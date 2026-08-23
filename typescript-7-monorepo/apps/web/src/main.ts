import { add } from '@repo/core';
import { defaultConfig } from '@repo/config';
import { priceLabel } from '@repo/ui';

const basket = add(
  { amountMinor: 1299, currency: 'EUR' },
  { amountMinor: 450, currency: 'EUR' },
);

export const label = priceLabel(basket, defaultConfig);
export const roundedLabel = priceLabel(basket, { ...defaultConfig, showCents: false });
