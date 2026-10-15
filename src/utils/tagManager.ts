/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction } from '../types';
import { safeLocalStorage as localStorage } from './safeStorage';

// 1 month defined as 30 days in milliseconds
export const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export const TAG_METADATA_KEY = 'hellopoint_tag_metadata';
export const CUSTOM_CATEGORIES_KEY = 'hellopoint_custom_categories';
export const FAVORITE_TAGS_KEY = 'hellopoint_favorite_tags';
export const TAG_OVERRIDES_KEY = 'hellopoint_tag_category_overrides';
export const RECENT_USAGE_KEY = 'hellopoint_tag_recent_usage';

export interface TagMetadataItem {
  createdAt: number; // timestamp in ms when tag was first added/recorded
  lastUsedAt: number; // timestamp in ms when tag was last used (in a tx note or clicked/selected)
}

export type TagMetadataMap = Record<string, TagMetadataItem>;

// Rule 1: Helper to check if a tag is written in English (contains any Latin letters [a-zA-Z])
export const isEnglishTag = (str: string): boolean => {
  if (!str) return false;
  return /[a-zA-Z]/.test(str);
};

// Helper function to convert Bengali digits (০-৯) to English digits (0-9)
export const convertBengaliDigitsToEnglish = (str: string): string => {
  if (!str) return str;
  const banglaToEnglishMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return str.replace(/[০-৯]/g, (w) => banglaToEnglishMap[w] || w);
};

// Helper to determine if a string is pure numeric / phone number / code (should not be saved or shown as tag/category)
export const isNumericOrPhoneTag = (str: string): boolean => {
  if (!str) return true;
  const trimmed = str.trim();
  if (!trimmed) return true;
  const english = convertBengaliDigitsToEnglish(trimmed);
  // Phone number (e.g. 017..., +8801..., 8801...)
  if (/^(\+?88)?01[0-9]{9}$/.test(english.replace(/[\s\-\(\)]/g, ''))) return true;
  // If it has digits and only digits/formatting symbols (no Bengali or Latin alphabetical characters)
  const nonSymbolAlpha = english.replace(/[0-9\s\-\+\#\*\:\.\,\/\(\)\_\;]/g, '');
  const digitsOnly = english.replace(/[^0-9]/g, '');
  if (digitsOnly.length > 0 && nonSymbolAlpha.length === 0) return true;
  return false;
};

// Rule 1: A valid tag for the tag section MUST:
// - Not be empty
// - Not contain comma (,) or Bengali daari (।)
// - Not be pure numeric / phone number
// - Not be written in English (no Latin alphabets [a-zA-Z])
export const isValidTagForSection = (tag: string): boolean => {
  if (!tag) return false;
  const trimmed = tag.trim();
  if (!trimmed) return false;
  if (trimmed.includes(',') || trimmed.includes('।')) return false;
  if (isNumericOrPhoneTag(trimmed)) return false;
  if (isEnglishTag(trimmed)) return false;
  return true;
};

// Check if a tag was used in a transaction note
export const isTagUsedInNote = (tag: string, note: string): boolean => {
  if (!tag || !note) return false;
  const cleanTag = tag.trim().toLowerCase();
  const cleanNote = note.trim().toLowerCase();
  if (cleanTag === cleanNote) return true;
  const segments = cleanNote.split(/[,।;\n]+/).map(s => s.trim());
  return segments.includes(cleanTag);
};

// Load tag metadata from storage
export const loadTagMetadata = (): TagMetadataMap => {
  try {
    const raw = localStorage.getItem(TAG_METADATA_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

// Save tag metadata to storage
export const saveTagMetadata = (meta: TagMetadataMap): void => {
  try {
    localStorage.setItem(TAG_METADATA_KEY, JSON.stringify(meta));
  } catch (e) {
    console.error('Failed to save tag metadata:', e);
  }
};

// Record usage of a tag (updates lastUsedAt, sets createdAt if missing)
export const touchTagUsage = (tag: string, timestamp: number = Date.now()): TagMetadataMap => {
  const clean = tag.trim();
  if (!isValidTagForSection(clean)) return loadTagMetadata();
  const meta = loadTagMetadata();
  const existing = meta[clean];
  meta[clean] = {
    createdAt: existing?.createdAt || timestamp,
    lastUsedAt: Math.max(existing?.lastUsedAt || 0, timestamp)
  };
  saveTagMetadata(meta);
  return meta;
};

// Rule 2 & Rule 1:
// 1. Remove all tags written in English.
// 2. Remove all tags that are at least 1 month (30 days) old AND have not been used in the last 1 month (30 days).
export function pruneTags(
  currentCategories: string[],
  transactions: Transaction[],
  now: number = Date.now()
): {
  prunedCategories: string[];
  deletedTags: string[];
  updatedMetadata: TagMetadataMap;
} {
  const meta = loadTagMetadata();
  const deletedTags: string[] = [];
  const keptCategories: string[] = [];

  // Index transaction usage per tag
  const tagTxUsage: Record<string, { latest: number; earliest: number }> = {};
  for (const tx of transactions) {
    if (!tx.note) continue;
    const txTime = new Date(tx.createdAt || tx.date).getTime();
    if (isNaN(txTime)) continue;

    const segments = tx.note.split(/[,।;\n]+/).map(s => s.trim()).filter(Boolean);
    for (const seg of segments) {
      if (!tagTxUsage[seg]) {
        tagTxUsage[seg] = { latest: txTime, earliest: txTime };
      } else {
        if (txTime > tagTxUsage[seg].latest) tagTxUsage[seg].latest = txTime;
        if (txTime < tagTxUsage[seg].earliest) tagTxUsage[seg].earliest = txTime;
      }
    }
  }

  // Iterate over all candidate categories
  for (const cat of currentCategories) {
    const trimmed = cat.trim();
    if (!trimmed) continue;

    // Rule 1: Any tag written in English or numeric must be removed immediately
    if (isEnglishTag(trimmed) || isNumericOrPhoneTag(trimmed)) {
      deletedTags.push(trimmed);
      delete meta[trimmed];
      continue;
    }

    // Determine createdAt and lastUsedAt
    const txInfo = tagTxUsage[trimmed];
    const existingMeta = meta[trimmed];

    let createdAt: number;
    let lastUsedAt: number;

    if (txInfo) {
      // Used in transactions
      lastUsedAt = Math.max(existingMeta?.lastUsedAt || 0, txInfo.latest);
      createdAt = Math.min(existingMeta?.createdAt || txInfo.earliest, txInfo.earliest);
    } else if (existingMeta) {
      // Known in metadata but not in transactions
      createdAt = existingMeta.createdAt;
      lastUsedAt = existingMeta.lastUsedAt || existingMeta.createdAt;
    } else {
      // Brand new tag seen for the first time
      createdAt = now;
      lastUsedAt = now;
    }

    // Rule 2: Check if tag is 1 month old and unused in the last 1 month
    const isOneMonthOld = (now - createdAt) >= ONE_MONTH_MS;
    const isUnusedForOneMonth = (now - lastUsedAt) >= ONE_MONTH_MS;

    if (isOneMonthOld && isUnusedForOneMonth) {
      // 1 month old and unused -> automatically delete!
      deletedTags.push(trimmed);
      delete meta[trimmed];
    } else {
      keptCategories.push(trimmed);
      meta[trimmed] = { createdAt, lastUsedAt };
    }
  }

  // Clean any lingering entries in meta that are English or older than 1 month and unused
  Object.keys(meta).forEach(key => {
    if (isEnglishTag(key) || isNumericOrPhoneTag(key)) {
      delete meta[key];
    } else {
      const item = meta[key];
      if ((now - item.createdAt >= ONE_MONTH_MS) && (now - item.lastUsedAt >= ONE_MONTH_MS)) {
        if (!deletedTags.includes(key)) deletedTags.push(key);
        delete meta[key];
      }
    }
  });

  saveTagMetadata(meta);

  // Synchronize local storage lists to remove deleted tags
  try {
    // Favorite tags
    const favRaw = localStorage.getItem(FAVORITE_TAGS_KEY);
    if (favRaw) {
      const favList: string[] = JSON.parse(favRaw);
      const cleanFav = favList.filter(t => !deletedTags.includes(t) && !isEnglishTag(t) && !isNumericOrPhoneTag(t));
      if (cleanFav.length !== favList.length) {
        localStorage.setItem(FAVORITE_TAGS_KEY, JSON.stringify(cleanFav));
      }
    }

    // Overrides
    const overRaw = localStorage.getItem(TAG_OVERRIDES_KEY);
    if (overRaw) {
      const overMap: Record<string, string> = JSON.parse(overRaw);
      let changed = false;
      deletedTags.forEach(t => {
        if (overMap[t]) {
          delete overMap[t];
          changed = true;
        }
      });
      Object.keys(overMap).forEach(k => {
        if (isEnglishTag(k) || isNumericOrPhoneTag(k)) {
          delete overMap[k];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(TAG_OVERRIDES_KEY, JSON.stringify(overMap));
      }
    }

    // Recent usage
    const recRaw = localStorage.getItem(RECENT_USAGE_KEY);
    if (recRaw) {
      const recList: string[] = JSON.parse(recRaw);
      const cleanRec = recList.filter(t => !deletedTags.includes(t) && !isEnglishTag(t) && !isNumericOrPhoneTag(t));
      if (cleanRec.length !== recList.length) {
        localStorage.setItem(RECENT_USAGE_KEY, JSON.stringify(cleanRec));
      }
    }

    // Save custom categories
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(keptCategories));
  } catch (err) {
    console.error('Error synchronizing local storage after tag prune:', err);
  }

  return {
    prunedCategories: keptCategories,
    deletedTags,
    updatedMetadata: meta
  };
}
