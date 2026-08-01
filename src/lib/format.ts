import type { Lang } from "./i18n";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Convert ASCII digits inside a string to Bengali digits. */
export function toBnDigits(input: string) {
  return input.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/** Group a number with thousand separators, localized per language. */
export function formatNumber(n: number, lang: Lang = "bn") {
  const grouped = Math.round(n).toLocaleString("en-US");
  return lang === "bn" ? toBnDigits(grouped) : grouped;
}

/** Money in BDT, localized digits. */
export function formatMoney(n: number, lang: Lang = "bn") {
  return `৳ ${formatNumber(n, lang)}`;
}

/** Percentage value, localized digits. */
export function formatPercent(n: number, lang: Lang = "bn") {
  return `${formatNumber(n, lang)}%`;
}
