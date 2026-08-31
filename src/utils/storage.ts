/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contact, Transaction, CashbookEntry, PayBillEntry, Product, ChatQuickFAQ, CashInAccount, CashInTransaction } from '../types';
import { safeLocalStorage as localStorage } from './safeStorage';

const CONTACTS_KEY = 'hellopoint_contacts';
const TRANSACTIONS_KEY = 'hellopoint_transactions';
const CASHBOOK_KEY = 'hellopoint_cashbook';
const PAYBILLS_KEY = 'hellopoint_paybills';
const CURRENCY_KEY = 'hellopoint_currency';
const PRODUCTS_KEY = 'hellopoint_products';
const QUICK_FAQS_KEY = 'hellopoint_quick_faqs';
const PAYBILL_ACCOUNTS_KEY = 'hellopoint_paybill_accounts';
const CASHIN_ACCOUNTS_KEY = 'hellopoint_cashin_accounts';
const CASHIN_TRANSACTIONS_KEY = 'hellopoint_cashin_transactions';

export const DEFAULT_PAYBILL_ACCOUNTS: string[] = [];

export const DEFAULT_QUICK_FAQS: ChatQuickFAQ[] = [
  {
    id: 'faq-1',
    question: 'দোকান কখন খোলা থাকে?',
    answer: 'আমাদের দোকান প্রতিদিন সকাল ৮:০০ টা থেকে রাত ১০:০০ টা পর্যন্ত নিয়মিত খোলা থাকে। আপনার যেকোনো প্রয়োজনে যোগাযোগ করতে পারেন।',
    active: true,
    icon: '🕒',
    createdAt: '2026-05-30T10:00:00Z'
  },
  {
    id: 'faq-2',
    question: 'বিকাশ/নগদ ক্যাশআউট চার্জ কত?',
    answer: 'আমাদের দোকানে বিকাশ ও নগদ ক্যাশআউট চার্জ অ্যাপ চার্জ অনুযায়ী অত্যন্ত সাশ্রয়ী রাখা হয়। সরাসরি দোকানে এসে সেবা নিতে পারেন।',
    active: true,
    icon: '💳',
    createdAt: '2026-05-30T10:05:00Z'
  },
  {
    id: 'faq-3',
    question: 'অনলাইন শপের পণ্য ডেলিভারি সুবিধা আছে কি?',
    answer: 'হ্যাঁ, আমাদের শপের পণ্য অর্ডার করলে দ্রুততম সময়ে হোম ডেলিভারি ও হ্যান্ড-টু-হ্যান্ড ডেলিভারি সুবিধা প্রদান করা হয়।',
    active: true,
    icon: '🛍️',
    createdAt: '2026-05-30T10:10:00Z'
  }
];

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'ফাস্ট চার্জিং টাইপ-সি ক্যাবল (65W Fast Cable)',
    price: 180,
    originalPrice: 250,
    description: 'উচ্চমানের ব্রেইডেড টাইপ-সি ক্যাবল, সুপার ফাস্ট চার্জিং এবং হাই স্পিড ডাটা ট্রান্সফার সাপোর্ট করে।',
    category: 'অ্যাক্সেসরিজ',
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60',
    inStock: true,
    createdAt: '2026-05-30T10:00:00Z'
  },
  {
    id: 'prod-2',
    name: 'অরিজিনাল পাওয়ার ব্যাংক (10000mAh Power Bank)',
    price: 850,
    originalPrice: 1100,
    description: 'ডুয়াল ইউএসবি আউটপুট সহ দীর্ঘস্থায়ী ব্যাটারি ব্যাকআপ, ট্রাভেল ফ্রেন্ডলি ও নিরাপদ।',
    category: 'গ্যাজেট',
    imageUrl: 'https://images.unsplash.com/photo-1609592424368-e6b8c9d2fbe5?w=500&auto=format&fit=crop&q=60',
    inStock: true,
    createdAt: '2026-05-30T11:00:00Z'
  },
  {
    id: 'prod-3',
    name: 'ওয়্যারলেস ব্লুটুথ এয়ারবাডস (TWS Earbuds)',
    price: 550,
    originalPrice: 750,
    description: 'ক্রিস্টাল ক্লিয়ার সাউন্ড কোয়ালিটি এবং ডিপ বাস, নয়েজ ক্যান্সেলেশন ও স্মার্ট টাচ কন্ট্রোল।',
    category: 'অডিও',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=60',
    inStock: true,
    createdAt: '2026-05-30T12:00:00Z'
  },
  {
    id: 'prod-4',
    name: 'প্রিমিয়াম স্মার্টওয়াচ (Smart Fitness Watch)',
    price: 1250,
    originalPrice: 1600,
    description: 'হার্ট রেট মনিটর, স্টেপ কাউন্টার, নোটিফিকেশন অ্যালার্ট এবং ওয়াটার রেজিস্ট্যান্ট বডি।',
    category: 'স্মার্ট ওয়াচ',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60',
    inStock: true,
    createdAt: '2026-05-30T13:00:00Z'
  }
];

// Pre-populated default pay bill entries to represent user's layout on first load
const DEFAULT_PAYBILLS: PayBillEntry[] = [
  {
    id: 'pb-1',
    billerNumber: '1006064391110',
    amount: 341.00,
    date: '2026-05-29',
    billerDetails: 'রহিছ আলী-৫৪৫৪',
    secondDate: '2026-05-22',
    note: '5454',
    isPaid: true,
    createdAt: '2026-05-29T10:00:00Z'
  },
  {
    id: 'pb-2',
    billerNumber: '1006064391840',
    amount: 823.00,
    date: '2026-05-29',
    billerDetails: 'কাদির -৭৭',
    secondDate: '2026-05-22',
    note: '77',
    isPaid: true,
    createdAt: '2026-05-29T11:20:00Z'
  },
  {
    id: 'pb-3',
    billerNumber: '1006064421500',
    amount: 2249.00,
    date: '2026-05-25',
    billerDetails: 'মিসবা',
    secondDate: '2026-05-23',
    note: '77',
    isPaid: false,
    createdAt: '2026-05-25T08:15:00Z'
  },
  {
    id: 'pb-4',
    billerNumber: '1006064421500',
    amount: 2249.00,
    date: '2026-05-25',
    billerDetails: 'মিসবা মিয়া',
    secondDate: '2026-05-23',
    note: '77',
    isPaid: true,
    createdAt: '2026-05-25T14:40:00Z'
  },
  {
    id: 'pb-5',
    billerNumber: '1006064501230',
    amount: 335.00,
    date: '2026-05-26',
    billerDetails: '-5464',
    secondDate: '2026-05-24',
    note: '5454',
    isPaid: false,
    createdAt: '2026-05-26T09:30:00Z'
  }
];

// Pre-populated data mirroring the user's screenshots
const DEFAULT_CONTACTS: Contact[] = [
  {
    id: 'abul-123',
    name: 'আবুল',
    phone: '01712345678',
    type: 'customer',
    createdAt: '2026-05-30T19:29:00Z',
    updatedAt: '2026-05-30T19:30:00Z'
  },
  {
    id: 'babul-456',
    name: 'বাবুল স্টোর (কাস্টমার)',
    phone: '01887654321',
    type: 'customer',
    createdAt: '2026-05-30T10:00:00Z',
    updatedAt: '2026-05-30T10:15:00Z'
  }
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  // Transactions for "আবুল" (corresponds to Screenshot 2)
  {
    id: 'tx-1',
    contactId: 'abul-123',
    amount: 200,
    type: 'GOT', // Green (Shop got cash from Abul)
    note: 'প্রথম কিস্তি জমা',
    billNo: 'B-101',
    date: '2026-05-30T19:29:00Z',
    createdAt: '2026-05-30T19:29:00Z'
  },
  {
    id: 'tx-2',
    contactId: 'abul-123',
    amount: 100,
    type: 'GOT', // Green (Shop got another 100)
    note: 'বকেয়া পরিশোধ',
    billNo: 'B-102',
    date: '2026-05-30T19:29:30Z',
    createdAt: '2026-05-30T19:29:30Z'
  },
  {
    id: 'tx-3',
    contactId: 'abul-123',
    amount: 200,
    type: 'GAVE', // Red (Shop gave Abul goods/cash)
    note: 'মালামাল কেনা বাবদ',
    billNo: 'B-103',
    date: '2026-05-30T19:30:00Z',
    createdAt: '2026-05-30T19:30:00Z'
  }
];

const DEFAULT_CASHBOOK: CashbookEntry[] = [
  {
    id: 'cb-1',
    amount: 500,
    type: 'IN',
    note: 'ক্যাশ জমা',
    date: '2026-05-30T09:00:00Z',
    createdAt: '2026-05-30T09:00:00Z'
  },
  {
    id: 'cb-2',
    amount: 200,
    type: 'OUT',
    note: 'গাড়ী ভাড়া',
    date: '2026-05-30T12:00:00Z',
    createdAt: '2026-05-30T12:00:00Z'
  }
];

export function getCurrency(): string {
  if (typeof window === 'undefined') return '৳';
  const val = localStorage.getItem(CURRENCY_KEY);
  return val || '৳'; // Default to Taka (৳). Users can easily toggle in settings!
}

export function saveCurrency(currency: string): void {
  localStorage.setItem(CURRENCY_KEY, currency);
}

export function loadContacts(): Contact[] {
  if (typeof window === 'undefined') return DEFAULT_CONTACTS;
  const raw = localStorage.getItem(CONTACTS_KEY);
  if (!raw) {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(DEFAULT_CONTACTS));
    return DEFAULT_CONTACTS;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_CONTACTS;
  }
}

export function saveContacts(contacts: Contact[]): void {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export function loadTransactions(): Transaction[] {
  if (typeof window === 'undefined') return DEFAULT_TRANSACTIONS;
  const raw = localStorage.getItem(TRANSACTIONS_KEY);
  if (!raw) {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(DEFAULT_TRANSACTIONS));
    return DEFAULT_TRANSACTIONS;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_TRANSACTIONS;
  }
}

export function saveTransactions(txs: Transaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txs));
}

export function loadCashbook(): CashbookEntry[] {
  if (typeof window === 'undefined') return DEFAULT_CASHBOOK;
  const raw = localStorage.getItem(CASHBOOK_KEY);
  if (!raw) {
    localStorage.setItem(CASHBOOK_KEY, JSON.stringify(DEFAULT_CASHBOOK));
    return DEFAULT_CASHBOOK;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_CASHBOOK;
  }
}

export function saveCashbook(entries: CashbookEntry[]): void {
  localStorage.setItem(CASHBOOK_KEY, JSON.stringify(entries));
}

export function loadPayBills(): PayBillEntry[] {
  if (typeof window === 'undefined') return DEFAULT_PAYBILLS;
  const raw = localStorage.getItem(PAYBILLS_KEY);
  if (!raw) {
    localStorage.setItem(PAYBILLS_KEY, JSON.stringify(DEFAULT_PAYBILLS));
    return DEFAULT_PAYBILLS;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_PAYBILLS;
  }
}

export function savePayBills(entries: PayBillEntry[]): void {
  localStorage.setItem(PAYBILLS_KEY, JSON.stringify(entries));
}

export function loadProducts(): Product[] {
  if (typeof window === 'undefined') return DEFAULT_PRODUCTS;
  const raw = localStorage.getItem(PRODUCTS_KEY);
  if (raw === null || raw === undefined) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
    return DEFAULT_PRODUCTS;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_PRODUCTS;
  } catch (e) {
    return DEFAULT_PRODUCTS;
  }
}

export function saveProducts(products: Product[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    window.dispatchEvent(new Event('storage'));
  }
}

export function loadQuickFaqs(): ChatQuickFAQ[] {
  if (typeof window === 'undefined') return DEFAULT_QUICK_FAQS;
  const raw = localStorage.getItem(QUICK_FAQS_KEY);
  if (raw === null || raw === undefined) {
    localStorage.setItem(QUICK_FAQS_KEY, JSON.stringify(DEFAULT_QUICK_FAQS));
    return DEFAULT_QUICK_FAQS;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_QUICK_FAQS;
  } catch (e) {
    return DEFAULT_QUICK_FAQS;
  }
}

export function saveQuickFaqs(faqs: ChatQuickFAQ[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(QUICK_FAQS_KEY, JSON.stringify(faqs));
    window.dispatchEvent(new Event('storage'));
  }
}

const LEGACY_PRESET_TAGS = [
  'বিকাশ (bkash)',
  'নগদ (nagad)',
  'রকেট (rocket)',
  'উপায় (upay)',
  'ইসলামী ব্যাংক',
  'সিটি ব্যাংক',
  'ডাচ বাংলা ব্যাংক',
  'bkash',
  'nagad',
  'rocket',
  'upay'
];

export function loadSavedPayBillAccounts(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(PAYBILL_ACCOUNTS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Clean out any legacy pre-filled default tags
    return parsed.filter((item: string) => {
      if (typeof item !== 'string') return false;
      const lower = item.trim().toLowerCase();
      return !LEGACY_PRESET_TAGS.includes(lower);
    });
  } catch (e) {
    return [];
  }
}

export function saveSavedPayBillAccounts(accounts: string[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PAYBILL_ACCOUNTS_KEY, JSON.stringify(accounts));
  }
}

export function addSavedPayBillAccount(account: string): string[] {
  const clean = account.trim();
  if (!clean) return loadSavedPayBillAccounts();
  const current = loadSavedPayBillAccounts();
  if (!current.some(a => a.toLowerCase() === clean.toLowerCase())) {
    const updated = [clean, ...current];
    saveSavedPayBillAccounts(updated);
    return updated;
  }
  return current;
}

// Calculate summary statistics for custom list/suppliers
export function getContactSummary(contactId: string, transactions: Transaction[]) {
  const contactTxs = transactions.filter(t => t.contactId === contactId);
  const totalGave = contactTxs.filter(t => t.type === 'GAVE').reduce((sum, t) => sum + t.amount, 0);
  const totalGot = contactTxs.filter(t => t.type === 'GOT').reduce((sum, t) => sum + t.amount, 0);
  
  // Balance: Negative if we owe them (totalGot > totalGave) (You will give / আপনি পাবেন)
  // Or positive if they owe us (totalGave > totalGot) (You will get / কাস্টমার আপনাকে দেবে)
  const balance = totalGave - totalGot; 
  return {
    totalGave,
    totalGot,
    balance,
    entryCount: contactTxs.length
  };
}

export function loadCashInAccounts(): CashInAccount[] {
  try {
    const data = localStorage.getItem(CASHIN_ACCOUNTS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load cashin accounts', e);
    return [];
  }
}

export function saveCashInAccounts(accounts: CashInAccount[]): void {
  try {
    localStorage.setItem(CASHIN_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save cashin accounts', e);
  }
}

export function loadCashInTransactions(): CashInTransaction[] {
  try {
    const data = localStorage.getItem(CASHIN_TRANSACTIONS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load cashin transactions', e);
    return [];
  }
}

export function saveCashInTransactions(txs: CashInTransaction[]): void {
  try {
    localStorage.setItem(CASHIN_TRANSACTIONS_KEY, JSON.stringify(txs));
  } catch (e) {
    console.error('Failed to save cashin transactions', e);
  }
}

