export const supportedCurrencies = [
  'AED', 'ARS', 'AUD', 'BDT', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'COP', 'CZK',
  'DKK', 'EGP', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'JPY', 'KES',
  'KRW', 'KWD', 'LKR', 'MAD', 'MXN', 'MYR', 'NGN', 'NOK', 'NPR', 'NZD', 'PHP',
  'PKR', 'PLN', 'QAR', 'RON', 'SAR', 'SEK', 'SGD', 'THB', 'TRY', 'TWD', 'TZS',
  'UAH', 'UGX', 'USD', 'VND', 'ZAR',
] as const;

export type CurrencyCode = typeof supportedCurrencies[number];
const storageKey = 'bizpilot-currency';

export function getBusinessCurrencyCode(): CurrencyCode {
  try {
    const value = window.localStorage.getItem(storageKey);
    if (value && (supportedCurrencies as readonly string[]).includes(value)) return value as CurrencyCode;
  } catch { /* Use the default when browser storage is unavailable. */ }
  return 'INR';
}

export function setBusinessCurrencyCode(value: CurrencyCode) {
  try { window.localStorage.setItem(storageKey, value); } catch { /* The active app state still keeps this setting. */ }
}

export function currencyName(code: CurrencyCode, locale?: string) {
  try { return new Intl.DisplayNames(locale, { type: 'currency' }).of(code) ?? code; }
  catch { return code; }
}

export function formatCurrency(amount: number, maximumFractionDigits = 2, requestedCode: string = getBusinessCurrencyCode()) {
  const code = (supportedCurrencies as readonly string[]).includes(requestedCode) ? requestedCode : 'INR';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits }).format(Number.isFinite(amount) ? amount : 0);
}
