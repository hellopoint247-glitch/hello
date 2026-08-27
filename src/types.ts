/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'customer' | 'supplier';
  createdAt: string;
  updatedAt: string;
  photoUrl?: string;
}

export type TransactionType = 'GAVE' | 'GOT';

export interface Transaction {
  id: string;
  contactId: string;
  amount: number;
  type: TransactionType;
  note: string;
  billNo: string;
  date: string; // ISO date string or custom string representing transaction day
  attachFile?: string; // Base64 data url of attached image
  signature?: string; // Base64 data url of dynamic signature drawing
  createdAt: string;
  cashbookEntryId?: string; // Optional link to a cashbook entry
}

export interface CashbookEntry {
  id: string;
  amount: number;
  type: 'IN' | 'OUT'; // IN is direct cash-in-hand entry, OUT is cash-out-hand entry
  note: string;
  date: string;
  createdAt: string;
  contactId?: string; // Optional link to a customer/supplier
  transactionId?: string; // Optional link to a customer/supplier transaction
}

export interface PayBillEntry {
  id: string;
  billerNumber: string;
  amount: number;
  date: string; // e.g. "May 29, 2026" or "2026-05-29"
  billerDetails: string; // e.g., "রহিছ আলী-৫৪৫৪" (Client Name / Details)
  secondDate: string; // e.g., "May 22, 2026" or "2026-05-22"
  note: string; // Memo number / comment (e.g., "5454", "77", etc.)
  isPaid: boolean; // Checked or unchecked status matching screenshot
  createdAt: string;
  paidAt?: string;
  paidInfo?: string;
  paidAccount?: string; // Bank Name or Account Last digits (e.g., "বিকাশ - ০১৭১২...", "City Bank")
  contactId?: string; // Optional link to a customer/supplier
}

// Current application view state types
export type ActiveTab = 'customers' | 'paybill' | 'cashbook';

export type ScreenState = 
  | { type: 'dashboard' }
  | { type: 'contact_detail'; contactId: string }
  | { type: 'transaction_form'; contactId: string; transactionId?: string; isGaveMode: boolean };

export interface SignUpRequest {
  id: string;
  name: string;
  phone: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  photoUrl?: string; // Optional customer photo URL during signup onboarding
}

export interface RechargeRequest {
  id: string;
  contactId: string;
  customerName: string;
  rechargePhone: string;
  amount: number;
  method: 'bkash' | 'nagad' | 'flexiload';
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface PayBillRequest {
  id: string;
  contactId: string;
  customerName: string;
  billerNumber: string;
  amount: number;
  billerDetails: string;
  secondDate: string;
  phone: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  serialNumber?: string;
}

export interface ChatMessage {
  id: string;
  contactId: string;
  senderRole: 'owner' | 'customer';
  senderName: string;
  senderPhone?: string;
  text: string;
  readByOwner: boolean;
  readByCustomer: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  category?: string;
  imageUrl?: string;
  images?: string[]; // Up to 4 product photos
  inStock: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatQuickFAQ {
  id: string;
  question: string;
  answer: string;
  active: boolean;
  icon?: string;
  createdAt?: string;
}

