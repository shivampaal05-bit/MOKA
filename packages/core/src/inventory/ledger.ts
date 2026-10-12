import { DomainError, type Clock, type Ingredient, type LedgerEntry, type LedgerType, type MenuItem } from '../types.ts';
export type Needs = Map<string, number>;
/** Recipe/BOM expansion. Dine-in plates skip packaging lines. */
export function needsFor(menu: Map<string, MenuItem>, lines: { menuItemId: string; qty: number }[], packaging: boolean): Needs {
  const n: Needs = new Map();
  for (const l of lines) { const m = menu.get(l.menuItemId); if (!m) throw new DomainError('UNKNOWN_ITEM', `Unknown item ${l.menuItemId}`, 400);
    for (const r of m.recipe) { if (r.pack && !packaging) continue; n.set(r.ingredient, (n.get(r.ingredient) ?? 0) + r.qty * l.qty); } }
  return n;
}
/** Stock with an append-only ledger. Reserve is all-or-nothing (the SQL equivalent is a conditional UPDATE, see db/migrations). */
export class Inventory {
  items = new Map<string, Ingredient>(); ledger: LedgerEntry[] = []; private seq = 0;
  private clock: Clock;
  constructor(seed: Ingredient[], clock: Clock) { this.clock = clock; for (const i of seed) this.items.set(i.id, { ...i }); }
  available(id: string) { const i = this.items.get(id); return i ? i.onHand - i.reserved : 0; }
  private log(ingredient: string, type: LedgerType, qty: number, ref?: string, note?: string) { this.ledger.push({ id: ++this.seq, at: this.clock.now(), ingredient, type, qty, ref, note }); }
  reserve(needs: Needs, ref: string) {
    const ids = [...needs.keys()].sort(); // consistent lock order
    const short: Record<string, { need: number; available: number }> = {};
    for (const id of ids) { const need = needs.get(id)!; const av = this.available(id); if (av < need) short[id] = { need, available: av }; }
    if (Object.keys(short).length) throw new DomainError('STOCK_SHORT', 'Not enough stock for this order', 422, { short });
    for (const id of ids) { const q = needs.get(id)!; this.items.get(id)!.reserved += q; this.log(id, 'RESERVE', q, ref); }
  }
  release(needs: Needs, ref: string) { for (const [id, q] of needs) { const i = this.items.get(id)!; i.reserved = Math.max(0, i.reserved - q); this.log(id, 'RELEASE', q, ref); } }
  consume(needs: Needs, ref: string) { for (const [id, q] of needs) { const i = this.items.get(id)!; i.reserved = Math.max(0, i.reserved - q); i.onHand = Math.max(0, i.onHand - q); this.log(id, 'CONSUME', q, ref); } }
  waste(id: string, qty: number, ref: string, note: string) { const i = this.items.get(id); if (!i) throw new DomainError('UNKNOWN_INGREDIENT', id, 400); this.log(id, 'WASTE', qty, ref, note); }
  receipt(id: string, qty: number, note = 'purchase received') { const i = this.items.get(id); if (!i) throw new DomainError('UNKNOWN_INGREDIENT', id, 400); if (qty <= 0) throw new DomainError('BAD_QTY', 'qty must be > 0', 400); i.onHand += qty; this.log(id, 'RECEIPT', qty, undefined, note); }
  adjust(id: string, counted: number, note = 'physical count') { const i = this.items.get(id); if (!i) throw new DomainError('UNKNOWN_INGREDIENT', id, 400); const diff = counted - i.onHand; i.onHand = counted; this.log(id, 'ADJUST', diff, undefined, note); return diff; }
  /** How many portions of a menu item can still be promised. */
  portionsLeft(m: MenuItem, packaging = true) { let best = Infinity; for (const r of m.recipe) { if (r.pack && !packaging) continue; best = Math.min(best, Math.floor(this.available(r.ingredient) / r.qty)); } return best === Infinity ? 0 : best; }
  status(id: string): 'OK' | 'LOW_SOON' | 'ORDER_NOW' | 'FINISHED' { const i = this.items.get(id)!; const a = i.onHand - i.reserved; if (a <= 0) return 'FINISHED'; if (a <= i.reorderLevel * 0.5) return 'ORDER_NOW'; if (a <= i.reorderLevel) return 'LOW_SOON'; return 'OK'; }
  snapshot() { return { items: [...this.items.values()], ledger: this.ledger, seq: this.seq }; }
  restore(s: { items: Ingredient[]; ledger: LedgerEntry[]; seq: number }) { this.items = new Map(s.items.map(i => [i.id, i])); this.ledger = s.ledger; this.seq = s.seq; }
}
