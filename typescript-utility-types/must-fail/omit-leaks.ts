// Omit really removes the key, it does not merely hide it.
import { type PublicProduct } from '../src/pick-omit.js';

export function leak(product: PublicProduct): Date {
  return product.createdAt;
}
