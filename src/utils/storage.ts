/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contact, Transaction, CashbookEntry, PayBillEntry, TrashTransaction } from '../types';
import { safeLocalStorage as localStorage } from './safeStorage';

const CONTACTS_KEY = 'hellopoint_contacts';
const TRANSACTIONS_KEY = 'hellopoint_transactions';
const CASHBOOK_KEY = 'hellopoint_cashbook';
const PAYBILLS_KEY = 'hellopoint_paybills';
const CURRENCY_KEY = 'hellopoint_currency';
const TRASH_KEY = 'hellopoint_trash_transactions';

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

export function loadTrashTransactions(): TrashTransaction[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(TRASH_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveTrashTransactions(items: TrashTransaction[]): void {
  localStorage.setItem(TRASH_KEY, JSON.stringify(items));
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
