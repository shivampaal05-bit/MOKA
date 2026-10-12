-- QueueBite v4 — PostgreSQL schema (target source of truth). Tested on PostgreSQL 16.
-- Conventions: every business row carries restaurant_id (single outlet today; cheap to keep, costly to add later).
-- Money is whole rupees (integer). Time is timestamptz. Status columns are enums so a typo cannot be stored.

BEGIN;

CREATE TYPE order_mode      AS ENUM ('PREORDER', 'DINE_IN', 'TAKEAWAY');
CREATE TYPE order_channel   AS ENUM ('WHATSAPP', 'CHATBOT', 'APP', 'WEB', 'QR', 'COUNTER');
CREATE TYPE payment_mode    AS ENUM ('PREPAID', 'COUNTER', 'TABLE_BILL');
CREATE TYPE order_status    AS ENUM ('PLACED','PAID','ACCEPTED','SCHEDULED','COOKING','ASSEMBLY','EXPO_CHECK','READY','HANDED_OVER','COMPLETED','CANCELLED','EXPIRED','NO_SHOW','FAILED','REFUND_PENDING','REFUNDED');
CREATE TYPE task_status     AS ENUM ('PLANNED','READY','RELEASED','COOKING','PAUSED','DONE','BLOCKED','CANCELLED','FAILED');
CREATE TYPE ledger_type     AS ENUM ('RESERVE','RELEASE','CONSUME','WASTE','RECEIPT','ADJUST');
CREATE TYPE notify_channel  AS ENUM ('WHATSAPP','SMS','PUSH');
CREATE TYPE staff_role      AS ENUM ('cook','expo','cashier','waiter','manager','owner');

-- ---------- tenancy and people ----------
CREATE TABLE restaurants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  timezone    text NOT NULL DEFAULT 'Asia/Kolkata',
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,      -- scheduler constants (see packages/core SETTINGS)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  name           text NOT NULL,
  role           staff_role NOT NULL,
  pin_hash       text NOT NULL,                         -- never store the PIN itself
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  name           text NOT NULL,
  phone_hash     text NOT NULL,                         -- lookup key (hash); the sendable number is encrypted
  phone_enc      bytea,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, phone_hash)
);

-- ---------- kitchen configuration ----------
CREATE TABLE stations (
  id             text NOT NULL,
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  name           text NOT NULL,
  PRIMARY KEY (restaurant_id, id)
);

CREATE TABLE resources (                                -- fryer basket 2, wok burner 1, a cook ...
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL,
  station_id     text NOT NULL,
  unit_no        int  NOT NULL CHECK (unit_no >= 0),
  state          text NOT NULL DEFAULT 'ONLINE' CHECK (state IN ('ONLINE','OFFLINE','MAINTENANCE')),
  UNIQUE (restaurant_id, station_id, unit_no),
  FOREIGN KEY (restaurant_id, station_id) REFERENCES stations(restaurant_id, id)
);

CREATE TABLE menu_items (
  id             text NOT NULL,
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  name           text NOT NULL,
  price          integer NOT NULL CHECK (price >= 0),
  station_id     text NOT NULL,
  cook_min       numeric(5,2) NOT NULL CHECK (cook_min >= 0),
  batch_cap      integer NOT NULL CHECK (batch_cap >= 1),
  hold_min       numeric(5,2) NOT NULL CHECK (hold_min >= 0),   -- food_quality_window
  active         boolean NOT NULL DEFAULT true,
  PRIMARY KEY (restaurant_id, id),
  FOREIGN KEY (restaurant_id, station_id) REFERENCES stations(restaurant_id, id)
);

CREATE TABLE ingredients (
  id             text NOT NULL,
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  name           text NOT NULL,
  unit           text NOT NULL,
  on_hand        numeric(12,3) NOT NULL DEFAULT 0,
  reserved       numeric(12,3) NOT NULL DEFAULT 0,
  reorder_level  numeric(12,3) NOT NULL DEFAULT 0,
  version        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, id),
  CONSTRAINT stock_never_negative CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand)
);

CREATE TABLE recipe_items (
  restaurant_id  uuid NOT NULL,
  menu_item_id   text NOT NULL,
  ingredient_id  text NOT NULL,
  qty            numeric(12,3) NOT NULL CHECK (qty > 0),
  is_pack        boolean NOT NULL DEFAULT false,        -- packaging: consumed at pack time, not for dine-in
  PRIMARY KEY (restaurant_id, menu_item_id, ingredient_id),
  FOREIGN KEY (restaurant_id, menu_item_id) REFERENCES menu_items(restaurant_id, id),
  FOREIGN KEY (restaurant_id, ingredient_id) REFERENCES ingredients(restaurant_id, id)
);

-- ---------- dine-in ----------
CREATE TABLE tables_ (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  label          text NOT NULL,
  UNIQUE (restaurant_id, label)
);
CREATE TABLE table_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  table_id       uuid NOT NULL REFERENCES tables_(id),
  opened_at      timestamptz NOT NULL DEFAULT now(),
  closed_at      timestamptz
);
CREATE UNIQUE INDEX one_open_session_per_table ON table_sessions(table_id) WHERE closed_at IS NULL;

-- ---------- orders ----------
CREATE TABLE orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id),
  business_day     date NOT NULL,
  token            text,                                  -- P-001 / T-001 / W-001 (issued at ACCEPTED)
  channel          order_channel NOT NULL,
  mode             order_mode NOT NULL,
  status           order_status NOT NULL DEFAULT 'PLACED',
  version          integer NOT NULL DEFAULT 1,            -- optimistic concurrency: every transition bumps it
  customer_id      uuid REFERENCES customers(id),
  customer_name    text NOT NULL,
  table_session_id uuid REFERENCES table_sessions(id),
  table_label      text,
  payment_mode     payment_mode NOT NULL,
  paid             boolean NOT NULL DEFAULT false,
  total            integer NOT NULL CHECK (total >= 0),
  slot_at          timestamptz,                           -- pre-order pickup slot
  deadline         timestamptz NOT NULL,
  promised_p50     timestamptz, promised_p80 timestamptz, promised_p90 timestamptz,
  planned_ready_at timestamptz, ready_at timestamptz, handed_over_at timestamptz,
  arrived          boolean NOT NULL DEFAULT false,
  leave_at         timestamptz,
  refund_state     text NOT NULL DEFAULT 'NONE' CHECK (refund_state IN ('NONE','REFUND_PENDING','REFUNDED')),
  refund_amount    integer NOT NULL DEFAULT 0,
  cancel_reason    text,
  hold_expires_at  timestamptz,
  access_key       text NOT NULL,                         -- unguessable key in the customer's tracking link
  idempotency_key  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  accepted_at      timestamptz,
  UNIQUE (restaurant_id, idempotency_key),
  CONSTRAINT token_unique_per_day UNIQUE (restaurant_id, business_day, token)
);
CREATE INDEX orders_active ON orders(restaurant_id, status)
  WHERE status NOT IN ('COMPLETED','CANCELLED','EXPIRED','NO_SHOW','FAILED','REFUNDED');

CREATE TABLE order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL,
  menu_item_id   text NOT NULL,
  name           text NOT NULL,                           -- snapshot at order time
  qty            integer NOT NULL CHECK (qty BETWEEN 1 AND 20),
  price          integer NOT NULL CHECK (price >= 0),     -- price comes from the menu, never from the client
  FOREIGN KEY (restaurant_id, menu_item_id) REFERENCES menu_items(restaurant_id, id)
);
CREATE INDEX order_items_order ON order_items(order_id);

CREATE TABLE payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES orders(id),
  provider           text NOT NULL,
  provider_event_id  text NOT NULL,
  amount             integer NOT NULL,
  status             text NOT NULL,
  raw                jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)                    -- duplicate webhook = unique violation = no effect
);

-- ---------- kitchen tasks ----------
CREATE TABLE batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL,
  menu_item_id   text NOT NULL,
  resource_id    uuid REFERENCES resources(id),
  planned_start  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL,
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id    uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,   -- identity is never merged by a batch
  menu_item_id     text NOT NULL,
  station_id       text NOT NULL,
  resource_id      uuid REFERENCES resources(id),
  batch_id         uuid REFERENCES batches(id),
  status           task_status NOT NULL DEFAULT 'PLANNED',
  priority         integer NOT NULL DEFAULT 0,
  planned_start    timestamptz, planned_finish timestamptz,
  actual_start     timestamptz, actual_finish  timestamptz,
  replacement_of   uuid REFERENCES tasks(id),
  version          integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_board ON tasks(restaurant_id, station_id, status)
  WHERE status IN ('PLANNED','READY','RELEASED','COOKING','BLOCKED');
CREATE INDEX tasks_order ON tasks(order_id);

CREATE TABLE task_dependencies (
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on),
  CHECK (task_id <> depends_on)
);

-- ---------- stock ledger and reservations ----------
CREATE TABLE stock_ledger (
  id             bigserial PRIMARY KEY,
  restaurant_id  uuid NOT NULL,
  ingredient_id  text NOT NULL,
  type           ledger_type NOT NULL,
  qty            numeric(12,3) NOT NULL,
  ref            text,                                    -- order id / task id
  note           text,
  at             timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (restaurant_id, ingredient_id) REFERENCES ingredients(restaurant_id, id)
);
CREATE INDEX stock_ledger_item ON stock_ledger(restaurant_id, ingredient_id, id DESC);

CREATE TABLE stock_reservations (
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL,
  ingredient_id  text NOT NULL,
  qty            numeric(12,3) NOT NULL CHECK (qty > 0),
  expires_at     timestamptz,
  PRIMARY KEY (order_id, ingredient_id),
  FOREIGN KEY (restaurant_id, ingredient_id) REFERENCES ingredients(restaurant_id, id)
);

-- ---------- reliability, audit and tracking ----------
CREATE TABLE order_events (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id),
  type        text NOT NULL,
  version     integer NOT NULL,
  data        jsonb,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order ON order_events(order_id, id);

CREATE TABLE outbox (                                      -- written in the same transaction as the change it announces
  id            bigserial PRIMARY KEY,
  event_id      bigint NOT NULL REFERENCES order_events(id),
  published_at  timestamptz
);
CREATE INDEX outbox_unpublished ON outbox(id) WHERE published_at IS NULL;

CREATE TABLE notifications (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id),
  event       text NOT NULL,
  channel     notify_channel NOT NULL,
  status      text NOT NULL,
  body        text NOT NULL,
  animation   text,
  dedupe_key  text NOT NULL UNIQUE,                       -- a duplicate insert means "already sent"
  at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE handover_records (
  order_id    uuid PRIMARY KEY REFERENCES orders(id),     -- one handover per order
  by_user     uuid REFERENCES staff_users(id),
  proof       text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE eta_snapshots (
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id),
  p50         timestamptz NOT NULL, p80 timestamptz NOT NULL, p90 timestamptz NOT NULL,
  confidence  text NOT NULL DEFAULT 'HIGH',
  at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE locations (                                   -- opt-in, rounded, deleted after expires_at
  id          bigserial PRIMARY KEY,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  lat_round   numeric(8,3) NOT NULL, lng_round numeric(8,3) NOT NULL,
  accuracy_m  integer, at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE TABLE scheduler_runs (
  id            bigserial PRIMARY KEY,
  restaurant_id uuid NOT NULL, policy text NOT NULL, ms integer NOT NULL,
  safe_mode     boolean NOT NULL DEFAULT false, decisions jsonb, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE manager_overrides (
  id bigserial PRIMARY KEY, restaurant_id uuid NOT NULL, user_id uuid REFERENCES staff_users(id),
  action text NOT NULL, order_id uuid REFERENCES orders(id), reason text, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY, restaurant_id uuid NOT NULL, user_id uuid REFERENCES staff_users(id),
  entity text NOT NULL, entity_id text NOT NULL, action text NOT NULL, before jsonb, after jsonb, at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
