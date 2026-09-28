const CENTS_PER_DOLLAR = 100;

export function dollarsToCents(value: string) {
  const normalized = value.trim();

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Money values must use whole dollars or two decimal places.');
  }

  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [dollars, cents = ''] = unsigned.split('.');
  const amount = Number(dollars) * CENTS_PER_DOLLAR + Number((cents + '00').slice(0, 2));

  if (!Number.isSafeInteger(amount)) {
    throw new Error('Money value exceeds safe integer storage.');
  }

  return negative ? -amount : amount;
}

export function centsToDollars(cents: number) {
  if (!Number.isSafeInteger(cents)) {
    throw new Error('Cent value must be a safe integer.');
  }

  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const dollars = absolute / CENTS_PER_DOLLAR;
  const remainder = absolute % CENTS_PER_DOLLAR;

  return `${negative ? '-' : ''}${Math.trunc(dollars).toString()}.${remainder
    .toString()
    .padStart(2, '0')}`;
}

export function marginBps(sellPriceCents: number, directCostCents: number) {
  if (sellPriceCents <= 0) return null;
  return Math.round(((sellPriceCents - directCostCents) * 10000) / sellPriceCents);
}

export function markupBps(sellPriceCents: number, directCostCents: number) {
  if (directCostCents <= 0) return null;
  return Math.round(((sellPriceCents - directCostCents) * 10000) / directCostCents);
}
