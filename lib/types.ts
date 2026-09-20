export type Variant = {
  id: string; sku: string; size: string; flavour: string;
  priceMinor: number; availableQuantity: number; version: number;
};
export type Product = {
  id: string; name: string; brand: string; description: string; image: string;
  currency: string; maxPerOrder: number; variants: Variant[]; inventoryAsOf: string;
};
export type CartItem = { variantId: string; quantity: number };
export type Order = {
  id: string; orderNumber: string; status: string; createdAt: string;
  subtotalMinor: number; shippingMinor: number; totalMinor: number; currency: string;
  items: { variantId: string; sku: string; productName: string; size: string; flavour: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }[];
};
export const money = (amountMinor: number) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(amountMinor / 100);
