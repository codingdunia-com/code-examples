export interface Money {
  amountMinor: number;
  currency: 'EUR' | 'PLN' | 'USD';
}

export function add(left: Money, right: Money): Money {
  if (left.currency !== right.currency) {
    throw new Error(`Refusing to add ${left.currency} to ${right.currency}`);
  }
  return { amountMinor: left.amountMinor + right.amountMinor, currency: left.currency };
}

export function format(money: Money): string {
  const major = (money.amountMinor / 100).toFixed(2);
  return `${major} ${money.currency}`;
}
