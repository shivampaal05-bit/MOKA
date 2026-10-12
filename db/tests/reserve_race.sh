#!/usr/bin/env bash
# Proves atomic reservation on a real PostgreSQL: two sessions race for the last 3 buns (each wants 2).
# Usage: DATABASE_URL=postgres://... db/tests/reserve_race.sh   (database must be EMPTY; the script loads schema + seed)
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to an empty database}"
cd "$(dirname "$0")/.."
P=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -At)
for f in migrations/*.sql seed/seed.sql; do "${P[@]}" -f "$f"; done
R=00000000-0000-0000-0000-000000000001
"${P[@]}" -c "UPDATE ingredients SET on_hand = 3 WHERE id = 'bun';"
for n in 1 2; do "${P[@]}" -c "INSERT INTO orders(id, restaurant_id, business_day, channel, mode, customer_name, payment_mode, total, deadline, access_key)
  VALUES ('0000000$n-0000-0000-0000-000000000000', '$R', current_date, 'WEB', 'TAKEAWAY', 'race$n', 'COUNTER', 198, now(), 'k$n');"; done
# session 1 reserves 2 and keeps its transaction open for 2 seconds; session 2 starts meanwhile and must wait on the row lock
( "${P[@]}" -c "BEGIN; SELECT reserve_stock('$R','bun',2,'00000001-0000-0000-0000-000000000000'); SELECT pg_sleep(2); COMMIT;" >/tmp/qb_s1.out 2>&1 && echo S1_OK || echo S1_FAIL ) > /tmp/qb_r1 &
sleep 0.5
( "${P[@]}" -c "BEGIN; SELECT reserve_stock('$R','bun',2,'00000002-0000-0000-0000-000000000000'); COMMIT;" >/tmp/qb_s2.out 2>&1 && echo S2_OK || echo S2_FAIL ) > /tmp/qb_r2 &
wait
r1=$(cat /tmp/qb_r1); r2=$(cat /tmp/qb_r2); echo "session 1: $r1   session 2: $r2"
reserved=$("${P[@]}" -c "SELECT reserved FROM ingredients WHERE id='bun';")
rows=$("${P[@]}" -c "SELECT count(*) FROM stock_reservations WHERE ingredient_id='bun';")
echo "bun reserved = $reserved, reservation rows = $rows"
grep -q STOCK_SHORT /tmp/qb_s2.out && echo "loser error: $(grep -o 'STOCK_SHORT[^\"]*' /tmp/qb_s2.out | head -1)"
if [[ "$r1" == S1_OK && "$r2" == S2_FAIL && "$reserved" == 2.000 && "$rows" == 1 ]]; then echo "PASS: exactly one order got the buns, nothing oversold"; else echo "FAIL"; exit 1; fi
