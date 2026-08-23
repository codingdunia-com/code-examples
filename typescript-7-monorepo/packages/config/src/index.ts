export interface AppConfig {
  locale: string;
  defaultCurrency: 'EUR' | 'PLN' | 'USD';
  showCents: boolean;
}

export const defaultConfig: AppConfig = {
  locale: 'en-US',
  defaultCurrency: 'EUR',
  showCents: true,
};
