/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { 
  X, 
  Trash2, 
  Share2, 
  Check, 
  Calendar, 
  Camera, 
  FileText, 
  PenTool, 
  ChevronRight, 
  Info,
  CalendarCheck2,
  Star,
  User,
  Hash,
  Tag,
  ChevronDown,
  Sparkles,
  Plus,
  ArrowLeftRight,
  Receipt,
  Search,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { Contact, Transaction } from '../types';
import { loadTransactions } from '../utils/storage';
import { db, auth, handleFirestoreError, OperationType } from '../utils/firebase';
import { doc, setDoc } from 'firebase/firestore';

// Helper function to convert Bengali digits (০-৯) to English digits (0-9)
const convertBengaliDigitsToEnglish = (str: string): string => {
  if (!str) return str;
  const banglaToEnglishMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return str.replace(/[০-৯]/g, (w) => banglaToEnglishMap[w] || w);
};

// Helper to sanitize numeric and general tags (removes spaces, dashes, symbols from number tags)
const sanitizeTagInput = (input: string, isNumberContext = false): string => {
  if (!input) return input;
  const english = convertBengaliDigitsToEnglish(input.trim());
  const hasDigits = /[0-9]/.test(english);
  const nonDigitSymbols = english.replace(/[0-9\s\-\+\(\)\.\,\/\#\:\;\_]/g, '');

  // If explicitly in number context, or if the string is made of digits + formatting symbols (spaces, dashes, etc.)
  if (isNumberContext || (hasDigits && nonDigitSymbols.length === 0)) {
    const digitsOnly = english.replace(/[^0-9]/g, '');
    if (digitsOnly.length > 0) {
      return digitsOnly;
    }
  }
  return input.trim();
};

// Component to render text with clean glass-themed highlight on matched substring/digits without breaking words or conjuncts
const HighlightedTagText: React.FC<{ text: string; query: string; digitsQuery?: string }> = ({ text, query, digitsQuery }) => {
  const cleanQ = query.trim().toLowerCase();
  const cleanDigits = digitsQuery?.trim() || '';

  if (cleanQ && text.toLowerCase().includes(cleanQ)) {
    const idx = text.toLowerCase().indexOf(cleanQ);
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + cleanQ.length);
    const after = text.slice(idx + cleanQ.length);
    return (
      <span className="whitespace-nowrap inline">
        <span>{before}</span>
        <mark className="bg-red-500/20 dark:bg-red-400/25 text-red-600 dark:text-red-400 rounded-xs px-0.5 font-semibold inline">
          {match}
        </mark>
        <span>{after}</span>
      </span>
    );
  }

  if (cleanDigits && cleanDigits.length >= 1) {
    const textEnglish = convertBengaliDigitsToEnglish(text);
    const digitsOnly = textEnglish.replace(/[^0-9]/g, '');
    if (digitsOnly.includes(cleanDigits)) {
      const idx = textEnglish.indexOf(cleanDigits);
      if (idx !== -1) {
        const before = text.slice(0, idx);
        const match = text.slice(idx, idx + cleanDigits.length);
        const after = text.slice(idx + cleanDigits.length);
        return (
          <span className="whitespace-nowrap inline">
            <span>{before}</span>
            <mark className="bg-red-500/20 dark:bg-red-400/25 text-red-600 dark:text-red-400 rounded-xs px-0.5 font-semibold inline">
              {match}
            </mark>
            <span>{after}</span>
          </span>
        );
      }
    }
  }

  return <span className="whitespace-nowrap inline">{text}</span>;
};

interface TransactionFormProps {
  contact: Contact;
  transaction?: Transaction; // empty if adding new
  isGaveMode: boolean; // default direction if adding new
  onBack: () => void;
  onSave: (data: {
    amount: number;
    type: 'GAVE' | 'GOT';
    note: string;
    billNo: string;
    date: string;
    attachFile?: string;
    signature?: string;
  }) => void;
  onDelete?: () => void; // only for edit mode
  currency: string;
  customCategories?: string[];
  deletedCategories?: string[];
  onSaveCategory?: (category: string) => void;
  onDeleteCategory?: (category: string) => void;
}

export function TransactionForm({
  contact,
  transaction,
  isGaveMode,
  onBack,
  onSave,
  onDelete,
  currency,
  customCategories,
  deletedCategories,
  onSaveCategory,
  onDeleteCategory
}: TransactionFormProps) {
  const [amount, setAmount] = useState<string>(transaction ? transaction.amount.toString() : '');
  const [note, setNote] = useState<string>(transaction ? transaction.note : '');
  const [billNo, setBillNo] = useState<string>(transaction ? transaction.billNo : '');
  const [error, setError] = useState<string>('');
  
  // Dynamic Transaction Type toggle state (GOT = Cash In / পেলাম, GAVE = Cash Out / দিলাম)
  const [currentType, setCurrentType] = useState<'GAVE' | 'GOT'>(() => {
    if (transaction) {
      return transaction.type;
    }
    return isGaveMode ? 'GAVE' : 'GOT';
  });

  const isGave = currentType === 'GAVE';

  // Date handle - default to current local time ISO
  const [date, setDate] = useState<string>(
    transaction ? new Date(transaction.date).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10)
  );
  
  // Attachment & Signature states
  const [attachFile, setAttachFile] = useState<string | undefined>(transaction?.attachFile);
  const [signature, setSignature] = useState<string | undefined>(transaction?.signature);
  const [isCopied, setIsCopied] = useState(false);
  const [isDrawSignatureOpen, setIsDrawSignatureOpen] = useState(false);

  const handleShareClick = () => {
    const text = `${contact.name}-এর হিসাব:\nটাকা: ${amount} ${currency}\nতারিখ: ${date}\nনোট: ${note}\nমেমো: ${billNo}\nসংরক্ষিত: মাইখাতা`;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      }).catch(() => {
        fallbackShareCopy(text);
      });
    } else {
      fallbackShareCopy(text);
    }
  };

  const fallbackShareCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      if (successful) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      }
      document.body.removeChild(textArea);
    } catch (err) {
      console.error("Fallback share copy failed", err);
    }
  };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Tag Favorite, Categorization & Usage Recency States
  const [favoriteTags, setFavoriteTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hellopoint_favorite_tags');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [tagOverrides, setTagOverrides] = useState<Record<string, 'person' | 'transaction' | 'expense' | 'number' | 'general'>>(() => {
    try {
      const saved = localStorage.getItem('hellopoint_tag_category_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Track most recently used tags across all filters to guarantee persistent filter recency
  const [recentUsageOrder, setRecentUsageOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hellopoint_tag_recent_usage');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Listen for storage events to keep favoriteTags, tagOverrides, and recentUsageOrder updated
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const savedFavs = localStorage.getItem('hellopoint_favorite_tags');
        if (savedFavs) {
          setFavoriteTags(JSON.parse(savedFavs));
        }
        const savedOverrides = localStorage.getItem('hellopoint_tag_category_overrides');
        if (savedOverrides) {
          setTagOverrides(JSON.parse(savedOverrides));
        }
        const savedUsage = localStorage.getItem('hellopoint_tag_recent_usage');
        if (savedUsage) {
          setRecentUsageOrder(JSON.parse(savedUsage));
        }
      } catch (e) {
        console.error('Error syncing tag categories from storage:', e);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Record a tag's usage to promote it to the top of its filter's recent list
  const recordTagUsage = (tagName: string) => {
    try {
      const trimmed = tagName.trim();
      if (!trimmed) return;
      const updated = [trimmed, ...recentUsageOrder.filter(t => t !== trimmed)];
      setRecentUsageOrder(updated);
      localStorage.setItem('hellopoint_tag_recent_usage', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error(e);
    }
  };

  // Load historical unique notes from props, fallback to calculated local list if not provided
  const getRecentNotes = () => {
    let savedCategories: string[] = customCategories ? [...customCategories] : [];
    let savedDeleted: string[] = deletedCategories ? [...deletedCategories] : [];

    if (!customCategories) {
      try {
        const defaultNotes = [
          'মালামাল কেনা বাবদ',
          'বকেয়া পরিশোধ',
          'প্রথম কিস্তি জমা',
          'নগদ ক্যাশ গ্রহণ',
          'বাকিতে ক্রয়',
          'বাকিতে বিক্রয়',
          'পরিবহন খরচ',
          'অগ্রিম প্রদান'
        ];

        const cached = localStorage.getItem('hellopoint_custom_categories');
        if (cached) {
          savedCategories = JSON.parse(cached);
        } else {
          const list = [...defaultNotes];
          try {
            const txs = loadTransactions();
            txs.forEach((tx) => {
              const trimmed = tx.note ? tx.note.trim() : '';
              if (trimmed && !trimmed.includes(',') && !trimmed.includes('।') && !list.includes(trimmed)) {
                list.push(trimmed);
              }
            });
          } catch (e) {
            console.error(e);
          }
          savedCategories = list;
          localStorage.setItem('hellopoint_custom_categories', JSON.stringify(savedCategories));
        }

        const savedDeletedStr = localStorage.getItem('hellopoint_deleted_notes');
        savedDeleted = savedDeletedStr ? JSON.parse(savedDeletedStr) : [];
      } catch (err) {
        console.error('Error loading notes suggestions locally:', err);
      }
    }

    // Ensure all favorited or category-overridden tags are always included in savedCategories
    favoriteTags.forEach(tag => {
      if (!savedCategories.includes(tag) && !savedDeleted.includes(tag)) {
        savedCategories.push(tag);
      }
    });
    Object.keys(tagOverrides).forEach(tag => {
      if (!savedCategories.includes(tag) && !savedDeleted.includes(tag)) {
        savedCategories.push(tag);
      }
    });

    const filtered = savedCategories.filter(n => !savedDeleted.includes(n) && !n.includes(',') && !n.includes('।'));
    return filtered.slice(0, 100);
  };

  const recentNotesList = getRecentNotes();

  // Strict category calculation: each tag has exactly one category
  const getTagCategory = React.useCallback((tag: string): 'favorite' | 'person' | 'transaction' | 'expense' | 'number' | 'general' => {
    if (favoriteTags.includes(tag)) {
      return 'favorite';
    }
    if (tagOverrides[tag] && tagOverrides[tag] !== 'general') {
      return tagOverrides[tag] as 'person' | 'transaction' | 'expense' | 'number';
    }
    if (/[0-9]/.test(convertBengaliDigitsToEnglish(tag)) || /^(01|\+8801|\d+)/.test(tag)) {
      return 'number';
    }
    return 'general';
  }, [favoriteTags, tagOverrides]);

  const [tagFilter, setTagFilter] = useState<'all' | 'favorite' | 'person' | 'transaction' | 'expense' | 'number'>('all');
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isAddingTagToFilter, setIsAddingTagToFilter] = useState<'favorite' | 'person' | 'transaction' | 'expense' | null>(null);
  const [newCustomTagInput, setNewCustomTagInput] = useState('');

  // Active query extraction for real-time live match indicator & highlighting
  const activeNoteSegments = note.split(/[,।]/);
  const currentNoteSegment = activeNoteSegments[activeNoteSegments.length - 1].trim();
  const activeTypedQuery = tagSearchQuery.trim() || currentNoteSegment;
  const activeTypedDigits = convertBengaliDigitsToEnglish(activeTypedQuery).replace(/[^0-9]/g, '');

  const sortedRecentNotes = React.useMemo(() => {
    const selectedTags = activeNoteSegments.map(s => s.trim()).filter(Boolean);
    const queryLower = activeTypedQuery.toLowerCase();

    let list = [...recentNotesList];

    return list.sort((a, b) => {
      // 1. Tags currently active in the note always go first
      const aSelected = selectedTags.includes(a);
      const bSelected = selectedTags.includes(b);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      // 2. Exact or search prefix matches
      if (queryLower) {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aExact = aLower === queryLower;
        const bExact = bLower === queryLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = aLower.startsWith(queryLower);
        const bStarts = bLower.startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Digits containment matching
        if (activeTypedDigits.length >= 1) {
          const aDigits = convertBengaliDigitsToEnglish(a).replace(/[^0-9]/g, '');
          const bDigits = convertBengaliDigitsToEnglish(b).replace(/[^0-9]/g, '');
          const aDigMatch = aDigits.includes(activeTypedDigits);
          const bDigMatch = bDigits.includes(activeTypedDigits);
          if (aDigMatch && !bDigMatch) return -1;
          if (!aDigMatch && bDigMatch) return 1;
        }
      }

      // 3. Persistent Filter Recency: Tags used recently come first in their respective filter
      const aUsageIdx = recentUsageOrder.indexOf(a);
      const bUsageIdx = recentUsageOrder.indexOf(b);
      if (aUsageIdx !== -1 && bUsageIdx !== -1) {
        return aUsageIdx - bUsageIdx;
      }
      if (aUsageIdx !== -1) return -1;
      if (bUsageIdx !== -1) return 1;

      return 0;
    });
  }, [recentNotesList, note, activeTypedQuery, activeTypedDigits, recentUsageOrder]);

  // Live Matching Tags Tracker - finds matching tags across all filters and tells where they are located
  const matchingTagsInfo = React.useMemo(() => {
    if (!activeTypedQuery && !activeTypedDigits) return [];
    const qLower = activeTypedQuery.toLowerCase();

    return sortedRecentNotes
      .map(tag => {
        const tagCategory = getTagCategory(tag);
        const tagEnglish = convertBengaliDigitsToEnglish(tag);
        const tagDigits = tagEnglish.replace(/[^0-9]/g, '');

        let matchScore = 0;
        let matchType: 'exact' | 'starts' | 'digits' | 'contains' | null = null;

        if (tag.toLowerCase() === qLower) {
          matchScore = 100;
          matchType = 'exact';
        } else if (tag.toLowerCase().startsWith(qLower)) {
          matchScore = 80;
          matchType = 'starts';
        } else if (activeTypedDigits.length >= 1 && tagDigits.includes(activeTypedDigits)) {
          matchScore = 60;
          matchType = 'digits';
        } else if (qLower.length >= 1 && tag.toLowerCase().includes(qLower)) {
          matchScore = 40;
          matchType = 'contains';
        }

        return {
          tag,
          category: tagCategory,
          matchScore,
          matchType,
          isInActiveFilter: tagFilter === 'all' || tagFilter === tagCategory
        };
      })
      .filter(item => item.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [sortedRecentNotes, activeTypedQuery, activeTypedDigits, getTagCategory, tagFilter]);

  const toggleFavorite = (tagName: string) => {
    const willBeFav = !favoriteTags.includes(tagName);

    if (willBeFav && tagOverrides[tagName] && tagOverrides[tagName] !== 'general') {
      setTagOverrides(prev => {
        const next = { ...prev, [tagName]: 'general' as const };
        localStorage.setItem('hellopoint_tag_category_overrides', JSON.stringify(next));
        const activeUid = localStorage.getItem('hellopoint_active_uid') || auth.currentUser?.uid;
        if (activeUid && auth.currentUser && auth.currentUser.uid === activeUid) {
          setDoc(doc(db, 'users', activeUid), { tagCategoryOverrides: next }, { merge: true })
            .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}`));
        }
        return next;
      });
    }

    setFavoriteTags(prev => {
      const next = willBeFav ? [...prev, tagName] : prev.filter(t => t !== tagName);
      localStorage.setItem('hellopoint_favorite_tags', JSON.stringify(next));
      window.dispatchEvent(new Event('storage'));

      const activeUid = localStorage.getItem('hellopoint_active_uid') || auth.currentUser?.uid;
      if (activeUid && auth.currentUser && auth.currentUser.uid === activeUid) {
        setDoc(doc(db, 'users', activeUid), { favoriteTags: next }, { merge: true })
          .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}`));
      }
      return next;
    });

    recordTagUsage(tagName);
    handleSaveNewCategory(tagName);
  };

  const setTagOverrideCategory = (tagName: string, category: 'person' | 'transaction' | 'expense' | 'number' | 'general') => {
    if (category !== 'general' && favoriteTags.includes(tagName)) {
      setFavoriteTags(prev => {
        const next = prev.filter(t => t !== tagName);
        localStorage.setItem('hellopoint_favorite_tags', JSON.stringify(next));
        const activeUid = localStorage.getItem('hellopoint_active_uid') || auth.currentUser?.uid;
        if (activeUid && auth.currentUser && auth.currentUser.uid === activeUid) {
          setDoc(doc(db, 'users', activeUid), { favoriteTags: next }, { merge: true })
            .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}`));
        }
        return next;
      });
    }

    setTagOverrides(prev => {
      const next = { ...prev, [tagName]: category };
      localStorage.setItem('hellopoint_tag_category_overrides', JSON.stringify(next));
      window.dispatchEvent(new Event('storage'));

      const activeUid = localStorage.getItem('hellopoint_active_uid') || auth.currentUser?.uid;
      if (activeUid && auth.currentUser && auth.currentUser.uid === activeUid) {
        setDoc(doc(db, 'users', activeUid), { tagCategoryOverrides: next }, { merge: true })
          .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}`));
      }
      return next;
    });

    recordTagUsage(tagName);
    handleSaveNewCategory(tagName);
  };

  // Compute unassigned general tags available for adding (+ এড) to any filter
  const availableGeneralTags = React.useMemo(() => {
    return sortedRecentNotes.filter(tag => {
      return getTagCategory(tag) === 'general';
    });
  }, [sortedRecentNotes, getTagCategory]);

  const handleTagCrossClick = (tagName: string) => {
    if (tagFilter === 'all') {
      handleRemoveNote(tagName);
      setActionFeedback(`🗑️ "${tagName}" স্থায়ীভাবে মুছে ফেলা হয়েছে`);
    } else if (tagFilter === 'favorite') {
      if (favoriteTags.includes(tagName)) {
        toggleFavorite(tagName);
        setActionFeedback(`⭐ "${tagName}" ফেভারিট থেকে সরান হয়েছে`);
      }
    } else if (tagFilter === 'person' || tagFilter === 'transaction' || tagFilter === 'expense' || tagFilter === 'number') {
      setTagOverrideCategory(tagName, 'general');
      setActionFeedback(`🏷️ "${tagName}" এই ফিল্টার থেকে সরান হয়েছে`);
    }
    setTimeout(() => setActionFeedback(null), 2000);
  };

  const filteredNotesForView = React.useMemo(() => {
    let list = sortedRecentNotes;
    if (tagFilter !== 'all') {
      list = list.filter(n => getTagCategory(n) === tagFilter);
    }
    if (tagSearchQuery.trim()) {
      const q = tagSearchQuery.trim().toLowerCase();
      const qDigits = convertBengaliDigitsToEnglish(q).replace(/[^0-9]/g, '');
      list = list.filter(n => {
        const nLower = n.toLowerCase();
        if (nLower.includes(q)) return true;
        if (qDigits.length >= 1) {
          const nDigits = convertBengaliDigitsToEnglish(n).replace(/[^0-9]/g, '');
          if (nDigits.includes(qDigits)) return true;
        }
        return false;
      });
    }
    return list;
  }, [sortedRecentNotes, tagFilter, tagSearchQuery, getTagCategory]);

  const favCount = React.useMemo(() => sortedRecentNotes.filter(n => getTagCategory(n) === 'favorite').length, [sortedRecentNotes, getTagCategory]);
  const personCount = React.useMemo(() => sortedRecentNotes.filter(n => getTagCategory(n) === 'person').length, [sortedRecentNotes, getTagCategory]);
  const transactionCount = React.useMemo(() => sortedRecentNotes.filter(n => getTagCategory(n) === 'transaction').length, [sortedRecentNotes, getTagCategory]);
  const expenseCount = React.useMemo(() => sortedRecentNotes.filter(n => getTagCategory(n) === 'expense').length, [sortedRecentNotes, getTagCategory]);
  const numberCount = React.useMemo(() => sortedRecentNotes.filter(n => getTagCategory(n) === 'number').length, [sortedRecentNotes, getTagCategory]);

  const handleAddNewTagToActiveFilter = () => {
    const isNumberFilter = isAddingTagToFilter === null && tagFilter === 'number';
    const cleaned = sanitizeTagInput(newCustomTagInput, isNumberFilter);
    if (!cleaned) return;

    // Immediately save to custom categories so it appears in recent notes and syncs real-time
    handleSaveNewCategory(cleaned);
    recordTagUsage(cleaned);

    if (isAddingTagToFilter === 'favorite') {
      toggleFavorite(cleaned);
      setActionFeedback(`⭐ "${cleaned}" ফেভারিটে যোগ করা হয়েছে`);
    } else if (isAddingTagToFilter === 'person') {
      setTagOverrideCategory(cleaned, 'person');
      setActionFeedback(`👤 "${cleaned}" ব্যক্তি ক্যাটাগরিতে যোগ করা হয়েছে`);
    } else if (isAddingTagToFilter === 'transaction') {
      setTagOverrideCategory(cleaned, 'transaction');
      setActionFeedback(`🔄 "${cleaned}" লেনদেন ক্যাটাগরিতে যোগ করা হয়েছে`);
    } else if (isAddingTagToFilter === 'expense') {
      setTagOverrideCategory(cleaned, 'expense');
      setActionFeedback(`💸 "${cleaned}" খরচ ক্যাটাগরিতে যোগ করা হয়েছে`);
    }
    setNewCustomTagInput('');
    setTimeout(() => setActionFeedback(null), 2000);
  };

  const handleCategoryClick = (categoryName: string) => {
    // Record recency usage so this tag stays at the top of its filter
    recordTagUsage(categoryName);

    // Promote clicked tag to front of custom categories
    try {
      const cached = localStorage.getItem('hellopoint_custom_categories');
      if (cached) {
        const categories: string[] = JSON.parse(cached);
        const updated = [categoryName, ...categories.filter(c => c !== categoryName)];
        localStorage.setItem('hellopoint_custom_categories', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error(e);
    }

    setNote((prevNote) => {
      const rawTrimmed = prevNote.trim();
      if (!rawTrimmed) {
        return categoryName;
      }

      // Split note by comma or Bengali full stop
      const parts = prevNote.split(/[,।]/);
      const lastPart = parts[parts.length - 1];
      const lastPartTrimmed = lastPart.trim();

      // Extract all complete items currently in note
      const allItems = prevNote
        .split(/[,।]/)
        .map((s) => s.trim())
        .filter(Boolean);

      // Check if categoryName is already present in note
      if (allItems.includes(categoryName)) {
        // Toggle off: remove categoryName
        const remaining = allItems.filter((item) => item !== categoryName);
        return remaining.join(', ');
      }

      // Check if lastPartTrimmed is a partial query being typed.
      const endsWithDelimiter = prevNote.endsWith(',') || prevNote.endsWith('।') || prevNote.endsWith(';');
      const isPartialQuery =
        lastPartTrimmed.length > 0 &&
        !recentNotesList.includes(lastPartTrimmed) &&
        !endsWithDelimiter;

      if (isPartialQuery) {
        // Replace the last partial segment with categoryName
        const completedParts = parts.slice(0, parts.length - 1).map((s) => s.trim()).filter(Boolean);
        completedParts.push(categoryName);
        return completedParts.join(', ');
      } else {
        // Append categoryName cleanly
        const existingItems = [...allItems];
        existingItems.push(categoryName);
        return existingItems.join(', ');
      }
    });
  };

  const handleSaveNewCategory = (newCat: string) => {
    // Automatically sanitize number tags (remove spaces, symbols, punctuation)
    const cleaned = sanitizeTagInput(newCat);
    if (!cleaned) return;
    if (cleaned.includes(',') || cleaned.includes('।')) return;
    
    recordTagUsage(cleaned);

    if (onSaveCategory) {
      onSaveCategory(cleaned);
    } else {
      try {
        const cached = localStorage.getItem('hellopoint_custom_categories');
        let categories: string[] = cached ? JSON.parse(cached) : [];
        categories = [cleaned, ...categories.filter(c => c !== cleaned)];
        localStorage.setItem('hellopoint_custom_categories', JSON.stringify(categories));

        // Ensure it is removed from deleted list if they are explicitly saving it
        const savedDeletedStr = localStorage.getItem('hellopoint_deleted_notes');
        if (savedDeletedStr) {
          const savedDeleted = JSON.parse(savedDeletedStr) as string[];
          if (savedDeleted.includes(cleaned)) {
            const updatedDeleted = savedDeleted.filter(d => d !== cleaned);
            localStorage.setItem('hellopoint_deleted_notes', JSON.stringify(updatedDeleted));
          }
        }
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Error saving new custom category:', err);
      }
    }
  };

  const handleRemoveNote = (noteToRemove: string) => {
    if (onDeleteCategory) {
      onDeleteCategory(noteToRemove);
    } else {
      try {
        const savedDeletedStr = localStorage.getItem('hellopoint_deleted_notes');
        let savedDeleted: string[] = savedDeletedStr ? JSON.parse(savedDeletedStr) : [];
        if (!savedDeleted.includes(noteToRemove)) {
          savedDeleted = [...savedDeleted, noteToRemove];
          localStorage.setItem('hellopoint_deleted_notes', JSON.stringify(savedDeleted));
        }

        // Remove from hellopoint_custom_categories list
        const cached = localStorage.getItem('hellopoint_custom_categories');
        if (cached) {
          const categories: string[] = JSON.parse(cached);
          const updatedCategories = categories.filter(n => n !== noteToRemove);
          localStorage.setItem('hellopoint_custom_categories', JSON.stringify(updatedCategories));
        }
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Error removing note:', err);
      }
    }
  };

  const [isDesktopMode, setIsDesktopMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hellopoint_desktop_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleChanged = () => {
      setIsDesktopMode(localStorage.getItem('hellopoint_desktop_mode') === 'true');
    };
    window.addEventListener('desktop_mode_changed', handleChanged);
    return () => window.removeEventListener('desktop_mode_changed', handleChanged);
  }, []);

  // File Upload base64 reader trigger
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Format header text dynamically as Screenshot 1: "You got ₹ 200.00 from আবুল"
  const getHeaderTitle = () => {
    const displayAmount = amount ? parseFloat(amount) : 0;
    const actionText = isGave 
      ? `You gave ${currency} ${displayAmount.toFixed(2)} to ${contact.name}` 
      : `You got ${currency} ${displayAmount.toFixed(2)} from ${contact.name}`;
      
    const bnActionText = isGave
      ? `আপনি ${contact.name}-কে ${currency} ${displayAmount.toFixed(2)} দিলেন`
      : `আপনি ${contact.name}-এর থেকে ${currency} ${displayAmount.toFixed(2)} পেলেন`;
    
    return { en: actionText, bn: bnActionText };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use URL.createObjectURL to safely process huge high-res images taken on mobile
    // camera streams. This completely avoids iOS Safari memory depletion/crashing.
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 750;
        const MAX_HEIGHT = 750;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round(width * (MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress high quality JPEG (e.g. 50-80KB in size) to fit under Firestore size caps
          const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
          setAttachFile(dataUrl);
        }
      } catch (err) {
        console.error("Voucher photo compression failed:", err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  };

  // Canvas drawing controls for signature
  useEffect(() => {
    if (isDrawSignatureOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // If editing, preload signature if existing
        if (signature) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = signature;
        }
      }
    }
  }, [isDrawSignatureOpen]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let x = 0;
    let y = 0;

    if ('touches' in e) {
      const rect = canvas.getBoundingClientRect();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let x = 0;
    let y = 0;

    if ('touches' in e) {
      const rect = canvas.getBoundingClientRect();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvasSignature = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    setSignature(dataUrl);
    setIsDrawSignatureOpen(false);
  };

  const parseAmountWithBilingualSupport = (str: string): number => {
    if (!str) return NaN;
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    let val = str.trim().replace(/,/g, '');
    for (let i = 0; i < 10; i++) {
      val = val.replace(new RegExp(bnNums[i], 'g'), String(i));
    }
    return parseFloat(val);
  };

  const handleSavingTransaction = () => {
    const parsedAmount = parseAmountWithBilingualSupport(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('দয়া করে সঠিক অংক লিখুন!');
      return;
    }

    const trimmedNote = convertBengaliDigitsToEnglish(note.trim());
    if (trimmedNote) {
      handleSaveNewCategory(trimmedNote);
    }

    onSave({
      amount: parsedAmount,
      type: currentType,
      note: trimmedNote,
      billNo: convertBengaliDigitsToEnglish(billNo.trim()),
      date: new Date(date).toISOString(),
      attachFile,
      signature
    });
  };

  return (
    <div id="transaction-form-viewport" className="flex flex-col min-h-screen bg-[#eaeff5] dark:bg-[#252B33] text-slate-800 dark:text-[#F1F3F5] font-sans pb-24">
      
      {/* Dynamic Header adopting color of transaction type (Screenshot 1 green style or red style) */}
      <header className={`px-4 py-4.5 flex items-center gap-3 border-b transition-all select-none ${
        isGave 
          ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border-rose-100 dark:border-rose-900/60' 
          : 'bg-emerald-50/90 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border-emerald-100 dark:border-emerald-900/60'
      }`}>
        <button 
          id="btn-close-form"
          onClick={onBack}
          className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-all shrink-0 cursor-pointer"
        >
          <X className="w-6 h-6 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xs rounded-full p-0.5" />
        </button>
        
        <div className="min-w-0 flex-1">
          <h2 className="text-xs sm:text-sm font-semibold truncate uppercase tracking-wider opacity-90">
            {isGave ? 'মালামাল বা টাকা দিয়েছেন (ক্যাশ আউট)' : 'বকেয়া বা ক্যাশ পেয়েছেন (ক্যাশ ইন)'}
          </h2>
          <h3 id="form-dynamic-message" className="text-sm font-black line-clamp-2 md:text-base mt-0.5 text-slate-900 dark:text-white">
            {getHeaderTitle().bn}
          </h3>
        </div>
      </header>

      {/* Main Form Fields Container (Screenshot 1 clone) */}
      <main className={`p-4 ${isDesktopMode ? 'max-w-7xl' : 'max-w-sm'} mx-auto w-full space-y-4`}>
        {error && (
          <p className="text-[10px] bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800 font-extrabold text-rose-600 dark:text-rose-400 rounded-xl py-2 px-3 text-center leading-normal animate-fade-in">
            ⚠️ {error}
          </p>
        )}
        
        {/* Top Controls Grid: Amount (Left) & Types + Compact Date (Right) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 items-stretch">
          {/* Left Half: Amount Input Box */}
          <div className="space-y-1 flex flex-col justify-between">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-400 pl-1 truncate">
              টাকার পরিমাণ (Amount)
            </label>
            <div className="relative flex-1 bg-[#f8fafc] dark:bg-[#2D3540] border border-slate-200 dark:border-[#46515E] rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between shadow-tiny focus-within:border-purple-500 dark:focus-within:border-amber-400 focus-within:bg-white dark:focus-within:bg-[#333C48] transition-all min-h-[66px]">
              <div className="flex items-center gap-1.5 w-full">
                <span className="text-lg sm:text-xl font-bold text-slate-400 dark:text-slate-400 font-mono shrink-0">{currency}</span>
                <input 
                  id="input-amount"
                  type="text" 
                  inputMode="decimal" 
                  value={amount}
                  onChange={(e) => setAmount(convertBengaliDigitsToEnglish(e.target.value))}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  required
                  autoFocus
                  className="bg-transparent border-none text-lg sm:text-xl font-black text-slate-800 dark:text-[#F1F3F5] outline-none w-full font-mono placeholder:text-slate-300 dark:placeholder:text-slate-500"
                />
              </div>
              <div className="bg-purple-100 dark:bg-purple-950/80 px-1.5 py-0.5 rounded-lg text-purple-700 dark:text-purple-300 font-bold text-[10px] shadow-tiny pointer-events-none hover:bg-purple-200 shrink-0 select-none hidden xs:block">
                +-
              </div>
            </div>
          </div>

          {/* Right Half: Cash In & Cash Out + Compact Date */}
          <div className="space-y-1 flex flex-col justify-between">
            <div className="flex items-center justify-between pl-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-400 truncate">
                ধরণ ও তারিখ
              </label>
            </div>
            
            <div className="flex flex-col gap-1.5 flex-1 justify-between">
              {/* Cash In / Out Buttons */}
              <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                {/* ক্যাশ ইন (পেলাম / GOT) */}
                <button 
                  id="btn-toggle-cash-in"
                  type="button"
                  onClick={() => setCurrentType('GOT')}
                  className={`py-1.5 px-1.5 sm:px-2 rounded-xl font-black text-[9.5px] sm:text-xs tracking-tight flex items-center justify-center gap-1 transition-all outline-none cursor-pointer border select-none active:scale-95 ${
                    currentType === 'GOT'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300/60 dark:ring-emerald-500/40'
                      : 'bg-emerald-50/70 hover:bg-emerald-100/90 text-emerald-800 border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 dark:hover:bg-emerald-950/70'
                  }`}
                  title="ক্যাশ ইন (টাকা পেয়েছেন)"
                >
                  <ArrowDownLeft className={`w-3.5 h-3.5 shrink-0 ${currentType === 'GOT' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  <span className="truncate leading-tight">ক্যাশ ইন</span>
                </button>
                
                {/* ক্যাশ আউট (দিলাম / GAVE) */}
                <button 
                  id="btn-toggle-cash-out"
                  type="button"
                  onClick={() => setCurrentType('GAVE')}
                  className={`py-1.5 px-1.5 sm:px-2 rounded-xl font-black text-[9.5px] sm:text-xs tracking-tight flex items-center justify-center gap-1 transition-all outline-none cursor-pointer border select-none active:scale-95 ${
                    currentType === 'GAVE'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300/60 dark:ring-rose-500/40'
                      : 'bg-rose-50/70 hover:bg-rose-100/90 text-rose-800 border-rose-200/90 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 dark:hover:bg-rose-950/70'
                  }`}
                  title="ক্যাশ আউট (টাকা দিয়েছেন)"
                >
                  <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 ${currentType === 'GAVE' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`} />
                  <span className="truncate leading-tight">ক্যাশ আউট</span>
                </button>
              </div>

              {/* Compact Date Box with Icon */}
              <div className="relative bg-[#f8fafc] dark:bg-[#2D3540] hover:bg-slate-100/90 hover:dark:bg-[#333C48] border border-slate-200 dark:border-[#46515E] rounded-xl px-2.5 py-1 sm:py-1.5 flex items-center gap-1.5 shadow-2xs focus-within:border-purple-500 dark:focus-within:border-amber-400 focus-within:bg-white dark:focus-within:bg-[#333C48] transition-all cursor-pointer">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <input 
                  id="input-date"
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-[#F1F3F5] outline-none cursor-pointer font-mono p-0 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Note Input Box */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-400 pl-1">Note (বিবরণ/পণ্যের নাম কন্ট্রোল)</label>
          <div className="relative bg-[#f8fafc] dark:bg-[#2D3540] border border-slate-200 dark:border-[#46515E] rounded-xl px-3 py-2 flex flex-col justify-start shadow-tiny focus-within:border-purple-500 dark:focus-within:border-amber-400 focus-within:bg-white dark:focus-within:bg-[#333C48] transition-all">
            <textarea 
              id="input-note"
              value={note}
              onChange={(e) => setNote(convertBengaliDigitsToEnglish(e.target.value))}
              placeholder="এখানে নোট বা নাম্বার লিখুন..."
              rows={1.5}
              className="bg-transparent border-none text-xs font-semibold text-slate-800 dark:text-[#F1F3F5] outline-none w-full placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none leading-relaxed font-sans"
            />

            {/* If user types a unique tag, show quick save button with cleaned value */}
            {(() => {
              const cleanedCandidate = sanitizeTagInput(note.trim());
              if (
                cleanedCandidate.length > 0 && 
                !cleanedCandidate.includes(',') && 
                !cleanedCandidate.includes('।') && 
                !recentNotesList.includes(cleanedCandidate)
              ) {
                return (
                  <button
                    type="button"
                    onClick={() => handleSaveNewCategory(cleanedCandidate)}
                    className="mt-1 mb-1 inline-flex items-center gap-1.5 bg-purple-50/80 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[9.5px] font-extrabold px-2.5 py-1 rounded-lg border border-purple-200/80 dark:border-purple-800/50 transition-all cursor-pointer shadow-2xs self-start outline-none"
                  >
                    <span>➕ "{cleanedCandidate}" ক্যাটাগরি হিসেবে সেভ করুন</span>
                  </button>
                );
              }
              return null;
            })()}

            {/* Live Matching Tracker: Shows matched tags location while typing numbers or text */}
            {matchingTagsInfo.length > 0 && (
              <div className="mt-1.5 mb-1 p-1.5 rounded-lg bg-red-50/40 dark:bg-red-950/20 border border-red-300 dark:border-red-800/60 flex flex-col gap-1 text-[9.5px] animate-fade-in backdrop-blur-xs">
                <div className="flex items-center justify-between text-red-800 dark:text-red-300 font-semibold text-[9px] px-1">
                  <span className="flex items-center gap-1">
                    <span className="text-red-500 dark:text-red-400">🎯</span>
                    <span>মিলে যাওয়া ট্যাগ ({matchingTagsInfo.length}টি):</span>
                  </span>
                  <span className="text-[8px] text-red-600/80 dark:text-red-400/80">
                    ট্যাপ করে সিলেক্ট করুন
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto px-0.5">
                  {matchingTagsInfo.slice(0, 8).map(({ tag, category, isInActiveFilter }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleCategoryClick(tag)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#1E252D] border border-red-400 dark:border-red-500/80 text-slate-800 dark:text-slate-200 font-medium hover:bg-red-50/50 dark:hover:bg-red-950/40 transition-colors shadow-2xs cursor-pointer active:scale-95 text-[10px] whitespace-nowrap shrink-0"
                    >
                      <HighlightedTagText text={tag} query={activeTypedQuery} digitsQuery={activeTypedDigits} />
                      <span className="text-[7.5px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {category === 'favorite' && '⭐'}
                        {category === 'person' && '👤'}
                        {category === 'transaction' && '🔄'}
                        {category === 'expense' && '💸'}
                        {category === 'number' && '🔢'}
                        {category === 'general' && '🏷️'}
                      </span>
                      {!isInActiveFilter && (
                        <span className="text-[7.5px] text-red-500 dark:text-red-400 font-semibold">
                          (অন্য ফিল্টার)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sortedRecentNotes.length > 0 && (
              <div className="mt-2 text-left w-full border-t border-slate-100 dark:border-slate-700/60 pt-2">
                {/* Quick Category Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-2 w-full">
                  <button
                    type="button"
                    onClick={() => setTagFilter('all')}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-1 border ${
                      tagFilter === 'all'
                        ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-700 dark:border-slate-200 shadow-2xs'
                        : 'bg-white dark:bg-[#333C48] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#4A5565] hover:bg-slate-50 dark:hover:bg-[#3D4756]'
                    }`}
                  >
                    <span>সব</span>
                    <span className={`px-1 rounded-full text-[7.5px] font-black transition-colors ${tagFilter === 'all' ? 'bg-slate-800 dark:bg-slate-300 text-slate-100 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {sortedRecentNotes.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTagFilter('favorite')}
                    title="ফেভারিট"
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-1 border ${
                      tagFilter === 'favorite'
                        ? 'bg-amber-600/90 text-white border-amber-600 shadow-2xs'
                        : matchingTagsInfo.some(m => m.category === 'favorite')
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-red-400 dark:border-red-500'
                        : 'bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/50 hover:bg-amber-100/60 dark:hover:bg-amber-950/60'
                    }`}
                  >
                    <span>⭐ ফেভারিট</span>
                    <span className={`px-1 rounded-full text-[7.5px] font-black transition-colors ${tagFilter === 'favorite' ? 'bg-amber-800 text-white' : 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'}`}>
                      {favCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTagFilter('person')}
                    title="ব্যক্তি"
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-1 border ${
                      tagFilter === 'person'
                        ? 'bg-sky-600/90 text-white border-sky-600 shadow-2xs'
                        : matchingTagsInfo.some(m => m.category === 'person')
                        ? 'bg-sky-50/60 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 border-red-400 dark:border-red-500'
                        : 'bg-sky-50/60 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/50 hover:bg-sky-100/60 dark:hover:bg-sky-950/60'
                    }`}
                  >
                    <span>ব্যক্তি</span>
                    <span className={`px-1 rounded-full text-[7.5px] font-black transition-colors ${tagFilter === 'person' ? 'bg-sky-800 text-white' : 'bg-sky-100 dark:bg-sky-900/60 text-sky-900 dark:text-sky-200'}`}>
                      {personCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTagFilter('transaction')}
                    title="লেনদেন"
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-1 border ${
                      tagFilter === 'transaction'
                        ? 'bg-indigo-600/90 text-white border-indigo-600 shadow-2xs'
                        : matchingTagsInfo.some(m => m.category === 'transaction')
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 border-red-400 dark:border-red-500'
                        : 'bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/50 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/60'
                    }`}
                  >
                    <span>লেনদেন</span>
                    <span className={`px-1 rounded-full text-[7.5px] font-black transition-colors ${tagFilter === 'transaction' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200'}`}>
                      {transactionCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTagFilter('expense')}
                    title="খরচ"
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-1 border ${
                      tagFilter === 'expense'
                        ? 'bg-rose-600/90 text-white border-rose-600 shadow-2xs'
                        : matchingTagsInfo.some(m => m.category === 'expense')
                        ? 'bg-rose-50/60 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-red-400 dark:border-red-500'
                        : 'bg-rose-50/60 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/50 hover:bg-rose-100/60 dark:hover:bg-rose-950/60'
                    }`}
                  >
                    <span>খরচ</span>
                    <span className={`px-1 rounded-full text-[7.5px] font-black transition-colors ${tagFilter === 'expense' ? 'bg-rose-800 text-white' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200'}`}>
                      {expenseCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTagFilter('number')}
                    title="নাম্বারিং"
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-1 border ${
                      tagFilter === 'number'
                        ? 'bg-emerald-600/90 text-white border-emerald-600 shadow-2xs'
                        : matchingTagsInfo.some(m => m.category === 'number')
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-red-400 dark:border-red-500'
                        : 'bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/50 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60'
                    }`}
                  >
                    <span>নাম্বারিং</span>
                    <span className={`px-1 rounded-full text-[7.5px] font-black transition-colors ${tagFilter === 'number' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200'}`}>
                      {numberCount}
                    </span>
                  </button>
                </div>

                {/* Smart Tag Search Bar */}
                <div className="relative mb-2 mt-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-purple-600" />
                  <input
                    type="text"
                    placeholder="ট্যাগ বা নাম্বার সার্চ করুন (Search)..."
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#252B33] border border-slate-200 dark:border-[#46515E] rounded-lg pl-8 pr-7 py-1 text-[10px] font-bold text-slate-800 dark:text-[#F1F3F5] outline-none focus:bg-white dark:focus:bg-[#20252D] focus:border-purple-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-purple-200/50 dark:focus:ring-amber-400/20 shadow-2xs transition-all duration-150 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  {tagSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTagSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-0.5 rounded-full transition-transform active:scale-90"
                      title="সার্চ ফিল্টার মুছুন"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Feedback Toast */}
                {actionFeedback && (
                  <div className="mb-2 p-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[9.5px] font-bold rounded-lg text-center animate-fade-in shadow-sm flex items-center justify-center gap-1.5 border border-slate-600">
                    <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                    <span>{actionFeedback}</span>
                  </div>
                )}

                {/* Tags List Container with Soft Muted Styling */}
                {filteredNotesForView.length === 0 ? (
                  <div className="text-center py-2.5 px-2 bg-slate-50 dark:bg-[#252B33] rounded-lg border border-dashed border-slate-200 dark:border-[#46515E] text-[10px] text-slate-400 dark:text-slate-400 font-bold mb-2">
                    {tagSearchQuery ? (
                      <span>🔍 "{tagSearchQuery}" দিয়ে কোন ট্যাগ খুঁজে পাওয়া যায়নি</span>
                    ) : (
                      <>
                        {tagFilter === 'favorite' && '⭐ কোন ফেভারিট ট্যাগ নেই। নিচের "এড+" বাটনে ট্যাপ করে যোগ করুন!'}
                        {tagFilter === 'person' && '👤 "ব্যক্তি" ক্যাটাগরিতে কোন ট্যাগ নেই। নিচের "এড+" বাটনে ট্যাপ করে যোগ করুন!'}
                        {tagFilter === 'transaction' && '🔄 "লেনদেন" ক্যাটাগরিতে কোন ট্যাগ নেই। নিচের "এড+" বাটনে ট্যাপ করে যোগ করুন!'}
                        {tagFilter === 'expense' && '💸 "খরচ" ক্যাটাগরিতে কোন ট্যাগ নেই। নিচের "এড+" বাটনে ট্যাপ করে যোগ করুন!'}
                        {tagFilter === 'number' && '🔢 "নাম্বারিং" ক্যাটাগরিতে কোন ট্যাগ নেই।'}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto pt-0.5 pb-1.5 justify-start">
                    {filteredNotesForView.map((n) => {
                      const isSelected = note.split(/[,।]/).map(s => s.trim()).includes(n);
                      const isFav = favoriteTags.includes(n);
                      const category = getTagCategory(n);

                      // Check if tag is currently matched by active typed query
                      const hasActiveQuery = Boolean(activeTypedQuery || activeTypedDigits);
                      const isMatch = hasActiveQuery && (
                        (activeTypedQuery && n.toLowerCase().includes(activeTypedQuery.toLowerCase())) ||
                        (activeTypedDigits.length >= 1 && convertBengaliDigitsToEnglish(n).replace(/[^0-9]/g, '').includes(activeTypedDigits))
                      );

                      // Clean styling: if matched by user input, give it a clean red border
                      let tagStyle = '';
                      if (isMatch) {
                        tagStyle = isSelected
                          ? 'bg-red-500/10 dark:bg-red-500/20 border-red-500 dark:border-red-400 text-red-700 dark:text-red-300 font-semibold ring-1 ring-red-400/40 shadow-2xs'
                          : 'bg-red-50/40 dark:bg-red-950/25 border-red-400 dark:border-red-500 text-slate-800 dark:text-slate-200 hover:bg-red-50/70 dark:hover:bg-red-950/40 font-medium';
                      } else if (isFav) {
                        tagStyle = isSelected
                          ? 'bg-amber-100/90 dark:bg-amber-950/70 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100 font-black ring-1 ring-amber-400/50 shadow-2xs'
                          : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/40 text-amber-900/90 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/50 font-semibold';
                      } else if (category === 'person') {
                        tagStyle = isSelected
                          ? 'bg-sky-100/90 dark:bg-sky-950/70 border-sky-400 dark:border-sky-600 text-sky-950 dark:text-sky-100 font-black ring-1 ring-sky-400/50 shadow-2xs'
                          : 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200/80 dark:border-sky-800/40 text-sky-900/90 dark:text-sky-300 hover:bg-sky-100/60 dark:hover:bg-sky-950/50 font-semibold';
                      } else if (category === 'transaction') {
                        tagStyle = isSelected
                          ? 'bg-indigo-100/90 dark:bg-indigo-950/70 border-indigo-400 dark:border-indigo-600 text-indigo-950 dark:text-indigo-100 font-black ring-1 ring-indigo-400/50 shadow-2xs'
                          : 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/40 text-indigo-900/90 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/50 font-semibold';
                      } else if (category === 'expense') {
                        tagStyle = isSelected
                          ? 'bg-rose-100/90 dark:bg-rose-950/70 border-rose-400 dark:border-rose-600 text-rose-950 dark:text-rose-100 font-black ring-1 ring-rose-400/50 shadow-2xs'
                          : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/40 text-rose-900/90 dark:text-rose-300 hover:bg-rose-100/60 dark:hover:bg-rose-950/50 font-semibold';
                      } else if (category === 'number') {
                        tagStyle = isSelected
                          ? 'bg-emerald-100/90 dark:bg-emerald-950/70 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100 font-black ring-1 ring-emerald-400/50 shadow-2xs'
                          : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/40 text-emerald-900/90 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/50 font-semibold';
                      } else {
                        tagStyle = isSelected
                          ? 'bg-slate-200 dark:bg-[#3D4756] border-slate-400 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-black ring-1 ring-slate-400/40 shadow-2xs'
                          : 'bg-white dark:bg-[#2B333E] border-slate-200 dark:border-[#424D5B] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#333C48] font-semibold';
                      }

                      return (
                        <div
                          key={n}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-all duration-150 hover:scale-[1.02] active:scale-95 select-none text-[10px] whitespace-nowrap shrink-0 ${tagStyle}`}
                        >
                          {/* Tag Text Button with Highlighted Match */}
                          <button
                            type="button"
                            onClick={() => handleCategoryClick(n)}
                            className="cursor-pointer text-left outline-none flex items-center gap-1 whitespace-nowrap"
                          >
                            {category === 'favorite' && <span className="text-[8.5px] opacity-90" title="ফেভারিট">⭐</span>}
                            {category === 'person' && <span className="text-[8.5px] opacity-90" title="ব্যক্তি">👤</span>}
                            {category === 'transaction' && <span className="text-[8.5px] opacity-90" title="লেনদেন">🔄</span>}
                            {category === 'expense' && <span className="text-[8.5px] opacity-90" title="খরচ">💸</span>}
                            {category === 'number' && <span className="text-[8.5px] opacity-90" title="নাম্বারিং">🔢</span>}
                            <HighlightedTagText text={n} query={activeTypedQuery} digitsQuery={activeTypedDigits} />
                          </button>

                          {/* Remove/Delete Tag Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTagCrossClick(n);
                            }}
                            title={
                              tagFilter === 'all' 
                                ? "স্থায়ীভাবে মুছে ফেলুন" 
                                : tagFilter === 'favorite' 
                                ? "ফেভারিট থেকে সরান" 
                                : "এই ফিল্টার থেকে সরান"
                            }
                            className={`p-0.5 rounded-full transition-colors cursor-pointer ml-0.5 ${
                              isSelected 
                                ? 'hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400' 
                                : 'hover:bg-slate-200 dark:hover:bg-slate-700/60 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                            }`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* + Add Button Banner placed BELOW the Tags List */}
                {(tagFilter === 'favorite' || tagFilter === 'person' || tagFilter === 'transaction' || tagFilter === 'expense' || tagFilter === 'number') && (
                  <div className="mt-1.5 mb-2 flex items-center justify-between bg-slate-50 dark:bg-[#252B33] border border-slate-200 dark:border-[#46515E] rounded-lg p-1.5">
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      {tagFilter === 'favorite' && '⭐ ফেভারিটে ট্যাগ এড করুন'}
                      {tagFilter === 'person' && '👤 ব্যক্তিতে ট্যাগ এড করুন'}
                      {tagFilter === 'transaction' && '🔄 লেনদেনে ট্যাগ এড করুন'}
                      {tagFilter === 'expense' && '💸 খরচে ট্যাগ এড করুন'}
                      {tagFilter === 'number' && '🔢 নাম্বারিংয়ে ট্যাগ এড করুন'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingTagToFilter(isAddingTagToFilter === tagFilter ? null : (tagFilter as any))}
                      className={`px-2.5 py-0.5 rounded-md text-[9.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-2xs text-white ${
                        tagFilter === 'favorite'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : tagFilter === 'person'
                          ? 'bg-sky-600 hover:bg-sky-700'
                          : tagFilter === 'transaction'
                          ? 'bg-indigo-600 hover:bg-indigo-700'
                          : tagFilter === 'expense'
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <Plus className="w-2.5 h-2.5 stroke-[3]" />
                      <span>এড+</span>
                    </button>
                  </div>
                )}

                {/* + Add Selection Panel */}
                {isAddingTagToFilter && (
                  <div className="mb-2 p-2.5 bg-white dark:bg-[#2D3540] border border-purple-200 dark:border-[#4A5565] rounded-xl shadow-md space-y-2 animate-fade-in text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1">
                      <span className="text-[10px] font-extrabold text-purple-900 dark:text-purple-300 flex items-center gap-1">
                        {isAddingTagToFilter === 'favorite' && '⭐ ফেভারিট ফিল্টারে নতুন ট্যাগ যোগ করুন'}
                        {isAddingTagToFilter === 'person' && '👤 ব্যক্তি ফিল্টারে নতুন ট্যাগ যোগ করুন'}
                        {isAddingTagToFilter === 'transaction' && '🔄 লেনদেন ফিল্টারে নতুন ট্যাগ যোগ করুন'}
                        {isAddingTagToFilter === 'expense' && '💸 খরচ ফিল্টারে নতুন ট্যাগ যোগ করুন'}
                        {isAddingTagToFilter === 'number' && '🔢 নাম্বারিং ফিল্টারে নতুন নাম্বার যোগ করুন'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingTagToFilter(null)}
                        className="p-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Direct Text Input to Add Custom Tag */}
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder={isAddingTagToFilter === 'number' ? "নাম্বার লিখুন (স্পেস/চিহ্ন ছাড়া সেভ হবে)..." : "নতুন ট্যাগ লিখুন (যেমন: নাম, বিষয়)..."}
                        value={newCustomTagInput}
                        onChange={(e) => setNewCustomTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNewTagToActiveFilter();
                          }
                        }}
                        className="flex-1 bg-slate-50 dark:bg-[#252B33] border border-slate-200 dark:border-[#46515E] rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-800 dark:text-[#F1F3F5] outline-none focus:border-purple-500 dark:focus:border-amber-400 focus:bg-white dark:focus:bg-[#20252D]"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewTagToActiveFilter}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black shrink-0 transition-all cursor-pointer shadow-tiny"
                      >
                        যোগ করুন
                      </button>
                    </div>

                    {availableGeneralTags.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                        <p className="text-[8.5px] font-semibold text-slate-500 dark:text-slate-400">
                          অথবা তালিকা থেকে ট্যাপ করে যোগ করুন:
                        </p>
                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pt-0.5">
                          {availableGeneralTags.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                if (isAddingTagToFilter === 'favorite') {
                                  toggleFavorite(tag);
                                  setActionFeedback(`⭐ "${tag}" ফেভারিটে যোগ করা হয়েছে`);
                                } else if (isAddingTagToFilter === 'person') {
                                  setTagOverrideCategory(tag, 'person');
                                  setActionFeedback(`👤 "${tag}" ব্যক্তি ক্যাটাগরিতে যোগ করা হয়েছে`);
                                } else if (isAddingTagToFilter === 'transaction') {
                                  setTagOverrideCategory(tag, 'transaction');
                                  setActionFeedback(`🔄 "${tag}" লেনদেন ক্যাটাগরিতে যোগ করা হয়েছে`);
                                } else if (isAddingTagToFilter === 'expense') {
                                  setTagOverrideCategory(tag, 'expense');
                                  setActionFeedback(`💸 "${tag}" খরচ ক্যাটাগরিতে যোগ করা হয়েছে`);
                                } else if (isAddingTagToFilter === 'number') {
                                  setTagOverrideCategory(tag, 'number');
                                  setActionFeedback(`🔢 "${tag}" নাম্বারিংয়ে যোগ করা হয়েছে`);
                                }
                                setTimeout(() => setActionFeedback(null), 2000);
                              }}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-purple-100 hover:dark:bg-purple-900/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-[9.5px] font-bold transition-all cursor-pointer flex items-center gap-0.5"
                            >
                              <Plus className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                              <span>{tag}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Persistent Bottom actions */}
      <footer className={`fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/95 dark:bg-[#1E252D]/95 backdrop-blur-md border-t border-slate-100 dark:border-[#384250] shadow-[0_-4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.4)] z-10 ${isDesktopMode ? 'max-w-7xl' : 'max-w-sm'} mx-auto rounded-t-2xl`}>
        {/* Large full width Green Submit Button */}
        <button 
          id="btn-submit-tx"
          type="button"
          onClick={handleSavingTransaction}
          className="w-full bg-[#4caf50] hover:bg-[#43a047] active:scale-98 text-white py-3 sm:py-3.5 rounded-xl font-black text-xs sm:text-sm tracking-wider flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer select-none"
        >
          <Check className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          {transaction ? 'Update (পরিবর্তন নিশ্চিত করুন)' : 'Save (নতুন হিসাব জমা করুন)'}
        </button>
      </footer>

    </div>
  );
}
