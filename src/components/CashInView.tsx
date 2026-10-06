import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Search, 
  X, 
  Edit3, 
  Trash2,
  FileSpreadsheet,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  History,
  Clock,
  ArrowDownLeft,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Download,
  ArrowLeft,
  Maximize2,
  Minimize2,
  RotateCcw,
  BookOpen,
  UserCheck,
  Sparkles,
  User,
  Phone,
  Calendar,
  ClipboardPaste
} from 'lucide-react';
import { CashInAccount, CashInTransaction, Contact, AccountRechargeRecord } from '../types';
import { isTxOwnNumberTransfer, isPhoneOwnAccount, findOwnAccountByPhone, getTransactionCommission } from '../utils/cashInUtils';
import { PremiumAppLoader } from './PremiumAppLoader';
import { soundEngine } from '../utils/audio';
import { DailyReportFullView } from './DailyReportFullView';
import { MonthlyReportFullView } from './MonthlyReportFullView';

/**
 * Cleans any pasted or typed phone number into a pure 11-digit Bangladeshi mobile number:
 * - Converts Bengali numerals (০-৯) to 0-9
 * - Strips all non-numeric characters (+88, spaces, hyphens, commas, parentheses, etc.)
 * - Removes +88, 88, 0088 country codes
 * - Fixes missing leading zero if 10 digits starting with 1
 * - Extracts 11-digit mobile number starting with 01[3-9]
 */
export const cleanBangladeshiPhoneNumber = (raw: string): string => {
  if (!raw) return '';

  // 1. Convert Bengali numerals ০-৯ to 0-9
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const text = String(raw).replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));

  // 2. Extract only digits
  let digits = text.replace(/\D/g, '');
  if (!digits) return '';

  // 3. If someone pasted a 10-digit number missing leading '0' (e.g. 17xxxxxxxx)
  if (digits.length === 10 && digits.startsWith('1')) {
    digits = '0' + digits;
  }

  // 4. Look for an 11-digit Bangladeshi mobile number anywhere in the string:
  // Starts with 01 followed by 3-9 and 8 more digits (013, 014, 015, 016, 017, 018, 019)
  const bdMatch = digits.match(/01[3-9]\d{8}/);
  if (bdMatch) {
    return bdMatch[0];
  }

  // 5. If international prefixes exist without the regex catching (e.g. typing or partial):
  if (digits.startsWith('0088') && digits.length > 4) {
    digits = digits.slice(4);
  } else if (digits.startsWith('880') && digits.length > 3) {
    digits = digits.slice(2);
  } else if (digits.startsWith('88') && digits.length > 2) {
    digits = digits.slice(2);
  }

  // 6. Return at most 11 digits
  return digits.slice(0, 11);
};

/**
 * Allows mobile number along with Name or Transaction ID in the same field:
 * - Converts Bengali numerals ০-৯ to 0-9
 * - Cleans +88/88 prefixes and hyphens on phone numbers if present
 * - Preserves names, letters, spaces, and Transaction IDs intact
 */
export const normalizePhoneNameOrTrxInput = (raw: string): string => {
  if (!raw) return '';
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let text = String(raw).replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
  // Strip +88 or 0088 right before 01[3-9]
  text = text.replace(/(?:\+?88|0088)(01[3-9]\d{8})/g, '$1');
  // Strip hyphen inside 01712-345678 format
  text = text.replace(/\b(01[3-9]\d{2})-(\d{6})\b/g, '$1$2');
  return text;
};

interface CashInViewProps {
  accounts: CashInAccount[];
  transactions: CashInTransaction[];
  contacts: Contact[];
  currency: string;
  lang: 'bn' | 'en';
  themeColor: string;
  onSaveAccount: (account: CashInAccount) => Promise<void> | void;
  onDeleteAccount: (accountId: string) => Promise<void> | void;
  onSaveTransaction: (tx: CashInTransaction, updatedAccount?: CashInAccount) => Promise<void> | void;
  onDeleteTransaction: (txId: string, refundAccount?: boolean) => Promise<void> | void;
  onClearAccountHistory?: (accountId: string) => Promise<void> | void;
  onSaveCustomerTransaction?: (data: {
    amount: number;
    type: 'GAVE' | 'GOT';
    note: string;
    billNo: string;
    date: string;
    attachFile?: string;
    signature?: string;
    contactId?: string;
    transactionId?: string;
  }) => Promise<void> | void;
}

export function CashInView({
  accounts,
  transactions,
  contacts,
  currency,
  lang,
  themeColor,
  onSaveAccount,
  onDeleteAccount,
  onSaveTransaction,
  onDeleteTransaction,
  onClearAccountHistory,
  onSaveCustomerTransaction
}: CashInViewProps) {
  // Input Form States
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [formError, setFormError] = useState('');

  // Category selection: বিকাশ (bkash), নগদ (nagad), ফ্লেক্সিলোড (flexiload), নিজ (own)
  const [selectedCategory, setSelectedCategory] = useState<'bkash' | 'nagad' | 'flexiload' | 'own'>('bkash');

  // New Baki Auto-Entry Feature
  const [bakiAutoEntryContact, setBakiAutoEntryContact] = useState<Contact | null>(null);
  const [showBakiSearchModal, setShowBakiSearchModal] = useState(false);
  const [bakiSearchQuery, setBakiSearchQuery] = useState('');
  const [bakiCustomLabel, setBakiCustomLabel] = useState<string>('বিকাশ');
  const [isPostCashInBakiSearch, setIsPostCashInBakiSearch] = useState(false);
  const [isSavingPostBaki, setIsSavingPostBaki] = useState(false);
  const [targetTxForBaki, setTargetTxForBaki] = useState<CashInTransaction | null>(null);

  // Desktop mode state synced with MainDashboard
  const [isDesktopMode, setIsDesktopMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('hellopoint_desktop_mode');
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' && window.innerWidth >= 1024;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const syncDesktop = () => {
      try {
        const saved = localStorage.getItem('hellopoint_desktop_mode');
        if (saved !== null) setIsDesktopMode(saved === 'true');
      } catch {}
    };
    window.addEventListener('desktop_mode_changed', syncDesktop);
    window.addEventListener('storage', syncDesktop);
    return () => {
      window.removeEventListener('desktop_mode_changed', syncDesktop);
      window.removeEventListener('storage', syncDesktop);
    };
  }, []);

  // Processing & Loading State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [successTx, setSuccessTx] = useState<{
    tx: CashInTransaction;
    account?: CashInAccount;
    prevBalance?: number;
    newBalance?: number;
    destinationAccount?: CashInAccount;
    destinationNewBalance?: number;
    bakiCustomer?: Contact;
  } | null>(null);

  // Modals & Forms
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddBalanceModal, setShowAddBalanceModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CashInAccount | null>(null);
  const [activeAccountForRecharge, setActiveAccountForRecharge] = useState<CashInAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<CashInAccount | null>(null);
  const [txToDelete, setTxToDelete] = useState<CashInTransaction | null>(null);

  // Add Account form fields
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [accModalError, setAccModalError] = useState('');

  // Add Balance form fields
  const [selectedAccIdForBalance, setSelectedAccIdForBalance] = useState<string>('');
  const [balanceAddAmount, setBalanceAddAmount] = useState('');
  const [balanceModalError, setBalanceModalError] = useState('');

  // Recharge History and Edit States
  const [editingRechargeId, setEditingRechargeId] = useState<string | null>(null);
  const [editingRechargeAmount, setEditingRechargeAmount] = useState<string>('');
  const [confirmDeleteRechargeId, setConfirmDeleteRechargeId] = useState<string | null>(null);
  const [rechargeSuccessMsg, setRechargeSuccessMsg] = useState<string>('');

  // Quick Recharge on Card states
  const [quickRechargeAmounts, setQuickRechargeAmounts] = useState<Record<string, string>>({});
  const [quickRechargeLoading, setQuickRechargeLoading] = useState<string | null>(null);
  const [quickRechargeFeedback, setQuickRechargeFeedback] = useState<{ accId: string; msg: string } | null>(null);

  // Cash-In Transaction Edit States
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editTxAmount, setEditTxAmount] = useState<string>('');
  const [editTxPhone, setEditTxPhone] = useState<string>('');
  const [editTxName, setEditTxName] = useState<string>('');
  const [editTxCategory, setEditTxCategory] = useState<'bkash' | 'nagad' | 'flexiload' | 'own' | 'other'>('bkash');
  const [editTxIsOwnNumber, setEditTxIsOwnNumber] = useState<boolean>(false);

  // Clear all history states
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  // Unified History states: filter, search, copy & inline accordion
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [justPastedPhone, setJustPastedPhone] = useState(false);
  const [expandedAccIdForHistory, setExpandedAccIdForHistory] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [hideRunningBalance, setHideRunningBalance] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hellopoint_hide_running_bal') === 'true';
    } catch {
      return false;
    }
  });
  const [historyFilter, setHistoryFilter] = useState<'all' | 'cashin' | 'recharge'>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  const [cardDensity, setCardDensity] = useState<'compact' | 'comfortable' | 'large'>(() => {
    try {
      return (localStorage.getItem('hellopoint_card_density') as 'compact' | 'comfortable' | 'large') || 'compact';
    } catch {
      return 'compact';
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const density = (localStorage.getItem('hellopoint_card_density') as 'compact' | 'comfortable' | 'large') || 'compact';
        setCardDensity(density);
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleHideRunningBalance = () => {
    setHideRunningBalance(prev => {
      const next = !prev;
      try {
        localStorage.setItem('hellopoint_hide_running_bal', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toBengaliNumber = (num: number | string): string => {
    if (lang !== 'bn') return String(num);
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
  };

  const getNormalizedDateKey = (dateStr?: string) => {
    if (!dateStr) return 'unknown';
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.substring(0, 10);
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {}
    return dateStr.substring(0, 10);
  };

  const isDateToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const key = getNormalizedDateKey(dateStr);
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (key === todayKey) return true;
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      }
    } catch {}
    return false;
  };

  const displayTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const formatFullDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Subview navigation: 'main' (Cash-in form/dashboard), 'daily_report' (full-page), 'monthly_report' (full-page)
  const [subView, setSubView] = useState<'main' | 'daily_report' | 'monthly_report'>('main');

  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Month-wise analytics filter (Default to current month, last 6 months)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Requirement: When phone number is typed, check past transactions for this number.
  // Show up to 3 most recent transactions formatted strictly as: last(xxx) ৳0000 name (recent on top)
  const lastCashInMatches = useMemo(() => {
    const rawDigits = customerPhone.replace(/\D/g, '');
    const cleanP = cleanBangladeshiPhoneNumber(customerPhone) || (rawDigits.length >= 11 ? rawDigits.slice(-11) : '');
    if (!cleanP || cleanP.length < 11) return [];

    // Filter past transactions matching this customerPhone
    const matches = transactions.filter(t => {
      if (!t.customerPhone) return false;
      const tClean = cleanBangladeshiPhoneNumber(t.customerPhone) || t.customerPhone.replace(/\D/g, '');
      return tClean === cleanP;
    });

    if (matches.length === 0) return [];

    // Sort descending to get the most recent transactions on top
    matches.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date).getTime() || 0;
      const timeB = new Date(b.createdAt || b.date).getTime() || 0;
      return timeB - timeA;
    });

    // Return up to 3 most recent transactions
    return matches.slice(0, 3).map(tx => {
      const matchedAcc = accounts.find(a => 
        a.id === tx.accountId ||
        (tx.accountNumber && a.accountNumber === tx.accountNumber) ||
        (tx.lastDigits && a.lastDigits === tx.lastDigits)
      );

      const lastDigits = tx.lastDigits || matchedAcc?.lastDigits || (tx.accountNumber ? tx.accountNumber.replace(/\D/g, '').slice(-4) : '');

      let bakiName = tx.customerName ? tx.customerName.replace(/\s*\((বাকি|baki)\)/gi, '').trim() : '';
      if (!bakiName && tx.note && tx.note.includes('বাকির খাতায় অটো এন্ট্রি:')) {
        bakiName = tx.note.split('বাকির খাতায় অটো এন্ট্রি:')[1]?.trim() || '';
      }

      return {
        tx,
        lastDigits,
        amount: tx.amount,
        bakiName
      };
    });
  }, [customerPhone, transactions, accounts]);

  // Filtered contacts for the Baki Customer Search Modal opened via '+' button
  const filteredBakiContacts = useMemo(() => {
    if (!contacts || contacts.length === 0) return [];
    if (!bakiSearchQuery.trim()) return contacts;
    const q = bakiSearchQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return contacts.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').replace(/\D/g, '');
      if (name.includes(q)) return true;
      if (digits && phone.includes(digits)) return true;
      return false;
    });
  }, [contacts, bakiSearchQuery]);

  // Post-Cash-In Category Update Handler (inside Success Modal)
  const handleUpdateSuccessTxCategory = async (newCat: 'bkash' | 'nagad' | 'flexiload' | 'own') => {
    setSelectedCategory(newCat);
    if (!successTx) return;
    const isOwn = newCat === 'own' || isPhoneOwnAccount(successTx.tx.customerPhone, accounts);
    const updatedTx: CashInTransaction = {
      ...successTx.tx,
      category: newCat,
      isOwnNumberTransfer: isOwn,
      note: isOwn && !successTx.tx.note
        ? (lang === 'bn' ? 'নিজ নাম্বারে লেনদেন' : 'Own number transfer')
        : successTx.tx.note
    };
    setSuccessTx(prev => prev ? { ...prev, tx: updatedTx } : null);
    try {
      await onSaveTransaction(updatedTx, successTx.account);
    } catch (err) {
      console.error('Failed to update post-cashin category:', err);
    }
  };

  const handleSelectBakiCustomer = async (contact: Contact) => {
    const serviceLabel = bakiCustomLabel.trim() || (lang === 'bn' ? 'বিকাশ' : 'bKash');

    // If selecting for a specific transaction (via + button on transaction card)
    if (targetTxForBaki) {
      setIsSavingPostBaki(true);
      try {
        const phone = targetTxForBaki.customerPhone || '';
        const ownTag = targetTxForBaki.isOwnNumberTransfer ? (lang === 'bn' ? ' [নিজ নম্বর]' : ' [Own Number]') : '';

        // 1. Record baki ledger "GAVE" (দিয়েছি) entry
        if (onSaveCustomerTransaction) {
          await onSaveCustomerTransaction({
            amount: targetTxForBaki.amount,
            type: 'GAVE',
            note: phone ? `${serviceLabel} (${phone})${ownTag}` : `${serviceLabel}${ownTag}`,
            billNo: phone,
            date: targetTxForBaki.date ? targetTxForBaki.date.split('T')[0] : new Date().toISOString().split('T')[0],
            contactId: contact.id
          });
        }

        // 2. Update cash in transaction customerName and note
        const updatedTx: CashInTransaction = {
          ...targetTxForBaki,
          customerName: `${contact.name} (বাকি)`,
          note: `বাকির খাতায় এন্ট্রি: ${contact.name}`
        };
        const matchedAccount = accounts.find(a => a.id === targetTxForBaki.accountId);
        await onSaveTransaction(updatedTx, matchedAccount);
      } catch (err) {
        console.error('Failed to save baki transaction for cash-in item:', err);
      } finally {
        setIsSavingPostBaki(false);
        setTargetTxForBaki(null);
        setShowBakiSearchModal(false);
      }
      return;
    }

    // If selecting from post-cashin success modal
    if (isPostCashInBakiSearch && successTx) {
      setIsSavingPostBaki(true);
      try {
        const phone = successTx.tx.customerPhone || '';
        const ownTag = successTx.tx.isOwnNumberTransfer ? (lang === 'bn' ? ' [নিজ নম্বর]' : ' [Own Number]') : '';

        // 1. Record baki ledger "GAVE" (দিয়েছি) entry
        if (onSaveCustomerTransaction) {
          await onSaveCustomerTransaction({
            amount: successTx.tx.amount,
            type: 'GAVE',
            note: phone ? `${serviceLabel} (${phone})${ownTag}` : `${serviceLabel}${ownTag}`,
            billNo: phone,
            date: successTx.tx.date || new Date().toISOString().split('T')[0],
            contactId: contact.id
          });
        }

        // 2. Update cash in transaction customerName and note
        const updatedTx: CashInTransaction = {
          ...successTx.tx,
          customerName: `${contact.name} (বাকি)`,
          note: `বাকির খাতায় এন্ট্রি: ${contact.name}`
        };
        await onSaveTransaction(updatedTx, successTx.account);

        // Update current success modal view
        setSuccessTx(prev => prev ? {
          ...prev,
          tx: updatedTx,
          bakiCustomer: contact
        } : null);
      } catch (err) {
        console.error('Failed to save post-cashin baki transaction:', err);
      } finally {
        setIsSavingPostBaki(false);
        setIsPostCashInBakiSearch(false);
        setShowBakiSearchModal(false);
      }
      return;
    }

    // Default: selecting before cash-in
    setBakiAutoEntryContact(contact);
    if (!customerName) {
      setCustomerName(contact.name);
    }
    const cleanContactPhone = cleanBangladeshiPhoneNumber(contact.phone);
    if (!customerPhone && cleanContactPhone) {
      setCustomerPhone(cleanContactPhone);
    }
    setShowBakiSearchModal(false);
  };

  // Total balance calculation across all numbers
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
  }, [accounts]);

  // Helper to find the latest transaction/activity timestamp for an account
  const getAccountLatestTxTime = (acc: CashInAccount): number => {
    let latest = 0;
    // 1. Check in cash-in transactions
    for (const tx of transactions) {
      if (
        tx.accountId === acc.id || 
        (tx.accountNumber && tx.accountNumber === acc.accountNumber) ||
        (tx.lastDigits && tx.lastDigits === acc.lastDigits)
      ) {
        const t = new Date(tx.createdAt || tx.date).getTime() || 0;
        if (t > latest) latest = t;
      }
    }
    // 2. Check in balance recharge records
    if (Array.isArray(acc.rechargeHistory)) {
      for (const r of acc.rechargeHistory) {
        const t = new Date(r.createdAt || r.date).getTime() || 0;
        if (t > latest) latest = t;
      }
    }
    // 3. Fallback to account update or creation time
    if (latest === 0) {
      latest = new Date(acc.updatedAt || acc.createdAt || 0).getTime() || 0;
    }
    return latest;
  };

  // Requirement: Recently transacted Cash-In SIM number is ALWAYS at the top!
  const sortedAccountsByBalance = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const timeA = getAccountLatestTxTime(a);
      const timeB = getAccountLatestTxTime(b);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return (Number(b.balance) || 0) - (Number(a.balance) || 0);
    });
  }, [accounts, transactions]);

  // Note: lastDigits is NOT auto-selected anymore so user can freely select or type it manually

  // Requirement: "নিজ নাম্বার থেকে নিজ নাম্বারে কোনো লেন্দেন হলে তা কমিশনে হিসাব গন্য হবে না।"
  // এবং "নিজ নামে ক্যাটাগরি এন্ট্রি হয়েছে এমন কোনো লেনদেন হলে তা কমিশনে হিসাব গন্য হবে না।"
  const isDetectedOwnNumber = useMemo(() => {
    return isPhoneOwnAccount(customerPhone, accounts);
  }, [customerPhone, accounts]);

  const isOwnNumber = useMemo(() => {
    return selectedCategory === 'own' || isDetectedOwnNumber;
  }, [selectedCategory, isDetectedOwnNumber]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    try {
      localStorage.setItem('hellopoint_clipboard_fallback', text);
    } catch {}
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Paste helper for Customer Number / Name / TrxID input
  const handlePasteCustomerPhone = async () => {
    let pastedText = '';
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        pastedText = await navigator.clipboard.readText();
      }
    } catch {
      // Fallback if clipboard read permission is blocked by browser/iframe
    }
    if (!pastedText || !pastedText.trim()) {
      try {
        pastedText = localStorage.getItem('hellopoint_clipboard_fallback') || '';
      } catch {}
    }
    if (pastedText && pastedText.trim()) {
      setCustomerPhone(normalizePhoneNameOrTrxInput(pastedText.trim()));
      setFormError('');
      setJustPastedPhone(true);
      setTimeout(() => setJustPastedPhone(false), 1200);
    }
  };

  // Find matching account by last 4 digits (or exact match)
  const findMatchingAccount = (digits: string): CashInAccount | undefined => {
    const cleanDigits = digits.trim().replace(/\D/g, '');
    if (!cleanDigits) return undefined;
    return accounts.find(acc => {
      const cleanAcc = acc.accountNumber.replace(/\D/g, '');
      return cleanAcc.endsWith(cleanDigits) || acc.lastDigits === cleanDigits;
    });
  };

  // Generate last 6 months list with Bengali and English names
  const last6Months = useMemo(() => {
    const months = [];
    const banglaMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      months.push({
        key,
        year,
        monthIdx,
        labelBn: banglaMonths[monthIdx],
        labelEn: englishMonths[monthIdx]
      });
    }
    return months;
  }, []);

  // Compute month analytics for the selected month
  const selectedMonthStats = useMemo(() => {
    const monthTxs = transactions.filter(tx => {
      const txDate = tx.createdAt ? tx.createdAt.slice(0, 7) : (tx.date ? tx.date.slice(0, 7) : '');
      return txDate === selectedMonthKey;
    });

    const totalCashIn = monthTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    // 15 Taka profit per 1000 Taka (1.5%) - excluding own number transfers
    const totalProfit = monthTxs
      .filter(tx => !isTxOwnNumberTransfer(tx, accounts))
      .reduce((sum, tx) => sum + ((Number(tx.amount) || 0) / 1000) * 15, 0);
    const txCount = monthTxs.length;

    const currentMonthObj = last6Months.find(m => m.key === selectedMonthKey);

    return {
      totalCashIn,
      totalProfit,
      txCount,
      transactions: monthTxs,
      labelBn: currentMonthObj?.labelBn || selectedMonthKey,
      labelEn: currentMonthObj?.labelEn || selectedMonthKey
    };
  }, [transactions, selectedMonthKey, last6Months, accounts]);

  // Daily Report stats and SIM-wise breakdown (এক নজরে একি সারিতে কোন নাম্বার থেকে কত ক্যাশ ইন)
  const selectedDailyStats = useMemo(() => {
    const dayTxs = transactions.filter(tx => {
      const d = tx.createdAt ? tx.createdAt.slice(0, 10) : (tx.date ? tx.date.slice(0, 10) : '');
      return d === selectedDailyDate;
    });

    const sortedDayTxs = [...dayTxs].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date).getTime() || 0;
      const timeB = new Date(b.createdAt || b.date).getTime() || 0;
      return timeB - timeA;
    });

    const totalCashIn = sortedDayTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    // 15 Taka profit per 1000 Taka (1.5%) - excluding own number transfers
    const totalProfit = sortedDayTxs
      .filter(tx => !isTxOwnNumberTransfer(tx, accounts))
      .reduce((sum, tx) => sum + ((Number(tx.amount) || 0) / 1000) * 15, 0);
    const txCount = sortedDayTxs.length;

    // Requirement: "এক নজরে একি সারিতে থাকবে কোন নাম্বার থেকে কত টাকা ক্যাশ ইন হলো।"
    const simMap = new Map<string, {
      id: string;
      accountNumber: string;
      accountName?: string;
      lastDigits: string;
      totalAmount: number;
      count: number;
    }>();

    for (const acc of accounts) {
      simMap.set(acc.lastDigits, {
        id: acc.id,
        accountNumber: acc.accountNumber,
        accountName: acc.accountName,
        lastDigits: acc.lastDigits,
        totalAmount: 0,
        count: 0
      });
    }

    for (const tx of sortedDayTxs) {
      const key = tx.lastDigits || 'other';
      if (simMap.has(key)) {
        const item = simMap.get(key)!;
        item.totalAmount += Number(tx.amount) || 0;
        item.count += 1;
      } else {
        simMap.set(key, {
          id: tx.accountId || key,
          accountNumber: tx.accountNumber || `...${tx.lastDigits}`,
          accountName: tx.accountName,
          lastDigits: tx.lastDigits || '----',
          totalAmount: Number(tx.amount) || 0,
          count: 1
        });
      }
    }

    const simBreakdown = Array.from(simMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      date: selectedDailyDate,
      totalCashIn,
      totalProfit,
      txCount,
      transactions: sortedDayTxs,
      simBreakdown
    };
  }, [transactions, accounts, selectedDailyDate]);

  // Format daily date display in Bengali/English
  const formatDailyDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const banglaMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
      const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let prefix = '';
      if (dateStr === todayStr) {
        prefix = lang === 'bn' ? 'আজ, ' : 'Today, ';
      } else if (dateStr === yesterdayStr) {
        prefix = lang === 'bn' ? 'গতকাল, ' : 'Yesterday, ';
      }

      if (lang === 'bn') {
        return `${prefix}${toBengaliNumber(d)} ${banglaMonths[m - 1]} ${toBengaliNumber(y)}`;
      }
      return `${prefix}${d} ${englishMonths[m - 1]} ${y}`;
    } catch {
      return dateStr;
    }
  };

  // Change selected daily date by +/- days
  const changeDailyDateByDays = (delta: number) => {
    try {
      const [y, m, d] = selectedDailyDate.split('-').map(Number);
      const current = new Date(y, m - 1, d);
      current.setDate(current.getDate() + delta);
      const nextY = current.getFullYear();
      const nextM = String(current.getMonth() + 1).padStart(2, '0');
      const nextD = String(current.getDate()).padStart(2, '0');
      setSelectedDailyDate(`${nextY}-${nextM}-${nextD}`);
    } catch {
      // fallback
    }
  };

  // Google Sheets / CSV Export handler for the SELECTED month
  const handleExportMonthGoogleSheet = () => {
    const monthTxs = selectedMonthStats.transactions;
    if (monthTxs.length === 0) {
      alert(lang === 'bn' ? 'এই মাসে কোনো লেনদেন পাওয়া যায়নি' : 'No transactions found for this month');
      return;
    }

    const headers = [
      'তারিখ ও সময় (Date)',
      'ক্যাটাগরি (Category)',
      'কাস্টমার নম্বর (Customer Phone)',
      'কাস্টমার নাম (Customer Name)',
      'টাকার পরিমাণ (Amount)',
      'লাস্ট ৪ ডিজিট (Last Digits)',
      'প্রেরক নম্বর (Sender Number)',
      'মুনাফা ১৫টাকা/হাজার (Profit @15/1k)'
    ];

    const rows = monthTxs.map(tx => {
      const formattedDate = new Date(tx.createdAt || tx.date).toLocaleString('bn-BD');
      const isOwn = isTxOwnNumberTransfer(tx, accounts);
      const profit = isOwn ? '0.00 (নিজ নম্বর)' : ((tx.amount / 1000) * 15).toFixed(2);
      const catName = tx.category === 'own' ? 'নিজ' : tx.category === 'nagad' ? 'নগদ' : tx.category === 'flexiload' ? 'ফ্লেক্সিলোড' : 'বিকাশ';
      return [
        `"${formattedDate}"`,
        `"${catName}"`,
        `"${tx.customerPhone}"`,
        `"${tx.customerName || ''}"`,
        tx.amount,
        `"${tx.lastDigits}"`,
        `"${tx.accountNumber || ''}"`,
        profit
      ];
    });

    const summaryRow = [
      `"মোট (${selectedMonthStats.labelBn})"`,
      '""',
      '""',
      '""',
      selectedMonthStats.totalCashIn,
      '""',
      '""',
      selectedMonthStats.totalProfit.toFixed(2)
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(',')), summaryRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HelloPoint_CashIn_${selectedMonthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Keyboard shortcut: Escape closes full-page / full-screen view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAddBalanceModal) {
        setShowAddBalanceModal(false);
        setEditingRechargeId(null);
        setEditingRechargeAmount('');
        setConfirmDeleteRechargeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddBalanceModal]);

  // Export combined history for a single SIM account as CSV / Excel
  const handleExportSingleAccountHistory = (acc: CashInAccount, items: UnifiedHistoryItem[]) => {
    if (!acc || items.length === 0) {
      alert(lang === 'bn' ? 'কোনো লেনদেন হিস্ট্রি পাওয়া যায়নি' : 'No history found to export');
      return;
    }
    const headers = [
      'তারিখ ও সময় (Date & Time)',
      'ধরন (Type)',
      'বিবরণ / গ্রাহক নম্বর (Details / Customer)',
      'গ্রাহক নাম (Customer Name)',
      'পরিমাণ (Amount)'
    ];
    const rows = items.map(item => {
      const formattedDate = formatCompactDateTime(item.date, lang);
      const typeLabel = item.type === 'cashin' ? 'ক্যাশ-ইন' : 'ব্যালেন্স রিচার্জ';
      const details = item.type === 'cashin' ? (item.customerPhone || '') : (item.info || 'ব্যালেন্স রিচার্জ');
      const name = item.customerName || '';
      const amt = item.type === 'cashin' ? `-${item.amount}` : `+${item.amount}`;
      return [
        `"${formattedDate}"`,
        `"${typeLabel}"`,
        `"${details}"`,
        `"${name}"`,
        `"${amt}"`
      ];
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CashIn_${acc.accountNumber}_History.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Form Submit
  const handleSubmitCashIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const normalizedEntry = normalizePhoneNameOrTrxInput(customerPhone).trim();
    const extractedPhone = cleanBangladeshiPhoneNumber(normalizedEntry);
    const cleanPhone = normalizedEntry || extractedPhone;
    const numAmount = parseFloat(amount);
    const cleanLastDigits = lastDigits.trim().replace(/\D/g, '');

    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError(lang === 'bn' ? 'সঠিক টাকার পরিমাণ লিখুন' : 'Please enter a valid amount');
      return;
    }

    // Strict requirement: "লাস্ট নাম্বার সিলেক্ট না করে ক্যাশ ইন করতে গেলে ক্যাশ ইন হবে না।"
    if (!cleanLastDigits) {
      setFormError(
        lang === 'bn' 
          ? 'অনুগ্রহ করে একটি সিম নম্বর নির্বাচন করুন' 
          : 'Please select a SIM number'
      );
      return;
    }

    // Match account strictly from selected SIM number
    const matchedAccount = findMatchingAccount(cleanLastDigits);
    if (!matchedAccount) {
      setFormError(
        lang === 'bn' 
          ? `"${cleanLastDigits}" নম্বরের সিম পাওয়া যায়নি!`
          : `No account found matching SIM "${cleanLastDigits}"!`
      );
      return;
    }

    // Strict balance check: verify the account has enough balance
    const currentAccBal = Number(matchedAccount.balance) || 0;
    if (currentAccBal < numAmount) {
      setFormError(
        lang === 'bn'
          ? `পর্যাপ্ত ব্যালেন্স নেই! "${matchedAccount.accountNumber}" নম্বরে বর্তমান ব্যালেন্স মাত্র ${currency}${currentAccBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          : `Insufficient balance! Account "${matchedAccount.accountNumber}" only has ${currency}${currentAccBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      );
      return;
    }

    // Trigger smooth loading animation
    setIsProcessing(true);
    setProcessingProgress(15);

    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 95;
        }
        return prev + 30;
      });
    }, 120);

    setTimeout(async () => {
      clearInterval(interval);
      setProcessingProgress(100);

      // Perform deduction if matchedAccount exists
      let prevBal: number | undefined = undefined;
      let newBal: number | undefined = undefined;
      let updatedAccount: CashInAccount | undefined = undefined;

      if (matchedAccount) {
        prevBal = matchedAccount.balance;
        newBal = Math.max(0, prevBal - numAmount);
        updatedAccount = {
          ...matchedAccount,
          balance: newBal,
          updatedAt: new Date().toISOString()
        };
      }

      const targetBaki = bakiAutoEntryContact;
      const shouldRecordBaki = Boolean(targetBaki);

      // Auto-recharge destination SIM if this is an own-number transfer
      const destAccount = findOwnAccountByPhone(extractedPhone || cleanPhone, accounts);
      let updatedDestAccount: CashInAccount | undefined = undefined;

      if (destAccount) {
        // If sender and receiver are the same account (or different account)
        const baseDestAcc = (updatedAccount && updatedAccount.id === destAccount.id) ? updatedAccount : destAccount;
        const destCurrentBal = Number(baseDestAcc.balance) || 0;
        const destNewBal = destCurrentBal + numAmount;
        const rechargeRec: AccountRechargeRecord = {
          id: 'rec-auto-' + Date.now(),
          amount: numAmount,
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          note: matchedAccount 
            ? (lang === 'bn' 
                ? `ব্যালেন্স ট্রান্সফার (${matchedAccount.accountNumber || matchedAccount.accountName || 'অন্য সিম'}) হতে` 
                : `Transfer from ${matchedAccount.accountNumber || matchedAccount.accountName || 'other SIM'}`)
            : (lang === 'bn' ? 'ব্যালেন্স ট্রান্সফার হতে অটো রিচার্জ' : 'Auto recharge from balance transfer')
        };
        const prevHistory = baseDestAcc.rechargeHistory || [];
        updatedDestAccount = {
          ...baseDestAcc,
          balance: destNewBal,
          rechargeHistory: [rechargeRec, ...prevHistory],
          updatedAt: new Date().toISOString()
        };
      }

      // Always default to 'bkash' on initial entry so even if the post-tx modal is closed immediately, it stays recorded as bKash
      const defaultCat: 'bkash' | 'nagad' | 'flexiload' | 'own' = 'bkash';
      const initialIsOwn = Boolean(destAccount) || isDetectedOwnNumber;

      const newTx: CashInTransaction = {
        id: 'tx-cashin-' + Date.now(),
        customerPhone: cleanPhone,
        customerName: shouldRecordBaki 
          ? `${targetBaki.name} (বাকি)` 
          : (destAccount ? (destAccount.accountName || destAccount.accountNumber || (lang === 'bn' ? 'নিজ নম্বর' : 'Own Number')) : (customerName.trim() || undefined)),
        amount: numAmount,
        lastDigits: cleanLastDigits || (matchedAccount ? matchedAccount.lastDigits : ''),
        accountId: matchedAccount?.id,
        accountNumber: matchedAccount?.accountNumber,
        accountName: matchedAccount?.accountName,
        category: defaultCat,
        isOwnNumberTransfer: initialIsOwn,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        note: shouldRecordBaki 
          ? `বাকির খাতায় অটো এন্ট্রি: ${targetBaki.name}` 
          : (destAccount 
              ? (lang === 'bn' 
                  ? `এক সিম থেকে অন্য সিমে ট্রান্সফার (অটো রিচার্জ: ${destAccount.accountNumber})` 
                  : `Transfer between own SIMs (Auto recharge: ${destAccount.accountNumber})`)
              : (initialIsOwn ? (lang === 'bn' ? 'নিজ নাম্বারে লেনদেন' : 'Own number transfer') : undefined))
      };

      try {
        // 1. Save cash-in transaction and deduct from sender account
        await onSaveTransaction(newTx, updatedAccount);

        // 2. Auto-recharge receiving SIM account balance
        if (updatedDestAccount) {
          if (updatedAccount && updatedDestAccount.id === updatedAccount.id) {
            // If sender and receiver are the same account, save the merged state
            await onSaveAccount(updatedDestAccount);
          } else {
            await onSaveAccount(updatedDestAccount);
          }
        }

        // Requirement: Automatically create a "GAVE" (দিয়েছি) transaction in that customer's baki ledger!
        if (shouldRecordBaki && targetBaki && onSaveCustomerTransaction) {
          try {
            const catLabels: Record<string, string> = {
              bkash: lang === 'bn' ? 'বিকাশ' : 'bKash',
              nagad: lang === 'bn' ? 'নগদ' : 'Nagad',
              flexiload: lang === 'bn' ? 'ফ্লেক্সিলোড' : 'Flexiload',
              own: lang === 'bn' ? 'নিজ' : 'Own'
            };
            const serviceLabel = catLabels[selectedCategory] || (lang === 'bn' ? 'বিকাশ' : 'bKash');
            const ownTag = isOwnNumber ? (lang === 'bn' ? ' [নিজ নম্বর]' : ' [Own Number]') : '';

            await onSaveCustomerTransaction({
              amount: numAmount,
              type: 'GAVE',
              note: `${serviceLabel} (${cleanPhone})${ownTag}`,
              billNo: cleanPhone,
              date: new Date().toISOString().split('T')[0],
              contactId: targetBaki.id
            });
          } catch (bakiErr) {
            console.error('Failed to auto-save customer baki entry:', bakiErr);
          }
        }

        setIsProcessing(false);
        setSuccessTx({
          tx: newTx,
          account: updatedAccount,
          prevBalance: prevBal,
          newBalance: newBal,
          destinationAccount: updatedDestAccount,
          destinationNewBalance: updatedDestAccount?.balance,
          bakiCustomer: shouldRecordBaki ? targetBaki : undefined
        });

        // Reset form
        setCustomerPhone('');
        setCustomerName('');
        setBakiAutoEntryContact(null);
        setAmount('');
        setLastDigits('');
        setSelectedCategory('bkash');
      } catch (err) {
        setIsProcessing(false);
        setFormError(lang === 'bn' ? 'ক্যাশ-ইন সম্পন্ন করতে সমস্যা হয়েছে' : 'Failed to complete cash-in');
      }
    }, 600);
  };

  // Add / Edit Account Handler
  const handleSaveAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccModalError('');

    const cleanNum = newAccNumber.trim();
    const cleanBal = parseFloat(newAccBalance) || 0;

    if (!cleanNum || cleanNum.length < 4) {
      setAccModalError(lang === 'bn' ? 'সঠিক মোবাইল নম্বর লিখুন (কমপক্ষে ৪ ডিজিট)' : 'Please enter a valid number (min 4 digits)');
      return;
    }

    const digits = cleanNum.slice(-4);

    const accountToSave: CashInAccount = {
      id: editingAccount?.id || 'acc-' + Date.now(),
      accountNumber: cleanNum,
      accountName: newAccName.trim() || undefined,
      balance: cleanBal,
      lastDigits: digits,
      rechargeHistory: editingAccount?.rechargeHistory || [],
      createdAt: editingAccount?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    soundEngine.playSimBalanceRechargeSound();
    await onSaveAccount(accountToSave);
    setShowAddAccountModal(false);
    setEditingAccount(null);
    setNewAccNumber('');
    setNewAccName('');
    setNewAccBalance('');
  };

  // Unified History Item combining Cash-In and Recharge
  interface UnifiedHistoryItem {
    id: string;
    type: 'cashin' | 'recharge';
    date: string;
    amount: number;
    customerPhone?: string;
    customerName?: string;
    info?: string;
    rawTx?: CashInTransaction;
    rawRecharge?: AccountRechargeRecord;
    runningBalance?: number;
  }

  // Format compact date & time matching "06 Sep, 01:15 AM"
  const formatCompactDateTime = (dateStr: string, currentLang: 'bn' | 'en') => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const monthsBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
      const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = currentLang === 'bn' ? monthsBn[d.getMonth()] : monthsEn[d.getMonth()];
      
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const hourStr = String(hours).padStart(2, '0');

      return `${day} ${month}, ${hourStr}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  // Helper to build combined history list for any account (newest first) with accurate running balance
  const getCombinedHistoryForAccount = (acc: CashInAccount): UnifiedHistoryItem[] => {
    const list: UnifiedHistoryItem[] = [];

    // 1. Recharges (↙️)
    if (Array.isArray(acc.rechargeHistory)) {
      acc.rechargeHistory.forEach(r => {
        list.push({
          id: 'rec-' + r.id,
          type: 'recharge',
          date: r.date || r.createdAt,
          amount: Number(r.amount) || 0,
          info: r.note || (lang === 'bn' ? 'ব্যালেন্স রিচার্জ' : 'Recharge'),
          rawRecharge: r
        });
      });
    }

    // 2. Cash-Ins (↗️)
    const accCashIns = transactions.filter(tx => 
      tx.accountId === acc.id || 
      (tx.accountNumber && tx.accountNumber === acc.accountNumber) || 
      (tx.lastDigits && tx.lastDigits === acc.lastDigits)
    );

    accCashIns.forEach(tx => {
      list.push({
        id: 'tx-' + tx.id,
        type: 'cashin',
        date: tx.createdAt || tx.date,
        amount: Number(tx.amount) || 0,
        customerPhone: tx.customerPhone,
        customerName: tx.customerName,
        rawTx: tx
      });
    });

    // Sort newest first
    list.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeB - timeA;
    });

    // Calculate running balance backwards from acc.balance
    let running = Number(acc.balance) || 0;
    list.forEach(item => {
      item.runningBalance = Number(running.toFixed(2));
      if (item.type === 'cashin') {
        running = Number((running + item.amount).toFixed(2));
      } else {
        running = Number((running - item.amount).toFixed(2));
      }
    });

    return list;
  };

  // Currently active account selected for recharge/history (reactive with live accounts list)
  const currentActiveAccount = useMemo(() => {
    const targetId = selectedAccIdForBalance || activeAccountForRecharge?.id;
    return accounts.find(a => a.id === targetId) || activeAccountForRecharge;
  }, [accounts, selectedAccIdForBalance, activeAccountForRecharge]);

  // Combined history list for active account in modal (newest first)
  const activeAccountCombinedHistory = useMemo(() => {
    if (!currentActiveAccount) return [];
    return getCombinedHistoryForAccount(currentActiveAccount);
  }, [currentActiveAccount, transactions, lang]);

  // Total recharged for this active account
  const activeAccountTotalRecharged = useMemo(() => {
    return activeAccountCombinedHistory
      .filter(i => i.type === 'recharge')
      .reduce((sum, item) => sum + item.amount, 0);
  }, [activeAccountCombinedHistory]);

  // Total cash-in given from this active account
  const activeAccountTotalCashIn = useMemo(() => {
    return activeAccountCombinedHistory
      .filter(i => i.type === 'cashin')
      .reduce((sum, item) => sum + item.amount, 0);
  }, [activeAccountCombinedHistory]);

  // Commissionable cash-in given from this active account (excluding own-number transfers)
  const activeAccountCommissionableCashIn = useMemo(() => {
    return activeAccountCombinedHistory
      .filter(i => i.type === 'cashin' && !isTxOwnNumberTransfer(i.rawTx, accounts))
      .reduce((sum, item) => sum + item.amount, 0);
  }, [activeAccountCombinedHistory, accounts]);

  // Direct Tap to Recharge / Add Balance Handler (stores history record)
  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBalanceModalError('');

    const numAmount = parseFloat(balanceAddAmount);
    const targetId = selectedAccIdForBalance || activeAccountForRecharge?.id;

    if (!targetId) {
      setBalanceModalError(lang === 'bn' ? 'নম্বর সিলেক্ট করুন' : 'Please select an account');
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setBalanceModalError(lang === 'bn' ? 'টাকার সঠিক পরিমাণ লিখুন' : 'Please enter a valid amount');
      return;
    }

    const acc = accounts.find(a => a.id === targetId) || activeAccountForRecharge;
    if (!acc) return;

    const newRecord: AccountRechargeRecord = {
      id: 'rch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      amount: numAmount,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    const existingHistory = Array.isArray(acc.rechargeHistory) ? acc.rechargeHistory : [];
    const updatedHistory = [newRecord, ...existingHistory];
    const newBal = Number(((Number(acc.balance) || 0) + numAmount).toFixed(2));

    const updated: CashInAccount = {
      ...acc,
      balance: newBal,
      rechargeHistory: updatedHistory,
      updatedAt: new Date().toISOString()
    };

    soundEngine.playSimBalanceRechargeSound();
    await onSaveAccount(updated);

    // Keep modal open so user sees their new recharge record immediately in history!
    setBalanceAddAmount('');
    setRechargeSuccessMsg(
      lang === 'bn'
        ? `৳${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} রিচার্জ সফলভাবে যোগ হয়েছে!`
        : `Successfully added ${currency}${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} recharge!`
    );
    setTimeout(() => setRechargeSuccessMsg(''), 4000);
  };

  // Helper to extract short 4 digits for SIM account
  const getShortLast4 = (acc: CashInAccount) => {
    if (acc.lastDigits && acc.lastDigits.trim()) {
      return acc.lastDigits.trim();
    }
    const digits = (acc.accountNumber || '').replace(/\D/g, '');
    if (digits.length >= 4) {
      return digits.slice(-4);
    }
    if (acc.accountNumber && acc.accountNumber.trim()) {
      return acc.accountNumber.trim().slice(-4);
    }
    return '----';
  };

  // Quick direct recharge from card item
  const handleQuickRecharge = async (acc: CashInAccount) => {
    const rawVal = quickRechargeAmounts[acc.id] || '';
    const numAmount = parseFloat(rawVal);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setQuickRechargeLoading(acc.id);
    try {
      const newRecord: AccountRechargeRecord = {
        id: 'rch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        amount: numAmount,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const existingHistory = Array.isArray(acc.rechargeHistory) ? acc.rechargeHistory : [];
      const updatedHistory = [newRecord, ...existingHistory];
      const newBal = Number(((Number(acc.balance) || 0) + numAmount).toFixed(2));

      const updated: CashInAccount = {
        ...acc,
        balance: newBal,
        rechargeHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      };

      soundEngine.playSimBalanceRechargeSound();
      await onSaveAccount(updated);

      setQuickRechargeAmounts(prev => ({ ...prev, [acc.id]: '' }));
      setQuickRechargeFeedback({
        accId: acc.id,
        msg: `+${currency}${numAmount.toLocaleString('en-US')}`
      });
      setTimeout(() => {
        setQuickRechargeFeedback(curr => (curr?.accId === acc.id ? null : curr));
      }, 2500);
    } catch (err) {
      console.error('Failed to recharge account:', err);
    } finally {
      setQuickRechargeLoading(null);
    }
  };

  // Start editing a recharge record in history
  const handleStartEditRecharge = (rec: AccountRechargeRecord) => {
    setEditingRechargeId(rec.id);
    setEditingRechargeAmount(String(rec.amount));
    setConfirmDeleteRechargeId(null);
    setEditingTxId(null);
  };

  // Save the edited recharge amount and adjust account balance accordingly
  const handleSaveEditRecharge = async (recId: string) => {
    const acc = currentActiveAccount || accounts.find(a => a.id === (selectedAccIdForBalance || activeAccountForRecharge?.id)) || activeAccountForRecharge;
    if (!acc) return;

    const newAmount = parseFloat(editingRechargeAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
      alert(lang === 'bn' ? 'সঠিক টাকার পরিমাণ লিখুন' : 'Please enter a valid amount');
      return;
    }

    const history = Array.isArray(acc.rechargeHistory) ? [...acc.rechargeHistory] : [];
    const targetIdx = history.findIndex(r => r.id === recId);
    if (targetIdx === -1) return;

    const oldRecord = history[targetIdx];
    const oldAmount = Number(oldRecord.amount) || 0;
    const diff = Number((newAmount - oldAmount).toFixed(2));

    const updatedRecord: AccountRechargeRecord = {
      ...oldRecord,
      amount: newAmount,
      updatedAt: new Date().toISOString()
    };

    history[targetIdx] = updatedRecord;

    const currentBal = Number(acc.balance) || 0;
    const newBal = Number(Math.max(0, currentBal + diff).toFixed(2));

    const updatedAcc: CashInAccount = {
      ...acc,
      balance: newBal,
      rechargeHistory: history,
      updatedAt: new Date().toISOString()
    };

    soundEngine.playSuccessSound();
    setActiveAccountForRecharge(updatedAcc);
    await onSaveAccount(updatedAcc);

    setEditingRechargeId(null);
    setEditingRechargeAmount('');

    const diffText = diff >= 0 
      ? `+${currency}${diff.toFixed(2)}` 
      : `-${currency}${Math.abs(diff).toFixed(2)}`;

    setRechargeSuccessMsg(
      lang === 'bn'
        ? `রিচার্জ পরিমাণ সংশোধন করা হয়েছে! ব্যালেন্সে সমন্বয়: ${diffText}`
        : `Recharge amount updated! Balance adjusted: ${diffText}`
    );
    setTimeout(() => setRechargeSuccessMsg(''), 4500);
  };

  // Delete a recharge record from history and adjust account balance
  const handleDeleteRecharge = async (recId: string) => {
    const acc = currentActiveAccount || accounts.find(a => a.id === (selectedAccIdForBalance || activeAccountForRecharge?.id)) || activeAccountForRecharge;
    if (!acc) return;

    const history = Array.isArray(acc.rechargeHistory) ? [...acc.rechargeHistory] : [];
    const targetRec = history.find(r => r.id === recId);
    if (!targetRec) return;

    const updatedHistory = history.filter(r => r.id !== recId);
    const recAmount = Number(targetRec.amount) || 0;
    const currentBal = Number(acc.balance) || 0;
    const newBal = Number(Math.max(0, currentBal - recAmount).toFixed(2));

    const updatedAcc: CashInAccount = {
      ...acc,
      balance: newBal,
      rechargeHistory: updatedHistory,
      updatedAt: new Date().toISOString()
    };

    soundEngine.playDeleteSound();
    setActiveAccountForRecharge(updatedAcc);
    await onSaveAccount(updatedAcc);
    setConfirmDeleteRechargeId(null);

    setRechargeSuccessMsg(
      lang === 'bn'
        ? `রিচার্জ মুছে ফেলা হয়েছে এবং ব্যালেন্স থেকে ৳${recAmount.toFixed(2)} বাদ দেওয়া হয়েছে`
        : `Recharge deleted and ${currency}${recAmount.toFixed(2)} deducted from balance`
    );
    setTimeout(() => setRechargeSuccessMsg(''), 4500);
  };

  // Cash-In Transaction Edit Handlers
  const handleStartEditCashInTx = (tx: CashInTransaction) => {
    setEditingTxId(tx.id);
    setEditTxAmount(String(tx.amount));
    setEditTxPhone(tx.customerPhone || '');
    setEditTxName(tx.customerName || '');
    setEditTxCategory(tx.category || 'bkash');
    setEditTxIsOwnNumber(Boolean(tx.isOwnNumberTransfer || isTxOwnNumberTransfer(tx, accounts)));
    setEditingRechargeId(null);
    setConfirmDeleteRechargeId(null);
  };

  const handleSaveEditCashInTx = async (txId: string) => {
    const targetTx = transactions.find(t => t.id === txId);
    if (!targetTx) return;

    const newAmt = parseFloat(editTxAmount);
    if (isNaN(newAmt) || newAmt <= 0) {
      alert(lang === 'bn' ? 'সঠিক টাকার পরিমাণ লিখুন' : 'Please enter a valid amount');
      return;
    }

    const oldAmt = Number(targetTx.amount) || 0;
    const diff = Number((newAmt - oldAmt).toFixed(2));

    const targetAcc = currentActiveAccount || accounts.find(a => 
      a.id === targetTx.accountId || 
      a.accountNumber === targetTx.accountNumber || 
      (targetTx.lastDigits && (a.lastDigits === targetTx.lastDigits || a.accountNumber.replace(/\D/g, '').endsWith(targetTx.lastDigits.replace(/\D/g, ''))))
    );

    let updatedAcc: CashInAccount | undefined = undefined;
    if (targetAcc && diff !== 0) {
      const newBal = Number(Math.max(0, (Number(targetAcc.balance) || 0) - diff).toFixed(2));
      updatedAcc = {
        ...targetAcc,
        balance: newBal,
        updatedAt: new Date().toISOString()
      };
    }

    const updatedTx: CashInTransaction = {
      ...targetTx,
      amount: newAmt,
      customerPhone: editTxPhone.trim() || targetTx.customerPhone,
      customerName: editTxName.trim() || undefined,
      category: editTxCategory,
      isOwnNumberTransfer: editTxIsOwnNumber
    };

    soundEngine.playSuccessSound();
    if (updatedAcc) {
      setActiveAccountForRecharge(updatedAcc);
      await onSaveAccount(updatedAcc);
    }
    await onSaveTransaction(updatedTx, updatedAcc);
    setEditingTxId(null);
    setEditTxAmount('');
    setEditTxPhone('');
    setEditTxName('');

    const diffText = diff >= 0 ? `-${currency}${diff.toFixed(2)}` : `+${currency}${Math.abs(diff).toFixed(2)}`;
    setRechargeSuccessMsg(
      lang === 'bn' 
        ? `ক্যাশ-ইন এন্ট্রি সফলভাবে সংশোধন করা হয়েছে! ব্যালেন্স সমন্বয়: ${diffText}` 
        : `Cash-In entry updated! Balance adjusted: ${diffText}`
    );
    setTimeout(() => setRechargeSuccessMsg(''), 4500);
  };

  // Clear all history for the active account in one click
  const handleClearAllAccountHistory = async () => {
    if (!currentActiveAccount) return;
    setIsClearingHistory(true);
    try {
      if (onClearAccountHistory) {
        await onClearAccountHistory(currentActiveAccount.id);
      } else {
        const txsToRemove = transactions.filter(t => 
          t.accountId === currentActiveAccount.id || 
          t.accountNumber === currentActiveAccount.accountNumber || 
          (t.lastDigits && (currentActiveAccount.lastDigits === t.lastDigits || currentActiveAccount.accountNumber.replace(/\D/g, '').endsWith(t.lastDigits.replace(/\D/g, ''))))
        );
        for (const tx of txsToRemove) {
          await onDeleteTransaction(tx.id, false);
        }
        const updatedAcc: CashInAccount = {
          ...currentActiveAccount,
          rechargeHistory: [],
          updatedAt: new Date().toISOString()
        };
        await onSaveAccount(updatedAcc);
      }

      soundEngine.playDeleteSound();
      setShowClearHistoryConfirm(false);
      setRechargeSuccessMsg(
        lang === 'bn' 
          ? 'এই নম্বরের সকল হিস্ট্রি সফলভাবে ক্লিয়ার করা হয়েছে' 
          : 'All transaction history cleared successfully'
      );
      setTimeout(() => setRechargeSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to clear account history:', err);
    } finally {
      setIsClearingHistory(false);
    }
  };

  // Confirm delete account without window.confirm (guaranteed to work in iframe)
  const handleConfirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    try {
      await onDeleteAccount(accountToDelete.id);
      setAccountToDelete(null);
    } catch (err) {
      console.error('Delete account failed', err);
      setAccountToDelete(null);
    }
  };

  // Confirm delete transaction and refund balance if needed
  const handleConfirmDeleteTx = async () => {
    if (!txToDelete) return;
    try {
      const deletedAmt = Number(txToDelete.amount) || 0;
      const targetAcc = accounts.find(a => 
        (txToDelete.accountId && a.id === txToDelete.accountId) || 
        (txToDelete.accountNumber && a.accountNumber === txToDelete.accountNumber) || 
        (txToDelete.lastDigits && (a.lastDigits === txToDelete.lastDigits || a.accountNumber.replace(/\D/g, '').endsWith(txToDelete.lastDigits.replace(/\D/g, ''))))
      ) || currentActiveAccount;

      if (targetAcc) {
        const newBal = Number(((Number(targetAcc.balance) || 0) + deletedAmt).toFixed(2));
        const updatedAcc: CashInAccount = {
          ...targetAcc,
          balance: newBal,
          updatedAt: new Date().toISOString()
        };
        setActiveAccountForRecharge(updatedAcc);
        await onSaveAccount(updatedAcc);
      }

      await onDeleteTransaction(txToDelete.id, false);
      setTxToDelete(null);
      setRechargeSuccessMsg(
        lang === 'bn' 
          ? `লেনদেন মুছে ফেলা হয়েছে এবং ব্যালেন্সে ৳${deletedAmt.toFixed(2)} ফেরত যোগ হয়েছে` 
          : `Transaction deleted and ${currency}${deletedAmt.toFixed(2)} refunded to balance`
      );
      setTimeout(() => setRechargeSuccessMsg(''), 4500);
    } catch (err) {
      console.error('Delete transaction failed', err);
      setTxToDelete(null);
    }
  };

  // Render Customer-Detail style Transaction Ledger History for Cash In Number
  const renderCustomerStyleHistory = (
    acc: CashInAccount,
    items: UnifiedHistoryItem[],
    isDesktopWorkspace = false
  ) => {
    const cashInCount = items.filter(i => i.type === 'cashin').length;
    const rechargeCount = items.filter(i => i.type === 'recharge').length;

    const filtered = items.filter(item => {
      if (historyFilter === 'cashin' && item.type !== 'cashin') return false;
      if (historyFilter === 'recharge' && item.type !== 'recharge') return false;
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase().trim();
        const phone = (item.customerPhone || '').toLowerCase();
        const name = (item.customerName || '').toLowerCase();
        const info = (item.info || '').toLowerCase();
        const amt = String(item.amount);
        const bnAmt = toBengaliNumber(item.amount);
        if (!phone.includes(q) && !name.includes(q) && !info.includes(q) && !amt.includes(q) && !bnAmt.includes(q)) {
          return false;
        }
      }
      return true;
    });

    const rowStyles = {
      compact: {
        containerPadding: "px-2.5 py-1.5 sm:py-2 gap-2 min-h-[36px]",
        noteText: "text-xs sm:text-[13px] leading-normal",
        amountText: "text-xs sm:text-[13px] leading-normal",
        copyIconSize: "w-3 h-3",
        copyBtnPadding: "p-1"
      },
      comfortable: {
        containerPadding: "px-3 py-2 sm:py-2.5 gap-2.5 min-h-[40px]",
        noteText: "text-xs sm:text-sm leading-normal",
        amountText: "text-xs sm:text-sm leading-normal",
        copyIconSize: "w-3.5 h-3.5",
        copyBtnPadding: "p-1"
      },
      large: {
        containerPadding: "px-3.5 py-2.5 sm:py-3 gap-3 min-h-[44px]",
        noteText: "text-sm sm:text-base leading-normal",
        amountText: "text-sm sm:text-base leading-normal",
        copyIconSize: "w-4 h-4",
        copyBtnPadding: "p-1.5"
      }
    };

    const style = rowStyles[cardDensity] || rowStyles.comfortable;

    return (
      <div className="space-y-2 flex flex-col h-full">
        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 shrink-0">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'খুঁজুন (নম্বর/নাম/টাকা)...' : 'Search transactions...'}
              className="w-full pl-8 pr-7 py-1 bg-white dark:bg-[#151b22] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
            />
            {historySearchQuery && (
              <button
                type="button"
                onClick={() => setHistorySearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setHistoryFilter('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                historyFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#151b22] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
              }`}
            >
              {lang === 'bn' ? 'সকল' : 'All'} ({toBengaliNumber(items.length)})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('cashin')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                historyFilter === 'cashin'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200/60 dark:border-rose-900/60'
              }`}
            >
              <span>●</span>
              <span>{lang === 'bn' ? 'ক্যাশ-ইন' : 'Cash-In'}</span>
              <span>({toBengaliNumber(cashInCount)})</span>
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('recharge')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                historyFilter === 'recharge'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200/60 dark:border-emerald-900/60'
              }`}
            >
              <span>●</span>
              <span>{lang === 'bn' ? 'রিচার্জ' : 'Recharge'}</span>
              <span>({toBengaliNumber(rechargeCount)})</span>
            </button>

            {/* Clear All History Button */}
            <button
              type="button"
              id="btn-clear-account-history-pills"
              onClick={() => setShowClearHistoryConfirm(true)}
              disabled={items.length === 0}
              className="px-2 py-0.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/60 disabled:opacity-40 ml-auto"
              title={lang === 'bn' ? 'এই অ্যাকাউন্টের সব হিস্ট্রি ক্লিয়ার করুন' : 'Clear all history for this account'}
            >
              <RotateCcw className="w-3 h-3 text-rose-500" />
              <span>{lang === 'bn' ? 'ক্লিয়ার' : 'Clear'}</span>
            </button>
          </div>
        </div>

        {/* Minimal Subheader with Count & Legend */}
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 px-1 shrink-0 pb-0.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span>{lang === 'bn' ? 'লেনদেন খতিয়ান' : 'Ledger'} ({toBengaliNumber(filtered.length)})</span>
          </div>
          <span className="flex items-center gap-2 text-[9.5px]">
            <span className="text-emerald-600 dark:text-emerald-400">● {lang === 'bn' ? 'রিচার্জ (+)' : 'Recharge (+)'}</span>
            <span className="text-rose-500 dark:text-rose-400">● {lang === 'bn' ? 'ক্যাশ-ইন (-)' : 'Cash-In (-)'}</span>
            <span className="text-slate-600 dark:text-slate-400 font-bold">● {lang === 'bn' ? 'জের ব্যালেন্স' : 'Balance'}</span>
          </span>
        </div>

        {/* Ledger Rows Wrapper - Flat compact list without date breaks */}
        <div 
          id="cashin-ledger-rows-wrapper" 
          className={`space-y-1 w-full flex flex-col overflow-y-auto ${
            isDesktopWorkspace ? 'flex-1 pr-1' : 'max-h-[55vh] pr-0.5'
          }`}
        >
          {filtered.length === 0 ? (
            <div className="text-center py-5 bg-white dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 text-xs font-bold space-y-1">
              <History className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600 opacity-70" />
              <p>
                {items.length === 0 
                  ? (lang === 'bn' ? 'কোনো লেনদেনের এন্ট্রি নেই' : 'No transactions recorded yet')
                  : (lang === 'bn' ? 'কোনো এন্ট্রি পাওয়া যায়নি' : 'No entries found')}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isCashIn = item.type === 'cashin';
              const isExpanded = expandedHistoryId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                  className={`${
                    !isCashIn
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40'
                      : 'bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800'
                  } border ${
                    isExpanded 
                      ? 'border-purple-400 dark:border-purple-500 shadow-sm' 
                      : !isCashIn
                        ? 'border-emerald-200/80 dark:border-emerald-800/50 hover:border-emerald-300 dark:hover:border-emerald-600 shadow-tiny'
                        : 'border-slate-200/90 dark:border-slate-700/90 hover:border-purple-300 dark:hover:border-purple-600 shadow-tiny'
                  } rounded-lg transition-all select-none text-left flex flex-col cursor-pointer`}
                  id={`history-card-${item.id}`}
                >
                  {/* Ultra-Compact Top-Row: [Copy Button] [Phone/Note] [Main Amount] ---- [Running Balance / জের ব্যালেন্স] */}
                  <div className={`${style.containerPadding} flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {/* Copy Button - On Left of Number */}
                      {isCashIn && item.customerPhone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(item.customerPhone || '', item.id);
                          }}
                          className={`${style.copyBtnPadding} rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center`}
                          title={lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy number'}
                        >
                          {copiedId === item.id ? (
                            <Check className={`${style.copyIconSize} text-emerald-600 stroke-[2.5]`} />
                          ) : (
                            <Copy className={style.copyIconSize} />
                          )}
                        </button>
                      )}

                      {/* Number (Cash-In Phone or Recharge Note) */}
                      {isCashIn ? (
                        <span className={`${style.noteText} font-black text-slate-800 dark:text-slate-100 font-mono tracking-wide whitespace-nowrap shrink-0 leading-normal`}>
                          {item.rawTx?.category === 'paybill'
                            ? (lang === 'bn' ? 'বিল পেমেন্ট' : 'Bill Payment')
                            : (item.customerPhone || (item.customerName ? item.customerName : (lang === 'bn' ? 'নম্বর ছাড়া' : 'No number')))}
                        </span>
                      ) : (
                        <span className={`${style.noteText} font-black text-slate-800 dark:text-slate-100 truncate min-w-0 leading-normal`}>
                          {item.info || (lang === 'bn' ? 'ব্যালেন্স রিচার্জ' : 'Recharge')}
                        </span>
                      )}

                      {/* Main Transaction Amount (মুল ব্যালেন্স) - Right next to the number */}
                      <span className={`${style.amountText} font-black font-mono tracking-tight whitespace-nowrap leading-normal shrink-0 ${
                        !isCashIn 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {!isCashIn ? '+' : '-'}{currency}{item.amount.toFixed(2)}
                      </span>

                      {/* Cash-In Category Badge (বিকাশ / নগদ / ফ্লেক্সিলোড / বিল পেমেন্ট) */}
                      {isCashIn && item.rawTx?.category && (
                        <span className={`px-1 py-0.2 rounded text-[8px] font-black shrink-0 leading-tight ${
                          item.rawTx.category === 'bkash'
                            ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
                            : item.rawTx.category === 'nagad'
                            ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
                            : item.rawTx.category === 'paybill'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                        }`}>
                          {item.rawTx.category === 'bkash' ? (lang === 'bn' ? 'বিকাশ' : 'bKash') 
                           : item.rawTx.category === 'nagad' ? (lang === 'bn' ? 'নগদ' : 'Nagad') 
                           : item.rawTx.category === 'paybill' ? (lang === 'bn' ? 'বিল পেমেন্ট' : 'Bill Payment')
                           : (lang === 'bn' ? 'ফ্লেক্সি' : 'Flexi')}
                        </span>
                      )}

                      {/* Own Number Transfer Badge */}
                      {isCashIn && isTxOwnNumberTransfer(item.rawTx, accounts) && (
                        <span 
                          title={lang === 'bn' ? 'নিজ নাম্বারে লেনদেন (কমিশন হিসাব বহির্ভূত)' : 'Own number transfer (excluded from commission)'}
                          className="px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[8px] font-black shrink-0 leading-tight"
                        >
                          {lang === 'bn' ? 'নিজ' : 'Self'}
                        </span>
                      )}

                      {!isCashIn && item.rawRecharge?.updatedAt && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[8px] font-bold shrink-0">
                          {lang === 'bn' ? 'সংশোধিত' : 'Edited'}
                        </span>
                      )}
                    </div>

                    {/* Running Balance in place of the original main balance position */}
                    <div className="shrink-0 pl-1.5 text-right">
                      <span 
                        className={`${style.amountText} font-black font-mono tracking-tight whitespace-nowrap leading-normal text-slate-700 dark:text-slate-200`}
                        title={lang === 'bn' ? `জের ব্যালেন্স: ${currency}${(item.runningBalance ?? 0).toFixed(2)}` : `Running Balance: ${currency}${(item.runningBalance ?? 0).toFixed(2)}`}
                      >
                        {currency}{(item.runningBalance ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Area: Customer Name, Phone Copy, Date & Time, Edit & Delete Buttons */}
                  {isExpanded && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/60 p-2.5 sm:p-3 space-y-2 text-xs"
                    >
                          {/* Cash-In Details & Actions */}
                          {isCashIn && (
                            <>
                              {editingTxId === item.rawTx?.id ? (
                                /* Inline Edit Form for Cash-In */
                                <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl space-y-2.5">
                                  <div className="flex items-center justify-between text-xs font-black text-amber-900 dark:text-amber-200">
                                    <span className="flex items-center gap-1.5">
                                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                      {lang === 'bn' ? 'ক্যাশ-ইন এন্ট্রি সংশোধন করুন:' : 'Edit Cash-In Entry:'}
                                    </span>
                                    <span className="font-mono text-slate-500 dark:text-slate-400 text-xs">
                                      {currency}{item.amount.toFixed(2)}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                                        {lang === 'bn' ? 'কাস্টমার নম্বর' : 'Customer Phone'}
                                      </label>
                                      <input
                                        type="text"
                                        value={editTxPhone}
                                        onChange={(e) => setEditTxPhone(cleanBangladeshiPhoneNumber(e.target.value))}
                                        onPaste={(e) => {
                                          e.preventDefault();
                                          const pasted = e.clipboardData.getData('text');
                                          setEditTxPhone(cleanBangladeshiPhoneNumber(pasted));
                                        }}
                                        placeholder="01xxxxxxxxx"
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E252D] border border-amber-300 dark:border-amber-600 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                                        {lang === 'bn' ? 'কাস্টমার নাম' : 'Customer Name'}
                                      </label>
                                      <input
                                        type="text"
                                        value={editTxName}
                                        onChange={(e) => setEditTxName(e.target.value)}
                                        placeholder={lang === 'bn' ? 'নাম লিখুন...' : 'Enter name...'}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E252D] border border-amber-300 dark:border-amber-600 text-xs font-bold text-slate-800 dark:text-slate-100"
                                      />
                                    </div>
                                  </div>

                                  {/* Edit Category Tabs */}
                                  <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                    {([
                                      { id: 'bkash', labelBn: 'বিকাশ', labelEn: 'bKash', activeBg: 'bg-pink-600 text-white' },
                                      { id: 'nagad', labelBn: 'নগদ', labelEn: 'Nagad', activeBg: 'bg-orange-600 text-white' },
                                      { id: 'flexiload', labelBn: 'ফ্লেক্সিলোড', labelEn: 'Flexiload', activeBg: 'bg-teal-600 text-white' },
                                    ] as const).map((cat) => {
                                      const isSelected = editTxCategory === cat.id;
                                      return (
                                        <button
                                          key={cat.id}
                                          type="button"
                                          onClick={() => setEditTxCategory(cat.id)}
                                          className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-black transition-all cursor-pointer text-center select-none ${
                                            isSelected
                                              ? cat.activeBg
                                              : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
                                          }`}
                                        >
                                          {lang === 'bn' ? cat.labelBn : cat.labelEn}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Edit Own Number Toggle */}
                                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 cursor-pointer select-none text-xs font-bold text-slate-700 dark:text-slate-200">
                                    <span className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={editTxIsOwnNumber}
                                        onChange={(e) => setEditTxIsOwnNumber(e.target.checked)}
                                        className="w-4 h-4 rounded text-purple-600 border-slate-300 dark:border-slate-600 focus:ring-purple-500 cursor-pointer"
                                      />
                                      <span>{lang === 'bn' ? 'নিজ নাম্বারে লেনদেন' : 'Own Number Transfer'}</span>
                                    </span>
                                    <span className={`text-[10px] ${editTxIsOwnNumber ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                                      {editTxIsOwnNumber ? (lang === 'bn' ? 'কমিশন ০' : '0 Commission') : (lang === 'bn' ? '১৫৳/১,০০০' : '15/1k')}
                                    </span>
                                  </label>

                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                                      {lang === 'bn' ? 'টাকার পরিমাণ' : 'Amount'} <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400 font-bold">{currency}</span>
                                      <input
                                        type="number"
                                        step="any"
                                        value={editTxAmount}
                                        onChange={(e) => setEditTxAmount(e.target.value)}
                                        className="w-full pl-6 pr-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E252D] border border-amber-300 dark:border-amber-600 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                        autoFocus
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTxId(null);
                                        setEditTxAmount('');
                                        setEditTxPhone('');
                                        setEditTxName('');
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                                    >
                                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditCashInTx(item.rawTx!.id)}
                                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer transition-colors shadow-2xs"
                                    >
                                      {lang === 'bn' ? 'সংরক্ষণ' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Expanded Info: Customer Name, Phone + Copy, Date & Time, Action Buttons */
                                <div className="space-y-2.5">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-0.5">
                                    {/* Customer Name */}
                                    <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="text-slate-500 dark:text-slate-400 font-bold">
                                        {lang === 'bn' ? 'কাস্টমার নাম:' : 'Customer Name:'}
                                      </span>
                                      <span className="font-black text-slate-800 dark:text-slate-100 truncate">
                                        {item.customerName || (lang === 'bn' ? 'নাম উল্লেখ নেই' : 'No name')}
                                      </span>
                                    </div>

                                    {/* Phone with Copy */}
                                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-700 dark:text-slate-200">
                                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">
                                        {lang === 'bn' ? 'নম্বর:' : 'Phone:'}
                                      </span>
                                      <span className="font-black text-slate-800 dark:text-slate-100">
                                        {item.customerPhone}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(item.customerPhone || '', item.id)}
                                        className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer shrink-0 ml-1"
                                        title={lang === 'bn' ? 'নম্বর কপি' : 'Copy'}
                                      >
                                        {copiedId === item.id ? (
                                          <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>

                                    {/* Date & Time */}
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{formatFullDateTime(item.date)}</span>
                                    </div>

                                    {/* Post-transaction Running Balance */}
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                      <span className="font-bold text-slate-400">⚖️ {lang === 'bn' ? 'চলতি জের:' : 'Running Bal:'}</span>
                                      <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                                        {currency}{(item.runningBalance ?? 0).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Action Buttons: Add Baki (+), Edit & Delete */}
                                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/80 flex items-center justify-end gap-2">
                                    {item.rawTx && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTargetTxForBaki(item.rawTx!);
                                          setIsPostCashInBakiSearch(false);
                                          setBakiCustomLabel('বিকাশ');
                                          setBakiSearchQuery(item.rawTx!.customerPhone || item.rawTx!.customerName || '');
                                          setShowBakiSearchModal(true);
                                        }}
                                        title={lang === 'bn' ? 'বাকির খাতায় এন্ট্রি যোগ করুন' : 'Add to Baki ledger'}
                                        className="px-2.5 py-1.5 font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                                        <span>{lang === 'bn' ? 'বাকি' : 'Baki'}</span>
                                      </button>
                                    )}
                                    {item.rawTx && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditCashInTx(item.rawTx!)}
                                        className="px-3 py-1.5 font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                                      >
                                        <Edit3 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                        <span>{lang === 'bn' ? 'এডিট' : 'Edit'}</span>
                                      </button>
                                    )}
                                    {item.rawTx && (
                                      <button
                                        type="button"
                                        onClick={() => setTxToDelete(item.rawTx!)}
                                        className="px-3 py-1.5 font-black text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        <span>{lang === 'bn' ? 'মুছুন' : 'Delete'}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* Recharge Details & Actions */}
                          {!isCashIn && (
                            <>
                              {editingRechargeId === item.rawRecharge?.id ? (
                                /* Inline Edit Form for Recharge */
                                <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl space-y-2">
                                  <div className="flex items-center justify-between text-xs font-black text-amber-900 dark:text-amber-200">
                                    <span className="flex items-center gap-1.5">
                                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                      {lang === 'bn' ? 'রিচার্জ পরিমাণ এডিট করুন:' : 'Edit Recharge Amount:'}
                                    </span>
                                    <span className="font-mono text-slate-500 dark:text-slate-400">
                                      {currency}{item.amount.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400 font-bold">{currency}</span>
                                      <input
                                        type="number"
                                        step="any"
                                        value={editingRechargeAmount}
                                        onChange={(e) => setEditingRechargeAmount(e.target.value)}
                                        className="w-full pl-6 pr-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E252D] border border-amber-300 dark:border-amber-600 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                        autoFocus
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditRecharge(item.rawRecharge!.id)}
                                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer transition-colors shadow-2xs"
                                    >
                                      {lang === 'bn' ? 'সংরক্ষণ' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRechargeId(null);
                                        setEditingRechargeAmount('');
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                                    >
                                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                                    </button>
                                  </div>
                                </div>
                              ) : confirmDeleteRechargeId === item.rawRecharge?.id ? (
                                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-xs">
                                  <span className="font-bold text-rose-700 dark:text-rose-300">
                                    {lang === 'bn' ? `এই রিচার্জটি (${currency}${item.amount.toFixed(2)}) মুছে ফেলতে চান?` : `Delete this recharge (${currency}${item.amount.toFixed(2)})?`}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRecharge(item.rawRecharge!.id)}
                                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer transition-colors"
                                    >
                                      {lang === 'bn' ? 'মুছুন' : 'Delete'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteRechargeId(null)}
                                      className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                                    >
                                      {lang === 'bn' ? 'না' : 'Cancel'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="space-y-1">
                                    <div className="text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5">
                                      <span>📝 {item.info || (lang === 'bn' ? 'ব্যালেন্স রিচার্জ' : 'Recharge')}</span>
                                      {item.rawRecharge?.updatedAt && (
                                        <span className="text-[9px] text-amber-600 ml-1">({lang === 'bn' ? 'সংশোধিত' : 'Edited'})</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{formatFullDateTime(item.date)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                      <span className="font-bold text-slate-400">⚖️ {lang === 'bn' ? 'চলতি জের:' : 'Running Bal:'}</span>
                                      <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                                        {currency}{(item.runningBalance ?? 0).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/80 flex items-center justify-end gap-2">
                                    {item.rawRecharge && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditRecharge(item.rawRecharge!)}
                                        className="px-3 py-1.5 font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                                      >
                                        <Edit3 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                        <span>{lang === 'bn' ? 'এডিট' : 'Edit'}</span>
                                      </button>
                                    )}
                                    {item.rawRecharge && (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteRechargeId(item.rawRecharge!.id)}
                                        className="px-3 py-1.5 font-black text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        <span>{lang === 'bn' ? 'মুছুন' : 'Delete'}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
          )}
        </div>
      </div>
    );
  };

  // 1. Full Page Daily Report View
  if (subView === 'daily_report') {
    return (
      <DailyReportFullView
        date={selectedDailyDate}
        onDateChange={setSelectedDailyDate}
        transactions={transactions}
        accounts={accounts}
        currency={currency}
        lang={lang}
        onBack={() => setSubView('main')}
        onOpenMonthly={() => setSubView('monthly_report')}
      />
    );
  }

  // 2. Full Page Monthly Report View
  if (subView === 'monthly_report') {
    return (
      <MonthlyReportFullView
        selectedMonthKey={selectedMonthKey}
        onMonthChange={setSelectedMonthKey}
        transactions={transactions}
        accounts={accounts}
        currency={currency}
        lang={lang}
        onBack={() => setSubView('main')}
        onOpenDaily={() => setSubView('daily_report')}
      />
    );
  }

  return (
    <div id="cashin-main-container" className="space-y-3 font-sans pb-16">
      
      {/* 1. CASH-IN INPUT FORM WITH COMPACT TOTAL BALANCE RIGHT NEXT TO TITLE */}
      <div 
        id="cashin-input-card"
        className="bg-white dark:bg-[#1E252D] rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'bn' ? 'ক্যাশ-ইন' : 'Cash-In'}</span>
            </h2>

            {/* Compact Total Balance next to Cash-In text */}
            <div 
              id="cashin-compact-balance"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-black shadow-2xs"
              title={lang === 'bn' ? 'মোট ব্যালেন্স' : 'Total Balance'}
            >
              <span>{currency}</span>
              <span>{totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* The Form Fields: Ultra-Compact Single Row + Direct SIM Selection Below */}
        <form onSubmit={handleSubmitCashIn} className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            
            {/* 1. Mobile Number / Name / TrxID (Left) with Paste Button beside it */}
            <div className="col-span-1">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider truncate">
                  {lang === 'bn' ? 'নম্বর / নাম / TrxID' : 'Number / Name / TrxID'}
                </label>
                {isDetectedOwnNumber && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800 animate-in fade-in">
                    {lang === 'bn' ? 'নিজ সিম' : 'Own SIM'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(normalizePhoneNameOrTrxInput(e.target.value));
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text');
                    setCustomerPhone(normalizePhoneNameOrTrxInput(pasted));
                  }}
                  placeholder={lang === 'bn' ? 'নম্বর / নাম / TrxID...' : 'Number / Name / TrxID...'}
                  className={`flex-1 min-w-0 bg-slate-50 dark:bg-[#151b22] border rounded-xl px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                    isDetectedOwnNumber 
                      ? 'border-purple-400 dark:border-purple-700 focus:ring-purple-500 bg-purple-50/20' 
                      : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  id="btn-paste-cashin-number"
                  onClick={handlePasteCustomerPhone}
                  className={`h-[35px] px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-[11px] font-black flex items-center justify-center gap-1 shrink-0 shadow-2xs transition-all cursor-pointer active:scale-95 select-none ${
                    justPastedPhone
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/70 text-purple-700 dark:text-purple-300 border-purple-200/90 dark:border-purple-800'
                  }`}
                  title={lang === 'bn' ? 'কপি করা নম্বর পেস্ট করুন' : 'Paste copied number'}
                >
                  {justPastedPhone ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    <>
                      <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'bn' ? 'পেস্ট' : 'Paste'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Amount (Right, next to Mobile Number) with Cash-In Complete Submit Icon Button beside it */}
            <div className="col-span-1">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider truncate">
                  {lang === 'bn' ? 'টাকার পরিমাণ' : 'Amount'} <span className="text-rose-500">*</span>
                </label>
                {lastDigits && (
                  <span className="text-[9.5px] font-mono font-black px-1.5 py-0.2 rounded bg-amber-500 text-white shrink-0">
                    ...{lastDigits}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 min-w-0 bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 sm:px-3 py-2 text-xs font-mono font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <button
                  type="submit"
                  id="btn-submit-cashin-icon"
                  disabled={isProcessing}
                  className="h-[35px] w-[40px] rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white flex items-center justify-center shrink-0 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  title={lang === 'bn' ? 'ক্যাশ-ইন সম্পন্ন করুন' : 'Complete Cash-In'}
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                </button>
              </div>
            </div>

            {/* Up to 3 recent transactions list formatted strictly as: last(xxx) ৳0000 name */}
            {lastCashInMatches.length > 0 && (
              <div 
                id="cashin-recent-matches"
                className="col-span-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-800/80 shadow-2xs space-y-1 animate-fade-in"
              >
                {lastCashInMatches.map((item, idx) => (
                  <div 
                    key={item.tx.id || idx}
                    onClick={() => {
                      if (item.lastDigits) {
                        setLastDigits(item.lastDigits);
                        setFormError('');
                      }
                    }}
                    className="flex items-center gap-2 text-[11px] sm:text-xs font-mono font-bold hover:bg-slate-100 dark:hover:bg-slate-800/60 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors select-none"
                    title={item.lastDigits ? (lang === 'bn' ? `ক্লিক করে ...${item.lastDigits} নির্বাচন করুন` : `Click to select ...${item.lastDigits}`) : undefined}
                  >
                    <span className="text-blue-700 dark:text-blue-400 font-bold shrink-0">
                      last({item.lastDigits || '---'})
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold shrink-0">
                      {currency}{Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                    {item.bakiName && (
                      <span className="text-slate-700 dark:text-slate-200 font-sans font-semibold truncate">
                        {item.bakiName}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 text-xs font-bold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
        </form>
      </div>

      {/* 2. MOBILE NUMBERS & BALANCE LIST (পেন্সিল, ডিলিট, রিচার্জ ও হিস্ট্রি সব নাম্বারে ক্লিক করলে ভেতরে থাকবে) */}
      <div className="bg-white dark:bg-[#1E252D] rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-[#171d24] border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-purple-600" />
              <span>{lang === 'bn' ? 'মোবাইল নম্বর ও ব্যালেন্স' : 'Mobile number & Balance'}</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">
              ({accounts.length})
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* ডেক্সটপ মোডের জন্য আলাদা ফুল স্ক্রিন বাটন */}
            {accounts.length > 0 && (
              <button
                type="button"
                id="btn-open-desktop-fullscreen"
                onClick={() => {
                  const target = currentActiveAccount || sortedAccountsByBalance[0];
                  if (target) {
                    setActiveAccountForRecharge(target);
                    setSelectedAccIdForBalance(target.id);
                    setBalanceAddAmount('');
                    setBalanceModalError('');
                    setEditingRechargeId(null);
                    setEditingRechargeAmount('');
                    setConfirmDeleteRechargeId(null);
                    setRechargeSuccessMsg('');
                    setShowAddBalanceModal(true);
                  }
                }}
                className="hidden md:inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs transition-all active:scale-95"
                title={lang === 'bn' ? 'ডেক্সটপ ফুল স্ক্রিন' : 'Desktop Full Screen'}
              >
                <Maximize2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              </button>
            )}

            {/* দৈনিক রিপোর্ট - শুধু আইকন */}
            <button
              type="button"
              id="btn-open-daily-report"
              onClick={() => setSubView('daily_report')}
              className="w-7 h-7 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 flex items-center justify-center cursor-pointer shadow-2xs transition-all active:scale-95"
              title={lang === 'bn' ? 'দৈনিক রিপোর্ট' : 'Daily Report'}
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>

            {/* মাসিক রিপোর্ট - শুধু আইকন */}
            <button
              type="button"
              id="btn-open-monthly-report"
              onClick={() => setSubView('monthly_report')}
              className="w-7 h-7 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center cursor-pointer shadow-2xs transition-all active:scale-95"
              title={lang === 'bn' ? 'মাসিক রিপোর্ট' : 'Monthly Report'}
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>

            {/* Direct + icon to add new number */}
            <button
              type="button"
              id="btn-add-cashin-number-plus"
              onClick={() => {
                setEditingAccount(null);
                setNewAccNumber('');
                setNewAccName('');
                setNewAccBalance('');
                setShowAddAccountModal(true);
              }}
              className="w-7 h-7 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer"
              title={lang === 'bn' ? 'নতুন নম্বর যোগ করুন' : 'Add Number'}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="p-6 text-center text-slate-400 space-y-2">
            <p className="text-xs font-bold">{lang === 'bn' ? 'কোনো নম্বর যোগ করা হয়নি' : 'No numbers added'}</p>
            <button
              type="button"
              onClick={() => setShowAddAccountModal(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-black cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'নম্বর যোগ করুন' : 'Add Number'}</span>
            </button>
          </div>
        ) : (
          <div className={isDesktopMode ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-2.5' : 'divide-y divide-slate-100 dark:divide-slate-800 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-2 md:p-2.5 md:divide-y-0'}>
            {sortedAccountsByBalance.map((acc) => {
              const shortLast = getShortLast4(acc);
              const isSelectedForCashIn = Boolean(lastDigits) && (lastDigits === acc.lastDigits || lastDigits === shortLast);
              return (
                <div
                  key={acc.id}
                  onClick={() => {
                    const targetDigits = acc.lastDigits || shortLast;
                    setLastDigits(prev => (prev === targetDigits ? '' : targetDigits));
                    setFormError('');
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer transition-all group select-none ${
                    isDesktopMode ? 'rounded-xl border' : 'md:rounded-xl md:border'
                  } ${
                    isSelectedForCashIn
                      ? 'bg-amber-50/95 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/40 shadow-xs'
                      : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                  }`}
                  title={lang === 'bn' ? `ক্লিক করে ...${shortLast} লাস্ট নাম্বার হিসেবে সিলেক্ট করুন` : `Click to select ...${shortLast} as SIM`}
                >
                  {/* Left: Selection Check/Dot, Last 4 digits, and Balance */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isSelectedForCashIn ? (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                      </span>
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                    <span 
                      className={`text-xs sm:text-sm font-mono font-black transition-colors shrink-0 ${
                        isSelectedForCashIn
                          ? 'text-amber-900 dark:text-amber-300'
                          : 'text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                      }`}
                    >
                      ...{shortLast}
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                      {currency}{Number(acc.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {acc.accountName && (
                      <span className="text-[11px] text-slate-400 truncate hidden xl:inline">
                        • {acc.accountName}
                      </span>
                    )}
                  </div>

                  {/* Right: Quick Recharge input + submit button right on the card & History Trigger */}
                  <div 
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={quickRechargeAmounts[acc.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuickRechargeAmounts(prev => ({ ...prev, [acc.id]: val }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleQuickRecharge(acc);
                          }
                        }}
                        placeholder={lang === 'bn' ? 'টাকা' : 'Tk'}
                        className="w-16 sm:w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none text-right transition-all shadow-2xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickRecharge(acc)}
                      disabled={!quickRechargeAmounts[acc.id] || parseFloat(quickRechargeAmounts[acc.id]) <= 0 || quickRechargeLoading === acc.id}
                      className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-35 active:scale-95 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs shrink-0"
                      title={lang === 'bn' ? 'রিচার্জ সাবমিট করুন' : 'Submit Recharge'}
                    >
                      {quickRechargeLoading === acc.id ? (
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[10px]">{lang === 'bn' ? 'রিচার্জ' : 'Recharge'}</span>
                        </>
                      )}
                    </button>

                    {quickRechargeFeedback?.accId === acc.id && (
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded animate-fade-in shrink-0">
                        {quickRechargeFeedback.msg}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveAccountForRecharge(acc);
                        setSelectedAccIdForBalance(acc.id);
                        setBalanceAddAmount('');
                        setBalanceModalError('');
                        setEditingRechargeId(null);
                        setEditingRechargeAmount('');
                        setConfirmDeleteRechargeId(null);
                        setRechargeSuccessMsg('');
                        setShowAddBalanceModal(true);
                      }}
                      className="h-7 px-2 bg-slate-100 hover:bg-purple-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer text-slate-600 dark:text-slate-300 hover:text-purple-600 flex items-center gap-1 ml-0.5"
                      title={lang === 'bn' ? 'হিস্ট্রি ও বিস্তারিত দেখুন' : 'View History & Details'}
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. SMOOTH PROCESSING / LOADING ANIMATION (STANDARDIZED) */}
      <PremiumAppLoader
        isOpen={isProcessing}
        title={lang === 'bn' ? 'ক্যাশ-ইন সম্পন্ন হচ্ছে...' : 'Processing Cash-In...'}
        icon={Send}
        iconGradient="from-emerald-600 to-teal-500"
        ringColor="border-emerald-500"
        progressColor="from-emerald-500 to-teal-500"
        progress={processingProgress}
      />

      {/* 5. SUCCESS CONFIRMATION MODAL */}
      <AnimatePresence>
        {successTx && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSuccessTx(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 p-4 text-white">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-1 border border-white/30">
                  <CheckCircle2 className="w-6 h-6 text-white stroke-[2.5]" />
                </div>
                <h3 className="text-base font-black">
                  {lang === 'bn' ? 'ক্যাশ-ইন সফল!' : 'Successful!'}
                </h3>
                
                {/* Click to copy phone number container (or show badge if no number was entered) */}
                {successTx.tx.customerPhone ? (
                  <div className="mt-1 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(successTx.tx.customerPhone, 'success-modal-phone');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all text-white border border-white/25 cursor-pointer shadow-xs"
                      title={lang === 'bn' ? 'নম্বর কপি করতে ট্যাপ করুন' : 'Tap to copy phone number'}
                    >
                      <span className="text-xs font-mono font-black tracking-wider">
                        {successTx.tx.customerPhone}
                      </span>
                      {copiedId === 'success-modal-phone' ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-white text-emerald-700 px-1.5 py-0.5 rounded-full shadow-xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          <span>{lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
                        </span>
                      ) : (
                        <Copy className="w-3 h-3 text-emerald-100" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center justify-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20 text-white/90 text-[11px] font-bold">
                      {lang === 'bn' ? 'নম্বর ছাড়া এন্ট্রি' : 'No mobile number'}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-2.5">
                <div className="bg-slate-50 dark:bg-[#151b22] rounded-xl p-2.5 space-y-1.5 text-xs text-left">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>{lang === 'bn' ? 'পরিমাণ:' : 'Amount:'}</span>
                    <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {currency}{successTx.tx.amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                    <span>{lang === 'bn' ? 'লাস্ট ডিজিট:' : 'Last 4:'}</span>
                    <span className="font-mono font-bold">
                      {successTx.tx.lastDigits ? `...${successTx.tx.lastDigits}` : (lang === 'bn' ? 'দেওয়া হয়নি' : 'Not specified')}
                    </span>
                  </div>

                  {successTx.newBalance !== undefined && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                      <span>{lang === 'bn' ? 'প্রেরক সিমের ব্যালেন্স:' : 'Sender Remaining:'}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {currency}{successTx.newBalance.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {successTx.destinationAccount && successTx.destinationNewBalance !== undefined && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold bg-amber-50/60 dark:bg-amber-950/30 -mx-1 px-1 py-1 rounded">
                      <div className="flex flex-col text-left">
                        <span className="text-amber-800 dark:text-amber-300 text-[11px] font-black">
                          {lang === 'bn' ? '✓ প্রাপক সিমে অটো রিচার্জ:' : '✓ Auto-Recharged SIM:'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {successTx.destinationAccount.accountNumber || `...${successTx.destinationAccount.lastDigits}`}
                        </span>
                      </div>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                        {currency}{successTx.destinationNewBalance.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {successTx.bakiCustomer && (
                    <div className="pt-2 border-t border-purple-200 dark:border-purple-800 flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300">
                      <span>{lang === 'bn' ? 'বাকির খাতা:' : 'Baki Ledger:'}</span>
                      <span className="font-black text-purple-900 dark:text-purple-100">{successTx.bakiCustomer.name}</span>
                    </div>
                  )}
                </div>

                {/* 4 Category Buttons Shown After Transaction Completes (Always defaults to বিকাশ even if closed) */}
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-0.5 block">
                    {lang === 'bn' ? 'ক্যাটাগরি (ডিফল্ট বিকাশ):' : 'Category (Default bKash):'}
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      {
                        id: 'bkash',
                        labelBn: 'বিকাশ',
                        labelEn: 'bKash',
                        activeClass: 'bg-pink-600 text-white border-pink-700 shadow-xs ring-2 ring-pink-400/40'
                      },
                      {
                        id: 'nagad',
                        labelBn: 'নগদ',
                        labelEn: 'Nagad',
                        activeClass: 'bg-orange-500 text-white border-orange-600 shadow-xs ring-2 ring-orange-400/40'
                      },
                      {
                        id: 'flexiload',
                        labelBn: 'ফ্লেক্সিলোড',
                        labelEn: 'Flexiload',
                        activeClass: 'bg-teal-600 text-white border-teal-700 shadow-xs ring-2 ring-teal-400/40'
                      },
                      {
                        id: 'own',
                        labelBn: 'নিজ',
                        labelEn: 'Own',
                        activeClass: 'bg-purple-600 text-white border-purple-700 shadow-xs ring-2 ring-purple-400/40'
                      }
                    ] as const).map((cat) => {
                      const currentCat = successTx.tx.category || 'bkash';
                      const isSelected = currentCat === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleUpdateSuccessTxCategory(cat.id)}
                          className={`py-1.5 px-1 rounded-xl text-center text-[11px] font-black transition-all cursor-pointer border select-none ${
                            isSelected
                              ? cat.activeClass
                              : 'bg-slate-50 dark:bg-[#151b22] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {lang === 'bn' ? cat.labelBn : cat.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Prompt: Do you want to add entry to Baki Ledger? */}
                {!successTx.bakiCustomer ? (
                  <div className="p-3 bg-purple-50/90 dark:bg-purple-950/40 rounded-2xl border border-purple-100 dark:border-purple-900/50 space-y-2 text-center">
                    <p className="text-xs font-black text-purple-900 dark:text-purple-200">
                      {lang === 'bn' ? 'এন্ট্রি কি বাকির খাতায় যোগ করতে চান?' : 'Add this entry to Baki Ledger?'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPostCashInBakiSearch(true);
                          setBakiCustomLabel('বিকাশ');
                          setBakiSearchQuery('');
                          setShowBakiSearchModal(true);
                        }}
                        className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{lang === 'bn' ? 'হ্যাঁ' : 'Yes'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuccessTx(null)}
                        className="py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-black transition-all cursor-pointer"
                      >
                        <span>{lang === 'bn' ? 'না' : 'No'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center">
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                      {lang === 'bn' ? '✓ বাকির খাতায় সফলভাবে যোগ হয়েছে' : '✓ Added to Baki ledger successfully'}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsPostCashInBakiSearch(false);
                    setSuccessTx(null);
                  }}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer transition-all"
                >
                  {lang === 'bn' ? 'ঠিক আছে' : 'OK'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. ADD / EDIT NUMBER MODAL */}
      <AnimatePresence>
        {showAddAccountModal && (
          <div 
            className="fixed inset-0 z-[10005] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 font-sans"
            onClick={() => setShowAddAccountModal(false)}
          >
            <div 
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black">
                  {editingAccount ? (lang === 'bn' ? 'নম্বর সম্পাদনা' : 'Edit Number') : (lang === 'bn' ? 'নতুন নম্বর যোগ' : 'Add Number')}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setShowAddAccountModal(false)}
                  className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleSaveAccountSubmit} className="p-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase mb-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile number'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase mb-1">
                    {lang === 'bn' ? 'নাম / বিবরণ' : 'Label'}
                  </label>
                  <input
                    type="text"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: সিম ১ / বিকাশ' : 'e.g. SIM 1'}
                    className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase mb-1">
                    {lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Balance'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {accModalError && (
                  <p className="text-xs text-rose-500 font-bold">{accModalError}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAccountModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black cursor-pointer shadow-xs"
                  >
                    {lang === 'bn' ? 'সংরক্ষণ' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. TAP-ON-NUMBER FULL PAGE (MOBILE) & DEDICATED FULL SCREEN (DESKTOP) */}
      <AnimatePresence>
        {showAddBalanceModal && currentActiveAccount && (
          <div className="fixed inset-0 z-[9999] overflow-hidden">
            {/* ============================================================= */}
            {/* 1. MOBILE FULL PAGE VIEW (md:hidden) */}
            {/* ============================================================= */}
            <div className="flex md:hidden flex-col h-full w-full bg-slate-50 dark:bg-[#11161d] text-slate-800 dark:text-slate-100 font-sans overflow-hidden">
              {/* Sticky Top App Bar */}
              <div className="p-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBalanceModal(false);
                      setEditingRechargeId(null);
                      setEditingRechargeAmount('');
                      setConfirmDeleteRechargeId(null);
                    }}
                    className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer shrink-0"
                    title={lang === 'bn' ? 'ফিরে যান' : 'Back'}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-mono font-black">
                        {currentActiveAccount.accountNumber}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-amber-950 text-[9px] font-mono font-black">
                        ...{currentActiveAccount.lastDigits}
                      </span>
                    </div>
                    {currentActiveAccount.accountName && (
                      <p className="text-[10px] text-emerald-100 truncate">
                        {currentActiveAccount.accountName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Edit SIM Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccount(currentActiveAccount);
                      setNewAccNumber(currentActiveAccount.accountNumber);
                      setNewAccName(currentActiveAccount.accountName || '');
                      setNewAccBalance(String(currentActiveAccount.balance));
                      setShowAddAccountModal(true);
                    }}
                    className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                    title={lang === 'bn' ? 'এডিট' : 'Edit'}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Clear All History Button */}
                  <button
                    type="button"
                    id="btn-clear-account-history-mobile"
                    onClick={() => setShowClearHistoryConfirm(true)}
                    disabled={activeAccountCombinedHistory.length === 0}
                    className="px-2 py-1 rounded-lg bg-white/20 hover:bg-rose-500/80 text-white flex items-center gap-1 transition-colors cursor-pointer text-[11px] font-black disabled:opacity-40"
                    title={lang === 'bn' ? 'সব হিস্ট্রি ক্লিয়ার করুন' : 'Clear all history'}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'ক্লিয়ার' : 'Clear'}</span>
                  </button>

                  {/* Delete SIM Button */}
                  <button
                    type="button"
                    onClick={() => setAccountToDelete(currentActiveAccount)}
                    className="w-7 h-7 rounded-lg bg-white/20 hover:bg-rose-500 text-white flex items-center justify-center transition-colors cursor-pointer"
                    title={lang === 'bn' ? 'মুছুন' : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Close / Exit Button */}
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddBalanceModal(false);
                      setEditingRechargeId(null);
                      setEditingRechargeAmount('');
                      setConfirmDeleteRechargeId(null);
                    }}
                    className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                    title={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Success Notification Banner */}
              {rechargeSuccessMsg && (
                <div className="bg-emerald-500 text-white px-3 py-2 text-xs font-bold flex items-center justify-between shadow-xs shrink-0">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {rechargeSuccessMsg}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setRechargeSuccessMsg('')}
                    className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Scrollable Page Body */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
                {/* Balance Display Card */}
                <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-emerald-100 font-bold block">
                        {lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Current Balance'}
                      </span>
                      <div className="text-2xl font-mono font-black tracking-tight mt-0.5">
                        {currency}{currentActiveAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="text-right space-y-1 text-[10px] font-mono font-bold">
                      <div className="bg-white/15 px-2 py-0.5 rounded-md">
                        ↙️ +{currency}{activeAccountTotalRecharged.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </div>
                      <div className="bg-white/15 px-2 py-0.5 rounded-md text-rose-200">
                        ↗️ -{currency}{activeAccountTotalCashIn.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Combined Cash-In and Recharge History */}
                <div className="bg-white dark:bg-[#18202a] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                        {lang === 'bn' ? 'ক্যাশ-ইন ও রিচার্জ হিস্ট্রি' : 'History'}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-black">
                        {activeAccountCombinedHistory.length}
                      </span>
                    </div>
                  </div>

                  {/* Render Customer-Detail style history component */}
                  {renderCustomerStyleHistory(currentActiveAccount, activeAccountCombinedHistory, false)}
                </div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* 2. DESKTOP DEDICATED FULL SCREEN WORKSPACE (hidden md:flex) */}
            {/* ============================================================= */}
            <div className="hidden md:flex flex-col h-full w-full bg-slate-100/98 dark:bg-[#0c1015]/98 text-slate-800 dark:text-slate-100 font-sans backdrop-blur-md overflow-hidden">
              {/* Desktop Top Navigation Bar */}
              <div className="h-14 px-5 bg-white dark:bg-[#141a22] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs">
                {/* Left: Back to Dashboard & Active Account Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBalanceModal(false);
                      setEditingRechargeId(null);
                      setEditingRechargeAmount('');
                      setConfirmDeleteRechargeId(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black cursor-pointer transition-all active:scale-95 shrink-0"
                    title={lang === 'bn' ? 'ক্যাশ-ইন ড্যাশবোর্ডে ফিরে যান' : 'Back to Dashboard'}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard'}</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-sm text-slate-800 dark:text-slate-100">
                        {currentActiveAccount.accountNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 font-mono font-black text-[10px]">
                        ...{currentActiveAccount.lastDigits}
                      </span>
                      {currentActiveAccount.accountName && (
                        <span className="text-xs text-slate-400 font-bold truncate max-w-[140px]">
                          • {currentActiveAccount.accountName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: Interactive SIM Switcher Tabs */}
                <div className="flex items-center gap-1.5 max-w-lg overflow-x-auto scrollbar-none py-1 px-2 bg-slate-50 dark:bg-[#0f141a] rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 pr-0.5">
                    {lang === 'bn' ? 'নম্বরসমূহ:' : 'SIMs:'}
                  </span>
                  {sortedAccountsByBalance.map(acc => {
                    const isActive = acc.id === currentActiveAccount.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setActiveAccountForRecharge(acc);
                          setSelectedAccIdForBalance(acc.id);
                          setBalanceAddAmount('');
                          setBalanceModalError('');
                          setEditingRechargeId(null);
                          setEditingRechargeAmount('');
                          setConfirmDeleteRechargeId(null);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-black cursor-pointer transition-all shrink-0 ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-[#18202a] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-emerald-500'}`} />
                        <span>...{acc.lastDigits}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right: Balance Display & Action Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Current Balance Display */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {lang === 'bn' ? 'ব্যালেন্স' : 'Balance'}:
                    </span>
                    <span className="text-sm font-mono font-black">
                      {currency}{currentActiveAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Edit SIM Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccount(currentActiveAccount);
                      setNewAccNumber(currentActiveAccount.accountNumber);
                      setNewAccName(currentActiveAccount.accountName || '');
                      setNewAccBalance(String(currentActiveAccount.balance));
                      setShowAddAccountModal(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                    title={lang === 'bn' ? 'এডিট করুন' : 'Edit Account'}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>{lang === 'bn' ? 'এডিট' : 'Edit'}</span>
                  </button>

                  {/* Clear All History Button */}
                  <button
                    type="button"
                    id="btn-clear-account-history-desktop"
                    onClick={() => setShowClearHistoryConfirm(true)}
                    disabled={activeAccountCombinedHistory.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 text-xs font-bold cursor-pointer transition-colors border border-rose-200/60 dark:border-rose-900/60 disabled:opacity-40"
                    title={lang === 'bn' ? 'সব হিস্ট্রি ক্লিয়ার করুন' : 'Clear all history'}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    <span>{lang === 'bn' ? 'ক্লিয়ার' : 'Clear'}</span>
                  </button>

                  {/* Delete SIM Button */}
                  <button
                    type="button"
                    onClick={() => setAccountToDelete(currentActiveAccount)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-700 hover:text-rose-600 dark:text-slate-200 dark:hover:text-rose-400 text-xs font-bold cursor-pointer transition-colors"
                    title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete Account'}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{lang === 'bn' ? 'মুছুন' : 'Delete'}</span>
                  </button>

                  {/* Close / Exit Fullscreen Button */}
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddBalanceModal(false);
                      setEditingRechargeId(null);
                      setEditingRechargeAmount('');
                      setConfirmDeleteRechargeId(null);
                    }}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    title={lang === 'bn' ? 'ফুল স্ক্রিন বন্ধ করুন (Esc)' : 'Close Full Screen (Esc)'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Desktop Workspace Body: Split 2-Column Master-Detail Layout */}
              <div className="flex-1 flex overflow-hidden">
                {/* ----------------------------------------------------------- */}
                {/* Left Panel: Control Desk & Recharge Station (~390px wide) */}
                {/* ----------------------------------------------------------- */}
                <div className="w-[390px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141a22] p-5 space-y-4 overflow-y-auto shrink-0 flex flex-col">
                  {/* Account Overview Hero Card */}
                  <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        <span className="text-xs font-bold text-emerald-100">
                          {currentActiveAccount.accountName || (lang === 'bn' ? 'এজেন্ট সিম' : 'Agent SIM')}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-amber-950 font-mono font-black text-xs">
                        ...{currentActiveAccount.lastDigits}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-100 block">
                        {lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Current Balance'}
                      </span>
                      <div className="text-2xl font-mono font-black">
                        {currency}{currentActiveAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/20 text-xs font-mono">
                      <div>
                        <span className="text-[9.5px] text-emerald-100 block">
                          {lang === 'bn' ? 'মোট রিচার্জ (↙️)' : 'Total Recharged'}
                        </span>
                        <span className="font-bold">+{currency}{activeAccountTotalRecharged.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] text-emerald-100 block">
                          {lang === 'bn' ? 'মোট ক্যাশ-ইন (↗️)' : 'Total Cash-In'}
                        </span>
                        <span className="font-bold text-rose-200">-{currency}{activeAccountTotalCashIn.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* SIM Lifetime & Margin Analytics */}
                  <div className="bg-slate-50 dark:bg-[#18202a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span>{lang === 'bn' ? 'সিম পরিসংখ্যান ও লাভ' : 'SIM Analytics'}</span>
                      </span>
                      <span className="text-[10px] text-emerald-600 font-mono font-bold">
                        {lang === 'bn' ? '১৫৳/১,০০০' : '15/1k'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-[#12161d] border border-slate-200/60 dark:border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block font-bold">
                          {lang === 'bn' ? 'মোট ক্যাশ-ইন' : 'Total Cash-In'}
                        </span>
                        <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                          {currency}{activeAccountTotalCashIn.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-[#12161d] border border-slate-200/60 dark:border-slate-800/80">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold">
                          {lang === 'bn' ? 'অর্জিত লাভ' : 'Profit Earned'}
                        </span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                          +{currency}{((activeAccountCommissionableCashIn / 1000) * 15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ----------------------------------------------------------- */}
                {/* Right Panel: History Master Table Stage (flex-1) */}
                {/* ----------------------------------------------------------- */}
                <div className="flex-1 bg-slate-50/70 dark:bg-[#0c1015] p-4 lg:p-6 flex flex-col overflow-hidden space-y-3">
                  {/* Customer-Style Ledger Stage */}
                  <div className="flex-1 bg-white dark:bg-[#141a22] p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
                    {renderCustomerStyleHistory(currentActiveAccount, activeAccountCombinedHistory, true)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. IN-APP DELETE ACCOUNT CONFIRMATION MODAL (100% Guaranteed to work in iFrame) */}
      <AnimatePresence>
        {accountToDelete && (
          <div 
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 font-sans"
            onClick={() => setAccountToDelete(null)}
          >
            <div 
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden text-center p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {lang === 'bn' ? 'নম্বর মুছে ফেলতে চান?' : 'Delete Number?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 font-bold">
                  {accountToDelete.accountNumber} ({currency}{accountToDelete.balance})
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAccountToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {lang === 'bn' ? 'না' : 'No'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAccount}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer shadow-xs"
                >
                  {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. IN-APP DELETE TRANSACTION CONFIRMATION MODAL */}
      <AnimatePresence>
        {txToDelete && (
          <div 
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 font-sans"
            onClick={() => setTxToDelete(null)}
          >
            <div 
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden text-center p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {lang === 'bn' ? 'লেনদেন মুছে ফেলতে চান?' : 'Delete Transaction?'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-1 font-bold">
                  {txToDelete.customerPhone ? txToDelete.customerPhone : (txToDelete.customerName || (lang === 'bn' ? 'নম্বর ছাড়া এন্ট্রি' : 'No number'))} — {currency}{txToDelete.amount}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
                  {lang === 'bn' ? 'নম্বরের ব্যালেন্সে টাকা ফেরত যোগ হবে' : 'Amount will be refunded to SIM balance'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTxToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteTx}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer shadow-xs"
                >
                  {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 9.5. CLEAR ALL ACCOUNT HISTORY CONFIRMATION MODAL */}
      <AnimatePresence>
        {showClearHistoryConfirm && currentActiveAccount && (
          <div 
            className="fixed inset-0 z-[10010] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 font-sans"
            onClick={() => {
              if (!isClearingHistory) setShowClearHistoryConfirm(false);
            }}
          >
            <div 
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-rose-100 dark:border-rose-900/40 overflow-hidden text-center p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                <RotateCcw className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {lang === 'bn' ? 'সকল হিস্ট্রি ক্লিয়ার করবেন?' : 'Clear All History?'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-1 font-bold">
                  {currentActiveAccount.accountNumber} {currentActiveAccount.accountName ? `(${currentActiveAccount.accountName})` : ''}
                </p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5 font-bold">
                  {lang === 'bn' 
                    ? 'এক ক্লিকে এই নম্বরের সকল ক্যাশ-ইন ও রিচার্জ লেনদেন হিস্ট্রি মুছে যাবে। ব্যালেন্স অপরিবর্তিত থাকবে।' 
                    : 'This will delete all cash-in and recharge history for this account. Current balance remains unchanged.'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isClearingHistory}
                  onClick={() => setShowClearHistoryConfirm(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  id="btn-confirm-clear-all-history"
                  disabled={isClearingHistory}
                  onClick={handleClearAllAccountHistory}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isClearingHistory ? (
                    <span>...</span>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'হ্যাঁ, ক্লিয়ার করুন' : 'Clear All'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Baki Customer Search Modal (Triggered by + button beside Last 4 Digits or on Tx card) */}
      {showBakiSearchModal && (
        <div 
          className="fixed inset-0 z-[10006] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => {
            setIsPostCashInBakiSearch(false);
            setTargetTxForBaki(null);
            setShowBakiSearchModal(false);
          }}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-[#182029] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {lang === 'bn' ? 'বাকির খাতা কাস্টমার নির্বাচন' : 'Select Baki Customer'}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    {targetTxForBaki
                      ? (lang === 'bn' ? `এই লেনদেনের (${currency}${targetTxForBaki.amount}) এন্ট্রি কাস্টমারের বাকির খাতায় যোগ হবে` : `This transaction (${currency}${targetTxForBaki.amount}) will be added to customer Baki ledger`)
                      : isPostCashInBakiSearch
                      ? (lang === 'bn' ? 'কাস্টমার নির্বাচন করলে এন্ট্রি সরাসরি বাকির খাতায় যোগ হবে' : 'Selecting customer will add entry to Baki ledger')
                      : (lang === 'bn' ? 'ক্যাশ-ইন স্বয়ংক্রিয়ভাবে বাকির খাতায় যোগ হবে' : 'Cash-in will auto record in customer ledger')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPostCashInBakiSearch(false);
                  setTargetTxForBaki(null);
                  setShowBakiSearchModal(false);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Built-in 'বিকাশ' Editable Note + Customer Search Box */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-2.5">
              {/* Built-in bKash Note Editor */}
              <div className="bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-black text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                    {lang === 'bn' ? 'বাকির খাতার বিবরণ (বিল্ট-ইন বিকাশ):' : 'Baki Entry Note (Built-in bKash):'}
                  </label>
                  <div className="flex items-center gap-1">
                    {(['বিকাশ', 'নগদ', 'ফ্লেক্সিলোড'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBakiCustomLabel(preset)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer border ${
                          bakiCustomLabel === preset
                            ? 'bg-pink-600 text-white border-pink-700 shadow-2xs'
                            : 'bg-white dark:bg-[#151b22] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={bakiCustomLabel}
                    onChange={(e) => setBakiCustomLabel(e.target.value)}
                    placeholder={lang === 'bn' ? 'বিকাশ বা অন্য কিছু লিখুন...' : 'Type bKash or custom note...'}
                    className="w-full bg-white dark:bg-[#151b22] border border-purple-300 dark:border-purple-700 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {bakiCustomLabel && (
                    <button
                      type="button"
                      onClick={() => setBakiCustomLabel('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 cursor-pointer"
                      title={lang === 'bn' ? 'মুছে অন্য কিছু লিখুন' : 'Clear to type custom text'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={bakiSearchQuery}
                  onChange={(e) => setBakiSearchQuery(e.target.value)}
                  placeholder={lang === 'bn' ? 'নাম বা মোবাইল নম্বর দিয়ে কাস্টমার খুঁজুন...' : 'Search customer by name or mobile...'}
                  className="w-full bg-white dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {bakiSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setBakiSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-1">
                <span>{lang === 'bn' ? 'মোট কাস্টমার:' : 'Total customers:'} {filteredBakiContacts.length}</span>
                {bakiAutoEntryContact && (
                  <button
                    type="button"
                    onClick={() => {
                      setBakiAutoEntryContact(null);
                      setShowBakiSearchModal(false);
                    }}
                    className="text-rose-500 hover:underline font-black cursor-pointer"
                  >
                    {lang === 'bn' ? 'সিলেকশন মুছুন' : 'Clear selection'}
                  </button>
                )}
              </div>
            </div>

            {/* Customer List - Clean rows showing only Name and Mobile Number */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
              {filteredBakiContacts.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs font-bold">
                  {lang === 'bn' ? 'কোনো কাস্টমার পাওয়া যায়নি' : 'No customers found'}
                </div>
              ) : (
                filteredBakiContacts.map(contact => {
                  const isSelected = bakiAutoEntryContact?.id === contact.id;
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleSelectBakiCustomer(contact)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-purple-100/80 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800'
                          : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 active:bg-slate-200/70'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-black truncate ${
                          isSelected 
                            ? 'text-purple-900 dark:text-purple-100' 
                            : 'text-slate-800 dark:text-slate-100 group-hover:text-purple-700 dark:group-hover:text-purple-300'
                        }`}>
                          {contact.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-mono font-bold ${
                          isSelected 
                            ? 'text-purple-700 dark:text-purple-300' 
                            : 'text-slate-500 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-300'
                        }`}>
                          {contact.phone}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 stroke-[3]" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsPostCashInBakiSearch(false);
                  setTargetTxForBaki(null);
                  setShowBakiSearchModal(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}