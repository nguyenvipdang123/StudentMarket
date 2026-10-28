import type { Product } from "../api/types.ts";
import { checkoutSummary, type Delivery } from "./commerce.ts";
export type AccountSnapshot = { favorites: Product[]; cart: Product[] };
export const selectFavorites = (state: AccountSnapshot) => state.favorites;
export const selectCart = (state: AccountSnapshot) => state.cart;
export const selectSaved = (id: string) => (state: AccountSnapshot) => state.favorites.some(p => p.id === id);
export const selectCartCount = (state: AccountSnapshot) => state.cart.length;
export const selectCheckout = (delivery: Delivery) => (state: AccountSnapshot) => checkoutSummary(state.cart, delivery);
