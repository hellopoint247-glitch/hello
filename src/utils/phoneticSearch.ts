/**
 * Utility for phonetic search supporting both Bengali (Bangla) and English.
 * It allows searching for English names using Bangla text and vice versa.
 */

/**
 * Normalizes a Bengali character or vowel sign to its English/Latin phonetic equivalent.
 */
function getBengaliPhoneticChar(char: string): string {
  const mapping: { [key: string]: string } = {
    // Vowels (Independent)
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    // Vowels (Dependent/Kar)
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
    
    // Consonants
    'ক': 'k', 'খ': 'k', 'গ': 'g', 'ঘ': 'g', 'ঙ': 'ng',
    'চ': 'c', 'ছ': 'c', 'জ': 'j', 'ঝ': 'j', 'ঞ': 'n',
    'ট': 't', 'ঠ': 't', 'ড': 'd', 'ঢ': 'd', 'ণ': 'n',
    'ত': 't', 'থ': 't', 'দ': 'd', 'ধ': 'd', 'ন': 'n',
    'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'b', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 's', 'ষ': 's', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'r', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n'
  };
  return mapping[char] !== undefined ? mapping[char] : char;
}

/**
 * Transliterates a Bangla string into a simplified English representation.
 */
export function transliterateBanglaToEnglish(str: string): string {
  if (!str) return "";
  let result = "";
  const lower = str.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    result += getBengaliPhoneticChar(lower[i]);
  }
  return result;
}

/**
 * Generates a phonetic signature key for a word.
 * This key simplifies consonants and removes vowels, making it spelling-insensitive.
 * Works symmetrically for both native English strings and transliterated Bangla strings.
 */
export function getPhoneticKey(str: string): string {
  if (!str) return "";
  
  // First, convert any Bangla characters to English/Latin representation
  const transliterated = transliterateBanglaToEnglish(str);
  
  // Keep only alphanumeric characters and lowercase them
  let clean = transliterated.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  if (clean.length === 0) return "";

  // Normalize phonetic variations & simplify consonants:
  // - Double letters -> Single letter
  // - ph/f -> f
  // - sh/s -> s
  // - ch/c/q/k -> k
  // - gh/g -> g
  // - jh/j/z -> j
  // - th/t -> t
  // - dh/d -> d
  // - bh/b/v -> b
  clean = clean
    .replace(/([a-z0-9])\1+/g, "$1") // Simplify double characters (e.g. kk -> k, mm -> m)
    .replace(/ph/g, "f")
    .replace(/sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .replace(/jh/g, "j")
    .replace(/th/g, "t")
    .replace(/dh/g, "d")
    .replace(/bh/g, "b")
    .replace(/v/g, "b")
    .replace(/z/g, "j")
    .replace(/q/g, "k")
    .replace(/x/g, "ks");

  // Keep first letter, then strip all subsequent vowels (a, e, i, o, u, y, w, h)
  const firstLetter = clean[0];
  const rest = clean.slice(1);
  const withoutVowels = rest.replace(/[aeiouywh]/g, "");

  return firstLetter + withoutVowels;
}

function replaceBanglaDigits(str: string): string {
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[০-৯]/g, (char) => {
    const idx = banglaDigits.indexOf(char);
    return idx !== -1 ? String(idx) : char;
  });
}

/**
 * Matches a query string against a contact's name or phone.
 * Supports:
 * 1. Exact/Substring match in both English and Bangla.
 * 2. Mixed, multi-word English/Bangla cross-search phonetically.
 */
export function matchContactPhonetically(contactName: string, contactPhone: string, query: string): boolean {
  const q = replaceBanglaDigits(query.trim().toLowerCase());
  if (!q) return true;

  const nameLower = contactName.toLowerCase();
  const phoneClean = replaceBanglaDigits(contactPhone).replace(/\D/g, '');
  const queryClean = q.replace(/\D/g, '');

  // 1. If searching with a number, try to match phone
  if (queryClean && (phoneClean.includes(queryClean) || queryClean.includes(phoneClean))) {
    return true;
  }

  // 2. Direct string inclusion check (for fast, exact matching)
  if (nameLower.includes(q)) {
    return true;
  }

  // 3. Phonetic multi-word matching
  const queryWords = q.split(/\s+/).filter(Boolean);
  const nameWords = nameLower.split(/\s+/).filter(Boolean);

  if (queryWords.length === 0) return true;

  // Every word in the query must have a corresponding phonetical match in the contact's name words
  return queryWords.every(qw => {
    const qKey = getPhoneticKey(qw);
    if (!qKey) return false;

    return nameWords.some(nw => {
      const nKey = getPhoneticKey(nw);
      // Checks if the phonetic key of the query is a prefix or substring of the name word key
      return nKey.includes(qKey) || qKey.includes(nKey);
    });
  });
}
