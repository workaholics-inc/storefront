const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;

export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(
      code >= PERSIAN_ZERO ? code - PERSIAN_ZERO : code - ARABIC_INDIC_ZERO,
    );
  });
}
