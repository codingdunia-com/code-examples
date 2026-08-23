import { format, type Money } from '@repo/core';
import { type AppConfig } from '@repo/config';

export function priceLabel(money: Money, config: AppConfig): string {
  const text = format(money);
  if (config.showCents) {
    return text;
  }
  return text.replace(/\.\d\d /, ' ');
}
