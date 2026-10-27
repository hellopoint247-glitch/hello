/**
 * Utility functions for Bangladeshi phone number normalization and formatting.
 * Supports bKash, Nagad, Flexiload, Rocket, Upay and all Bangladeshi mobile numbers.
 */

/**
 * Normalizes any Bangladeshi phone number input:
 * - Converts Bengali numerals (০-৯) to standard English numerals (0-9).
 * - Strips all non-numeric characters (spaces, dashes, parentheses, +, commas, dots, etc.).
 * - Strips country code variants: +088, +88, +880, 088, 880, 00880, 0088, 88.
 * - Handles missing leading 0 if 10 digits starting with 1 (e.g. 17xxxxxxxx -> 017xxxxxxxx).
 * - Extracts valid 11-digit Bangladeshi mobile number starting with 01[3-9] if embedded in text.
 * - Truncates to standard 11 digits maximum (e.g. 017XXXXXXXX).
 */
export function normalizeBdPhoneNumber(raw: string): string {
  if (!raw) return '';

  // 1. Convert Bengali numerals (০-৯) to 0-9
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let text = String(raw).replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));

  // 2. Extract digits only
  let digits = text.replace(/\D/g, '');
  if (!digits) return '';

  // 3. Search for a complete 11-digit BD mobile number (013, 014, 015, 016, 017, 018, 019...)
  // Handles numbers prefixed with +088, 088, +880, 880, 00880, or embedded in text
  const bdMobileRegex = /01[3-9]\d{8}/;
  const match = digits.match(bdMobileRegex);
  if (match) {
    return match[0];
  }

  // 4. Strip common prefixes if not caught by regex
  // E.g. "+088 1712345678" -> digits "0881712345678" -> missing 0 after 088
  if (digits.startsWith('00880')) {
    digits = digits.slice(4); // leaves '0' + remaining
  } else if (digits.startsWith('0088')) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('0880')) {
    digits = digits.slice(3); // leaves '0' + remaining
  } else if (digits.startsWith('088')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('880')) {
    digits = digits.slice(2); // leaves '0' + remaining
  } else if (digits.startsWith('88') && digits.length > 10) {
    digits = digits.slice(2);
    if (digits.startsWith('1')) {
      digits = '0' + digits;
    }
  }

  // 5. If 10 digits starting with 1 (e.g. 1712345678 -> 01712345678)
  if (digits.length === 10 && digits.startsWith('1')) {
    digits = '0' + digits;
  }

  // 6. Check again if 11 digits match BD mobile pattern
  const secondMatch = digits.match(bdMobileRegex);
  if (secondMatch) {
    return secondMatch[0];
  }

  // 7. Cap at 11 digits
  return digits.slice(0, 11);
}

/**
 * Checks if a string is a valid 11-digit Bangladeshi mobile number
 * (Starts with 01 followed by 3-9 and 8 more digits)
 */
export function isValidBdPhoneNumber(phone: string): boolean {
  const clean = normalizeBdPhoneNumber(phone);
  return /^01[3-9]\d{8}$/.test(clean);
}

/**
 * Formats a phone number for display with optional Bengali digits
 */
export function formatBdPhoneDisplay(phone: string, useBengali = false): string {
  const clean = normalizeBdPhoneNumber(phone);
  if (!clean) return phone;
  if (!useBengali) return clean;
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return clean.replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
}
