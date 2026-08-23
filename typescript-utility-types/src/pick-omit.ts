import { type Product } from './types.js';

// Only what the UI needs.
export type ProductCard = Pick<Product, 'id' | 'name' | 'price'>;

// Strip internal timestamps from the public API response.
export type PublicProduct = Omit<Product, 'createdAt' | 'updatedAt'>;

export function toCard(product: Product): ProductCard {
  return { id: product.id, name: product.name, price: product.price };
}

export function toPublic(product: Product): PublicProduct {
  const { createdAt, updatedAt, ...rest } = product;
  void createdAt;
  void updatedAt;
  return rest;
}
