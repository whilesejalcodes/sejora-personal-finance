export const DEFAULT_CURRENCY = "INR";

/**
 * Format a monetary amount in major currency units for display.
 * Financial storage uses minor units; callers convert at the data boundary
 * before passing major units here for display.
 */
export function formatCurrency(amount: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function currencySymbol(currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
}