import type { MenuItem, StationDef, Ingredient } from '../types.ts';
// Starting values. Replace with measured values from the real kitchen in week 1 (see docs/ASSUMPTIONS.md).
export const STATIONS: StationDef[] = [
  { id: 'grill', name: 'Grill', units: 2 }, { id: 'fryer', name: 'Fryer', units: 2 }, { id: 'wok', name: 'Wok', units: 2 },
  { id: 'bev', name: 'Beverage', units: 2 }, { id: 'cold', name: 'Cold / Chaat', units: 1 }, { id: 'pack', name: 'Pack & Expo', units: 2 },
];
export const MENU: MenuItem[] = [
  { id: 'burger', name: 'Burger', price: 99, station: 'grill', cookMin: 4, batchCap: 4, holdMin: 8, emoji: '🍔',
    recipe: [{ ingredient: 'bun', qty: 1 }, { ingredient: 'patty', qty: 1 }, { ingredient: 'cheese', qty: 1 }, { ingredient: 'sauce_g', qty: 20 }, { ingredient: 'burger_box', qty: 1, pack: true }] },
  { id: 'fries', name: 'French fries', price: 79, station: 'fryer', cookMin: 5, batchCap: 2, holdMin: 4, emoji: '🍟',
    recipe: [{ ingredient: 'potato_g', qty: 150 }, { ingredient: 'oil_ml', qty: 8 }, { ingredient: 'salt_g', qty: 1 }, { ingredient: 'fries_carton', qty: 1, pack: true }] },
  { id: 'chilli_potato', name: 'Chilli potato', price: 129, station: 'wok', cookMin: 6, batchCap: 2, holdMin: 10, emoji: '🌶️',
    recipe: [{ ingredient: 'potato_g', qty: 150 }, { ingredient: 'veg_g', qty: 30 }, { ingredient: 'sauce_g', qty: 25 }, { ingredient: 'oil_ml', qty: 10 }, { ingredient: 'container', qty: 1, pack: true }] },
  { id: 'chowmein', name: 'Chowmein (main course)', price: 139, station: 'wok', cookMin: 7, batchCap: 1, holdMin: 10, emoji: '🍜',
    recipe: [{ ingredient: 'noodles_g', qty: 200 }, { ingredient: 'veg_g', qty: 60 }, { ingredient: 'sauce_g', qty: 20 }, { ingredient: 'oil_ml', qty: 10 }, { ingredient: 'container', qty: 1, pack: true }] },
  { id: 'chaat', name: 'Chaat', price: 69, station: 'cold', cookMin: 3, batchCap: 2, holdMin: 15, emoji: '🥗',
    recipe: [{ ingredient: 'chaat_mix_g', qty: 80 }, { ingredient: 'curd_g', qty: 40 }, { ingredient: 'container', qty: 1, pack: true }] },
  { id: 'chai', name: 'Chai', price: 25, station: 'bev', cookMin: 4, batchCap: 4, holdMin: 15, emoji: '🍵',
    recipe: [{ ingredient: 'milk_ml', qty: 80 }, { ingredient: 'tea_g', qty: 3 }, { ingredient: 'sugar_g', qty: 8 }, { ingredient: 'cup', qty: 1, pack: true }, { ingredient: 'lid', qty: 1, pack: true }] },
  { id: 'coffee', name: 'Hot coffee', price: 60, station: 'bev', cookMin: 4, batchCap: 4, holdMin: 10, emoji: '☕',
    recipe: [{ ingredient: 'milk_ml', qty: 100 }, { ingredient: 'coffee_g', qty: 6 }, { ingredient: 'sugar_g', qty: 8 }, { ingredient: 'cup', qty: 1, pack: true }, { ingredient: 'lid', qty: 1, pack: true }] },
  { id: 'cold_drink', name: 'Cold drink', price: 40, station: 'bev', cookMin: 1, batchCap: 6, holdMin: 30, emoji: '🥤',
    recipe: [{ ingredient: 'cola_can', qty: 1 }] },
];
const ing = (id: string, name: string, unit: string, onHand: number, reorderLevel: number): Ingredient => ({ id, name, unit, onHand, reserved: 0, reorderLevel });
export const INGREDIENTS: Ingredient[] = [
  ing('bun', 'Burger bun', 'pc', 40, 10), ing('patty', 'Patty', 'pc', 40, 10), ing('cheese', 'Cheese slice', 'pc', 40, 10), ing('sauce_g', 'Sauce', 'g', 3000, 500),
  ing('potato_g', 'Potato', 'g', 12000, 2000), ing('oil_ml', 'Frying oil', 'ml', 4000, 800), ing('salt_g', 'Salt', 'g', 500, 100), ing('veg_g', 'Vegetables', 'g', 4000, 800),
  ing('noodles_g', 'Noodles', 'g', 4000, 800), ing('chaat_mix_g', 'Chaat mix', 'g', 2000, 400), ing('curd_g', 'Curd', 'g', 2000, 400),
  ing('milk_ml', 'Milk', 'ml', 6000, 1000), ing('tea_g', 'Tea', 'g', 300, 60), ing('coffee_g', 'Coffee', 'g', 300, 60), ing('sugar_g', 'Sugar', 'g', 1500, 300), ing('cola_can', 'Cold drink can', 'pc', 48, 12),
  ing('burger_box', 'Burger box', 'pc', 60, 15), ing('fries_carton', 'Fries carton', 'pc', 60, 15), ing('container', 'Container', 'pc', 60, 15), ing('cup', 'Cup', 'pc', 100, 20), ing('lid', 'Lid', 'pc', 100, 20),
];
export const SETTINGS = {
  packMin: 1, preorderBufferMin: 3, holdFactor: 0.25, batchWindowMin: 2, maxWaitMin: 30, preorderMaxAheadMin: 120,
  etaHysteresisMin: 3, maxDelayNotices: 2, paymentHoldMin: 10, noShowGraceMin: 20, readyUndoSec: 20, fairnessExtraMin: 2, slotStepMin: 5,
  weights: { TAKEAWAY: 2, DINE_IN: 1, PREORDER: 1, PREORDER_ARRIVED: 2 },
  // travel slow case: 2 min + 4 min per km (starting rule; replace with measured data)
  travelBaseMin: 2, travelPerKmMin: 4,
};
export type Settings = typeof SETTINGS;
