import type { PriceCurrency, PricingUnit, Professional } from '@/types';

const SYMBOL: Record<PriceCurrency, string> = { GBP: '£', USD: '$', EUR: '€' };

const UNIT_LABEL: Record<PricingUnit, string> = {
  per_hour: 'per hour',
  per_session: 'per session',
  per_project: 'per project',
  fixed: 'fixed',
};

function amount(value: number): string {
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatPriceRange(professional: Pick<Professional, 'price_min' | 'price_max' | 'currency' | 'pricing_unit'>): string | null {
  const { price_min: min, price_max: max, currency, pricing_unit: unit } = professional;
  if (min == null || max == null || !unit) return null;
  const symbol = SYMBOL[currency] ?? '';
  const prefix = symbol || `${currency} `;
  const range = min === max ? `${prefix}${amount(min)}` : `${prefix}${amount(min)}–${prefix}${amount(max)}`;
  return `${range} ${UNIT_LABEL[unit]}`;
}

export const PRICING_UNIT_OPTIONS: { value: PricingUnit; label: string }[] = [
  { value: 'per_hour', label: 'Per hour' },
  { value: 'per_session', label: 'Per session' },
  { value: 'per_project', label: 'Per project' },
  { value: 'fixed', label: 'Fixed' },
];

export const PRICE_CURRENCIES: PriceCurrency[] = ['GBP', 'USD', 'EUR'];
