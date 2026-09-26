export const COMMON_CATEGORIES = [
  "Food",
  "Shopping",
  "Transport",
  "Housing",
  "Bills & Utilities",
  "Education",
  "Health",
  "Entertainment",
  "Travel",
  "Gifts",
  "Investments",
  "Other / Miscellaneous",
] as const;

export const CUSTOM_CATEGORY_OPTION = "__custom_category__";

export const PAYMENT_METHODS = ["UPI", "Bank", "Card", "Cash"] as const;
export const OTHER_PAYMENT_METHOD_OPTION = "__other_payment_method__";

export const MERCHANT_SUGGESTIONS = [
  "Swiggy",
  "Zomato",
  "Amazon",
  "Flipkart",
  "Uber",
  "Ola",
  "Blinkit",
  "Zepto",
  "BigBasket",
  "Myntra",
  "Netflix",
  "Spotify",
] as const;

export function isCommonCategory(value: string): boolean {
  return (COMMON_CATEGORIES as readonly string[]).includes(value);
}