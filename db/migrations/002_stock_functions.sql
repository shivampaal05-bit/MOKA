-- Atomic stock operations. Each function is one statement-level decision made by the database under a row lock,
-- so two simultaneous orders for the last buns can never both succeed.
BEGIN;

-- Reserve: moves qty from "available" to "reserved" only if enough is available. Raises STOCK_SHORT otherwise
-- (the caller's transaction rolls back, so no half-created order remains).
CREATE OR REPLACE FUNCTION reserve_stock(p_restaurant uuid, p_ingredient text, p_qty numeric, p_order uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ingredients
     SET reserved = reserved + p_qty, version = version + 1
   WHERE restaurant_id = p_restaurant AND id = p_ingredient AND (on_hand - reserved) >= p_qty;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_SHORT: % (needs %)', p_ingredient, p_qty USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO stock_reservations(order_id, restaurant_id, ingredient_id, qty)
       VALUES (p_order, p_restaurant, p_ingredient, p_qty)
  ON CONFLICT (order_id, ingredient_id) DO UPDATE SET qty = stock_reservations.qty + excluded.qty;
  INSERT INTO stock_ledger(restaurant_id, ingredient_id, type, qty, ref) VALUES (p_restaurant, p_ingredient, 'RESERVE', p_qty, p_order::text);
END $$;

-- Release: undo a reservation (cancel before cooking, payment hold expired).
CREATE OR REPLACE FUNCTION release_stock(p_restaurant uuid, p_ingredient text, p_qty numeric, p_order uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ingredients SET reserved = reserved - p_qty, version = version + 1
   WHERE restaurant_id = p_restaurant AND id = p_ingredient AND reserved >= p_qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'RELEASE_EXCEEDS_RESERVED: %', p_ingredient USING ERRCODE = 'P0001'; END IF;
  UPDATE stock_reservations SET qty = qty - p_qty WHERE order_id = p_order AND ingredient_id = p_ingredient;
  DELETE FROM stock_reservations WHERE order_id = p_order AND ingredient_id = p_ingredient AND qty <= 0;
  INSERT INTO stock_ledger(restaurant_id, ingredient_id, type, qty, ref) VALUES (p_restaurant, p_ingredient, 'RELEASE', p_qty, p_order::text);
END $$;

-- Consume: the point of no return, called when a cook taps Start. Reserved stock becomes used stock.
CREATE OR REPLACE FUNCTION consume_stock(p_restaurant uuid, p_ingredient text, p_qty numeric, p_ref text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE ingredients SET on_hand = on_hand - p_qty, reserved = reserved - p_qty, version = version + 1
   WHERE restaurant_id = p_restaurant AND id = p_ingredient AND reserved >= p_qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONSUME_WITHOUT_RESERVATION: %', p_ingredient USING ERRCODE = 'P0001'; END IF;
  INSERT INTO stock_ledger(restaurant_id, ingredient_id, type, qty, ref) VALUES (p_restaurant, p_ingredient, 'CONSUME', p_qty, p_ref);
END $$;

-- Guarded order transition: only moves forward if the caller saw the current version (optimistic lock).
-- Returns the new version, or NULL when someone else changed the order first (caller reloads and retries).
CREATE OR REPLACE FUNCTION transition_order(p_order uuid, p_from order_status, p_to order_status, p_expected_version integer)
RETURNS integer LANGUAGE sql AS $$
  UPDATE orders SET status = p_to, version = version + 1
   WHERE id = p_order AND status = p_from AND version = p_expected_version
  RETURNING version;
$$;

COMMIT;
