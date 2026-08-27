/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { 
  BookOpen, 
  Search, 
  SlidersHorizontal, 
  FileDown, 
  UserPlus, 
  User,
  MoreVertical, 
  Phone, 
  ChevronRight, 
  ChevronDown,
  X,
  Languages,
  TrendingDown,
  TrendingUp,
  PlusCircle,
  AlertTriangle,
  CheckCircle,
  LogOut,
  Sparkles,
  Trash2,
  Edit,
  Check,
  Square,
  CheckSquare,
  CreditCard,
  Printer,
  KeyRound,
  Bell,
  BellOff,
  Clock,
  Monitor,
  Info,
  Copy,
  FileSpreadsheet,
  ClipboardList,
  MessageSquare,
  CheckCheck,
  Calendar as CalendarIcon,
  Database,
  Download,
  UploadCloud,
  ShieldCheck,
  AlertCircle,
  Lightbulb,
  Sun,
  Moon,
  ShoppingBag,
  Building2,
  Landmark,
  Tag,
  ChevronUp,
  Hash
} from 'lucide-react';
import { Contact, Transaction, CashbookEntry, PayBillEntry, ActiveTab, SignUpRequest, RechargeRequest, ChatMessage, PayBillRequest, Product, ChatQuickFAQ } from '../types';
import { ThemeMode } from '../utils/theme';
import { ChatBox } from './ChatBox';
import { ShopManagementModal } from './ShopManagementModal';
import ChatAutoReplySettingsModal from './ChatAutoReplySettingsModal';
import { getContactSummary, loadQuickFaqs, saveQuickFaqs, loadSavedPayBillAccounts, addSavedPayBillAccount } from '../utils/storage';
import BanglaCalendar from './BanglaCalendar';
import { motion, AnimatePresence } from 'motion/react';

const normalizeString = (str: string): string => {
  const banglaDigits = [/০/g, /১/g, /২/g, /৩/g, /৪/g, /৫/g, /৬/g, /৭/g, /৮/g, /৯/g];
  let res = str.trim().toLowerCase();
  for (let i = 0; i < 10; i++) {
    res = res.replace(banglaDigits[i], String(i));
  }
  return res;
};

const isPhoneLike = (str: string): boolean => {
  const clean = str.replace(/[\s+\-()]/g, '');
  if (!clean) return false;
  return /^[0-9০-৯]+$/.test(clean);
};

interface MainDashboardProps {
  contacts: Contact[];
  transactions: Transaction[];
  onSelectContact: (id: string) => void;
  onAddContact: (name: string, phone: string) => void;
  onDeleteContact: (id: string) => void;
  onNavigateToForm: (contactId: string, isGaveMode: boolean) => void;
  currency: string;
  setCurrency: (c: string) => void;
  onOpenCashbookForm: () => void;
  cashbookBalance: { totalIn: number; totalOut: number; balance: number };
  cashbookEntries: CashbookEntry[];
  onDeleteCashbookEntry: (id: string) => void;
  user: any;
  loadingCloud: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  paybills: PayBillEntry[];
  onSavePayBill: (paybill: PayBillEntry) => void;
  onDeletePayBill: (id: string) => void;
  lang?: 'bn' | 'en';
  setLang?: (l: 'bn' | 'en') => void;
  onLogout: () => void;
  shopStatus?: 'open' | 'closed';
  onToggleShopStatus?: (status: 'open' | 'closed') => void;
  onPinChange?: (newPin: string) => void;
  onSaveReminder?: (reminder: any) => void;
  onDeleteReminder?: (id: string) => void;
  signupRequests?: SignUpRequest[];
  onAcceptSignUpRequest?: (req: SignUpRequest) => void;
  onRejectSignUpRequest?: (req: SignUpRequest) => void;
  themeColor?: string;
  onChangeThemeColor?: (color: string) => void;
  rechargeRequests?: RechargeRequest[];
  onCompleteRechargeRequest?: (req: RechargeRequest) => void;
  onCancelRechargeRequest?: (req: RechargeRequest) => void;
  paybillRequests?: PayBillRequest[];
  onCompletePayBillRequest?: (req: PayBillRequest) => void;
  onCancelPayBillRequest?: (req: PayBillRequest) => void;
  chatMessages?: ChatMessage[];
  onSendChatMessage?: (contactId: string, text: string, senderRole: 'owner' | 'customer', senderName: string) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  onDeleteChatThread?: (contactId: string) => void;
  onMarkChatsAsRead?: (contactId: string, role: 'owner' | 'customer') => void;
  themeMode?: ThemeMode;
  onChangeThemeMode?: (mode: ThemeMode) => void;
  products?: Product[];
  onSaveProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  quickFaqs?: ChatQuickFAQ[];
  onSaveQuickFaqs?: (faqs: ChatQuickFAQ[]) => void;
}

interface Reminder {
  id: string;
  text: string;
  datetime: string; // ISO / Y-M-DThh:mm
  isCompleted: boolean;
  isTriggered: boolean;
}

const safeConfirm = (message: string): boolean => {
  try {
    return window.confirm(message);
  } catch (err) {
    console.warn("window.confirm is blocked in this sandbox, defaulting to true", err);
    return true;
  }
};

export function MainDashboard({
  contacts,
  transactions,
  onSelectContact,
  onAddContact,
  onDeleteContact,
  onNavigateToForm,
  currency,
  setCurrency,
  onOpenCashbookForm,
  cashbookBalance,
  cashbookEntries,
  onDeleteCashbookEntry,
  user,
  loadingCloud,
  onSignIn,
  onSignOut,
  paybills,
  onSavePayBill,
  onDeletePayBill,
  lang: propLang,
  setLang: propSetLang,
  onLogout,
  shopStatus = 'open',
  onToggleShopStatus,
  onPinChange,
  onSaveReminder,
  onDeleteReminder,
  signupRequests = [],
  onAcceptSignUpRequest,
  onRejectSignUpRequest,
  themeColor = '#6244a6',
  onChangeThemeColor,
  rechargeRequests = [],
  onCompleteRechargeRequest,
  onCancelRechargeRequest,
  paybillRequests = [],
  onCompletePayBillRequest,
  onCancelPayBillRequest,
  chatMessages = [],
  onSendChatMessage,
  onDeleteChatMessage,
  onDeleteChatThread,
  onMarkChatsAsRead,
  themeMode = 'system',
  onChangeThemeMode,
  products = [],
  onSaveProduct,
  onDeleteProduct,
  quickFaqs,
  onSaveQuickFaqs
}: MainDashboardProps) {
  // Bilingual localization state
  const [localLang, setLocalLang] = useState<'bn' | 'en'>(() => (localStorage.getItem('hellopoint_lang') as 'bn' | 'en') || 'bn');
  const lang = propLang || localLang;
  const setLang = (l: 'bn' | 'en') => {
    localStorage.setItem('hellopoint_lang', l);
    if (propSetLang) propSetLang(l);
    setLocalLang(l);
  };

  // Reminders state management
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem('hellopoint_reminders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isDesktopMode, setIsDesktopMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('hellopoint_desktop_mode');
      if (saved !== null) {
        return saved === 'true';
      }
      return typeof window !== 'undefined' && window.innerWidth >= 1024;
    } catch {
      return false;
    }
  });

  const toggleDesktopMode = () => {
    const nextVal = !isDesktopMode;
    setIsDesktopMode(nextVal);
    localStorage.setItem('hellopoint_desktop_mode', String(nextVal));
    window.dispatchEvent(new Event('desktop_mode_changed'));
  };

  const [showOwnerInboxModal, setShowOwnerInboxModal] = useState(false);
  const [showChatSettingsModal, setShowChatSettingsModal] = useState(false);
  const [localQuickFaqs, setLocalQuickFaqs] = useState<ChatQuickFAQ[]>(() => quickFaqs || loadQuickFaqs());

  useEffect(() => {
    if (quickFaqs && quickFaqs.length > 0) {
      setLocalQuickFaqs(quickFaqs);
    }
  }, [quickFaqs]);

  const handleSaveFaqs = (updated: ChatQuickFAQ[]) => {
    setLocalQuickFaqs(updated);
    if (onSaveQuickFaqs) {
      onSaveQuickFaqs(updated);
    } else {
      saveQuickFaqs(updated);
    }
  };

  const [selectedChatContactId, setSelectedChatContactId] = useState<string | null>(null);
  const [chatThreadToDelete, setChatThreadToDelete] = useState<{ id: string; name: string } | null>(null);
  const [searchChatQuery, setSearchChatQuery] = useState('');
  const [showShopManagementModal, setShowShopManagementModal] = useState(false);

  const unreadChatsCount = useMemo(() => {
    return (chatMessages || []).filter(m => m.senderRole === 'customer' && !m.readByOwner).length;
  }, [chatMessages]);

  const pendingPaybillRequestsCount = useMemo(() => {
    return (paybillRequests || []).filter(r => r.status === 'pending').length;
  }, [paybillRequests]);

  const activeChatContacts = useMemo(() => {
    const contactIds = Array.from(new Set((chatMessages || []).map(m => m.contactId)));
    return contactIds.map(id => {
      const existing = contacts.find(c => c.id === id);
      const threadCustomerMsgs = (chatMessages || []).filter(m => m.contactId === id && m.senderRole === 'customer');
      const latestCustomerMsg = threadCustomerMsgs[threadCustomerMsgs.length - 1];
      const lastMsg = (chatMessages || []).slice().reverse().find(m => m.contactId === id);

      const resolvedName = existing?.name || latestCustomerMsg?.senderName || lastMsg?.senderName || (lang === 'bn' ? 'অনলাইন ভিজিটর' : 'Online Visitor');
      const resolvedPhone = existing?.phone || latestCustomerMsg?.senderPhone || lastMsg?.senderPhone || '';

      return {
        id,
        name: resolvedName,
        phone: resolvedPhone,
        type: 'customer' as const,
        photoUrl: existing?.photoUrl,
        createdAt: lastMsg?.createdAt || new Date().toISOString(),
        updatedAt: lastMsg?.createdAt || new Date().toISOString()
      };
    });
  }, [chatMessages, contacts, lang]);

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPaybillRequestsModal, setShowPaybillRequestsModal] = useState(false);
  const [selectedRequestToConfirm, setSelectedRequestToConfirm] = useState<PayBillRequest | null>(null);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderDatetime, setNewReminderDatetime] = useState(() => {
    // Current local time formatted for input defaultValue YYYY-MM-DDTHH:MM
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000; // in ms
    const localISOTime = (new Date(now.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  });
  const [isWiggling, setIsWiggling] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);
  const [nowTicker, setNowTicker] = useState<Date>(new Date());

  // Check reminders every 3 seconds for scheduled trigger wiggling & update tick time (Highly optimized functional updates)
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      setNowTicker(now);
      
      setReminders(prev => {
        let updated = false;
        const nextReminders = prev.map(r => {
          if (!r.isCompleted && !r.isTriggered) {
            const rDate = new Date(r.datetime);
            if (now >= rDate) {
              updated = true;
              return { ...r, isTriggered: true };
            }
          }
          return r;
        });

        if (updated) {
          localStorage.setItem('hellopoint_reminders', JSON.stringify(nextReminders));
          const hasActiveTrigger = nextReminders.some(r => r.isTriggered && !r.isCompleted);
          setIsWiggling(hasActiveTrigger);
          return nextReminders;
        }

        const hasActiveTrigger = prev.some(r => r.isTriggered && !r.isCompleted);
        setIsWiggling(hasActiveTrigger);
        return prev;
      });
    };

    checkReminders();
    const timer = setInterval(checkReminders, 3000);
    return () => clearInterval(timer);
  }, []);

  // Synchronize reminders with localStorage updates (e.g. from customer logins or sync)
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('hellopoint_reminders');
        if (saved) {
          setReminders(JSON.parse(saved));
        }
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim() || !newReminderDatetime) return;

    let nextReminders;
    const now = new Date();
    const target = new Date(newReminderDatetime);
    const isTriggered = now >= target;

    if (editingReminderId) {
      let updatedRem: Reminder | null = null;
      nextReminders = reminders.map(r => {
        if (r.id === editingReminderId) {
          const updated = {
            ...r,
            text: newReminderText.trim(),
            datetime: newReminderDatetime,
            isTriggered,
            isCompleted: false // reset completion status when edited/re-scheduled
          };
          updatedRem = updated;
          return updated;
        }
        return r;
      });
      setEditingReminderId(null);
      if (updatedRem && onSaveReminder) {
        onSaveReminder(updatedRem);
      }
    } else {
      const newRem: Reminder = {
        id: 'rem_' + Date.now(),
        text: newReminderText.trim(),
        datetime: newReminderDatetime,
        isCompleted: false,
        isTriggered
      };
      nextReminders = [newRem, ...reminders];
      if (onSaveReminder) {
        onSaveReminder(newRem);
      }
    }

    setReminders(nextReminders);
    localStorage.setItem('hellopoint_reminders', JSON.stringify(nextReminders));
    setNewReminderText('');
    
    // reset date to now
    const resetNow = new Date();
    const tzoffset = resetNow.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(resetNow.getTime() - tzoffset)).toISOString().slice(0, 16);
    setNewReminderDatetime(localISOTime);
  };

  const handleStartEditReminder = (r: Reminder) => {
    setEditingReminderId(r.id);
    setNewReminderText(r.text);
    setNewReminderDatetime(r.datetime);
  };

  const handleCancelEditReminder = () => {
    setEditingReminderId(null);
    setNewReminderText('');
    const resetNow = new Date();
    const tzoffset = resetNow.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(resetNow.getTime() - tzoffset)).toISOString().slice(0, 16);
    setNewReminderDatetime(localISOTime);
  };

  const handleCompleteReminder = (id: string) => {
    handleDeleteReminder(id);
  };

  const handleDeleteReminder = (id: string) => {
    const nextReminders = reminders.filter(r => r.id !== id);
    setReminders(nextReminders);
    localStorage.setItem('hellopoint_reminders', JSON.stringify(nextReminders));
    
    if (onDeleteReminder) {
      onDeleteReminder(id);
    }

    if (editingReminderId === id) {
      handleCancelEditReminder();
    }
  };

  // Suppliers is removed, tabs are Customer, Pay Bill, or Cashbook
  const [activeTab, setActiveTab] = useState<ActiveTab>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState<string | null>(null);
  
  // New Contact local state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  
  // Replaced settings drawer with dynamic Three-Dot Menu
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showThemeOptions, setShowThemeOptions] = useState(false);
  
  // Pay Bill State variables
  const [showPayBillModal, setShowPayBillModal] = useState(false);
  const [editingPayBill, setEditingPayBill] = useState<PayBillEntry | null>(null);
  const [payBillError, setPayBillError] = useState('');
  const [payBillSearch, setPayBillSearch] = useState('');
  const [selectedPayBillMonth, setSelectedPayBillMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [activePayBillDetails, setActivePayBillDetails] = useState<PayBillEntry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const toggleCardInfo = (id: string) => {
    setExpandedCardIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Copy to clipboard state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }).catch(() => {
        fallbackCopyText(text, id);
      });
    } else {
      fallbackCopyText(text, id);
    }
  };

  const fallbackCopyText = (text: string, id: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Prevent scrolling to bottom
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      if (successful) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      document.body.removeChild(textArea);
    } catch (err) {
      console.error("Fallback: Failed to copy text", err);
    }
  };

  // Paid Information Modal state
  const [showPaidInfoModal, setShowPaidInfoModal] = useState(false);
  const [activePaidInfoPb, setActivePaidInfoPb] = useState<PayBillEntry | null>(null);
  const [paidInfoText, setPaidInfoText] = useState('');
  const [paidAccountText, setPaidAccountText] = useState('');
  const [savedPayBillAccounts, setSavedPayBillAccounts] = useState<string[]>(() => loadSavedPayBillAccounts());
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string | null>(null);
  const [showMonthAccountCard, setShowMonthAccountCard] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hellopoint_show_month_account_card');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const handleSavePaidInfo = () => {
    if (!activePaidInfoPb) return;
    const cleanAcc = paidAccountText.trim();
    if (cleanAcc) {
      const updated = addSavedPayBillAccount(cleanAcc);
      setSavedPayBillAccounts(updated);
    }
    onSavePayBill({
      ...activePaidInfoPb,
      paidInfo: paidInfoText.trim() || undefined,
      paidAccount: cleanAcc || undefined
    });
    setShowPaidInfoModal(false);
    setActivePaidInfoPb(null);
    setPaidInfoText('');
    setPaidAccountText('');
  };
  
  // Pay Bill dynamic forms fields
  const [pbBillerNumber, setPbBillerNumber] = useState('');
  const [pbAmount, setPbAmount] = useState('');
  const [pbDate, setPbDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [pbBillerDetails, setPbBillerDetails] = useState('');
  const [pbMemo, setPbMemo] = useState('');
  const [pbSecondDate, setPbSecondDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [pbContactId, setPbContactId] = useState('');

  // Customer List sorting filter state
  const [customerFilter, setCustomerFilter] = useState<'last_edited' | 'a_to_z' | 'biggest_amount'>('last_edited');
  
  // Card density sizing style state: 'compact' | 'comfortable' | 'large'
  const [cardDensity, setCardDensity] = useState<'compact' | 'comfortable' | 'large'>(() => {
    return (localStorage.getItem('hellopoint_card_density') as 'compact' | 'comfortable' | 'large') || 'compact';
  });

  const handleCardDensityChange = (density: 'compact' | 'comfortable' | 'large') => {
    setCardDensity(density);
    localStorage.setItem('hellopoint_card_density', density);
  };
  
  // Bangla Calendar visibility trigger state
  const [showBanglaCalendar, setShowBanglaCalendar] = useState(false);

  // Pay Bill deletion target state for beautiful custom Yes/No popup alert modal
  const [payBillToDelete, setPayBillToDelete] = useState<PayBillEntry | null>(null);

  // Customer and Cashbook deletion target states for beautiful custom Yes/No popup alerts
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [cashbookToDelete, setCashbookToDelete] = useState<CashbookEntry | null>(null);

  // Recharge request cancellation target state for beautiful custom Yes/No popup alert modal
  const [rechargeToCancel, setRechargeToCancel] = useState<RechargeRequest | null>(null);

  // Backup Alert Banner dynamic dismiss state
  const [showBackupAlert, setShowBackupAlert] = useState<boolean>(
    () => !localStorage.getItem('hellopoint_backup_alert_dismissed')
  );

  const toggleShopStatus = () => {
    const newStatus = shopStatus === 'open' ? 'closed' : 'open';
    if (onToggleShopStatus) {
      onToggleShopStatus(newStatus);
    } else {
      localStorage.setItem('hellopoint_shop_status', newStatus);
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Backup & Restore State variables
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const handleExportFullBackup = () => {
    try {
      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        contacts: JSON.parse(localStorage.getItem('hellopoint_contacts') || '[]'),
        transactions: JSON.parse(localStorage.getItem('hellopoint_transactions') || '[]'),
        cashbook: JSON.parse(localStorage.getItem('hellopoint_cashbook') || '[]'),
        paybills: JSON.parse(localStorage.getItem('hellopoint_paybills') || '[]'),
        reminders: JSON.parse(localStorage.getItem('hellopoint_reminders') || '[]'),
        pin: localStorage.getItem('hellopoint_pin') || '1234',
        custom_categories: JSON.parse(localStorage.getItem('hellopoint_custom_categories') || '[]'),
        deleted_notes: JSON.parse(localStorage.getItem('hellopoint_deleted_notes') || '[]'),
        favorite_tags: JSON.parse(localStorage.getItem('hellopoint_favorite_tags') || '[]'),
        tag_category_overrides: JSON.parse(localStorage.getItem('hellopoint_tag_category_overrides') || '{}'),
        settings: {
          lang: localStorage.getItem('hellopoint_lang') || 'bn',
          currency: localStorage.getItem('hellopoint_currency') || '৳',
          desktop_mode: localStorage.getItem('hellopoint_desktop_mode') || 'false',
          card_density: localStorage.getItem('hellopoint_card_density') || 'compact',
        }
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `hellopoint_full_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert(lang === 'bn' ? 'ব্যাকআপ ফাইল তৈরিতে সমস্যা হয়েছে।' : 'Failed to create backup file.');
    }
  };

  const handleImportFullBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus({ type: null, message: '' });
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const backup = JSON.parse(content);
          
          if (!backup || typeof backup !== 'object') {
            throw new Error('Invalid JSON format.');
          }

          const hasContacts = Array.isArray(backup.contacts);
          const hasTransactions = Array.isArray(backup.transactions);
          const hasCashbook = Array.isArray(backup.cashbook);
          const hasPaybills = Array.isArray(backup.paybills);

          if (!hasContacts && !hasTransactions && !hasCashbook && !hasPaybills) {
            throw new Error(lang === 'bn' ? 'এটি কোনো বৈধ হ্যালো পয়েন্ট ব্যাকআপ ফাইল নয়।' : 'This file is not a valid Hello Point backup.');
          }

          // Save items to localStorage
          if (backup.contacts) localStorage.setItem('hellopoint_contacts', JSON.stringify(backup.contacts));
          if (backup.transactions) localStorage.setItem('hellopoint_transactions', JSON.stringify(backup.transactions));
          if (backup.cashbook) localStorage.setItem('hellopoint_cashbook', JSON.stringify(backup.cashbook));
          if (backup.paybills) localStorage.setItem('hellopoint_paybills', JSON.stringify(backup.paybills));
          if (backup.reminders) localStorage.setItem('hellopoint_reminders', JSON.stringify(backup.reminders));
          if (backup.pin) localStorage.setItem('hellopoint_pin', backup.pin);
          if (backup.custom_categories) localStorage.setItem('hellopoint_custom_categories', JSON.stringify(backup.custom_categories));
          if (backup.deleted_notes) localStorage.setItem('hellopoint_deleted_notes', JSON.stringify(backup.deleted_notes));
          if (backup.favorite_tags) localStorage.setItem('hellopoint_favorite_tags', JSON.stringify(backup.favorite_tags));
          if (backup.tag_category_overrides) localStorage.setItem('hellopoint_tag_category_overrides', JSON.stringify(backup.tag_category_overrides));
          
          if (backup.settings) {
            if (backup.settings.lang) localStorage.setItem('hellopoint_lang', backup.settings.lang);
            if (backup.settings.currency) localStorage.setItem('hellopoint_currency', backup.settings.currency);
            if (backup.settings.desktop_mode) localStorage.setItem('hellopoint_desktop_mode', backup.settings.desktop_mode);
            if (backup.settings.card_density) localStorage.setItem('hellopoint_card_density', backup.settings.card_density);
          }

          // If the user is logged in, clear their local-to-cloud migration flag,
          // so that on reload, all the restored data gets synced up to Firebase Firestore immediately!
          if (user) {
            localStorage.removeItem(`hellopoint_synced_${user.uid}`);
          }

          setImportStatus({
            type: 'success',
            message: lang === 'bn' 
              ? 'অভিনন্দন! আপনার ব্যাকআপ ফাইলটি সফলভাবে রিস্টোর হয়েছে। ডাটা লোড করার জন্য সিস্টেম রিবুট হচ্ছে...' 
              : 'Success! Your backup has been successfully restored. Reloading system...'
          });

          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } catch (err: any) {
          console.error(err);
          setImportStatus({
            type: 'error',
            message: lang === 'bn'
              ? `ব্যাকআপ রিস্টোর ব্যর্থ হয়েছে: ${err.message || 'ভুল ফাইল ফরম্যাট'}`
              : `Restore failed: ${err.message || 'Incorrect file format'}`
          });
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      console.error(err);
      setImportStatus({
        type: 'error',
        message: lang === 'bn' ? 'ফাইল পড়তে সমস্যা হয়েছে।' : 'Error reading backup file.'
      });
    }
  };

  // Change PIN State variables
  const [showPinChangeModal, setShowPinChangeModal] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState('');

  const handlePinChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError('');
    setPinChangeSuccess('');

    const savedPin = localStorage.getItem('hellopoint_pin');
    // If no pin is set in storage, we can treat any or empty oldPin as okay
    if (savedPin && oldPin !== savedPin) {
      setPinChangeError(lang === 'bn' ? 'বর্তমান পিনটি সঠিক নয়।' : 'Current PIN is incorrect.');
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      setPinChangeError(lang === 'bn' ? 'নতুন পিন অবশ্যই ৪ ডিজিটের হতে হবে।' : 'New PIN must be exactly 4 digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setPinChangeError(lang === 'bn' ? 'নতুন পিন এবং নিশ্চিতকরণ পিন মেলেনি।' : 'New PIN and confirm PIN do not match.');
      return;
    }

    if (onPinChange) {
      onPinChange(newPin);
    } else {
      localStorage.setItem('hellopoint_pin', newPin);
    }
    setPinChangeSuccess(lang === 'bn' ? 'পিন সফলভাবে পরিবর্তিত হয়েছে!' : 'PIN changed successfully!');
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setTimeout(() => {
      setShowPinChangeModal(false);
      setPinChangeSuccess('');
    }, 1500);
  };

  // Convert numbers to Bengali numerals if language is set to bn
  const toBn = (enStr: string | number): string => {
    if (lang !== 'bn') return String(enStr);
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(enStr).replace(/[0-9]/g, (digit) => bnDigits[parseInt(digit, 10)]);
  };

  // Real-time Bengali/English digital clock and day name
  const [bnDateTime, setBnDateTime] = useState({ formattedDate: '', formattedTime: '' });

  useEffect(() => {
    const updateTime = () => {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      const toBnDigits = (numStr: string | number): string => {
        return String(numStr).replace(/[0-9]/g, (digit) => bnDigits[parseInt(digit, 10)]);
      };
      
      const dateObj = new Date();
      if (lang === 'bn') {
        const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
        const dayName = days[dateObj.getDay()];
        
        const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
        const dateNum = toBnDigits(dateObj.getDate());
        const monthName = months[dateObj.getMonth()];
        
        let hours = dateObj.getHours();
        const ampm = hours >= 12 ? 'দুপুর' : 'সকাল';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        
        setBnDateTime({
          formattedDate: `${dayName}, ${dateNum} ${monthName}`,
          formattedTime: `${toBnDigits(hours)}:${toBnDigits(minutes)}:${toBnDigits(seconds)} ${ampm}`
        });
      } else {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[dateObj.getDay()];
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateNum = dateObj.getDate();
        const monthName = months[dateObj.getMonth()];
        
        let hours = dateObj.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        
        setBnDateTime({
          formattedDate: `${dayName}, ${dateNum} ${monthName}`,
          formattedTime: `${hours}:${minutes}:${seconds} ${ampm}`
        });
      }
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [lang]);

  const text = {
    bn: {
      customers: 'কাস্টমার হিসাব',
      cashbook: 'দৈনিক ক্যাশবুক',
      youWillGive: 'আপনি দেবেন',
      youWillGet: 'আপনি পাবেন',
      searchPlaceholder: 'কাস্টমারের নাম বা মোবাইল দিয়ে খুঁজুন...',
      addCustomer: 'কাস্টমার যোগ',
      viewReport: 'রিপোর্ট',
      entries: 'টি লেনদেন',
      noEntries: 'কোনো হিসাব নেই',
      addContactTitle: 'নতুন কাস্টমার যোগ করুন',
      nameLabel: 'নাম',
      phoneLabel: 'মোবাইল নম্বর',
      save: 'সংরক্ষণ করুন',
      cancel: 'বাতিল',
      enterName: 'নাম লিখুন (আবশ্যক)',
      enterPhone: '১১ ডিজিটের মোবাইল নম্বর',
      deleteConfirm: 'আপনি কি নিশ্চিতভাবে এই হিসাবটি এবং এর সকল লেনদেন মুছতে চান?',
      delete: 'মুছে ফেলুন',
      cashIn: 'ক্যাশ ইন (+)',
      cashOut: 'ক্যাশ আউট (-)',
      cashInHand: 'হাতে ক্যাশ আছে (ক্যাশ ইন হ্যান্ড)',
      settingsTitle: 'সেটিংস',
      currencyLabel: 'মুদ্রা সংকেত',
      reportDownload: 'সুন্দর গুগল শিট (.csv) রিপোর্ট জেনারেট',
      totalSummary: 'মোট বকেয়া সারসংক্ষেপ',
      searchNoResult: 'কোনো ফলাফল পাওয়া যায়নি!',
      appDescription: 'Hello Point - নিরাপদ বকেয়া খাতা ও ক্যাশবুক',
    },
    en: {
      customers: 'Customers',
      cashbook: 'Daily Cashbook',
      youWillGive: 'You will give',
      youWillGet: 'You will get',
      searchPlaceholder: 'Search customer name, phone...',
      addCustomer: 'Add Customer',
      viewReport: 'Report',
      entries: 'entries',
      noEntries: 'No entries',
      addContactTitle: 'Add New Customer',
      nameLabel: 'Name',
      phoneLabel: 'Mobile Number',
      save: 'Save',
      cancel: 'Cancel',
      enterName: 'Enter name (Required)',
      enterPhone: 'Enter mobile number',
      deleteConfirm: 'Are you sure you want to delete this customer and all their ledger history?',
      delete: 'Delete',
      cashIn: 'Cash In (+)',
      cashOut: 'Cash Out (-)',
      cashInHand: 'Cash in Hand',
      settingsTitle: 'Settings',
      currencyLabel: 'Currency Symbol',
      reportDownload: 'Generate Beautiful Google Sheet (.csv) Report',
      totalSummary: 'Total Credit Summary',
      searchNoResult: 'No results found!',
      appDescription: 'Hello Point - Secure Digital Ledger',
    }
  }[lang];

  // Pre-calculate and map contact summaries and last activity to convert O(N*M) calculation complexity to O(N+M)
  const contactSummaries = useMemo(() => {
    const map = new Map<string, { totalGave: number; totalGot: number; balance: number; entryCount: number; lastDateStr: string }>();
    
    // Initialize map for all contacts
    contacts.forEach(c => {
      map.set(c.id, { 
        totalGave: 0, 
        totalGot: 0, 
        balance: 0, 
        entryCount: 0,
        lastDateStr: c.updatedAt || c.createdAt || ''
      });
    });

    // Single sweep across transactions (Highly-optimized with direct string comparison for dates)
    const txLen = transactions.length;
    for (let i = 0; i < txLen; i++) {
      const t = transactions[i];
      const entry = map.get(t.contactId);
      if (entry) {
        entry.entryCount++;
        if (t.type === 'GAVE') {
          entry.totalGave += t.amount;
        } else if (t.type === 'GOT') {
          entry.totalGot += t.amount;
        }
        
        // Update last activity live - String-based lexical comparison is extremely fast and robust for ISO strings
        const txDate = t.createdAt || t.date || '';
        if (txDate > entry.lastDateStr) {
          entry.lastDateStr = txDate;
        }
      }
    }

    // Compute balances
    map.forEach(entry => {
      entry.balance = entry.totalGave - entry.totalGot;
    });

    return map;
  }, [contacts, transactions]);

  // Credit/Debit summation calculations
  const totals = useMemo(() => {
    let youWillGiveSum = 0; // Negative balance
    let youWillGetSum = 0;  // Positive balance

    // Suppliers type is safe now
    const filteredContacts = contacts.filter(c => c.type === 'customer');

    filteredContacts.forEach(c => {
      const summary = contactSummaries.get(c.id) || { totalGave: 0, totalGot: 0, balance: 0, entryCount: 0, lastDateStr: '' };
      if (summary.balance < 0) {
        youWillGiveSum += Math.abs(summary.balance);
      } else if (summary.balance > 0) {
        youWillGetSum += summary.balance;
      }
    });

    return {
      youWillGive: youWillGiveSum,
      youWillGet: youWillGetSum
    };
  }, [contacts, contactSummaries]);

  const getContactLastActivity = (contactId: string) => {
    const summary = contactSummaries.get(contactId);
    if (summary) {
      return { 
        // Parse dates lazily only if explicitly requested, not inside any hot loop
        time: summary.lastDateStr ? new Date(summary.lastDateStr).getTime() : 0, 
        dateStr: summary.lastDateStr 
      };
    }
    return { time: 0, dateStr: '' };
  };

  const formatLastVisit = (dateStr: string) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return '';
    
    const optionsDate: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
    const strDate = dateObj.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', optionsDate);
    const strTime = dateObj.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    
    return lang === 'bn' ? `শেষ এডিট: ${strDate}, ${strTime}` : `Last edit: ${strDate}, ${strTime}`;
  };

  // Query search on contacts (sorted on selected filter criteria)
  const filteredContacts = useMemo(() => {
    const list = contacts
      .filter(c => c.type === 'customer')
      .filter(c => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        const normQ = normalizeString(q);
        return (
          c.name.toLowerCase().includes(q) || 
          c.phone.includes(normQ) ||
          c.phone.includes(q)
        );
      });

    return list.sort((a, b) => {
      if (customerFilter === 'a_to_z') {
        return a.name.localeCompare(b.name, lang === 'bn' ? 'bn' : 'en');
      } else if (customerFilter === 'biggest_amount') {
        const summaryA = contactSummaries.get(a.id) || { balance: 0 };
        const summaryB = contactSummaries.get(b.id) || { balance: 0 };
        const balA = Math.abs(summaryA.balance);
        const balB = Math.abs(summaryB.balance);
        return balB - balA;
      } else {
        // Default / last_edited sorting using extremely fast lexical string comparisons
        const dateA = contactSummaries.get(a.id)?.lastDateStr || '';
        const dateB = contactSummaries.get(b.id)?.lastDateStr || '';
        return dateB.localeCompare(dateA);
      }
    });
  }, [contacts, searchQuery, contactSummaries, customerFilter, lang]);

  const handleSavePayBillForm = (e: React.FormEvent) => {
    e.preventDefault();
    setPayBillError('');

    if (!pbBillerNumber.trim() || !pbAmount.trim() || !pbBillerDetails.trim() || !pbSecondDate.trim() || !pbMemo.trim()) {
      setPayBillError(lang === 'bn' ? 'অনুগ্রহ করে সকল তথ্য (বিলার আইডি, টাকা, নাম, শেষ তারিখ, মোবাইল নম্বর) বাধ্যতামূলকভাবে পূরণ করুন।' : 'Please fill all mandatory fields.');
      return;
    }

    if (/[a-zA-Z\u0980-\u09FF]/.test(pbBillerNumber.trim())) {
      setPayBillError(lang === 'bn' ? '⚠️ বিলার নম্বরে নাম বা অন্য তথ্য বসানো হয়েছে! অনুগ্রহ করে শুধুমাত্র বিলার আইডি/সংখ্যা লিখুন।' : '⚠️ Name/text placed in Biller Number field!');
      return;
    }

    const finalAmount = parseFloat(pbAmount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setPayBillError(lang === 'bn' ? '⚠️ টাকার পরিমাণের জায়গায় ভুল তথ্য বসানো হয়েছে! সঠিক টাকার পরিমাণ লিখুন।' : '⚠️ Please enter a valid positive amount.');
      return;
    }
    if (/^01\d{9}$/.test(pbAmount.trim())) {
      setPayBillError(lang === 'bn' ? '⚠️ টাকার পরিমাণের জায়গায় মোবাইল নম্বর বসানো হয়েছে বলে মনে হচ্ছে! সঠিক টাকার পরিমাণ লিখুন।' : '⚠️ Phone number placed in Amount field!');
      return;
    }

    if (/^\d+$/.test(pbBillerDetails.trim())) {
      setPayBillError(lang === 'bn' ? '⚠️ কাস্টমার নামের জায়গায় মোবাইল নম্বর বা বিলার আইডি বসানো হয়েছে! অনুগ্রহ করে সঠিক নাম লিখুন।' : '⚠️ Number placed in Customer Name field!');
      return;
    }

    const cleanPhone = pbMemo.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
      setPayBillError(lang === 'bn' ? '⚠️ মোবাইল নম্বরের জায়গায় বিলার আইডি বা ভুল সংখ্যা বসানো হয়েছে! অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নম্বর লিখুন (যেমন: 01712345678)।' : '⚠️ Please enter a valid 11-digit mobile number.');
      return;
    }

    // Bangla to English numbers converter
    const convertBanglaToEnglishNumbers = (str: string): string => {
      const banglaDigits = [/০/g, /১/g, /২/g, /৩/g, /৪/g, /৫/g, /৬/g, /৭/g, /৮/g, /৯/g];
      let res = str;
      for (let i = 0; i < 10; i++) {
        res = res.replace(banglaDigits[i], String(i));
      }
      return res;
    };

    const finalBillerNumber = convertBanglaToEnglishNumbers(pbBillerNumber.trim());
    const finalBillerDetails = convertBanglaToEnglishNumbers(pbBillerDetails.trim());
    const finalMemo = convertBanglaToEnglishNumbers(pbMemo.trim());
    const finalDate = editingPayBill?.date || new Date().toISOString().split('T')[0];

    const entry: PayBillEntry = {
      id: editingPayBill?.id || 'pb-' + Date.now(),
      billerNumber: finalBillerNumber,
      amount: finalAmount,
      date: finalDate,
      billerDetails: finalBillerDetails,
      secondDate: pbSecondDate,
      note: finalMemo,
      isPaid: editingPayBill ? editingPayBill.isPaid : false,
      createdAt: editingPayBill ? editingPayBill.createdAt : new Date().toISOString(),
      paidAt: editingPayBill?.paidAt,
      paidInfo: editingPayBill?.paidInfo,
      paidAccount: editingPayBill?.paidAccount,
      contactId: pbContactId || undefined
    };

    onSavePayBill(entry);
    setShowPayBillModal(false);
    setEditingPayBill(null);
    clearPayBillForm();
  };

  const handleAddNewContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAddContact(newName.trim(), newPhone.trim());
    setShowAddModal(false);
    setNewName('');
    setNewPhone('');
  };

  // Helper to get YYYY-MM month key for paybills
  const getPayBillMonthKey = (pb: PayBillEntry): string => {
    const rawDateStr = pb.date && pb.date.trim() ? pb.date.trim() : (pb.createdAt || '');
    let dateObj = new Date(rawDateStr);

    if (isNaN(dateObj.getTime())) {
      const match = rawDateStr.match(/(\d{4})-(\d{2})/);
      if (match) {
        return `${match[1]}-${match[2]}`;
      }
      dateObj = new Date(pb.createdAt || Date.now());
    }

    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }

    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  // Helper to compute recent 6 months
  const getRecent6Months = (langStr: string) => {
    const monthsBn = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const monthsEn = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();

    const list: { monthKey: string; monthLabel: string; isCurrent: boolean }[] = [];

    for (let i = 0; i < 6; i++) {
      let y = currentYear;
      let mIdx = currentMonthIdx - i;
      while (mIdx < 0) {
        mIdx += 12;
        y -= 1;
      }

      const monthKey = `${y}-${String(mIdx + 1).padStart(2, '0')}`;

      const toBanglaDigits = (num: number) => {
        if (langStr !== 'bn') return String(num);
        const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        return String(num).split('').map(d => bnDigits[parseInt(d)] || d).join('');
      };

      const label = langStr === 'bn' 
        ? `${monthsBn[mIdx]} ${toBanglaDigits(y)}` 
        : `${monthsEn[mIdx]} ${y}`;

      list.push({
        monthKey,
        monthLabel: label,
        isCurrent: i === 0,
      });
    }

    return list;
  };

  // Auto cleanup paybills older than 6 months (auto delete bills older than 6th month)
  useEffect(() => {
    if (!paybills || paybills.length === 0) return;

    const recent6 = getRecent6Months(lang || 'bn');
    if (recent6.length === 0) return;

    const oldestAllowedMonthKey = recent6[recent6.length - 1].monthKey;

    const expiredPaybills = paybills.filter(pb => {
      const mk = getPayBillMonthKey(pb);
      return mk < oldestAllowedMonthKey;
    });

    if (expiredPaybills.length > 0) {
      expiredPaybills.forEach(pb => {
        onDeletePayBill(pb.id);
      });
    }
  }, [paybills, lang, onDeletePayBill]);

  // All 6 recent months list
  const recent6Months = useMemo(() => {
    return getRecent6Months(lang || 'bn');
  }, [lang]);

  // Current month key
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  // Paybills belonging strictly to the currently selected month
  const selectedMonthPaybills = useMemo(() => {
    return paybills.filter(pb => getPayBillMonthKey(pb) === selectedPayBillMonth);
  }, [paybills, selectedPayBillMonth]);

  // Assign serial numbers (#1 to #N) within the selected month in chronological order
  const monthBillsWithSerials = useMemo(() => {
    const sortedAsc = [...selectedMonthPaybills].sort((a, b) => {
      const dateA = a.createdAt || a.date || '';
      const dateB = b.createdAt || b.date || '';
      return dateA.localeCompare(dateB);
    });

    const serialMap = new Map<string, number>();
    sortedAsc.forEach((pb, idx) => {
      serialMap.set(pb.id, idx + 1);
    });

    return selectedMonthPaybills.map(pb => ({
      pb,
      monthSerialNo: serialMap.get(pb.id) || 1
    }));
  }, [selectedMonthPaybills]);

  // Combine stored tags + existing paybill accounts for instant 1-tap re-use (filtering out legacy preset templates)
  const allAvailableAccountTags = useMemo(() => {
    const legacyPresets = ['bkash', 'nagad', 'rocket', 'upay', 'বিকাশ', 'নগদ', 'রকেট', 'উপায়', 'ইসলামী ব্যাংক', 'সিটি ব্যাংক', 'ডাচ বাংলা ব্যাংক'];
    const list: string[] = [];

    [...savedPayBillAccounts].forEach(acc => {
      const clean = acc.trim();
      if (clean && !legacyPresets.some(p => clean.toLowerCase() === p.toLowerCase()) && !list.some(item => item.toLowerCase() === clean.toLowerCase())) {
        list.push(clean);
      }
    });

    (paybills || []).forEach(pb => {
      if (pb.paidAccount && pb.paidAccount.trim()) {
        const clean = pb.paidAccount.trim();
        if (!legacyPresets.some(p => clean.toLowerCase() === p.toLowerCase()) && !list.some(item => item.toLowerCase() === clean.toLowerCase())) {
          list.push(clean);
        }
      }
    });
    return list;
  }, [savedPayBillAccounts, paybills]);

  // Monthly account breakdown statistics for the currently selected month (only for bills with a specified last number)
  const monthlyAccountStats = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; accountName: string }>();
    
    selectedMonthPaybills.filter(p => p.isPaid && p.paidAccount && p.paidAccount.trim()).forEach(pb => {
      const acc = pb.paidAccount!.trim();
      const existing = map.get(acc) || { count: 0, totalAmount: 0, accountName: acc };
      existing.count += 1;
      existing.totalAmount += pb.amount;
      map.set(acc, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [selectedMonthPaybills]);

  // Memoized filtered and sorted pay bills list to avoid O(N log N) filtering/sorting on every single render/tick
  const filteredAndSortedPaybills = useMemo(() => {
    return monthBillsWithSerials
      .filter(({ pb }) => {
        if (selectedAccountFilter) {
          const acc = pb.paidAccount ? pb.paidAccount.trim() : '';
          if (acc !== selectedAccountFilter) {
            return false;
          }
        }

        if (!payBillSearch) return true;
        const search = payBillSearch.toLowerCase();
        return (
          pb.billerNumber.includes(search) ||
          pb.billerDetails.toLowerCase().includes(search) ||
          (pb.note && pb.note.toLowerCase().includes(search)) ||
          (pb.paidInfo && pb.paidInfo.toLowerCase().includes(search)) ||
          (pb.paidAccount && pb.paidAccount.toLowerCase().includes(search))
        );
      })
      .sort((a, b) => {
        if (a.pb.isPaid === b.pb.isPaid) {
          return b.monthSerialNo - a.monthSerialNo; // newest serial first
        }
        return a.pb.isPaid ? 1 : -1; // unpaid (false) first, then paid (true)
      });
  }, [monthBillsWithSerials, payBillSearch, selectedAccountFilter, lang]);

  const exportCustomersToGoogleSheet = () => {
    try {
      const csvRows = [];
      const BOM = '\uFEFF';
      
      if (lang === 'bn') {
        csvRows.push(['Hello Point - কাস্টমার বকেয়া খাতা ও লেজার রিপোর্ট']);
        csvRows.push([`তারিখ: ${new Date().toLocaleDateString('bn-BD')} ${new Date().toLocaleTimeString('bn-BD')}`]);
        csvRows.push([]);
        csvRows.push([
          'ক্রমিক নং',
          'কাস্টমারের নাম',
          'মোবাইল নম্বর',
          'মোট ট্রানজেকশন এন্ট্রি',
          `পাবেন (${currency})`,
          `দেবেন (${currency})`,
          `নেট সমতা (${currency})`,
          'সর্বশেষ এডিট'
        ]);
      } else {
        csvRows.push(['Hello Point - Customer Outstanding Ledger Report']);
        csvRows.push([`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`]);
        csvRows.push([]);
        csvRows.push([
          'Sl No',
          'Customer Name',
          'Phone Number',
          'Total Entries',
          `You Will Get (${currency})`,
          `You Will Give (${currency})`,
          `Net Balance (${currency})`,
          'Last Activity'
        ]);
      }

      filteredContacts.forEach((c, index) => {
        const summary = contactSummaries.get(c.id) || { totalGave: 0, totalGot: 0, balance: 0, entryCount: 0 };
        const isTheyOwe = summary.balance > 0;
        const isWeOwe = summary.balance < 0;
        const absoluteBalance = Math.abs(summary.balance);
        
        let পাবেন = isTheyOwe ? absoluteBalance.toFixed(2) : '0.00';
        let দেবেন = isWeOwe ? absoluteBalance.toFixed(2) : '0.00';
        let নেটসমতা = (summary.balance).toFixed(2);
        
        const lastAct = getContactLastActivity(c.id).dateStr;
        const formattedLastActive = lastAct ? new Date(lastAct).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US') : '';

        csvRows.push([
          index + 1,
          c.name,
          c.phone || '',
          summary.entryCount,
          পাবেন,
          দেবেন,
          নেটসমতা,
          formattedLastActive
        ]);
      });

      csvRows.push([]);
      if (lang === 'bn') {
        csvRows.push([
          'মোট হিসাব',
          '',
          '',
          '',
          totals.youWillGet.toFixed(2),
          totals.youWillGive.toFixed(2),
          (totals.youWillGet - totals.youWillGive).toFixed(2),
          ''
        ]);
      } else {
        csvRows.push([
          'TOTALS',
          '',
          '',
          '',
          totals.youWillGet.toFixed(2),
          totals.youWillGive.toFixed(2),
          (totals.youWillGet - totals.youWillGive).toFixed(2),
          ''
        ]);
      }

      const csvContent = BOM + csvRows.map(row => 
        row.map(value => {
          const strVal = String(value).replace(/"/g, '""');
          return `"${strVal}"`;
        }).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileNameStr = lang === 'bn' 
        ? `হ্যালো_পয়েন্ট_কাস্টমার_বকেয়া_${new Date().toISOString().slice(0, 10)}.csv`
        : `HelloPoint_Customer_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
      
      link.setAttribute('download', fileNameStr);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast(
        lang === 'bn' 
          ? 'গুগল শিট-এ ওপেনযোগ্য এক্সেল ফাইল (.csv) সফলভাবে তৈরি করা হয়েছে! এটি গুগল ড্রাইভ-এ আপলোড করে গুগল শিট হিসেবে সুন্দরভাবে দেখতে পারবেন।' 
          : 'Beautiful Google Sheet compatible file (.csv) generated successfully! Upload this to Google Drive to open and view it in Google Sheets.'
      );
    } catch (err) {
      console.error('Failed to export to Google Sheets:', err);
    }
  };

  const exportPayBillsToGoogleSheet = () => {
    try {
      const csvRows = [];
      const BOM = '\uFEFF';

      const selectedMonthObj = recent6Months.find(m => m.monthKey === selectedPayBillMonth);
      const monthLabelStr = selectedMonthObj ? selectedMonthObj.monthLabel : selectedPayBillMonth;

      if (lang === 'bn') {
        csvRows.push([`Hello Point - পে বিল এন্ট্রি রিপোর্ট (${monthLabelStr})`]);
        csvRows.push([`মাস: ${monthLabelStr} | প্রকাশের তারিখ: ${new Date().toLocaleDateString('bn-BD')} ${new Date().toLocaleTimeString('bn-BD')}`]);
        csvRows.push([]);
        csvRows.push([
          'ক্রমিক নং',
          'বিলার নম্বর / আইডি',
          'কাস্টমার মোবাইল / নাম',
          `টাকার পরিমাণ (${currency})`,
          'পরিশোধের তারিখ',
          'অবস্থা',
          'পেমেন্ট ট্রানজেকশন আইডি',
          'লাস্ট নাম্বার',
          'নোট/মেমো',
          'সংরক্ষিত তারিখ',
          'তৈরির সময়'
        ]);
      } else {
        csvRows.push([`Hello Point - Pay Bill Entries Report (${monthLabelStr})`]);
        csvRows.push([`Month: ${monthLabelStr} | Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`]);
        csvRows.push([]);
        csvRows.push([
          'Sl No',
          'Biller Number / ID',
          'Customer Name/Mobile',
          `Amount (${currency})`,
          'Due Date/Time',
          'Status',
          'Payment TrxID',
          'Last Number',
          'Note/Memo',
          'Reserved Date',
          'Created Time'
        ]);
      }

      let totalPaidAmount = 0;
      let totalUnpaidAmount = 0;

      monthBillsWithSerials.forEach(({ pb, monthSerialNo }) => {
        const statusStr = pb.isPaid 
          ? (lang === 'bn' ? 'পরিশোধিত (PAID)' : 'PAID')
          : (lang === 'bn' ? 'অপরিবাহিত (UNPAID)' : 'UNPAID');

        if (pb.isPaid) {
          totalPaidAmount += pb.amount;
        } else {
          totalUnpaidAmount += pb.amount;
        }

        const paidInfoStr = pb.paidInfo || '';
        const paidAccountStr = pb.paidAccount || '';
        const noteStr = pb.note || '';
        const secondDateStr = pb.secondDate || '';
        const createdAtStr = pb.createdAt || '';

        csvRows.push([
          monthSerialNo,
          `"${pb.billerNumber}"`,
          `"${pb.billerDetails}"`,
          pb.amount,
          `"${secondDateStr}"`,
          `"${statusStr}"`,
          `"${paidInfoStr}"`,
          `"${paidAccountStr}"`,
          `"${noteStr}"`,
          `"${pb.date}"`,
          `"${createdAtStr}"`
        ]);
      });

      csvRows.push([]);
      if (lang === 'bn') {
        csvRows.push([
          'মোট সংক্ষিপ্ত বিবরণ',
          '',
          '',
          `মোট পরিশোধিত: ${totalPaidAmount.toFixed(2)} | মোট বকেয়া: ${totalUnpaidAmount.toFixed(2)}`,
          '',
          '',
          '',
          '',
          '',
          ''
        ]);
      } else {
        csvRows.push([
          'Summary Totals',
          '',
          '',
          `Total Paid: ${totalPaidAmount.toFixed(2)} | Total Unpaid: ${totalUnpaidAmount.toFixed(2)}`,
          '',
          '',
          '',
          '',
          '',
          ''
        ]);
      }

      const csvContent = BOM + csvRows.map(row => 
        row.map(value => {
          const strVal = String(value).replace(/"/g, '""');
          return `"${strVal}"`;
        }).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileNameStr = lang === 'bn'
        ? `হ্যালো_পয়েন্ট_পে_বিল_রিপোর্ট_${selectedPayBillMonth}.csv`
        : `HelloPoint_PayBills_Report_${selectedPayBillMonth}.csv`;
        
      link.setAttribute('download', fileNameStr);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(
        lang === 'bn'
          ? 'পে বিলে গুগল শিট-এ ওপেনযোগ্য ফাইল (.csv) সফলভাবে তৈরি করা হয়েছে! এটি গুগল ড্রাইভ-এ আপলোড করে গুগল শিট হিসেবে সুন্দরভাবে দেখতে পারবেন।'
          : 'Pay bills CSV formatted spreadsheet generated successfully! Upload this to Google Drive to open and view it in Google Sheets.'
      );
    } catch (err) {
      console.error('Failed to export pay bills to Google Sheet:', err);
    }
  };

  const togglePayBillStatus = (pb: PayBillEntry) => {
    const nextPaid = !pb.isPaid;
    const today = new Date();
    const paidAtStr = nextPaid ? today.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    onSavePayBill({
      ...pb,
      isPaid: nextPaid,
      paidAt: nextPaid ? paidAtStr : undefined
    });
  };

  const startEditPayBill = (pb: PayBillEntry) => {
    setEditingPayBill(pb);
    setPbBillerNumber(pb.billerNumber);
    setPbAmount(pb.amount.toString());
    setPbDate(pb.date);
    setPbBillerDetails(pb.billerDetails);
    setPbMemo(pb.note);
    setPbSecondDate(pb.secondDate);
    setPbContactId(pb.contactId || '');
    setShowPayBillModal(true);
  };

  const clearPayBillForm = () => {
    setPbBillerNumber('');
    setPbAmount('');
    setPbDate(new Date().toISOString().split('T')[0]);
    setPbBillerDetails('');
    setPbMemo('');
    setPbSecondDate(new Date().toISOString().split('T')[0]);
    setPbContactId('');
    setPayBillError('');
  };

  const pendingRechargesCount = useMemo(() => rechargeRequests.filter(r => r.status === 'pending').length, [rechargeRequests]);
  const pendingPaybillsCount = useMemo(() => paybillRequests.filter(r => r.status === 'pending').length, [paybillRequests]);
  const pendingSignupsCount = useMemo(() => signupRequests ? signupRequests.filter(req => req.status === 'pending').length : 0, [signupRequests]);
  const overdueRemindersCount = useMemo(() => reminders.filter(r => r.isTriggered && !r.isCompleted).length, [reminders]);
  const totalNotificationsCount = overdueRemindersCount + pendingSignupsCount + pendingRechargesCount;

  return (
    <div id="main-dashboard" className={`flex flex-col h-screen ${isDesktopMode ? 'max-w-7xl' : 'max-w-sm'} mx-auto bg-[#f1f3f9] relative shadow-xl overflow-hidden font-sans select-none text-slate-800 transition-all duration-300`}>
      {/* Main Container Core for Compact Header (Screenshot 3 layout) */}
      <header id="app-header" className="bg-brand-primary text-white px-4 pt-3 pb-1 shadow-md border-b-2 border-yellow-300 shrink-0 print:hidden relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/10 p-1.5 rounded-lg shrink-0">
              <BookOpen className="w-5 h-5 text-yellow-300" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1 cursor-pointer">
                <span className="text-base font-black tracking-tight text-white shadow-tiny">Hello Point</span>
              </div>
              {/* Beautiful real-time Bengali/English calendar & clock */}
              <div className="flex items-center gap-1.5 select-none leading-none mt-0.5 animate-pulse animate-duration-3000">
                <span className="text-[8px] sm:text-[9px] font-black text-yellow-300 tracking-tight leading-none border-r border-white/20 pr-1.5">
                  {bnDateTime.formattedDate}
                </span>
                <span className="text-[9px] sm:text-[10px] font-extrabold text-white/95 font-mono leading-none">
                  {bnDateTime.formattedTime}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* The Inbox Chat Button */}
            <motion.button 
              id="header-inbox-trigger"
              onClick={() => setShowOwnerInboxModal(true)}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.90 }}
              className={`p-1.5 rounded-full transition-all focus:outline-none relative cursor-pointer ${
                unreadChatsCount > 0
                  ? 'animate-bell-glow scale-110 shadow-lg text-white ring-2 ring-purple-400/50' 
                  : 'bg-white/10 hover:bg-white/20 text-yellow-300'
              }`}
              title={lang === 'bn' ? 'মেসেজ ইনবক্স' : 'Message Inbox'}
            >
              <MessageSquare className="w-5 h-5 text-yellow-300" />
              {unreadChatsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 bg-red-650 text-white rounded-full text-[8.5px] font-black flex items-center justify-center px-1 border border-brand-primary shadow-md animate-bounce">
                  {unreadChatsCount}
                </span>
              )}
            </motion.button>

            {/* The Bell Button for Notifications (Triggered/Active Reminders & SignUp Requests) */}
            <motion.button 
              id="header-bell-trigger"
              onClick={() => setShowNotificationsModal(true)}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.90 }}
              className={`p-1.5 rounded-full transition-all focus:outline-none relative cursor-pointer ${
                isWiggling || totalNotificationsCount > 0
                  ? 'animate-bell-glow scale-110 shadow-lg text-white ring-2 ring-yellow-400/50' 
                  : 'bg-white/10 hover:bg-white/20 text-yellow-300'
              }`}
              title={lang === 'bn' ? 'নোটিফিকেশন সেন্টার' : 'Notification Center'}
            >
              <Bell className={`w-5 h-5 ${(isWiggling || totalNotificationsCount > 0) ? 'animate-wiggle text-white fill-amber-300' : 'text-yellow-300'}`} />
              {totalNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 bg-red-650 text-white rounded-full text-[8.5px] font-black flex items-center justify-center px-1 border border-brand-primary shadow-md animate-bounce">
                  {totalNotificationsCount}
                </span>
              )}
            </motion.button>

            {/* The Bulb Button for Pay-Bill requests */}
            <motion.button 
              id="header-paybill-trigger"
              onClick={() => setShowPaybillRequestsModal(true)}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.90 }}
              className={`p-1.5 rounded-full transition-all focus:outline-none relative cursor-pointer ${
                pendingPaybillRequestsCount > 0
                  ? 'animate-bell-glow scale-110 shadow-lg text-white ring-2 ring-amber-400/50' 
                  : 'bg-white/10 hover:bg-white/20 text-yellow-300'
              }`}
              title={lang === 'bn' ? 'পে-বিল অনুরোধসমূহ' : 'Pay-Bill Requests'}
            >
              <Lightbulb className={`w-5 h-5 ${pendingPaybillRequestsCount > 0 ? 'text-amber-300 fill-amber-300 animate-pulse' : 'text-yellow-300'}`} />
              {pendingPaybillRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 bg-red-650 text-white rounded-full text-[8.5px] font-black flex items-center justify-center px-1 border border-brand-primary shadow-md animate-bounce">
                  {pendingPaybillRequestsCount}
                </span>
              )}
            </motion.button>

            {/* The Vertical Three-Dot Menu Button requested by user */}
            <motion.button 
              id="header-three-dot-trigger"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.90 }}
              className={`p-1.5 rounded-full transition-all focus:outline-none relative cursor-pointer ${
                !user 
                  ? 'bg-rose-500/25 hover:bg-rose-500/35 text-rose-400 border border-rose-400/50 shadow-xs ring-1 ring-rose-500/30' 
                  : 'bg-white/10 hover:bg-white/20 text-yellow-300'
              }`}
              title={
                !user 
                  ? (lang === 'bn' ? 'জিমেইল ডিসকানেক্টেড (কানেক্ট করতে ক্লিক করুন)' : 'Gmail Disconnected (Click to connect)')
                  : (lang === 'bn' ? 'মেনু ও সেটিংস (জিমেইল সংযুক্ত)' : 'Menu & Settings (Gmail Connected)')
              }
            >
              <MoreVertical className={`w-5 h-5 transition-colors ${!user ? 'text-rose-400' : 'text-yellow-300'}`} />
              {/* Red blinking dot when Gmail is disconnected */}
              {!user && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 pointer-events-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-white" />
                </span>
              )}
            </motion.button>
          </div>
        </div>

        {/* Dynamic Three-Dot Dropdown Settings & Sync Menu */}
        <AnimatePresence>
          {showSettingsMenu && (
            <motion.div 
              id="settings-menu-panel" 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute right-4 top-13 bg-white text-slate-800 py-3 px-4 rounded-2xl shadow-2xl border border-slate-100 z-50 w-64 max-w-xs"
            >
              <div className="flex justify-between items-center mb-3 pb-1.5 border-b border-slate-100">
                <span className="font-extrabold text-xs text-brand-primary flex items-center gap-1 bg-brand-light px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <SlidersHorizontal className="w-3 h-3" />
                  {lang === 'bn' ? 'মেনু ও সেটিংস' : 'Menu & Settings'}
                </span>
                <button 
                  onClick={() => setShowSettingsMenu(false)} 
                  className="text-slate-400 hover:text-slate-650 p-0.5 rounded-full hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Google Sync segment inside Three Dot Menu */}
              <div className="bg-slate-50 rounded-xl p-2.5 mb-3 border border-slate-200/60">
                <h4 className="text-[9px] font-black tracking-wider text-slate-455 uppercase mb-1.5">
                  {lang === 'bn' ? 'জিমেইল ক্লাউড অ্যাকাউন্ট' : 'Gmail Cloud Sync'}
                </h4>
                {user ? (
                  <div className="space-y-2">
                    <div className="flex gap-1.5 text-[10.5px] font-bold text-emerald-650 leading-tight">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                      <div>
                        <p>{lang === 'bn' ? 'ডাটা সুরক্ষিত আছে' : 'Connected & Synced'}</p>
                        <p className="text-[9px] text-slate-500 font-mono break-all">{user.email}</p>
                      </div>
                    </div>
                    {loadingCloud && (
                      <div className="text-[9px] font-bold text-slate-400 animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                        <span>{lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing cloud...'}</span>
                      </div>
                    )}
                    <button 
                      onClick={() => {
                        onSignOut();
                        setShowSettingsMenu(false);
                      }}
                      className="w-full text-center py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-605 rounded-lg text-[9.5px] font-extrabold transition-all outline-none cursor-pointer"
                    >
                      {lang === 'bn' ? 'ডিসকানেক্ট করুন' : 'Disconnect'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-1.5 text-[9.5px] font-bold text-amber-600 leading-tight">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>{lang === 'bn' ? 'অফলাইন মোড (ডাটা ব্যাকআপ ও সুরক্ষায় সিঙ্ক করুন)' : 'Offline mode. Connect Gmail to protect data.'}</span>
                    </div>
                    <button 
                      onClick={() => {
                        onSignIn();
                        setShowSettingsMenu(false);
                      }}
                      className="w-full text-center py-2 bg-purple-650 hover:bg-purple-750 text-white rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow hover:shadow-md transition-all outline-none cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                      <span>{lang === 'bn' ? 'জিমেইল কানেক্ট করুন' : 'Connect to Gmail'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Language switches inside Three Dot Menu */}
              <div className="mb-3">
                <h4 className="text-[9px] font-black tracking-wider text-slate-455 uppercase mb-1.5 font-sans">
                  {lang === 'bn' ? 'ভাষা নির্বাচন / Language' : 'Toggle Language'}
                </h4>
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => setLang && setLang('bn')} 
                    className={`flex-1 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                      lang === 'bn' 
                        ? 'bg-purple-50 border-purple-500 text-purple-750 font-black' 
                        : 'border-slate-205 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    বাংলা (BN)
                  </button>
                  <button 
                    onClick={() => setLang && setLang('en')} 
                    className={`flex-1 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                      lang === 'en' 
                        ? 'bg-purple-50 border-purple-500 text-purple-750 font-black' 
                        : 'border-slate-205 text-slate-505 hover:bg-slate-50'
                    }`}
                  >
                    English (EN)
                  </button>
                </div>
              </div>

              {/* Card Density Sizing Settings inside Settings Dropdown */}
              <div className="mb-3">
                <h4 className="text-[9.5px] font-black tracking-wider text-slate-455 uppercase mb-1.5 font-sans">
                  📏 {lang === 'bn' ? 'কার্ডের সাইজ পরিবর্তন' : 'Card Sizing & Layout'}
                </h4>
                <div className="bg-slate-50 p-0.5 rounded-lg border border-slate-202 flex items-center gap-0.5">
                  {[
                    { value: 'compact', titleBn: 'ছোট', titleEn: 'Compact' },
                    { value: 'comfortable', titleBn: 'স্বাভাবিক', titleEn: 'Comfortable' },
                    { value: 'large', titleBn: 'বড়', titleEn: 'Large' }
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => handleCardDensityChange(item.value as 'compact' | 'comfortable' | 'large')}
                      className={`flex-1 py-1 rounded text-[8.5px] font-black transition-all cursor-pointer border ${
                        cardDensity === item.value
                          ? 'bg-white text-purple-700 border-purple-200/60 shadow-tiny font-black'
                          : 'text-slate-500 hover:text-purple-650 hover:bg-slate-100 border-transparent'
                      }`}
                    >
                      {lang === 'bn' ? item.titleBn : item.titleEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expandable Theme Settings Section */}
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowThemeOptions(!showThemeOptions)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/60 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-tiny select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">🎨</span>
                    <span className="text-[10px] font-black tracking-wide text-slate-700 uppercase">
                      {lang === 'bn' ? 'থিম ও স্টাইল সেটিংস' : 'Theme & Style Settings'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-slate-200 shadow-tiny shrink-0" style={{ backgroundColor: themeColor }} />
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showThemeOptions ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {showThemeOptions && (
                  <div className="mt-1.5 bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/50 space-y-2.5 animate-fadeIn">
                    {/* Theme Mode Selector (Light, Dark, System Default) */}
                    <div>
                      <p className="text-[8.5px] font-black text-slate-400 uppercase mb-1.5 font-sans">
                        {lang === 'bn' ? 'থিম মোড (Theme Mode)' : 'Theme Mode'}
                      </p>
                      <div className="bg-white p-1 rounded-xl border border-slate-200/70 grid grid-cols-3 gap-1 shadow-tiny">
                        {[
                          { id: 'light', labelBn: 'লাইট', labelEn: 'Light', icon: Sun },
                          { id: 'dark', labelBn: 'ডার্ক', labelEn: 'Dark', icon: Moon },
                          { id: 'system', labelBn: 'সিস্টেম', labelEn: 'System', icon: Monitor }
                        ].map((m) => {
                          const Icon = m.icon;
                          const isActive = themeMode === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => onChangeThemeMode && onChangeThemeMode(m.id as ThemeMode)}
                              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 text-[9.5px] font-black transition-all cursor-pointer border ${
                                isActive
                                  ? 'text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border-transparent'
                              }`}
                              style={isActive ? { backgroundColor: themeColor, borderColor: themeColor } : undefined}
                              title={lang === 'bn' ? m.labelBn : m.labelEn}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span>{lang === 'bn' ? m.labelBn : m.labelEn}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Theme Color Palettes inside App Theme */}
                    <div>
                      <p className="text-[8.5px] font-black text-slate-400 uppercase mb-1.5 font-sans">
                        {lang === 'bn' ? 'থিম কালার / App Theme' : 'App Theme Color'}
                      </p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { value: '#6244a6', title: 'Default' }, 
                          { value: '#0284c7', title: 'Sky' },
                          { value: '#0f766e', title: 'Teal' },
                          { value: '#047857', title: 'Emerald' },
                          { value: '#be123c', title: 'Rose' },
                          { value: '#7c3aed', title: 'Violet' },
                          { value: '#ea580c', title: 'Orange' },
                          { value: '#334155', title: 'Slate' },
                          { value: '#111827', title: 'Obsidian' }
                        ].map(item => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => onChangeThemeColor && onChangeThemeColor(item.value)}
                            className="w-full aspect-square rounded-lg border transition-all cursor-pointer relative flex items-center justify-center hover:scale-105 active:scale-95 shadow-tiny"
                            style={{ 
                              backgroundColor: item.value,
                              borderColor: themeColor === item.value ? '#eab308' : 'rgba(0,0,0,0.1)'
                            }}
                            title={item.title}
                          >
                            {themeColor === item.value && (
                              <span className="w-1.5 h-1.5 bg-white rounded-full shadow-md" />
                            )}
                          </button>
                        ))}
                        
                        {/* Custom Color Input Wheel */}
                        <label 
                          className="w-full aspect-square rounded-lg border border-slate-200 hover:border-slate-400 bg-white flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 relative shadow-tiny"
                          title="Custom Color"
                        >
                          <span className="text-[10px]">🎨</span>
                          <input 
                            type="color" 
                            value={themeColor} 
                            onChange={(e) => onChangeThemeColor && onChangeThemeColor(e.target.value)}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" 
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* iPhone Calculator Trigger inside Three-Dot Dashboard */}
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <button 
                  type="button"
                  onClick={() => {
                    toggleShopStatus();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer uppercase select-none shadow-tiny text-[10px] font-black ${
                    shopStatus === 'open' 
                      ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200/60 text-emerald-700' 
                      : 'bg-red-50 hover:bg-red-100 border-red-200/60 text-red-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${shopStatus === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    {lang === 'bn' ? 'শপ স্ট্যাটাস' : 'Shop Status'}
                  </span>
                  <span className="font-extrabold tracking-wide text-[10px]">
                    {shopStatus === 'open' ? 'Open' : 'Close'}
                  </span>
                </button>

                {/* Desktop Mode Toggle inside Three-Dot Dashboard */}
                <button 
                  type="button"
                  onClick={() => {
                    toggleDesktopMode();
                    setShowSettingsMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer uppercase select-none shadow-tiny text-[10px] font-black ${
                    isDesktopMode 
                      ? 'bg-purple-50 hover:bg-purple-100 border-purple-250 text-purple-750' 
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                    {lang === 'bn' ? 'ডেস্কটপ মোড' : 'Desktop Mode'}
                  </span>
                  <span className={`${isDesktopMode ? 'bg-purple-700 text-white' : 'bg-slate-400 text-white'} font-mono px-1.5 py-0.5 rounded-lg text-[8px] tracking-wide font-black`}>
                    {isDesktopMode ? 'ON' : 'OFF'}
                  </span>
                </button>


                {/* Set Reminder Button inside Three-Dot Menu requested by user */}
                <button 
                  type="button"
                  onClick={() => {
                    setShowRemindersModal(true);
                    setShowSettingsMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[10px] font-black text-amber-800 transition-all cursor-pointer uppercase select-none shadow-tiny"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    {lang === 'bn' ? 'রিমাইন্ডার সেট করুন' : 'Set Reminder'}
                  </span>
                  <span className="bg-amber-600 text-white font-mono px-1.5 py-0.5 rounded-lg text-[8px] tracking-wide font-black">
                    SET
                  </span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setShowBanglaCalendar(true);
                    setShowSettingsMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[10px] font-black text-orange-800 transition-all cursor-pointer uppercase select-none shadow-tiny"
                >
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-orange-600 animate-pulse animate-duration-1000" />
                    {lang === 'bn' ? 'বাংলা ক্যালেন্ডার (বার সহ)' : 'Bangla Calendar'}
                  </span>
                  <span className="bg-orange-600 text-white font-mono px-1.5 py-0.5 rounded-lg text-[8px] tracking-wide font-black">
                    NEW
                  </span>
                </button>

                {/* Owner Shop Products Catalog Management */}
                {onSaveProduct && onDeleteProduct && (
                  <button 
                    type="button"
                    onClick={() => {
                      setShowShopManagementModal(true);
                      setShowSettingsMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-black text-emerald-850 transition-all cursor-pointer uppercase select-none shadow-tiny"
                  >
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      {lang === 'bn' ? 'অনলাইন শপ প্রডাক্ট ম্যানেজ' : 'Manage Shop Products'}
                    </span>
                    <span className="bg-emerald-600 text-white font-mono px-1.5 py-0.5 rounded-lg text-[8px] tracking-wide font-black">
                      {products.length}
                    </span>
                  </button>
                )}

                <button 
                  type="button"
                  onClick={() => {
                    setShowPinChangeModal(true);
                    setShowSettingsMenu(false);
                    setOldPin('');
                    setNewPin('');
                    setConfirmPin('');
                    setPinChangeError('');
                    setPinChangeSuccess('');
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-black text-slate-800 transition-all cursor-pointer uppercase select-none shadow-tiny"
                >
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                    {lang === 'bn' ? 'পিন পরিবর্তন করুন' : 'Change PIN'}
                  </span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    onLogout();
                    setShowSettingsMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-100 text-[10px] font-black text-rose-650 transition-all cursor-pointer uppercase select-none shadow-tiny"
                >
                  <span className="flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    {lang === 'bn' ? 'লগআউট (লক করুন)' : 'Log Out (Lock App)'}
                  </span>
                  <span className="bg-rose-600 text-white font-mono px-1.5 py-0.5 rounded-lg text-[8px] tracking-wide font-black">
                    EXIT
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Toggle Tabs with NEW Pay Bill function embedded center */}
        <div id="tabs-header" className="flex mt-2.5 border-t border-white/10 pt-1.5 text-center text-xs font-bold tracking-wide">
          <button 
            id="tab-customers"
            onClick={() => setActiveTab('customers')}
            className={`flex-1 pb-1 relative transition-all ${
              activeTab === 'customers' ? 'text-yellow-300 font-extrabold text-sm' : 'text-white/60 hover:text-white font-medium'
            }`}
          >
            {text.customers}
            {activeTab === 'customers' && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-yellow-300 rounded-t-full" />
            )}
          </button>
          
          <button 
            id="tab-paybill"
            onClick={() => setActiveTab('paybill')}
            className={`flex-1 pb-1 relative transition-all ${
              activeTab === 'paybill' ? 'text-yellow-300 font-extrabold text-sm' : 'text-white/60 hover:text-white font-medium'
            }`}
          >
            {lang === 'bn' ? 'পে-বিল' : 'Pay Bill'}
            {activeTab === 'paybill' && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-yellow-300 rounded-t-full" />
            )}
          </button>

          <button 
            id="tab-cashbook"
            onClick={() => setActiveTab('cashbook')}
            className={`flex-1 pb-1 relative transition-all ${
              activeTab === 'cashbook' ? 'text-yellow-300 font-extrabold text-sm' : 'text-white/60 hover:text-white font-medium'
            }`}
          >
            {text.cashbook}
            {activeTab === 'cashbook' && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-yellow-300 rounded-t-full" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Scroll View (Styled optimally compact) */}
      <main id="main-content" className={`flex-1 px-3 py-2 ${isDesktopMode ? 'max-w-7xl' : 'max-w-sm'} mx-auto w-full pb-20 overflow-y-auto`}>
        

        
        {/* TAB 1: CUSTOMERS */}
        {activeTab === 'customers' && (
          <div id="contacts-dashboard-content" className="space-y-2.5">
            
            {/* Net Stats Premium Card */}
            <div id="net-stats-card" className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden relative select-none">
              {/* Top subtle decorative accent glow */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500 via-purple-500 to-rose-500 opacity-85" />

              <div className="grid grid-cols-2 divide-x divide-slate-100 items-stretch py-3 px-1 sm:px-2">
                {/* Left Column: আপনি দেবেন (We Owe - Emerald) */}
                <div className="flex flex-col items-center justify-center text-center px-1.5 sm:px-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100/80 mb-1.5 shadow-2xs">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <TrendingDown className="w-2 h-2 stroke-[2.5]" />
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-black tracking-tight">{text.youWillGive}</span>
                  </div>
                  <div className="flex items-baseline justify-center gap-0.5 text-emerald-600 font-mono font-black tracking-tight">
                    <span className="text-xs sm:text-sm font-bold opacity-90">{currency}</span>
                    <span className="text-base sm:text-xl font-black">{totals.youWillGive.toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Right Column: আপনি পাবেন (Receivable - Rose) */}
                <div className="flex flex-col items-center justify-center text-center px-1.5 sm:px-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100/80 mb-1.5 shadow-2xs">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                      <TrendingUp className="w-2 h-2 stroke-[2.5]" />
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-black tracking-tight">{text.youWillGet}</span>
                  </div>
                  <div className="flex items-baseline justify-center gap-0.5 text-rose-500 font-mono font-black tracking-tight">
                    <span className="text-xs sm:text-sm font-bold opacity-90">{currency}</span>
                    <span className="text-base sm:text-xl font-black">{totals.youWillGet.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Unified Search and Sorting Control Panel (Highly Space-Efficient for Mobile/Desktop) */}
            <div id="search-and-sort-unified" className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-tiny select-none">
              {/* Left Side: Shrunk Search Input */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-150 rounded-lg px-2 py-1 w-[100px] sm:w-[180px] shrink-0">
                <Search className="w-3 h-3 text-slate-400 shrink-0" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'bn' ? 'খুঁজুন...' : 'Search...'}
                  className="w-full bg-transparent border-none text-[10px] sm:text-xs outline-none placeholder:text-slate-400 font-extrabold text-slate-700"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 shrink-0 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {/* Right Side: Embedded Sort buttons taking the remaining space inline */}
              <div className="flex items-center gap-0.5 bg-slate-50 p-0.5 rounded-lg flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setCustomerFilter('last_edited')}
                  className={`flex-1 py-1 rounded text-[8.5px] sm:text-[10px] font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                    customerFilter === 'last_edited'
                      ? 'bg-purple-650 text-white shadow-tiny font-black'
                      : 'text-slate-500 hover:text-purple-650 hover:bg-slate-150/50'
                  }`}
                  title={lang === 'bn' ? 'শেষ এডিট হিস্ট্রি' : 'Recently Edited'}
                >
                  {lang === 'bn' ? 'রিসেন্ট' : 'Recent'}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilter('a_to_z')}
                  className={`flex-1 py-1 rounded text-[8.5px] sm:text-[10px] font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                    customerFilter === 'a_to_z'
                      ? 'bg-purple-650 text-white shadow-tiny font-black'
                      : 'text-slate-500 hover:text-purple-650 hover:bg-slate-150/50'
                  }`}
                  title={lang === 'bn' ? 'নামের ক্রমানুসারে (A-Z)' : 'Name A-Z'}
                >
                  {lang === 'bn' ? 'নাম(a-z)' : 'Name(a-z)'}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilter('biggest_amount')}
                  className={`flex-1 py-1 rounded text-[8.5px] sm:text-[10px] font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                    customerFilter === 'biggest_amount'
                      ? 'bg-purple-650 text-white shadow-tiny font-black'
                      : 'text-slate-500 hover:text-purple-650 hover:bg-slate-150/50'
                  }`}
                  title={lang === 'bn' ? 'সবচেয়ে বড় অ্যামাউন্ট' : 'Biggest Balance'}
                >
                  {lang === 'bn' ? 'বড় হিসাব' : 'Biggest'}
                </button>
              </div>

              {/* CSV Sheet Export button inline with search & sort */}
              <button 
                onClick={exportCustomersToGoogleSheet}
                title={lang === 'bn' ? 'গুগল শিট (.csv) ডাউনলোড করুন' : 'Export Google Sheet (.csv)'}
                className="bg-slate-50/70 p-1.5 rounded-lg border border-slate-150 text-emerald-600 shadow-tiny hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer shrink-0 hidden sm:flex items-center justify-center"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Total Customers list header indicator with compact Google Sheet download button */}
            <div className="flex items-center justify-between px-1 py-1 mt-1 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-wider text-slate-500 uppercase flex items-center gap-1">
                  👥 {lang === 'bn' ? 'কাস্টমার তালিকা' : 'Customer Directory'}
                </span>
                
                {/* Compact Google Sheet download button next to customer directory text */}
                <button 
                  id="customer-sheet-export-header-btn"
                  onClick={exportCustomersToGoogleSheet}
                  title={lang === 'bn' ? 'গুগল শিট (.csv) রিপোর্ট ডাউনলোড করুন' : 'Download Google Sheet (.csv) Report'}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-750 border border-emerald-200 text-[8.5px] font-black tracking-normal normal-case transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer select-none"
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{lang === 'bn' ? 'গুগল শিট' : 'Google Sheet'}</span>
                  <Download className="w-2.5 h-2.5 text-emerald-600 opacity-80" />
                </button>
              </div>
              
              <span className="bg-purple-50 text-purple-750 px-2 py-0.5 rounded-full border border-purple-100 font-extrabold normal-case text-[8.5px]">
                {lang === 'bn' ? `মোট: ${contacts.filter(c => c.type === 'customer').length} জন` : `Total: ${contacts.filter(c => c.type === 'customer').length}`}
              </span>
            </div>

            {/* Compact Customer List (Grid optimized for Desktop Mode: 3 Columns) */}
            <div id="contacts-list" className={isDesktopMode ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" : "space-y-1"}>
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-slate-100 shadow-tiny text-slate-400 col-span-full">
                  <UserPlus className="w-8 h-8 stroke-1 mx-auto text-slate-300 mb-1" />
                  <p className="text-xs font-semibold">{text.searchNoResult}</p>
                </div>
              ) : (
                filteredContacts.map(c => {
                  const summary = contactSummaries.get(c.id) || { totalGave: 0, totalGot: 0, balance: 0, entryCount: 0 };
                  const isWeOwe = summary.balance < 0; 
                  const isTheyOwe = summary.balance > 0;
                  const absoluteBalance = Math.abs(summary.balance);

                  // Density sizes mapping configuration
                  const dSizes = {
                    compact: {
                      card: "p-1 px-1.5",
                      avatar: "w-6 h-6 text-[9px]",
                      title: "text-[10.5px]",
                      subtitle: "text-[8px]",
                      time: "text-[7.5px]",
                      amount: "text-[9.5px]",
                      label: "text-[7px]",
                      gap: "gap-1"
                    },
                    comfortable: {
                      card: "p-1.5 px-2",
                      avatar: "w-7.5 h-7.5 text-[11px]",
                      title: "text-[11.5px]",
                      subtitle: "text-[9px]",
                      time: "text-[7.5px]",
                      amount: "text-[11px]",
                      label: "text-[7.5px]",
                      gap: "gap-1.5"
                    },
                    large: {
                      card: "p-4 sm:p-4.5",
                      avatar: "w-11 h-11 text-sm",
                      title: "text-[13.5px]",
                      subtitle: "text-[10.5px]",
                      time: "text-[9px]",
                      amount: "text-[13px]",
                      label: "text-[9px]",
                      gap: "gap-3.5"
                    }
                  };
                  const sz = dSizes[cardDensity] || dSizes.comfortable;

                  return (
                    <motion.div 
                      key={c.id}
                      onClick={() => onSelectContact(c.id)}
                      whileHover={{ scale: 1.015, y: -1 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ type: "spring", stiffness: 450, damping: 18 }}
                      className={`group bg-white rounded-xl border border-slate-100 shadow-tiny hover:border-purple-200/80 hover:shadow-md transition-all ${sz.card} flex items-center justify-between cursor-pointer`}
                    >
                      <div className={`flex items-center ${sz.gap} min-w-0 flex-1`}>
                        <div className="relative shrink-0">
                          <div className={`${sz.avatar} rounded-full overflow-hidden shrink-0 shadow-xs relative flex items-center justify-center border-2 border-white ${
                            isTheyOwe 
                              ? 'ring-2 ring-rose-500/40' 
                              : isWeOwe 
                              ? 'ring-2 ring-emerald-500/40' 
                              : 'ring-2 ring-purple-500/30'
                          } group-hover:scale-105 transition-all duration-200`}>
                            {c.photoUrl ? (
                              <img 
                                src={c.photoUrl} 
                                alt={c.name} 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center font-black text-white relative uppercase tracking-wider select-none ${
                                isTheyOwe 
                                  ? 'bg-gradient-to-br from-rose-500 via-pink-600 to-rose-700' 
                                  : isWeOwe 
                                  ? 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700' 
                                  : 'bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600'
                              }`}>
                                <span className="drop-shadow-xs">{c.name.trim().charAt(0).toUpperCase()}</span>
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent pointer-events-none" />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="min-w-0 text-left">
                          <h4 className={`font-extrabold text-slate-800 ${sz.title} truncate leading-tight flex items-center gap-1.5 flex-wrap`}>
                            <span>{c.name}</span>
                          </h4>
                          <div className={`flex items-center gap-1 ${sz.subtitle} text-slate-500 font-bold`}>
                            {c.phone && <span>{c.phone} •</span>}
                            <span>{summary.entryCount} {text.entries}</span>
                          </div>
                          <div className={`${sz.time} text-purple-650 font-black mt-0.5 uppercase tracking-wide leading-none flex items-center gap-0.5`}>
                            <span className="text-[8px]">🕒</span> {formatLastVisit(getContactLastActivity(c.id).dateStr)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap text-right select-none ml-2.5 transition-all">
                        <div className="text-right shrink-0">
                          <div className={`${sz.amount} font-extrabold font-mono shrink-0 whitespace-nowrap ${
                            isTheyOwe ? 'text-rose-500' : 
                            isWeOwe ? 'text-emerald-600' : 
                            'text-slate-500'
                          }`}>
                            {currency} {absoluteBalance.toFixed(2)}
                          </div>
                          <div className={`${sz.label} font-black tracking-wide text-slate-400 uppercase`}>
                            {isTheyOwe ? 'পাবেন' : isWeOwe ? 'দেবেন' : 'কারেন্ট সমতা'}
                          </div>
                        </div>
                        
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowContactMenu(showContactMenu === c.id ? null : c.id);
                            }}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                            title={lang === 'bn' ? 'অপশন' : 'Options'}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          
                          {showContactMenu === c.id && (
                            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200/90 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectContact(c.id);
                                  setShowContactMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                <span>{lang === 'bn' ? 'খতিয়ান দেখুন' : 'View Ledger'}</span>
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContactToDelete(c);
                                  setShowContactMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-[11px] font-black text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>{lang === 'bn' ? 'কাস্টমার ডিলিট করুন' : 'Delete Customer'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
            
          </div>
        )}

        {/* TAB 2: PAY BILL LEDGER SYSTEM */}
        {activeTab === 'paybill' && (
          <div id="paybill-dashboard-content" className="space-y-2.5">

            {/* 1. Pay Bill Summary KPI Tiles for Currently Selected Month (BALANCE TOP) */}
            <div className="bg-white rounded-xl shadow-tiny border border-slate-100 p-2.5">
              <div className="grid grid-cols-2 divide-x divide-slate-100 text-center">
                <div className="px-1">
                  <span className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-0.5">
                    {lang === 'bn' ? 'বকেয়া বিলসমূহ' : 'UNPAID BILLS'}
                  </span>
                  <p className="text-sm font-black font-mono text-rose-500">
                    {currency} {selectedMonthPaybills.filter(p => !p.isPaid).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                  </p>
                  <span className="text-[8.5px] font-extrabold text-slate-400">
                    {selectedMonthPaybills.filter(p => !p.isPaid).length} {lang === 'bn' ? 'টি বিল বাকি' : 'bills pending'}
                  </span>
                </div>
                <div className="px-1">
                  <span className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-0.5">
                    {lang === 'bn' ? 'পরিশোধিত বিলসমূহ' : 'PAID BILLS'}
                  </span>
                  <p className="text-sm font-black font-mono text-emerald-600">
                    {currency} {selectedMonthPaybills.filter(p => p.isPaid).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                  </p>
                  <span className="text-[8.5px] font-extrabold text-brand-primary">
                    {selectedMonthPaybills.filter(p => p.isPaid).length} {lang === 'bn' ? 'টি পরিশোধিত' : 'bills completed'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Combined 6-Month Selector & Last Number Breakdown Card with Hide/Show */}
            <div className="bg-white rounded-xl shadow-tiny border border-slate-100 overflow-hidden" id="month-and-last-number-card">
              {/* Header Bar with Current Month indicator and Hide/Show Button */}
              <div className="p-2 sm:p-2.5 flex items-center justify-between gap-2 border-b border-slate-100/80 bg-slate-50/50">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CalendarIcon className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                  <span className="text-[10px] sm:text-[10.5px] font-black text-slate-700 uppercase tracking-wider truncate">
                    {lang === 'bn' ? 'মাস ও লাস্ট নাম্বার হিসাব' : 'Month & Last Number Stats'}
                  </span>
                  {selectedAccountFilter && (
                    <span className="text-[8.5px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded-md border border-purple-200 shrink-0 truncate max-w-[100px]">
                      {selectedAccountFilter}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {selectedAccountFilter && (
                    <button
                      onClick={() => setSelectedAccountFilter(null)}
                      className="text-[8px] sm:text-[8.5px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 transition-all cursor-pointer flex items-center gap-0.5"
                      title={lang === 'bn' ? 'ফিল্টার মুছুন' : 'Clear filter'}
                    >
                      <span>{lang === 'bn' ? 'সব দেখুন' : 'Show All'}</span>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {selectedPayBillMonth !== currentMonthKey && (
                    <button 
                      onClick={() => {
                        setSelectedPayBillMonth(currentMonthKey);
                        setSelectedAccountFilter(null);
                      }}
                      className="text-[8.5px] font-extrabold text-brand-primary bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded-full transition-all cursor-pointer"
                    >
                      {lang === 'bn' ? 'বর্তমান মাস' : 'Current'}
                    </button>
                  )}
                  {/* Hide / Show Toggle Button */}
                  <button
                    onClick={() => {
                      const next = !showMonthAccountCard;
                      setShowMonthAccountCard(next);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('hellopoint_show_month_account_card', String(next));
                      }
                    }}
                    className="text-[8.5px] sm:text-[9px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-650 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <span>{showMonthAccountCard ? (lang === 'bn' ? 'হাইড' : 'Hide') : (lang === 'bn' ? 'শো' : 'Show')}</span>
                    {showMonthAccountCard ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                  </button>
                </div>
              </div>

              {/* Collapsible Content: Month grid + Last number breakdown */}
              {showMonthAccountCard && (
                <div className="p-2 sm:p-2.5 space-y-2.5 animate-fade-in">
                  {/* Row A: 6 Months Selector */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        {lang === 'bn' ? 'মাস নির্বাচন (গত ৬ মাস):' : 'Select Month (Last 6 Months):'}
                      </span>
                      <span className="text-[8.5px] font-bold text-slate-500 font-mono">
                        {selectedMonthPaybills.length} {lang === 'bn' ? 'টি বিল মোট' : 'total bills'}
                      </span>
                    </div>

                    <div className="grid grid-cols-6 gap-1">
                      {recent6Months.map(({ monthKey, monthLabel, isCurrent }) => {
                        const isSelected = selectedPayBillMonth === monthKey;
                        const countForMonth = paybills.filter(p => getPayBillMonthKey(p) === monthKey).length;
                        const monthNameOnly = monthLabel.split(' ')[0] || monthLabel;

                        return (
                          <button
                            key={monthKey}
                            onClick={() => {
                              setSelectedPayBillMonth(monthKey);
                              setSelectedAccountFilter(null);
                            }}
                            className={`py-1 px-0.5 sm:px-1 rounded-lg text-center transition-all cursor-pointer flex flex-col items-center justify-center border leading-none min-h-[36px] ${
                              isSelected
                                ? 'bg-brand-primary text-white border-brand-primary shadow-xs font-black'
                                : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-purple-50 hover:border-purple-200 hover:text-brand-primary font-bold'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-0.5 w-full">
                              <span className="truncate text-[9.5px] sm:text-[10px] tracking-tight">{monthNameOnly}</span>
                              {isCurrent && (
                                <span className={`text-[7px] px-0.5 rounded font-black shrink-0 ${
                                  isSelected ? 'bg-yellow-300 text-slate-900' : 'bg-brand-primary text-white'
                                }`}>
                                  ●
                                </span>
                              )}
                            </div>
                            <span className={`text-[8.5px] font-mono mt-0.5 ${isSelected ? 'text-white/90 font-bold' : 'text-slate-400 font-semibold'}`}>
                              {countForMonth} {lang === 'bn' ? 'টি' : 'bills'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row B: Last Number Breakdown for Selected Month */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Hash className="w-3 h-3 text-purple-600" />
                        {lang === 'bn' ? 'লাস্ট নাম্বার অনুযায়ী পরিশোধিত বিল:' : 'Paid Bills by Last Number:'}
                      </span>
                      <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-purple-50 text-brand-primary rounded-md border border-purple-100 font-mono">
                        {selectedMonthPaybills.filter(p => p.isPaid).length} {lang === 'bn' ? 'টি পেইড' : 'paid'}
                      </span>
                    </div>

                    {monthlyAccountStats.length === 0 ? (
                      <div className="py-1.5 px-2 bg-slate-50/70 rounded-lg border border-slate-150/70 text-center text-slate-400 text-[9px] font-bold">
                        {lang === 'bn' ? 'এই মাসে এখনও কোনো লাস্ট নাম্বার দিয়ে পরিশোধিত বিলের হিসাব নেই।' : 'No paid bills with last numbers for this month yet.'}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-0.5 scrollbar-thin">
                        {monthlyAccountStats.map((item) => {
                          const isFilterActive = selectedAccountFilter === item.accountName;
                          return (
                            <button
                              key={item.accountName}
                              onClick={() => {
                                setSelectedAccountFilter(isFilterActive ? null : item.accountName);
                              }}
                              className={`py-1 px-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                                isFilterActive 
                                  ? 'bg-purple-650 text-white border-purple-700 shadow-xs'
                                  : 'bg-slate-50 hover:bg-purple-50/80 border-slate-200 text-slate-800'
                              }`}
                              title={lang === 'bn' ? `${item.accountName} এর বিলগুলো ফিল্টার করতে ক্লিক করুন` : `Click to filter bills for ${item.accountName}`}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className={`text-[9.5px] font-black truncate max-w-[120px] sm:max-w-[160px] ${
                                  isFilterActive ? 'text-white' : 'text-slate-800'
                                }`}>
                                  {item.accountName}
                                </span>
                                <span className={`text-[8.5px] font-mono font-bold leading-tight ${
                                  isFilterActive ? 'text-purple-150' : 'text-emerald-600'
                                }`}>
                                  {currency} {item.totalAmount.toFixed(2)}
                                </span>
                              </div>
                              <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-full font-mono shrink-0 ${
                                isFilterActive ? 'bg-white text-purple-700' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {item.count} {lang === 'bn' ? 'টি' : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Actions Bar for Pay Bill: Search, Google Sheet Export, Add Entry */}
            <div className="flex gap-1.5">
              <div className="flex-1 bg-white rounded-xl border border-slate-200 px-2.5 py-1.5 flex items-center gap-2 shadow-tiny">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  value={payBillSearch}
                  onChange={(e) => setPayBillSearch(e.target.value)}
                  placeholder={lang === 'bn' ? 'বিলার বা কাস্টমার দিয়ে খুঁজুন...' : 'Search by biller, customer...'}
                  className="w-full bg-transparent border-none text-xs outline-none placeholder:text-slate-400 font-semibold"
                />
                {payBillSearch && (
                  <button onClick={() => setPayBillSearch('')} className="text-slate-450 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              <button 
                onClick={exportPayBillsToGoogleSheet}
                title={lang === 'bn' ? 'এই মাসের গুগল শিট (.csv) ডাউনলোড করুন' : 'Export Selected Month Google Sheet (.csv)'}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-xl border border-emerald-200 shadow-tiny shrink-0 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'bn' ? 'গুগল শিট' : 'Google Sheet'}</span>
              </button>

              <button 
                onClick={() => {
                  setEditingPayBill(null);
                  clearPayBillForm();
                  setSelectedPayBillMonth(currentMonthKey);
                  setShowPayBillModal(true);
                }}
                className="bg-brand-primary hover:bg-brand-hover text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-tiny hover:shadow flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'নতুন এন্ট্রি' : 'New Entry'}</span>
              </button>
            </div>

            {/* List Row Elements of Pay Bill (Grid optimized for Desktop Mode: 3 Columns) */}
            <div className={isDesktopMode ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-left" : "space-y-1.5"} id="paybill-list">
              {filteredAndSortedPaybills.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-slate-100 shadow-tiny text-slate-450 col-span-full animate-fade-in">
                  <CreditCard className="w-8 h-8 stroke-1 mx-auto text-slate-300 mb-1" />
                  <p className="text-xs font-bold leading-relaxed">
                    {lang === 'bn' ? 'এই মাসের জন্য কোনো পে-বিল এন্ট্রি পাওয়া যায়নি।' : 'No pay-bill record found for this month.'}
                  </p>
                  <button 
                    onClick={() => {
                      setEditingPayBill(null);
                      clearPayBillForm();
                      setSelectedPayBillMonth(currentMonthKey);
                      setShowPayBillModal(true);
                    }}
                    className="mt-2 text-[10px] font-extrabold text-brand-primary underline cursor-pointer"
                  >
                    {lang === 'bn' ? 'নতুন এন্ট্রি করুন' : 'Add New Entry'}
                  </button>
                </div>
              ) : (
                filteredAndSortedPaybills.map(({ pb, monthSerialNo }) => {
                  // Apply dynamic sizing to pay bill items as well!
                  const pSizes = {
                    compact: "p-1.5 text-[10px] gap-1",
                    comfortable: "p-2 text-xs gap-1.5",
                    large: "p-3 sm:p-4 text-sm gap-2.5"
                  };
                  const pClass = pSizes[cardDensity] || pSizes.comfortable;

                  return (
                    <motion.div 
                      key={pb.id}
                      whileHover={{ scale: 1.012, y: -0.5 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        setActivePayBillDetails(pb);
                        setPaidInfoText(pb.paidInfo || '');
                        setPaidAccountText(pb.paidAccount || '');
                      }}
                      className={`bg-white rounded-xl border flex flex-col transition-all shadow-tiny border-slate-200 hover:border-purple-300 cursor-pointer select-none overflow-hidden max-h-[44px] justify-center ${pClass}`}
                    >
                      {/* Compact Top Row: strictly single-line horizontal alignment */}
                      <div className="flex items-center justify-between gap-2 w-full overflow-hidden flex-nowrap">
                        {/* Left: Serial Number, Bill Number, and Amount with Client details inline */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden flex-nowrap whitespace-nowrap">
                          <span className="text-[9px] px-1 py-0.5 bg-slate-100 text-slate-650 font-bold font-mono rounded shrink-0">
                            #{monthSerialNo}
                          </span>
                          <span className={`font-mono font-extrabold truncate shrink-0 max-w-[70px] sm:max-w-[120px] ${pb.isPaid ? 'text-slate-400 line-through' : 'text-slate-700'}`} title={pb.billerNumber}>
                            {pb.billerNumber}
                          </span>
                          <span className="text-slate-300 font-mono shrink-0">|</span>
                          <span className={`font-black font-mono shrink-0 ${pb.isPaid ? 'text-slate-400 line-through' : 'text-rose-500'}`}>
                            {currency} {pb.amount.toFixed(2)}
                          </span>
                          <span className="text-slate-300 font-mono shrink-0">|</span>
                          <span className="text-[10px] text-slate-500 font-semibold truncate flex-1" title={`${pb.billerDetails}${pb.note ? ' - ' + pb.note : ''}`}>
                            {pb.billerDetails} {pb.note && <span className="text-[9px] text-slate-400 font-normal font-mono">({pb.note})</span>}
                          </span>
                        </div>

                        {/* Right: Small compact checkmark tick or exclamation status mark to save space */}
                        <div className="flex items-center shrink-0 pr-0.5">
                          {pb.isPaid ? (
                            <span 
                              className="w-4 h-4 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-black text-[10px] select-none border border-emerald-250 animate-fade-in shadow-tiny" 
                              title={lang === 'bn' ? 'পরিশোধিত' : 'Paid'}
                            >
                              ✓
                            </span>
                          ) : (
                            <span 
                              className="w-4 h-4 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center font-bold text-[9px] select-none border border-rose-100 animate-pulse shadow-tiny" 
                              title={lang === 'bn' ? 'বকেয়া' : 'Pending'}
                            >
                              !
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* TAB 3: CASHBOOK DIRECT ACCOUNTING */}
        {activeTab === 'cashbook' && (
          <div id="cashbook-dashboard-content" className="space-y-3">
            
            {/* Pure cash management summary box */}
            <div className={`bg-gradient-to-br from-brand-primary to-brand-hover text-white rounded-xl shadow-md p-3.5 flex flex-col items-center text-center relative overflow-hidden transition-all duration-300 ${
              cardDensity === 'compact' ? 'py-2.5' : cardDensity === 'large' ? 'py-5' : 'py-3.5'
            }`}>
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full filter blur-xl transform translate-x-4 -translate-y-4" />
              <span className={`text-white/80 font-bold tracking-wider mb-0.5 uppercase ${
                cardDensity === 'compact' ? 'text-[8.5px]' : cardDensity === 'large' ? 'text-[11px]' : 'text-[10px]'
              }`}>{text.cashInHand}</span>
              <h2 className={`font-black font-mono mb-2 tracking-tight transition-all ${
                cardDensity === 'compact' ? 'text-xl' : cardDensity === 'large' ? 'text-3xl' : 'text-2xl'
              }`}>
                {currency} {cashbookBalance.balance.toFixed(2)}
              </h2>
              
              <div className="w-full grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-2.5">
                <div className="px-1">
                  <span className={`block text-white/70 font-semibold ${
                    cardDensity === 'compact' ? 'text-[8.5px]' : 'text-[9.5px]'
                  }`}>{text.cashIn}</span>
                  <span className={`font-bold text-emerald-300 font-mono ${
                    cardDensity === 'compact' ? 'text-[10.5px]' : 'text-xs'
                  }`}>
                    + {currency} {cashbookBalance.totalIn.toFixed(2)}
                  </span>
                </div>
                <div className="px-1">
                  <span className={`block text-white/70 font-semibold ${
                    cardDensity === 'compact' ? 'text-[8.5px]' : 'text-[9.5px]'
                  }`}>{text.cashOut}</span>
                  <span className={`font-bold text-rose-300 font-mono ${
                    cardDensity === 'compact' ? 'text-[10.5px]' : 'text-xs'
                  }`}>
                    - {currency} {cashbookBalance.totalOut.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick entry for pure cash bookkeeping */}
            <div className={`bg-white rounded-xl border border-slate-100 shadow-tiny transition-all duration-305 ${
              cardDensity === 'compact' ? 'p-2' : cardDensity === 'large' ? 'p-4.5' : 'p-3'
            }`}>
              <div className="flex justify-between items-center mb-1">
                <h4 className={`font-black text-slate-800 flex items-center gap-1 ${
                  cardDensity === 'compact' ? 'text-[11px]' : 'text-xs'
                }`}>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
                  ক্যাশবুক সরাসরি হিসাব
                </h4>
              </div>
              <p className={`text-slate-400 leading-relaxed ${
                cardDensity === 'compact' ? 'text-[9px]' : 'text-[10px]'
              }`}>
                দোকান বা ক্যাশের সরাসরি খরচ বা খোচরা মালামাল কেনা সংক্রান্ত হিসাব রাখুন।
              </p>
              
              <div className="mt-2.5 flex gap-2">
                <motion.button 
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenCashbookForm}
                  className="flex-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 py-2 rounded-lg text-[10px] font-black tracking-wide flex items-center justify-center gap-1 transition-all border border-emerald-200 outline-none cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  ক্যাশ ইন (+ IN)
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenCashbookForm}
                  className="flex-1 bg-rose-50 text-rose-700 hover:bg-rose-100 py-2 rounded-lg text-[10px] font-black tracking-wide flex items-center justify-center gap-1 transition-all border border-rose-200 outline-none cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  ক্যাশ আউট (- OUT)
                </motion.button>
              </div>
            </div>

            {/* Cashbook History Log List (Satisfying query 5 on cashbook entries with dual symmetric columns) */}
            <div className={`bg-white rounded-xl border border-slate-100 shadow-tiny transition-all duration-305 ${
              cardDensity === 'compact' ? 'p-2' : cardDensity === 'large' ? 'p-4.5' : 'p-3'
            }`}>
              <h4 className="font-black text-slate-800 text-xs flex justify-between items-center pb-1.5 border-b border-slate-100 mb-2">
                <span>লেনদেন হিস্ট্রি ({cashbookEntries.length})</span>
                <span className="text-[9px] text-slate-400 font-medium font-mono uppercase tracking-wider">ডাবল কলাম লেজার</span>
              </h4>

              {cashbookEntries.length === 0 ? (
                <p className="text-center py-6 text-slate-450 text-[10px] font-medium leading-loose">কোনো দৈনিক ক্যাশবুক হিস্ট্রি লেনদেন নেই।</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {/* Left Column: Cash In (ক্যাশ ইন) */}
                  <div className="space-y-2 border-r border-slate-100 pr-2 text-left">
                    <div className="sticky top-0 bg-white/95 backdrop-blur-xs py-1 z-10 border-b border-emerald-100 flex justify-between items-center px-1 mb-1">
                      <span className="text-[9.5px] font-black text-emerald-700 uppercase tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        ক্যাশ ইন (বাম)
                      </span>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-mono">
                        +{currency}{cashbookBalance.totalIn.toFixed(0)}
                      </span>
                    </div>
                    {cashbookEntries.filter(e => e.type === 'IN').length === 0 ? (
                      <p className="text-center py-6 text-slate-450 text-[9px] font-medium italic">কোনো ক্যাশ ইন নেই</p>
                    ) : (
                      <div className="space-y-1">
                        {cashbookEntries.filter(e => e.type === 'IN').map(entry => {
                          const ledgerSizes = {
                            compact: {
                              card: "p-1 py-0.5",
                              title: "text-[9.5px]",
                              date: "text-[7.5px]",
                              amount: "text-[9px]",
                              button: "p-0"
                            },
                            comfortable: {
                              card: "p-1.5",
                              title: "text-[10.5px]",
                              date: "text-[8px]",
                              amount: "text-[10px]",
                              button: "p-0.5"
                            },
                            large: {
                              card: "p-2.5",
                              title: "text-xs sm:text-[12.5px]",
                              date: "text-[9px]",
                              amount: "text-[11.5px] sm:text-[12px]",
                              button: "p-1"
                            }
                          };
                          const lsz = ledgerSizes[cardDensity] || ledgerSizes.comfortable;

                          return (
                            <motion.div 
                              key={entry.id} 
                              whileHover={{ scale: 1.02, x: 1 }}
                              whileTap={{ scale: 0.98 }}
                              className={`border border-emerald-100 bg-emerald-50/25 hover:bg-emerald-50/50 rounded-lg transition-all flex justify-between items-center gap-1 ${lsz.card}`}
                            >
                              <div className="min-w-0 pr-0.5 text-left">
                                <p className={`font-bold text-slate-700 truncate leading-tight ${lsz.title}`} title={entry.note}>{entry.note}</p>
                                <span className={`text-slate-400 font-mono block ${lsz.date}`}>
                                  {new Date(entry.date).toLocaleDateString('bn-BD', {
                                    day: '2-digit',
                                    month: 'short'
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <span className={`font-black font-mono text-emerald-600 ${lsz.amount}`} title={`${currency}${entry.amount.toFixed(2)}`}>
                                  +{entry.amount.toFixed(0)}
                                </span>
                                <button 
                                  onClick={() => setCashbookToDelete(entry)}
                                  className={`text-slate-350 hover:text-red-500 rounded transition-all cursor-pointer outline-none shrink-0 ${lsz.button}`}
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Cash Out (ক্যাশ আউট) */}
                  <div className="space-y-2 pl-1 text-left">
                    <div className="sticky top-0 bg-white/95 backdrop-blur-xs py-1 z-10 border-b border-rose-100 flex justify-between items-center px-1 mb-1">
                      <span className="text-[9.5px] font-black text-rose-700 uppercase tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                        ক্যাশ আউট (ডান)
                      </span>
                      <span className="text-[9px] font-bold text-rose-605 bg-rose-50 px-1 py-0.5 rounded font-mono">
                        -{currency}{cashbookBalance.totalOut.toFixed(0)}
                      </span>
                    </div>
                    {cashbookEntries.filter(e => e.type === 'OUT').length === 0 ? (
                      <p className="text-center py-6 text-slate-450 text-[9px] font-medium italic">কোনো ক্যাশ আউট নেই</p>
                    ) : (
                      <div className="space-y-1">
                        {cashbookEntries.filter(e => e.type === 'OUT').map(entry => {
                          const ledgerSizes = {
                            compact: {
                              card: "p-1 py-0.5",
                              title: "text-[9.5px]",
                              date: "text-[7.5px]",
                              amount: "text-[9px]",
                              button: "p-0"
                            },
                            comfortable: {
                              card: "p-1.5",
                              title: "text-[10.5px]",
                              date: "text-[8px]",
                              amount: "text-[10px]",
                              button: "p-0.5"
                            },
                            large: {
                              card: "p-2.5",
                              title: "text-xs sm:text-[12.5px]",
                              date: "text-[9px]",
                              amount: "text-[11.5px] sm:text-[12px]",
                              button: "p-1"
                            }
                          };
                          const lsz = ledgerSizes[cardDensity] || ledgerSizes.comfortable;

                          return (
                            <motion.div 
                              key={entry.id} 
                              whileHover={{ scale: 1.02, x: -1 }}
                              whileTap={{ scale: 0.98 }}
                              className={`border border-rose-105 bg-rose-50/25 hover:bg-rose-50/50 rounded-lg transition-all flex justify-between items-center gap-1 ${lsz.card}`}
                            >
                              <div className="min-w-0 pr-0.5 text-left">
                                <p className={`font-bold text-slate-700 truncate leading-tight ${lsz.title}`} title={entry.note}>{entry.note}</p>
                                <span className={`text-slate-400 font-mono block ${lsz.date}`}>
                                  {new Date(entry.date).toLocaleDateString('bn-BD', {
                                    day: '2-digit',
                                    month: 'short'
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <span className={`font-black font-mono text-rose-550 ${lsz.amount}`} title={`${currency}${entry.amount.toFixed(2)}`}>
                                  -{entry.amount.toFixed(0)}
                                </span>
                                <button 
                                  onClick={() => setCashbookToDelete(entry)}
                                  className={`text-slate-350 hover:text-red-500 rounded transition-all cursor-pointer outline-none shrink-0 ${lsz.button}`}
                                  title="মুছে ফেলুন"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Floating Action Button for adding customers in optimal size */}
      {activeTab === 'customers' && (
        <button 
          id="add-contact-fab"
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-6 right-6 bg-brand-light text-brand-primary hover:bg-brand-primary hover:text-white px-4 py-2.5 rounded-full shadow-md font-extrabold flex items-center gap-1.5 border border-brand-primary/20 transition-all z-20 active:scale-95 print:hidden"
        >
          <UserPlus className="w-4.5 h-4.5 shrink-0" />
          <span className="text-xs tracking-wide">
            {text.addCustomer}
          </span>
        </button>
      )}

      {/* Adding a Customer Dialogue / Modal Dialog */}
      {showAddModal && (
        <div id="add-contact-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 transform transition-all p-4">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-805 text-xs flex items-center gap-1">
                <span className="w-2 h-2 bg-purple-600 rounded-full inline-block animate-pulse" />
                {text.addContactTitle}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleAddNewContact} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-405 mb-1">{text.nameLabel} <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder=""
                  required
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white transition-all font-semibold"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">{text.phoneLabel}</label>
                <input 
                  type="tel" 
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder=""
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white transition-all font-mono"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 text-[10px] font-black text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-lg transition-all"
                >
                  {text.cancel}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 text-[10px] font-black text-white bg-brand-hover hover:bg-brand-primary rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  {text.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* OWNER INBOX MODAL */}
      {showOwnerInboxModal && (
        <div id="owner-inbox-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fade-in print:hidden select-text font-sans">
          <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 transform transition-all p-5 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-150 shrink-0 select-none">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-700 animate-pulse" />
                <h3 className="text-sm sm:text-base font-black tracking-tight leading-none text-slate-900">
                  {lang === 'bn' ? 'গ্রাহক চ্যাট লিষ্ট' : 'Customer Messages'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowChatSettingsModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-extrabold text-[11px] transition-all cursor-pointer shadow-2xs active:scale-95"
                  title={lang === 'bn' ? 'অটো রিপ্লাই ও রেডিমেড চ্যাট সেটিংস' : 'Auto-reply & Canned responses settings'}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-purple-700" />
                  <span>{lang === 'bn' ? 'চ্যাট সেটিংস' : 'Chat Settings'}</span>
                </button>
                <button 
                  onClick={() => setShowOwnerInboxModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-700 p-1.5 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Sub-label */}
            <p className="text-[10px] font-bold text-slate-400 mb-3 select-none">
              {lang === 'bn' 
                ? 'রিয়েলটাইমে বার্তা পাঠান (৭ দিন পর বার্তা ও ইনবক্স স্বয়ংক্রিয়ভাবে পরিষ্কার হয়ে যাবে)।' 
                : 'Real-time messaging (Messages and inbox auto-clear after 7 days).'}
            </p>

            {/* Search client list to start chat */}
            <div className="relative mb-3.5 shrink-0 select-all">
              <input 
                type="text"
                placeholder={lang === 'bn' ? 'চ্যাট শুরু করতে গ্রাহক খুঁজুন...' : 'Search customer to message...'}
                value={searchChatQuery}
                onChange={(e) => setSearchChatQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl py-2 px-3 pl-8 text-[11px] font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-slate-400"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
              {searchChatQuery && (
                <button 
                  onClick={() => setSearchChatQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 font-bold"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 select-text">
              {searchChatQuery.trim() ? (
                (() => {
                  const queryTerm = searchChatQuery.trim().toLowerCase();
                  const results = contacts.filter(c => {
                    const normQ = normalizeString(queryTerm);
                    return c.name.toLowerCase().includes(queryTerm) || c.phone.includes(normQ) || c.phone.includes(queryTerm);
                  });
                  
                  if (results.length === 0) {
                    return (
                      <div className="text-center py-6 text-slate-400 font-semibold text-[11px] select-none">
                        {lang === 'bn' ? 'কোন গ্রাহক পাওয়া যায়নি।' : 'No matching customers.'}
                      </div>
                    );
                  }

                  return results.map(c => {
                    const unread = chatMessages.filter(m => m.contactId === c.id && m.senderRole === 'customer' && !m.readByOwner).length;
                    return (
                      <div 
                        key={c.id}
                        onClick={() => {
                          setSelectedChatContactId(c.id);
                          setShowOwnerInboxModal(false);
                          setSearchChatQuery('');
                        }}
                        className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 border-2 border-white ring-2 ring-purple-500/20 shadow-xs flex items-center justify-center font-black text-white text-xs shrink-0 overflow-hidden relative">
                            {c.photoUrl ? (
                              <img src={c.photoUrl} alt={c.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <span>{c.name.trim().charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 leading-none">{c.name}</h4>
                            <p className="text-[9px] text-slate-400 font-bold mt-1 font-mono">{c.phone}</p>
                          </div>
                        </div>
                        {unread > 0 && (
                          <span className="min-w-4.5 h-4.5 rounded-full bg-red-650 text-white text-[8.5px] font-black flex items-center justify-center px-1">
                            {unread}
                          </span>
                        )}
                      </div>
                    );
                  });
                })()
              ) : (
                <>
                  {activeChatContacts.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 font-semibold text-[11.5px] select-none">
                      {lang === 'bn' ? 'এখনো কোন চ্যাট বার্তা নেই।' : 'No active chats.'}
                      <p className="text-[9.5px] font-medium text-slate-400 mt-1">
                        {lang === 'bn' 
                          ? 'উপরে সার্চ বক্সে গ্রাহকের নাম বা ফোন দিয়ে প্রথম চ্যাট বার্তাটি পাঠান!' 
                          : 'Use search box to initiate a message thread.'}
                      </p>
                    </div>
                  ) : (
                    activeChatContacts.map(c => {
                      const unread = chatMessages.filter(m => m.contactId === c.id && m.senderRole === 'customer' && !m.readByOwner).length;
                      const cMsgs = chatMessages.filter(m => m.contactId === c.id);
                      const lastMsg = cMsgs[cMsgs.length - 1];

                      return (
                        <div 
                          key={c.id}
                          onClick={() => {
                            setSelectedChatContactId(c.id);
                            setShowOwnerInboxModal(false);
                          }}
                          className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 border-2 border-white ring-2 ring-purple-500/20 shadow-xs flex items-center justify-center font-black text-white text-xs shrink-0 overflow-hidden relative">
                              {c.photoUrl ? (
                                <img src={c.photoUrl} alt={c.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              ) : (
                                <span>{c.name.trim().charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between items-center select-none">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <h4 className="text-xs font-extrabold text-slate-800 truncate leading-none">{c.name}</h4>
                                  {c.phone && (
                                    <span className="font-mono text-[9px] font-bold text-purple-700 bg-purple-100/70 border border-purple-200/80 px-1.5 py-0.2 rounded shrink-0">
                                      {c.phone}
                                    </span>
                                  )}
                                </div>
                                {lastMsg && (
                                  <span className="text-[8px] font-bold text-slate-400 shrink-0 ml-1">
                                    {(() => {
                                      try {
                                        const date = new Date(lastMsg.createdAt);
                                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                      } catch {
                                        return '';
                                      }
                                    })()}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-450 mt-1 truncate font-medium">
                                {lastMsg ? lastMsg.text : ''}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {unread > 0 && (
                              <span className="min-w-4.5 h-4.5 rounded-full bg-red-650 text-white text-[8.5px] font-black flex items-center justify-center px-1 animate-pulse">
                                {unread}
                              </span>
                            )}
                            {onDeleteChatThread && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChatThreadToDelete({ id: c.id, name: c.name });
                                }}
                                className="p-1.5 text-slate-350 hover:text-rose-500 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                                title={lang === 'bn' ? 'চ্যাট থ্রেড মুছুন' : 'Delete Chat Thread'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE OWNER CHAT DIALOG FOR SELECTED CONTACT */}
      <AnimatePresence>
        {selectedChatContactId && (
          <ChatBox 
            currentContactId={selectedChatContactId}
            chatMessages={chatMessages}
            senderRole="owner"
            senderName={user?.displayName || "প্রোপাইটার (HelloPoint)"}
            onSendMessage={onSendChatMessage || (() => {})}
            onDeleteMessage={onDeleteChatMessage}
            onDeleteThread={onDeleteChatThread}
            onMarkAsRead={onMarkChatsAsRead || (() => {})}
            onClose={() => setSelectedChatContactId(null)}
            lang={lang}
            contactName={(() => {
              const existing = contacts.find(c => c.id === selectedChatContactId);
              if (existing) {
                return `${existing.name}${existing.phone ? ` (${existing.phone})` : ''}`;
              }
              const active = activeChatContacts.find(c => c.id === selectedChatContactId);
              if (active) {
                return `${active.name}${active.phone ? ` (${active.phone})` : ''}`;
              }
              return lang === 'bn' ? 'অনলাইন গ্রাহক' : 'Online Customer';
            })()}
            themeColor={themeColor}
          />
        )}
      </AnimatePresence>

      {/* CONFIRMATION DIALOG FOR DELETING ENTIRE CHAT THREAD */}
      {chatThreadToDelete && (
        <div id="chat-thread-delete-modal" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] font-sans select-none">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 w-full max-w-xs text-center transform scale-100 transition-all">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3.5 text-rose-500 animate-bounce">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              {lang === 'bn' ? 'চ্যাট মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Delete Chat'}
            </h3>
            <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">
              {lang === 'bn' 
                ? `আপনি কি সত্যি "${chatThreadToDelete.name}"-এর পুরো চ্যাট কথোপকথন মুছে ফেলতে চান?` 
                : `Delete entire chat history with "${chatThreadToDelete.name}"?`}
            </p>
            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setChatThreadToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteChatThread) {
                    onDeleteChatThread(chatThreadToDelete.id);
                  }
                  setChatThreadToDelete(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotificationsModal && (
        <div id="notifications-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in print:hidden select-none font-sans">
          <div className="bg-white rounded-[32px] w-full max-w-[640px] overflow-hidden shadow-[0_25px_60px_-15px_rgba(15,23,42,0.3)] border border-slate-200/90 transform transition-all p-6 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm">
                  <Bell className="w-4.5 h-4.5 animate-wiggle" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-slate-855 text-xs sm:text-xs flex items-center gap-2 uppercase tracking-wide">
                    {lang === 'bn' ? 'নোটিফিকেশন সেন্টার' : 'Notification Center'}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400">
                    {totalNotificationsCount > 0 
                      ? (lang === 'bn' ? `আপনি ${totalNotificationsCount}টি নতুন নোটিফিকেশন পেয়েছেন` : `You have ${totalNotificationsCount} active alerts`)
                      : (lang === 'bn' ? 'কোন পেন্ডিং অ্যালার্ট নেই' : 'No pending alerts')}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowNotificationsModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-full cursor-pointer transition-all active:scale-90"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* List of active (triggered / due) notifications */}
            <div className="flex-1 overflow-y-auto space-y-3.5 min-h-0 pr-1 select-none">
              {totalNotificationsCount === 0 ? (
                <div className="text-center py-14 px-4 border border-dashed border-slate-200 rounded-2.5xl flex flex-col items-center justify-center text-slate-400">
                  <div className="bg-slate-50 p-4 rounded-full mb-3.5 border border-slate-100">
                    <BellOff className="w-7 h-7 text-slate-350" />
                  </div>
                  <p className="text-xs font-black text-slate-700">{lang === 'bn' ? 'কোন নতুন নোটিফিকেশন নেই!' : 'No active notifications!'}</p>
                  <p className="text-[9.5px] mt-2 text-center text-slate-500 max-w-[260px] leading-relaxed">
                    {lang === 'bn' 
                      ? "নতুন রিমাইন্ডার শিডিউল করতে থ্রি-ডট মেনু থেকে 'রিমাইন্ডার সেট করুন' অপশনটি ক্লিক করুন।" 
                      : "To schedule a new alarm / reminder, click 'Set Reminder' in the three-dot menu."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Signup requests */}
                  {signupRequests && signupRequests.filter(req => req.status === 'pending').length > 0 && (
                    <div className="bg-purple-50/20 border border-purple-100 rounded-2.5xl p-3 space-y-2">
                      <div className="flex justify-between items-center px-1 mb-1 border-b border-purple-100 pb-1.5">
                        <span className="text-[9.2px] font-black text-purple-750 uppercase tracking-widest flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                          {lang === 'bn' ? 'কাস্টমার অ্যাকাউন্ট অনুরোধ' : 'PENDING SIGNUP REQUESTS'}
                        </span>
                        <span className="text-[8.5px] font-black px-1.5 py-0.2 bg-purple-100 text-purple-705 rounded-full">
                          {signupRequests.filter(req => req.status === 'pending').length}
                        </span>
                      </div>
                      
                      <div className="space-y-1.5">
                        {signupRequests.filter(req => req.status === 'pending').map((req) => (
                          <div 
                            key={req.id}
                            className="p-2 bg-white border border-purple-100 rounded-xl flex justify-between items-center gap-2 shadow-tiny hover:shadow-xs transition-all"
                          >
                            {/* Image/Avatar (Optional) */}
                            {req.photoUrl ? (
                              <button
                                type="button"
                                onClick={() => setZoomedImage({ url: req.photoUrl!, name: req.name })}
                                className="relative w-7 h-7 rounded-lg overflow-hidden border border-purple-100 bg-purple-50 hover:opacity-90 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                              >
                                <img 
                                  src={req.photoUrl} 
                                  alt={req.name} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </button>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold flex-shrink-0">
                                <User className="w-3.5 h-3.5 text-purple-600" />
                              </div>
                            )}

                            {/* Customer info */}
                            <div className="flex-1 min-w-0 space-y-0.5 text-left">
                              <p className="text-[10px] font-black leading-tight text-slate-900 break-words">
                                {req.name}
                              </p>
                              <div className="flex items-center gap-1 font-mono text-[8.5px] font-bold text-slate-850 leading-none">
                                <span>📱 {req.phone}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(req.phone, req.id)}
                                  className="p-0.5 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0 gap-0.5 text-[7px]"
                                  title={lang === 'bn' ? 'কপি করুন' : 'Copy Number'}
                                >
                                  <Copy className="w-2 h-2" />
                                  {copiedId === req.id && (
                                    <span className="text-[6px] text-emerald-650 font-extrabold animate-fade-in">
                                      {lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}
                                    </span>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Accept / Reject actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onAcceptSignUpRequest) onAcceptSignUpRequest(req);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white p-1 rounded-lg border border-emerald-700 shadow-tiny transition-all cursor-pointer flex items-center justify-center"
                                title={lang === 'bn' ? 'অনুমোদন করুন' : 'Accept Request'}
                              >
                                <Check className="w-3 h-3 font-black stroke-[3px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onRejectSignUpRequest) onRejectSignUpRequest(req);
                                }}
                                className="bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 p-1 rounded-lg border border-rose-200 shadow-tiny transition-all cursor-pointer flex items-center justify-center"
                                title={lang === 'bn' ? 'বাতিল করুন' : 'Reject Request'}
                              >
                                <X className="w-3 h-3 font-black stroke-[3px]" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recharge Requests */}
                  {rechargeRequests && rechargeRequests.filter(req => req.status === 'pending').length > 0 && (
                    <div className="bg-blue-50/20 border border-blue-100 rounded-2.5xl p-3 space-y-2">
                      <div className="flex justify-between items-center px-1 mb-1 border-b border-blue-100 pb-1.5">
                        <span className="text-[9.2px] font-black text-blue-750 uppercase tracking-widest flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                          {lang === 'bn' ? 'রিচার্জের অনুরোধ সমূহ' : 'PENDING RECHARGES'}
                        </span>
                        <span className="text-[8.5px] font-black px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full">
                          {rechargeRequests.filter(req => req.status === 'pending').length}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {rechargeRequests.filter(req => req.status === 'pending').map((req) => (
                          <div 
                            key={req.id}
                            className="p-2 bg-white border border-blue-100 rounded-xl flex flex-col gap-1 shadow-tiny hover:shadow-xs transition-all"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0 space-y-0.5 text-left">
                                <span className="bg-blue-600 text-white text-[6.5px] px-1.5 py-0.2 rounded-md font-black uppercase tracking-wider shrink-0 select-none inline-block leading-none">
                                  {req.method === 'bkash' ? (lang === 'bn' ? 'বিকাশ' : 'bKash') : req.method === 'nagad' ? (lang === 'bn' ? 'নগদ' : 'Nagad') : (lang === 'bn' ? 'ফ্লেক্সিলোড' : 'Flexiload')}
                                </span>
                                
                                <p className="text-[10px] font-black leading-tight text-slate-900 break-words pt-0.5">
                                  {req.customerName}
                                </p>

                                <div className="space-y-1 text-[9px] font-bold text-slate-800">
                                  <div className="flex items-center gap-1 font-mono leading-none">
                                    <span>📱 {req.rechargePhone}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(req.rechargePhone, req.id)}
                                      className="p-0.5 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-655 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0 gap-0.5 text-[7px]"
                                      title={lang === 'bn' ? 'কপি করুন' : 'Copy Number'}
                                    >
                                      <Copy className="w-2 h-2" />
                                      {copiedId === req.id && (
                                        <span className="text-[6px] text-emerald-650 font-extrabold animate-fade-in">
                                          {lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                  <div className="font-mono text-[10px] font-black text-blue-800 leading-none">
                                    💵 {currency}{req.amount.toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              <div className="text-[7.5px] font-black text-slate-400 shrink-0 select-none font-mono">
                                {req.createdAt ? new Date(req.createdAt).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                }) : ''}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2 mt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onCompleteRechargeRequest?.(req);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] font-black py-1 px-1.5 rounded-lg border border-emerald-700 shadow-tiny active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                              >
                                <Check className="w-2.5 h-2.5 text-white" />
                                <span>{lang === 'bn' ? 'সম্পূর্ণ করুন' : 'Complete'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRechargeToCancel(req);
                                }}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[8px] font-black py-1 px-1.5 rounded-lg border border-rose-200 shadow-tiny active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                              >
                                <X className="w-2.5 h-2.5 text-rose-600" />
                                <span>{lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Overdue Alarm Reminders */}
                  {reminders.filter(r => r.isTriggered && !r.isCompleted).length > 0 && (
                    <div className="bg-rose-50/20 border border-slate-100 rounded-2.5xl p-3 space-y-2">
                      <div className="flex justify-between items-center px-1 mb-1 border-b border-red-100 pb-1.5">
                        <span className="text-[9.2px] font-black text-rose-750 uppercase tracking-widest flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                          {lang === 'bn' ? 'রিমাইন্ডার সমূহের সময় অতিক্রম হয়েছে' : 'DUE ALARMS & REMINDERS'}
                        </span>
                        <span className="text-[8.5px] font-black px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full">
                          {reminders.filter(r => r.isTriggered && !r.isCompleted).length}
                        </span>
                      </div>
                  
                      <div className="space-y-1.5">
                        {reminders.filter(r => r.isTriggered && !r.isCompleted).map((r) => {
                          const rDate = new Date(r.datetime);
                          const formattedDateStr = rDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });

                          // Live Relative Duration Text string
                          const diffMs = rDate.getTime() - nowTicker.getTime();
                          const absoluteDiffMins = Math.floor(Math.abs(diffMs) / 60000);
                          const hours = Math.floor(absoluteDiffMins / 60);
                          const mins = absoluteDiffMins % 60;
                          const days = Math.floor(hours / 24);

                          let durationStr = '';
                          if (lang === 'bn') {
                            if (days > 0) {
                              durationStr += `${days} দিন ` + (hours % 24 > 0 ? `${hours % 24} ঘণ্টা` : '');
                            } else if (hours > 0) {
                              durationStr += `${hours} ঘণ্টা ${mins > 0 ? `${mins} মিনিট` : ''}`;
                            } else {
                              durationStr += `${mins} মিনিট`;
                            }
                            durationStr += ' আগে';
                          } else {
                            if (days > 0) {
                              durationStr += `${days}d ` + (hours % 24 > 0 ? `${hours % 24}h` : '');
                            } else if (hours > 0) {
                              durationStr += `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
                            } else {
                              durationStr += `${mins}m`;
                            }
                            durationStr += ' ago';
                          }

                          return (
                            <div 
                              key={r.id}
                              className="p-2.5 bg-white border border-red-100 rounded-xl flex justify-between items-center gap-3 shadow-tiny transition-all"
                            >
                              <div className="flex-1 min-w-0 space-y-0.5 text-left">
                                <span className="bg-red-650 text-white text-[6.5px] px-1.5 py-0.2 rounded-md font-black uppercase tracking-wider shrink-0 select-none leading-none inline-block font-sans">
                                  {lang === 'bn' ? 'বিজ্ঞপ্তি সময়' : 'ALARM'}
                                </span>
                                
                                {/* Rich Black text for title */}
                                <p className="text-[10px] font-black leading-tight text-slate-900 break-words pt-0.5">
                                  {r.text}
                                </p>

                                {/* Time Details with Live dynamic updates */}
                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] font-bold text-slate-500 leading-none">
                                  <div className="flex items-center gap-0.5 font-mono">
                                    <Clock className="w-2.5 h-2.5 text-purple-750" />
                                    <span className="text-purple-900">{formattedDateStr}</span>
                                  </div>
                                  <span className="text-red-655 font-extrabold flex items-center gap-0.5 font-mono">
                                    <span>({durationStr})</span>
                                  </span>
                                </div>
                              </div>

                              {/* Action buttons inside the notification card */}
                              <div className="flex shrink-0">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    handleCompleteReminder(r.id);
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white p-1 rounded-lg border border-emerald-700 shadow-tiny transition-all cursor-pointer flex items-center justify-center font-bold"
                                  title={lang === 'bn' ? 'সম্পন্ন বা বন্ধ করুন' : 'Dismiss / Mark Done'}
                                >
                                  <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Navigation Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between shrink-0 font-sans">
              <span className="text-[8.2px] font-black text-slate-400 uppercase tracking-widest">
                Hello Point Smart Center
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowNotificationsModal(false);
                  setShowRemindersModal(true);
                }}
                className="text-[9px] font-black text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl border border-purple-155 uppercase transition-all flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3 text-purple-700" />
                <span>{lang === 'bn' ? 'রিমাইন্ডার খাতা' : 'Reminders'}</span>
              </button>
            </div>


          </div>
        </div>
      )}

      {showPaybillRequestsModal && (
        <div id="paybill-requests-center-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in print:hidden select-none font-sans">
          <div className="bg-white rounded-[32px] w-full max-w-[640px] overflow-hidden shadow-[0_25px_60px_-15px_rgba(15,23,42,0.3)] border border-slate-200/90 transform transition-all p-6 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm">
                  <Lightbulb className="w-4.5 h-4.5 animate-pulse text-amber-500 fill-amber-300" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-slate-855 text-xs sm:text-xs flex items-center gap-2 uppercase tracking-wide">
                    {lang === 'bn' ? 'পে-বিল অনুরোধসমূহ' : 'Pay-Bill Request Center'}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400">
                    {pendingPaybillRequestsCount > 0 
                      ? (lang === 'bn' ? `আপনি ${pendingPaybillRequestsCount}টি নতুন পে-বিল অনুরোধ পেয়েছেন` : `You have ${pendingPaybillRequestsCount} pending requests`)
                      : (lang === 'bn' ? 'কোন পেন্ডিং অনুরোধ নেই' : 'No pending requests')}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPaybillRequestsModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-full cursor-pointer transition-all active:scale-90"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* List of pay-bill requests */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 min-h-0 select-text">
              {(paybillRequests || []).length === 0 ? (
                <div className="text-center py-14 px-4 border border-dashed border-slate-200 rounded-2.5xl flex flex-col items-center justify-center text-slate-400 select-none">
                  <div className="bg-slate-50 p-4 rounded-full mb-3.5 border border-slate-100">
                    <Lightbulb className="w-7 h-7 text-slate-350" />
                  </div>
                  <p className="text-xs font-black text-slate-700">{lang === 'bn' ? 'কোন পে-বিল অনুরোধ নেই!' : 'No pay-bill requests!'}</p>
                  <p className="text-[9.5px] mt-2 text-center text-slate-500 max-w-[260px] leading-relaxed">
                    {lang === 'bn' ? 'কাস্টমাররা পে-বিল সাবমিট করলে এখানে সকল তথ্য দেখতে পাবেন।' : 'When customers submit pay-bill requests, they will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(paybillRequests || []).map((req) => (
                    <div 
                      key={req.id}
                      className="p-3 bg-slate-50/50 border border-slate-200/80 rounded-2xl flex flex-col gap-2.5 hover:bg-slate-50 hover:border-slate-300 transition-all text-left"
                    >
                      <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-100 pb-2 select-none">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[7px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider select-none leading-none text-white ${
                            req.status === 'pending' ? 'bg-amber-500' : req.status === 'accepted' ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}>
                            {req.status === 'pending' ? (lang === 'bn' ? 'পেন্ডিং' : 'Pending') : req.status === 'accepted' ? (lang === 'bn' ? 'গৃহীত' : 'Accepted') : (lang === 'bn' ? 'বাতিল' : 'Rejected')}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500">
                            {lang === 'bn' ? `সিরিয়াল নং: ${req.serialNumber || 'N/A'}` : `Serial No: ${req.serialNumber || 'N/A'}`}
                          </span>
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 font-mono">
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          }) : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        {/* Biller ID */}
                        <div className="flex items-center justify-between bg-white border border-slate-100 px-2.5 py-1.5 rounded-xl">
                          <div className="min-w-0">
                            <span className="text-[8px] font-black text-slate-400 block uppercase leading-none mb-0.5 select-none">{lang === 'bn' ? 'বিলার আইডি' : 'BILLER ID'}</span>
                            <span className="font-mono font-bold text-[10.5px] text-slate-800 tracking-wider truncate block">{req.billerNumber}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(req.billerNumber, `${req.id}-id`)}
                            className="p-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0 gap-0.5 text-[8px] select-none"
                          >
                            {copiedId === `${req.id}-id` ? (
                              <span className="text-emerald-600 font-bold">{lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5 text-slate-500" />
                                <span>{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Biller Name */}
                        <div className="flex items-center justify-between bg-white border border-slate-100 px-2.5 py-1.5 rounded-xl">
                          <div className="min-w-0">
                            <span className="text-[8px] font-black text-slate-400 block uppercase leading-none mb-0.5 select-none">{lang === 'bn' ? 'বাংলায় নাম' : 'BILLER NAME'}</span>
                            <span className="font-bold text-[10.5px] text-slate-800 truncate block">{req.billerDetails}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(req.billerDetails, `${req.id}-name`)}
                            className="p-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0 gap-0.5 text-[8px] select-none"
                          >
                            {copiedId === `${req.id}-name` ? (
                              <span className="text-emerald-600 font-bold">{lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5 text-slate-500" />
                                <span>{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Customer Phone */}
                        <div className="flex items-center justify-between bg-white border border-slate-100 px-2.5 py-1.5 rounded-xl">
                          <div className="min-w-0">
                            <span className="text-[8px] font-black text-slate-400 block uppercase leading-none mb-0.5 select-none">{lang === 'bn' ? 'কাস্টমার মোবাইল' : 'CUSTOMER MOBILE'}</span>
                            <span className="font-mono font-bold text-[10.5px] text-slate-800 tracking-wider truncate block">{req.phone}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(req.phone, `${req.id}-phone`)}
                            className="p-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0 gap-0.5 text-[8px] select-none"
                          >
                            {copiedId === `${req.id}-phone` ? (
                              <span className="text-emerald-600 font-bold">{lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5 text-slate-500" />
                                <span>{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Due Date & Amount Info */}
                        <div className="bg-white border border-slate-100 px-2.5 py-1.5 rounded-xl flex justify-between items-center">
                          <div>
                            <span className="text-[8px] font-black text-slate-400 block uppercase leading-none mb-0.5 select-none">{lang === 'bn' ? 'শেষ তারিখ' : 'LAST DATE'}</span>
                            <span className="font-bold text-[10px] text-slate-700 block">{req.secondDate || 'N/A'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] font-black text-slate-400 block uppercase leading-none mb-0.5 select-none">{lang === 'bn' ? 'বিল পরিমাণ' : 'AMOUNT'}</span>
                            <span className="font-mono font-black text-[11px] text-blue-700 block">💵 {currency}{req.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {req.status === 'pending' && (
                        <div className="grid grid-cols-2 gap-2 mt-1 select-none">
                          <button
                            type="button"
                            onClick={() => setSelectedRequestToConfirm(req)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black py-2 px-3 rounded-xl border border-emerald-700 shadow-tiny active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                            <span>{lang === 'bn' ? 'গ্রহণ করুন' : 'Accept Request'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(lang === 'bn' ? 'আপনি কি নিশ্চিত যে এই পে-বিল অনুরোধটি বাতিল করতে চান?' : 'Are you sure you want to reject this request?')) {
                                onCancelPayBillRequest?.(req);
                              }
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-black py-2 px-3 rounded-xl border border-rose-250 shadow-tiny active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5 text-rose-650 stroke-[2.5]" />
                            <span>{lang === 'bn' ? 'বাতিল করুন' : 'Reject Request'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end shrink-0 select-none">
              <button
                type="button"
                onClick={() => setShowPaybillRequestsModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-black rounded-xl transition-all cursor-pointer uppercase"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal Overlay */}
      {selectedRequestToConfirm && (
        <div id="bill-confirm-dialog-overlay" className="fixed inset-0 bg-slate-955/80 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] animate-fade-in select-text">
          <div className="w-full max-w-sm bg-white border border-slate-200/95 rounded-[32px] shadow-2xl p-6 flex flex-col items-center text-center animate-scale-in">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 shrink-0">
              <Lightbulb className="w-6 h-6 text-amber-600 animate-pulse" />
            </div>

            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 select-none">
              {lang === 'bn' ? 'বিল গ্রহণের সম্মতি নিশ্চিতকরণ' : 'CONFIRM BILL ACCEPTANCE'}
            </h3>

            <p className="text-xs text-slate-650 leading-relaxed mb-6">
              {lang === 'bn' ? (
                <>
                  আপনি কি কাস্টমার <strong className="text-slate-900">{selectedRequestToConfirm.customerName}</strong> এর <strong className="text-blue-600">{currency}{selectedRequestToConfirm.amount.toFixed(2)}</strong> টাকার বিলটি গ্রহণ করতে চান?
                  <br /><br />
                  হ্যাঁ বাটনে ক্লিক করলে এই বিলটি গ্রহণ করা হবে এবং এটি আপনার 'পে-বিল' তালিকায় বকেয়া (Unpaid) অবস্থায় জমা হবে।
                </>
              ) : (
                <>
                  Are you sure you want to accept the bill request of <strong className="text-slate-900">{currency}{selectedRequestToConfirm.amount.toFixed(2)}</strong> for customer <strong className="text-slate-900">{selectedRequestToConfirm.customerName}</strong>?
                  <br /><br />
                  Clicking "Yes" will approve this bill request and save it as an UNPAID bill in your Pay-Bills list.
                </>
              )}
            </p>

            <div className="flex gap-3 w-full select-none">
              <button
                onClick={() => setSelectedRequestToConfirm(null)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-black rounded-xl cursor-pointer transition-all uppercase"
              >
                {lang === 'bn' ? 'না (বাতিল)' : 'No (Cancel)'}
              </button>
              <button
                onClick={() => {
                  onCompletePayBillRequest?.(selectedRequestToConfirm);
                  setSelectedRequestToConfirm(null);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-xl shadow-tiny cursor-pointer transition-all uppercase"
              >
                {lang === 'bn' ? 'হ্যাঁ (নিশ্চিত)' : 'Yes (Confirm)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Reminders Modal Manager requested by user */}
      {showRemindersModal && (
        <div id="reminders-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fade-in print:hidden select-none font-sans">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 transform transition-all p-4 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 shrink-0">
              <h3 className="font-black text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                <Bell className={`w-4 h-4 text-purple-700 ${isWiggling ? 'animate-wiggle' : ''}`} />
                <span>{lang === 'bn' ? 'আমার রিমাইন্ডার খাতা' : 'My Reminder Book'}</span>
              </h3>
              <button 
                onClick={() => {
                  setShowRemindersModal(false);
                  handleCancelEditReminder();
                }}
                className="text-slate-400 hover:text-slate-650 p-1 rounded-full hover:bg-slate-50 cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick reminder scheduler Form */}
            <form onSubmit={handleAddReminder} className="bg-purple-50 p-2.5 rounded-2xl border-2 border-purple-100 space-y-2 mb-3 shrink-0">
              <h4 className="text-[10px] font-black tracking-wider text-brand-primary uppercase flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {editingReminderId 
                    ? (lang === 'bn' ? 'রিমাইন্ডার এডিট করুন' : 'Edit Active Reminder') 
                    : (lang === 'bn' ? 'নতুন রিমাইন্ডার শিডিউল করুন' : 'Schedule New Reminder')
                  }
                </span>
                {editingReminderId && (
                  <button 
                    type="button" 
                    onClick={handleCancelEditReminder}
                    className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold hover:bg-red-200"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                )}
              </h4>
              <div className="space-y-2">
                <input 
                  type="text"
                  value={newReminderText}
                  onChange={(e) => setNewReminderText(e.target.value)}
                  placeholder={lang === 'bn' ? 'কী মনে করিয়ে দিতে হবে? (যেমন: করিম বকেয়া দিবে)' : 'What to remind? (e.g., Karim payment due)'}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold outline-none focus:border-brand-primary transition-all text-black"
                />
                
                <div className="grid grid-cols-5 gap-1.5 items-center">
                  <div className="col-span-3">
                    <input 
                      type="datetime-local"
                      value={newReminderDatetime}
                      onChange={(e) => setNewReminderDatetime(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1 text-[10.5px] font-black outline-none focus:border-brand-primary transition-all font-mono text-black"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="col-span-2 py-1.5 bg-brand-primary hover:bg-brand-hover active:scale-95 text-white rounded-xl text-[10px] font-black transition-all cursor-pointer shadow-sm tracking-wider uppercase text-center"
                  >
                    {editingReminderId 
                      ? (lang === 'bn' ? 'আপডেট' : 'UPDATE') 
                      : (lang === 'bn' ? 'সেভ করুন' : 'SAVE NOW')
                    }
                  </button>
                </div>
              </div>
            </form>

            {/* Reminders List wrapper */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1 select-none">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex justify-between items-center">
                <span>{lang === 'bn' ? 'রিমাইন্ডার তালিকা' : 'REMINDERS LIST'} ({reminders.length})</span>
                <span className="text-[7.5px] lowercase italic text-purple-600 animate-pulse font-normal">
                  {lang === 'bn' ? 'লাইভ টাইমার সক্রিয়' : 'Live timer active'}
                </span>
              </h4>

              {reminders.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                  <Bell className="w-8 h-8 opacity-25 mb-1.5 animate-pulse" />
                  <p className="text-[10.5px] font-bold">{lang === 'bn' ? 'কোন রিমাইন্ডার সেট করা নেই!' : 'No scheduled reminders!'}</p>
                  <p className="text-[9px] mt-0.5">{lang === 'bn' ? 'সহজে বকেয়া তাগাদা ও কাজের অ্যালার্ট সেট করুন।' : 'Easily set due alarms & credit reminders.'}</p>
                </div>
              ) : (
                reminders.map((r) => {
                  const rDate = new Date(r.datetime);
                  const formattedDateStr = rDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  const getLiveStatus = () => {
                    const diffMs = rDate.getTime() - nowTicker.getTime();
                    const isPast = diffMs < 0;
                    const absoluteDiffMins = Math.floor(Math.abs(diffMs) / 60000);
                    
                    if (r.isCompleted) {
                      return lang === 'bn' ? 'সম্পন্ন হয়েছে' : 'Completed';
                    }

                    if (absoluteDiffMins === 0) {
                      return lang === 'bn' ? 'এইমাত্র' : 'just now';
                    }

                    if (isPast) {
                      const hrs = Math.floor(absoluteDiffMins / 60);
                      const mins = absoluteDiffMins % 60;
                      if (hrs > 0) {
                        return lang === 'bn' ? `${hrs} ঘণ্টা ${mins} মিনিট আগে` : `${hrs}h ${mins}m ago`;
                      }
                      return lang === 'bn' ? `${mins} মিনিট আগে` : `${mins}m ago`;
                    } else {
                      const hrs = Math.floor(absoluteDiffMins / 60);
                      const mins = absoluteDiffMins % 60;
                      if (hrs > 0) {
                        return lang === 'bn' ? `${hrs} ঘণ্টা ${mins} মিনিট পর` : `in ${hrs}h ${mins}m`;
                      }
                      return lang === 'bn' ? `${mins} মিনিট পর` : `in ${mins}m`;
                    }
                  };

                  const liveStatusString = getLiveStatus();

                  let cardBorderClasses = '';
                  let cardBgClasses = '';
                  if (r.isCompleted) {
                    cardBorderClasses = 'border border-slate-200 opacity-75';
                    cardBgClasses = 'bg-slate-50/50';
                  } else if (r.isTriggered) {
                    cardBorderClasses = 'border border-red-300 border-l-4 border-l-red-500 shadow-sm';
                    cardBgClasses = 'bg-red-50/45 animate-pulse-slow';
                  } else {
                    cardBorderClasses = 'border border-amber-300 border-l-4 border-l-amber-500 shadow-tiny';
                    cardBgClasses = 'bg-amber-50/10';
                  }

                  const isBeingEdited = editingReminderId === r.id;

                  return (
                    <div 
                      key={r.id}
                      className={`p-1.5 rounded-xl transition-all flex justify-between items-start gap-1.5 ${cardBorderClasses} ${cardBgClasses} ${
                        isBeingEdited ? 'ring-2 ring-purple-600 scale-[0.98]' : ''
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1 flex-wrap mb-0.5">
                          {r.isTriggered && !r.isCompleted && (
                            <span className="bg-red-600 text-white text-[7px] px-1 py-0.2 rounded font-black tracking-wider shrink-0 uppercase">
                              {lang === 'bn' ? 'সময় হয়েছে!' : 'TIME OVER!'}
                            </span>
                          )}
                          {r.isCompleted && (
                            <span className="bg-emerald-100 text-emerald-800 text-[7px] px-1 py-0.2 rounded font-bold tracking-wider shrink-0 uppercase">
                              {lang === 'bn' ? 'সম্পন্ন' : 'COMPLETED'}
                            </span>
                          )}
                        </div>

                        <p className={`text-[10.5px] font-black break-words leading-tight text-black ${
                          r.isCompleted ? 'line-through text-slate-500 font-bold opacity-60' : ''
                        }`}>
                          {r.text}
                        </p>

                        <div className="flex flex-col gap-0.2 text-[8.5px] text-slate-700 font-extrabold pt-0.5">
                          <div className="flex items-center gap-1">
                            <Clock className="w-2 h-2 text-purple-700" />
                            <span className="font-mono text-purple-950">{formattedDateStr}</span>
                          </div>
                          {!r.isCompleted && (
                            <span className={`text-[8px] font-bold ${r.isTriggered ? 'text-red-600' : 'text-emerald-700'}`}>
                              ({liveStatusString})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        {!r.isCompleted && (
                          <button 
                            type="button"
                            onClick={() => handleCompleteReminder(r.id)}
                            className="bg-emerald-50 hover:bg-emerald-150 text-emerald-700 p-1 rounded border border-emerald-200 transition-all cursor-pointer"
                            title={lang === 'bn' ? 'সম্পন্ন চিহ্নিত করুন' : 'Mark completed'}
                          >
                            <Check className="w-3 h-3 font-bold" />
                          </button>
                        )}
                        {!r.isCompleted && (
                          <button 
                            type="button"
                            onClick={() => handleStartEditReminder(r)}
                            className={`p-1 rounded border transition-all cursor-pointer ${
                              isBeingEdited 
                                ? 'bg-brand-primary text-white border-brand-hover' 
                                : 'bg-brand-light hover:bg-brand-light/90 text-brand-primary border-brand-primary/20'
                            }`}
                            title={lang === 'bn' ? 'সম্পাদন করুন' : 'Edit Reminder'}
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => handleDeleteReminder(r.id)}
                          className="bg-red-50 hover:bg-red-150 text-red-600 p-1 rounded border border-red-200 transition-all cursor-pointer"
                          title={lang === 'bn' ? 'রিমুভ করুন' : 'Delete Reminder'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adding/Editing a Pay Bill Dialogue / Modal Dialog */}
      {showPayBillModal && (
        <div id="add-paybill-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 transform transition-all p-4">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 text-brand-primary">
                <CreditCard className="w-4 h-4 text-brand-primary" />
                {editingPayBill 
                  ? (lang === 'bn' ? 'পে-বিল তথ্য সম্পাদন করুন' : 'Edit Pay Bill Entry') 
                  : (lang === 'bn' ? 'নতুন পে-বিল অন্তর্ভুক্ত করুন' : 'New Pay Bill Entry')
                }
              </h3>
              <button 
                onClick={() => {
                  setShowPayBillModal(false);
                  setEditingPayBill(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleSavePayBillForm} className="space-y-3">
              {payBillError && (
                <p className="text-[10px] bg-rose-50 border border-rose-100 font-extrabold text-rose-600 rounded-xl py-1.5 px-2.5 text-center leading-normal animate-fade-in">
                  ⚠️ {payBillError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    {lang === 'bn' ? 'বিলার নম্বর (Bil No)' : 'Biller Number'} <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={pbBillerNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPbBillerNumber(val);
                      setPayBillError('');
                      const trimmed = val.trim().toLowerCase();
                      if (trimmed) {
                        const matchedPb = (paybills || []).find((pb) => pb.billerNumber.trim().toLowerCase() === trimmed);
                        const matchedReq = (paybillRequests || []).find((r) => r.billerNumber.trim().toLowerCase() === trimmed);
                        const matched = matchedPb || matchedReq;
                        if (matched) {
                          if ('billerDetails' in matched && matched.billerDetails) {
                            setPbBillerDetails(matched.billerDetails);
                          }
                          if ('note' in matched && matched.note && matched.note.trim()) {
                            setPbMemo(matched.note.trim());
                          } else if ('phone' in matched && matched.phone && matched.phone.trim()) {
                            setPbMemo(matched.phone.trim());
                          }
                        }
                      }
                    }}
                    placeholder=""
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white transition-all font-mono font-bold text-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    {lang === 'bn' ? 'টাকার পরিমাণ' : 'Amount'} <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="number" 
                    step="any"
                    value={pbAmount}
                    onChange={(e) => setPbAmount(e.target.value)}
                    placeholder=""
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white transition-all font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  {lang === 'bn' ? 'কাস্টমার নাম' : 'Customer Name'} <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={pbBillerDetails}
                  onChange={(e) => setPbBillerDetails(e.target.value)}
                  placeholder=""
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  {lang === 'bn' ? 'পরিশোধের শেষ সময় (Due Date)' : 'Due Date'}
                </label>
                <input 
                  type="date" 
                  value={pbSecondDate}
                  onChange={(e) => setPbSecondDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  {lang === 'bn' ? 'মোবাইল নাম্বার' : 'Mobile Number'}
                </label>
                <input 
                  type="text" 
                  value={pbMemo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPbMemo(val);
                    if (val.trim()) {
                      // Only auto-fill Mobile Number if the entered value is phone/numeric-like
                      if (!isPhoneLike(val)) return;
                      // Avoid early auto-fill by requiring at least 11 characters (typical mobile phone number)
                      if (val.trim().replace(/[\s+\-()]/g, '').length < 11) return;
                      const searchVal = normalizeString(val);
                      const matched = paybills.find(
                        (pb) => pb.note && normalizeString(pb.note) === searchVal
                      );
                      if (matched) {
                        if (!pbBillerNumber.trim()) {
                          setPbBillerNumber(matched.billerNumber);
                        }
                        if (!pbBillerDetails.trim()) {
                          setPbBillerDetails(matched.billerDetails);
                        }
                      }
                    }
                  }}
                  placeholder=""
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white transition-all font-semibold"
                />
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex gap-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowPayBillModal(false);
                    setEditingPayBill(null);
                  }}
                  className="flex-1 py-1.8 text-[10px] font-black text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  {text.cancel}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-1.8 text-[10px] font-black text-white bg-brand-hover hover:bg-brand-primary rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  {text.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEPARATE DETAILED MODAL OVERLAY FOR BILL INTERACTION */}
      {activePayBillDetails && (
        <div id="paybill-details-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 transform transition-all p-4 text-left flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 text-brand-primary">
                <CreditCard className="w-4 h-4 text-brand-hover" />
                {lang === 'bn' ? 'পে-বিল হিসাবের বিস্তারিত বিবরণ' : 'Pay-Bill Account Details'}
              </h3>
              <button 
                onClick={() => {
                  setActivePayBillDetails(null);
                  setPaidInfoText('');
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin text-[11px] text-slate-705">
              
              {/* Receipt Visual Header Card */}
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl text-center space-y-1">
                <span className={`text-[8.5px] font-black uppercase tracking-widest px-2 rounded-full inline-block ${
                  activePayBillDetails.isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                }`}>
                  {activePayBillDetails.isPaid ? (lang === 'bn' ? 'পরিশোধিত / PAID' : 'PAID') : (lang === 'bn' ? 'বকেয়া / UNPAID' : 'PENDING')}
                </span>
                
                <h4 className="text-xl font-black font-mono tracking-tight text-slate-850">
                  {currency} {activePayBillDetails.amount.toFixed(2)}
                </h4>
                
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <p className="text-[10px] text-slate-450 font-mono font-bold leading-none select-all">
                    {lang === 'bn' ? 'বিলার আইডি:' : 'Biller ID:'} <span className="text-rose-500 font-black">{activePayBillDetails.billerNumber}</span>
                  </p>
                  <button
                    onClick={() => handleCopyText(activePayBillDetails.billerNumber, `${activePayBillDetails.id}-burl`)}
                    className="p-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 transition-all text-slate-400 hover:text-slate-600 cursor-pointer flex items-center justify-center shrink-0"
                    title={lang === 'bn' ? 'বিলার আইডি কপি' : 'Copy Biller ID'}
                  >
                    {copiedId === `${activePayBillDetails.id}-burl` ? (
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                  </button>
                  {copiedId === `${activePayBillDetails.id}-burl` && (
                    <span className="text-[8.5px] text-emerald-600 font-bold animate-fade-in shrink-0">
                      {lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}
                    </span>
                  )}
                </div>
              </div>

              {/* Specific Details List */}
              <div className="bg-slate-50/40 p-2.5 rounded-xl border border-slate-100 space-y-2">
                <div>
                  <span className="font-extrabold text-slate-400 text-[8.5px] uppercase tracking-wider block">
                    {lang === 'bn' ? 'কাস্টমার নাম' : 'Customer Name'}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="font-black text-slate-800 text-xs">{activePayBillDetails.billerDetails}</p>
                    <button
                      onClick={() => handleCopyText(activePayBillDetails.billerDetails, `${activePayBillDetails.id}-dets`)}
                      className="p-1 rounded bg-white hover:bg-slate-150 border border-slate-200 transition-all text-slate-500 cursor-pointer flex items-center justify-center shrink-0"
                      title={lang === 'bn' ? 'নাম কপি করুন' : 'Copy Name'}
                    >
                      {copiedId === `${activePayBillDetails.id}-dets` ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    {copiedId === `${activePayBillDetails.id}-dets` && (
                      <span className="text-[8.5px] text-emerald-600 font-bold animate-fade-in shrink-0">
                        {lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="font-extrabold text-slate-400 text-[8.5px] uppercase tracking-wider block">
                      {lang === 'bn' ? 'এন্ট্রি করার তারিখ' : 'Recorded Date'}
                    </span>
                    <p className="font-bold text-slate-700 mt-0.5">
                      📅 {new Date(activePayBillDetails.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {activePayBillDetails.secondDate && (
                    <div>
                      <span className="font-extrabold text-slate-400 text-[8.5px] uppercase tracking-wider block">
                        {lang === 'bn' ? 'পরিশোধের শেষ সময়' : 'Due Date'}
                      </span>
                      <p className="font-bold text-amber-700 mt-0.5">
                        ⏳ {new Date(activePayBillDetails.secondDate).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>

                {activePayBillDetails.note && (
                  <div>
                    <span className="font-extrabold text-slate-400 text-[8.5px] uppercase tracking-wider block">
                      {lang === 'bn' ? 'মোবাইল নাম্বার' : 'Mobile Number'}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-purple-900 font-bold italic font-mono text-xs">📱 {activePayBillDetails.note}</p>
                      <button
                        onClick={() => handleCopyText(activePayBillDetails.note, `${activePayBillDetails.id}-note`)}
                        className="p-1 rounded bg-white hover:bg-slate-150 border border-slate-200 transition-all text-slate-500 cursor-pointer flex items-center justify-center shrink-0"
                        title={lang === 'bn' ? 'মোবাইল নম্বর কপি করুন' : 'Copy Mobile Number'}
                      >
                        {copiedId === `${activePayBillDetails.id}-note` ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      {copiedId === `${activePayBillDetails.id}-note` && (
                        <span className="text-[8.5px] text-emerald-600 font-bold animate-fade-in shrink-0">
                          {lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Paid Status & Inputs */}
              <div className="border-t border-slate-100 pt-3">
                {activePayBillDetails.isPaid ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100/65 space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] font-black text-emerald-600 uppercase tracking-wider block">
                        ✅ {lang === 'bn' ? 'টাকা পরিশোধ ভেরিফাইড' : 'PAYMENT VERIFIED'}
                      </span>
                      <p className="text-[10px] text-emerald-800 font-bold">
                        {lang === 'bn' ? 'তারিখ:' : 'Date:'} <span className="font-mono">{activePayBillDetails.paidAt || 'N/A'}</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activePayBillDetails.paidInfo && (
                        <div className="bg-white/90 p-2 rounded-lg border border-emerald-150 select-text">
                          <span className="text-[8px] font-black text-slate-400 block uppercase mb-0.5">
                            {lang === 'bn' ? 'বিকাশ ট্রানজেকশন আইডি:' : 'bKash TrxID / Paid Info:'}
                          </span>
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-mono font-black text-brand-hover text-xs leading-none truncate">
                              {activePayBillDetails.paidInfo}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopyText(activePayBillDetails.paidInfo || '', `${activePayBillDetails.id}-trx`)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
                              title="Copy TrxID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {activePayBillDetails.paidAccount && (
                        <div className="bg-white/90 p-2 rounded-lg border border-purple-150 select-text">
                          <span className="text-[8px] font-black text-purple-600 block uppercase mb-0.5 flex items-center gap-1">
                            #️⃣ {lang === 'bn' ? 'লাস্ট নাম্বার:' : 'Last Number:'}
                          </span>
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-mono font-black text-purple-900 text-xs leading-none truncate">
                              {activePayBillDetails.paidAccount}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopyText(activePayBillDetails.paidAccount || '', `${activePayBillDetails.id}-acc`)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
                              title="Copy Account"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Toggle to Unpaid Option inside the modal as well */}
                    <button
                      onClick={() => {
                        onSavePayBill({
                          ...activePayBillDetails,
                          isPaid: false,
                          paidAt: undefined,
                          paidInfo: undefined,
                          paidAccount: undefined
                        });
                        setActivePayBillDetails(null);
                        setPaidInfoText('');
                        setPaidAccountText('');
                      }}
                      className="mt-2 w-full text-center text-[9px] font-extrabold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 cursor-pointer uppercase transition-all"
                    >
                      {lang === 'bn' ? 'পুনরায় বকেয়া করুন (Unpaid)' : 'Mark as Unpaid'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50/50 p-2.5 rounded-xl border border-rose-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] font-black text-rose-500 uppercase tracking-wider block">
                        ⏳ {lang === 'bn' ? 'পেমেন্ট ও লাস্ট নাম্বার এন্ট্রি' : 'Payment & Last Number Entry'}
                      </span>
                    </div>

                    {/* 1. Trx ID input */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-450 block uppercase leading-none">
                        {lang === 'bn' ? 'বিকাশ ট্রানজেকশন আইডি লিখুন' : 'Enter bKash Trx ID'}
                      </label>
                      <input
                        type="text"
                        value={paidInfoText}
                        onChange={(e) => setPaidInfoText(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand-primary font-mono font-bold"
                      />
                    </div>

                    {/* 2. Last Number input */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-450 block uppercase leading-none">
                        {lang === 'bn' ? 'লাস্ট নাম্বার লিখুন' : 'Last Number'}
                      </label>
                      <input
                        type="text"
                        value={paidAccountText}
                        onChange={(e) => setPaidAccountText(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand-primary font-bold text-purple-900"
                      />

                      {/* Saved Tags for instant 1-tap reuse without typing (only shown if user previously saved tags) */}
                      {allAvailableAccountTags.length > 0 && (
                        <div className="space-y-1 pt-0.5">
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5 scrollbar-thin">
                            {allAvailableAccountTags.map((tag) => {
                              const isSelected = paidAccountText.trim().toLowerCase() === tag.trim().toLowerCase();
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    setPaidAccountText(isSelected ? '' : tag);
                                  }}
                                  className={`text-[8.5px] px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer border ${
                                    isSelected
                                      ? 'bg-purple-650 text-white border-purple-700 shadow-xs'
                                      : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:text-brand-primary'
                                  }`}
                                >
                                  {isSelected ? '✓ ' : ''}{tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        const today = new Date();
                        const paidAtStr = today.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' });
                        
                        const cleanAcc = paidAccountText.trim();
                        if (cleanAcc) {
                          const updated = addSavedPayBillAccount(cleanAcc);
                          setSavedPayBillAccounts(updated);
                        }

                        onSavePayBill({
                          ...activePayBillDetails,
                          isPaid: true,
                          paidAt: paidAtStr,
                          paidInfo: paidInfoText.trim() || undefined,
                          paidAccount: cleanAcc || undefined
                        });
                        setActivePayBillDetails(null);
                        setPaidInfoText('');
                        setPaidAccountText('');
                      }}
                      className="w-full py-2 bg-brand-hover hover:bg-brand-primary text-white rounded-lg font-black text-xs shadow-md shadow-brand-hover/20 hover:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'bn' ? 'পরিশোধ সম্পন্ন করুন' : 'Confirm Paid'}</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Bottom Edit / Delete Utilities Row */}
            <div className="pt-2.5 mt-3 border-t border-slate-150 flex gap-2 justify-between">
              <div className="flex gap-1.5">
                <button 
                  onClick={() => {
                    setActivePayBillDetails(null);
                    startEditPayBill(activePayBillDetails);
                  }}
                  className="px-2.5 py-1.5 text-[9.5px] font-black bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-205 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  title="Configure Details"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'সম্পাদন' : 'Edit'}</span>
                </button>

                <button 
                  onClick={() => {
                    setActivePayBillDetails(null);
                    setPayBillToDelete(activePayBillDetails);
                  }}
                  className="px-2.5 py-1.5 text-[9.5px] font-black bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-205 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                  title="Delete Data"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'ডিলিট' : 'Delete'}</span>
                </button>
              </div>

              <button 
                type="button" 
                onClick={() => {
                  setActivePayBillDetails(null);
                  setPaidInfoText('');
                }}
                className="px-3.5 py-1.5 text-[9.5px] font-black text-slate-500 hover:bg-slate-50 border border-slate-202 rounded-lg transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Hidden Printable Invoice Section only rendered during real PDF printing (Using window.print() formatting natively) */}
      <div className="hidden print:block font-sans text-slate-905 bg-white p-6 max-w-4xl mx-auto">
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-purple-900">Hello Point</h1>
            <p className="text-xs text-slate-500 tracking-wide mt-0.5">
              {activeTab === 'paybill' 
                ? 'ডিজিটাল পে-বিল খতিয়ান ও ট্র্যাকিং হিস্ট্রি রিপোর্ট'
                : 'ডিজিটাল কাস্টমার হিসাব খাতার খতিয়ান ও দৈনিক ক্যাশবুক রিপোর্ট'
              }
            </p>
          </div>
          <div className="text-right text-[10px] font-bold text-slate-400 font-mono">
            <span>প্রিন্ট সময়: {new Date().toLocaleDateString('bn-BD')} {new Date().toLocaleTimeString('en-US')}</span>
          </div>
        </div>

        {activeTab === 'paybill' ? (
          <div className="mt-6">
            <h2 className="text-lg font-bold text-slate-800 pb-1 border-b border-slate-200 mb-3 uppercase tracking-wider">পে-বিল হিস্ট্রি ও বিলার রিপোর্ট বিবরণী</h2>
            
            <div className="grid grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-100 gap-4 mb-4">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">মোট বকেয়া পে-বিল</p>
                <h3 className="text-xl font-extrabold text-rose-500 font-mono">
                  {currency} {paybills.filter(p => !p.isPaid).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                </h3>
                <p className="text-[9px] text-slate-400 font-semibold">{paybills.filter(p => !p.isPaid).length} টি বিল পরিশোধ বাকি</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">মোট পরিশোধিত পে-বিল</p>
                <h3 className="text-xl font-extrabold text-emerald-600 font-mono">
                  {currency} {paybills.filter(p => p.isPaid).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                </h3>
                <p className="text-[9px] text-slate-400 font-semibold">{paybills.filter(p => p.isPaid).length} টি বিল সম্পন্ন</p>
              </div>
            </div>

            <table className="w-full mt-6 text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-500 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50">
                  <th className="py-2 px-3">SL</th>
                  <th className="py-2 px-3">বিলার নম্বর (Bil No)</th>
                  <th className="py-2 px-3">কাস্টমার নাম</th>
                  <th className="py-2 px-3">মোবাইল নাম্বার</th>
                  <th className="py-2 px-3">বিল ইস্যু তারিখ</th>
                  <th className="py-2 px-3">পেমেন্ট সমাপ্তি</th>
                  <th className="py-2 px-3 text-right">টাকার পরিমাণ</th>
                  <th className="py-2 px-3 text-right">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-850">
                {paybills.map((pb, idx) => (
                  <tr key={pb.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono text-[10px] text-slate-500">#{paybills.length - idx}</td>
                    <td className="py-2 px-3 font-mono font-bold text-rose-500 italic">{pb.billerNumber}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{pb.billerDetails}</td>
                    <td className="py-2 px-3">
                      {pb.note ? (
                        <div className="flex items-center gap-1.5 font-mono text-slate-600 font-semibold">
                          <span>{pb.note}</span>
                          <button
                            onClick={() => handleCopyText(pb.note || '', `${pb.id}-table-note`)}
                            className="p-1 rounded bg-slate-50 hover:bg-slate-150 border border-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer flex items-center justify-center transition-all shrink-0"
                            title="মোবাইল নম্বর কপি করুন"
                          >
                            {copiedId === `${pb.id}-table-note` ? (
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-500">{new Date(pb.date).toLocaleDateString('bn-BD')}</td>
                    <td className="py-2 px-3 font-mono text-slate-500">{pb.secondDate ? new Date(pb.secondDate).toLocaleDateString('bn-BD') : '-'}</td>
                    <td className="py-2 px-3 text-right font-black font-mono text-slate-800">{currency} {pb.amount.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${pb.isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {pb.isPaid ? 'পরিশোধিত' : 'বকেয়া'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <div className="mt-6">
              <h2 className="text-lg font-bold text-slate-800 pb-1 border-b border-slate-200 mb-3 uppercase tracking-wider">কাস্টমারদের মোট বকেয়া সারসংক্ষেপ</h2>
              <div className="grid grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">কাস্টমারদের থেকে মোট প্রাপ্য (পাবেন)</p>
                  <h3 className="text-xl font-extrabold text-rose-500 font-mono">{currency} {totals.youWillGet.toFixed(2)}</h3>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">কাস্টমারদের কাছে মোট দেয় (দেবেন)</p>
                  <h3 className="text-xl font-extrabold text-emerald-600 font-mono">{currency} {totals.youWillGive.toFixed(2)}</h3>
                </div>
              </div>
            </div>

            <table className="w-full mt-6 text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-500 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50">
                  <th className="py-2 px-3">কাস্টমার নাম</th>
                  <th className="py-2 px-3">মোবাইল</th>
                  <th className="py-2 px-3 text-right">বকেয়া পরিমাণ</th>
                  <th className="py-2 px-3 text-right">মন্তব্য</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {contacts.map(c => {
                  const cs = contactSummaries.get(c.id) || { balance: 0 };
                  const isTheyOwe = cs.balance > 0;
                  const isWeOwe = cs.balance < 0;
                  if (cs.balance === 0) return null;
                  return (
                    <tr key={c.id}>
                      <td className="py-2 px-3 font-bold">{c.name}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{c.phone || 'N/A'}</td>
                      <td className={`py-2 px-3 text-right font-bold font-mono ${isTheyOwe ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {currency} {Math.abs(cs.balance).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-[10px] font-bold">
                        {isTheyOwe ? 'কাস্টমার দেবে' : isWeOwe ? 'কাস্টমার পাবে' : 'সমতা'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="mt-12 pt-8 border-t border-dashed border-slate-350 text-center text-[10px] font-bold text-slate-400">
          <p>© Hello Point - আপনার নিরাপদ ডিজিটাল খাতা।</p>
        </div>
      </div>

      {showBanglaCalendar && (
        <BanglaCalendar 
          onClose={() => setShowBanglaCalendar(false)}
          lang={lang}
          themeColor={themeColor}
          currency={currency}
        />
      )}

      {/* BEAUTIFUL CUSTOM YES/NO CONFIRMATION DIALOG FOR PAY BILL DELETION */}
      {payBillToDelete && (
        <div id="delete-confirmation-dialog-overlay" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 w-full max-w-xs text-center transform scale-100 transition-all">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3.5 text-rose-500 animate-bounce animate-duration-1000">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              {lang === 'bn' ? 'মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Pay-Bill Deletion'}
            </h3>
            
            <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">
              {lang === 'bn' 
                ? `আপনি কি সত্যি "${payBillToDelete.billerDetails}" (মূল্য: ${currency} ${payBillToDelete.amount.toFixed(2)}) বিলটি মুছে ফেলতে চান?`
                : `Are you sure you want to delete the pay-bill for "${payBillToDelete.billerDetails}" of amount ${currency} ${payBillToDelete.amount.toFixed(2)}?`}
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setPayBillToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'না, বন্ধ করুন' : 'No, Cancel'}
              </button>
              <button
                onClick={() => {
                  if (payBillToDelete) {
                    onDeletePayBill(payBillToDelete.id);
                    setPayBillToDelete(null);
                  }
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL CUSTOM YES/NO CONFIRMATION DIALOG FOR CUSTOMER DELETION */}
      {contactToDelete && (
        <div id="customer-delete-dialog-overlay" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 w-full max-w-xs text-center transform scale-100 transition-all">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3.5 text-rose-500 animate-bounce animate-duration-1000">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              {lang === 'bn' ? 'গ্রাহক মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Customer Deletion'}
            </h3>
            
            <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">
              {lang === 'bn' 
                ? `আপনি কি সত্যি "${contactToDelete.name}" গ্রাহক খাতাটি মুছতে চান? গ্রাহক মুছে ফেললে তার সকল পূর্ববর্তী লেনদেন রেকর্ডও মুছে যাবে।`
                : `Are you sure you want to delete "${contactToDelete.name}"? Deleting a customer will also permanentely erase all of their past ledge transactions.`}
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setContactToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'না, বন্ধ করুন' : 'No, Cancel'}
              </button>
              <button
                onClick={() => {
                  if (contactToDelete) {
                    onDeleteContact(contactToDelete.id);
                    setContactToDelete(null);
                  }
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL CUSTOM YES/NO CONFIRMATION DIALOG FOR DAILY CASHBOOK JOURNAL ENTRY DELETION */}
      {cashbookToDelete && (
        <div id="cashbook-delete-dialog-overlay" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 w-full max-w-xs text-center transform scale-100 transition-all">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3.5 text-rose-500 animate-bounce animate-duration-1000">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              {lang === 'bn' ? 'ক্যাশবুক মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Cashbook Entry'}
            </h3>
            
            <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">
              {lang === 'bn' 
                ? `আপনি কি নিশ্চিতভাবে এই ক্যাশবুক হিসাব এন্ট্রিটি মুছে ফেলতে চান?\nবিবরণ: "${cashbookToDelete.note || 'মন্তব্য নেই'}" (${cashbookToDelete.type === 'IN' ? 'জমা' : 'খরচ'}, পরিমাণ: ${currency} ${cashbookToDelete.amount.toFixed(2)})`
                : `Are you sure you want to delete this cashbook journal entry?\nDetails: "${cashbookToDelete.note || 'No note'}" (${cashbookToDelete.type === 'IN' ? 'Cash In' : 'Cash Out'} of ${currency} ${cashbookToDelete.amount.toFixed(2)})`}
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setCashbookToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'না, বন্ধ করুন' : 'No, Cancel'}
              </button>
              <button
                onClick={() => {
                  if (cashbookToDelete) {
                    onDeleteCashbookEntry(cashbookToDelete.id);
                    setCashbookToDelete(null);
                  }
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL CUSTOM YES/NO CONFIRMATION DIALOG FOR RECHARGE REQUEST CANCELLATION */}
      {rechargeToCancel && (
        <div id="recharge-cancel-dialog-overlay" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 w-full max-w-xs text-center transform scale-100 transition-all animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3.5 text-rose-500 animate-bounce">
              <X className="w-6 h-6 text-rose-600" />
            </div>
            
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              {lang === 'bn' ? 'রিচার্জ অনুরোধ বাতিল নিশ্চিতকরণ' : 'Confirm Recharge Cancellation'}
            </h3>
            
            <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">
              {lang === 'bn' 
                ? `আপনি কি নিশ্চিতভাবে "${rechargeToCancel.customerName}" এর ${rechargeToCancel.method === 'bkash' ? 'বিকাশ' : rechargeToCancel.method === 'nagad' ? 'নগদ' : 'ফ্লেক্সিলোড'} রিচার্জ অনুরোধটি (পরিমাণ: ${currency} ${rechargeToCancel.amount.toFixed(2)}) বাতিল করতে চান?`
                : `Are you sure you want to cancel the ${rechargeToCancel.method === 'bkash' ? 'bKash' : rechargeToCancel.method === 'nagad' ? 'Nagad' : 'Flexiload'} recharge request for "${rechargeToCancel.customerName}" of amount ${currency} ${rechargeToCancel.amount.toFixed(2)}?`}
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setRechargeToCancel(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'না, বন্ধ করুন' : 'No, Cancel'}
              </button>
              <button
                onClick={() => {
                  if (rechargeToCancel) {
                    onCancelRechargeRequest?.(rechargeToCancel);
                    setRechargeToCancel(null);
                  }
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                {lang === 'bn' ? 'হ্যাঁ, বাতিল করুন' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL CUSTOM CHIP-BASED PIN MODIFICATION DIALOG POPUP */}
      {showPinChangeModal && (
        <div id="pin-change-dialog-overlay" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 w-full max-w-sm transform scale-100 transition-all">
            
            {/* Header branding */}
            <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 text-purple-950">
                <KeyRound className="w-4 h-4 text-purple-600 animate-pulse" />
                {lang === 'bn' ? 'নিরাপত্তা পিন কোড পরিবর্তন' : 'Change Security Passcode'}
              </h3>
              <button 
                onClick={() => setShowPinChangeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full hover:bg-slate-100 active:scale-90 transition-all shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Change PIN Form */}
            <form onSubmit={handlePinChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">
                  {lang === 'bn' ? 'বর্তমান ৪-সংখ্যার পিন:' : 'Current 4-digit PIN:'}
                </label>
                <input 
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  inputMode="numeric"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  required
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center text-sm font-black font-mono outline-none focus:border-purple-500 focus:bg-white transition-all tracking-[0.4em]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">
                  {lang === 'bn' ? 'নতুন ৪-সংখ্যার পিন:' : 'New 4-digit PIN:'}
                </label>
                <input 
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center text-sm font-black font-mono outline-none focus:border-purple-500 focus:bg-white transition-all tracking-[0.4em]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">
                  {lang === 'bn' ? 'নতুন পিন পুনরায় লিখুন:' : 'Confirm New PIN:'}
                </label>
                <input 
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center text-sm font-black font-mono outline-none focus:border-purple-500 focus:bg-white transition-all tracking-[0.4em]"
                />
              </div>

              {/* Status messages indicator */}
              {pinChangeError && (
                <p className="text-[10px] font-extrabold text-red-650 bg-red-50 border border-red-105 rounded-xl p-2.5 text-center leading-none">
                  ⚠️ {pinChangeError}
                </p>
              )}

              {pinChangeSuccess && (
                <p className="text-[10px] font-extrabold text-emerald-650 bg-emerald-50 border border-emerald-105 rounded-xl p-2.5 text-center leading-none animate-pulse">
                  ✅ {pinChangeSuccess}
                </p>
              )}

              {/* Submit Buttons */}
              <div className="pt-2.5 border-t border-slate-100 flex gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setShowPinChangeModal(false)}
                  className="flex-1 py-2 text-[10.5px] font-black text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 text-[10.5px] font-black text-white bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 rounded-xl shadow-md hover:shadow-lg transition-all uppercase tracking-wider cursor-pointer"
                >
                  {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Update PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL DATA BACKUP & RESTORE MODAL DIALOG */}
      {showBackupModal && (
        <div id="backup-modal-overlay" className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] animate-fade-in print:hidden select-none font-sans">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 w-full max-w-sm transform scale-100 transition-all flex flex-col max-h-[85vh]">
            
            {/* Header branding */}
            <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-slate-100 shrink-0">
              <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 text-purple-950">
                <Database className="w-4 h-4 text-purple-600 animate-pulse" />
                <span>{lang === 'bn' ? 'ডাটা ব্যাকআপ ও রিস্টোর' : 'Data Backup & Restore'}</span>
              </h3>
              <button 
                onClick={() => {
                  setShowBackupModal(false);
                  setImportStatus({ type: null, message: '' });
                }}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full hover:bg-slate-100 active:scale-90 transition-all shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="space-y-4 overflow-y-auto pr-1">
              {/* Option 1: Export Full Backup */}
              <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-2.5 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 leading-tight">
                      {lang === 'bn' ? '১. ডাটা ব্যাকআপ ডাউনলোড' : '1. Export Full Backup'}
                    </h4>
                    <p className="text-[9.5px] font-bold text-slate-500 mt-0.5 leading-snug">
                      {lang === 'bn' 
                        ? 'আপনার সকল কাস্টমার, লেনদেন, ক্যাশবুক ও পে-বিল ডাটার একটি সুরক্ষিত ফাইল সংরক্ষণ করুন।' 
                        : 'Download a safe .json backup file containing all your records.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportFullBackup}
                  className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-[11px] font-black tracking-wide flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'ব্যাকআপ ফাইল ডাউনলোড করুন' : 'Download Backup JSON'}</span>
                </button>
              </div>

              {/* Option 2: Restore from Backup */}
              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl space-y-2.5 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <UploadCloud className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 leading-tight">
                      {lang === 'bn' ? '২. পূর্বের ব্যাকআপ রিস্টোর' : '2. Restore from Backup'}
                    </h4>
                    <p className="text-[9.5px] font-bold text-slate-500 mt-0.5 leading-snug">
                      {lang === 'bn' 
                        ? 'পূর্বে ডাউনলোড করা .json ব্যাকআপ ফাইলটি আপলোড করে সহজেই তথ্য রিস্টোর করুন।' 
                        : 'Select a previously exported .json file to restore all your data.'}
                    </p>
                  </div>
                </div>

                <label className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100/80 active:scale-98 text-indigo-700 border-2 border-dashed border-indigo-300 hover:border-indigo-400 text-[11px] font-black tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'ব্যাকআপ ফাইল নির্বাচন করুন' : 'Choose Backup JSON File'}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportFullBackup}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Status & Feedback Indicator */}
              {importStatus.message && (
                <div className={`p-3 rounded-2xl border text-center text-xs font-bold leading-normal animate-fade-in ${
                  importStatus.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 animate-pulse'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  {importStatus.type === 'success' ? '✅ ' : '⚠️ '}
                  {importStatus.message}
                </div>
              )}

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-1.5 text-[9.5px] font-bold text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>{lang === 'bn' ? 'আপনার তথ্য সম্পূর্ণ সুরক্ষিত ও এনক্রিপ্টেড' : 'Your data is safe and encrypted'}</span>
              </div>
            </div>

            {/* Close Button */}
            <div className="pt-3 mt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowBackupModal(false);
                  setImportStatus({ type: null, message: '' });
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Zoom Image Modal Overlay */}
      {zoomedImage && (
        <div 
          id="zoom-image-overlay"
          className="fixed inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 z-[9999] backdrop-blur-md animate-fade-in print:hidden select-none font-sans"
          onClick={() => setZoomedImage(null)}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/35 active:scale-90 text-white p-2 rounded-full shadow-lg transition-all border border-white/20 cursor-pointer"
          >
            <X className="w-5 h-5 font-black text-white" />
          </button>

          {/* Photo Display Card */}
          <div 
            className="bg-white p-3 rounded-[32px] max-w-sm w-full shadow-2xl flex flex-col items-center gap-3 transform transition-all animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full h-[280px] rounded-[24px] overflow-hidden border border-slate-100 bg-slate-50 relative">
              <img 
                src={zoomedImage.url} 
                alt={zoomedImage.name} 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-xs font-black text-slate-800 tracking-wide text-center uppercase">
              {zoomedImage.name}
            </p>
          </div>
        </div>
      )}

      {/* Visual Toast Notification Overlay */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-4 right-4 z-[9999] max-w-xs mx-auto bg-slate-900 border border-slate-800 text-white p-3.5 rounded-2xl shadow-2xl flex items-start gap-2.5 font-sans leading-relaxed text-[11px] font-semibold"
          >
            <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shrink-0 text-slate-950 font-bold text-[10px]">
              i
            </div>
            <div className="flex-1 min-w-0">
              {toastMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OWNER SHOP MANAGEMENT MODAL */}
      {onSaveProduct && onDeleteProduct && (
        <ShopManagementModal 
          isOpen={showShopManagementModal}
          onClose={() => setShowShopManagementModal(false)}
          lang={lang}
          products={products}
          onSaveProduct={onSaveProduct}
          onDeleteProduct={onDeleteProduct}
          currency={currency}
          themeColor={themeColor}
        />
      )}

      {/* CHAT AUTO-REPLY & CANNED FAQS SETTINGS MODAL */}
      <ChatAutoReplySettingsModal 
        isOpen={showChatSettingsModal}
        onClose={() => setShowChatSettingsModal(false)}
        lang={lang}
        quickFaqs={quickFaqs || localQuickFaqs}
        onSaveQuickFaqs={handleSaveFaqs}
        themeColor={themeColor}
      />

    </div>
  );
}
