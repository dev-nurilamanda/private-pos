import type { Product } from '../db/db';

export interface CartItem {
  id: string; // unique item identifier in cart
  productId?: number;
  productName: string;
  serverChannel: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  isPhysical: boolean;
  stock: number;
  outWalletId: string;
  notes?: string;
  product?: Product;
}
