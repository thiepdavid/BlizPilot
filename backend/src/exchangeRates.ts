type ExchangeRate = { base: string; quote: string; rate: number; date: string };
const cache = new Map<string, { value: ExchangeRate; expiresAt: number }>();
const cacheLifetimeMs = 12 * 60 * 60 * 1000;

function validCurrencyCode(value: string) {
  if (!/^[A-Z]{3}$/.test(value)) return false;
  try { new Intl.NumberFormat('en', { style: 'currency', currency: value }); return true; }
  catch { return false; }
}

export async function getExchangeRate(base: string, quote: string): Promise<ExchangeRate> {
  if (!validCurrencyCode(base) || !validCurrencyCode(quote)) throw new Error('Choose valid currency codes.');
  if (base === quote) return { base, quote, rate: 1, date: new Date().toISOString().slice(0, 10) };
  const key = `${base}:${quote}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/${quote.toLowerCase()}`, { signal: controller.signal });
    if (!response.ok) throw new Error('The exchange-rate service is unavailable.');
    const result = await response.json() as { base?: unknown; quote?: unknown; rate?: unknown; date?: unknown };
    if (typeof result.rate !== 'number' || !Number.isFinite(result.rate) || result.rate <= 0 || typeof result.date !== 'string') {
      throw new Error('No exchange rate is available for this currency pair.');
    }
    const value = { base, quote, rate: result.rate, date: result.date };
    cache.set(key, { value, expiresAt: Date.now() + cacheLifetimeMs });
    return value;
  } finally { clearTimeout(timeout); }
}
