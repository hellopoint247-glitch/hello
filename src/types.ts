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
  isOnline?: boolean; // Indicates whether bill was entered online by customer
}

// Current application view state types
export type ActiveTab = 'customers' | 'paybill' | 'cashbook' | 'cashin';

export interface AccountRechargeRecord {
  id: string;
  amount: number;
  date: string; // ISO string e.g. "2026-09-03T16:00:00.000Z"
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CashInAccount {
  id: string;
  accountNumber: string; // e.g. "01783585858"
  accountName?: string; // e.g. "বিকাশ এজেন্ট", "নগদ সিম"
  balance: number; // current balance
  lastDigits: string; // last 4 digits (e.g. "5858")
  provider?: 'bkash' | 'nagad' | 'rocket' | 'upay' | 'other';
  rechargeHistory?: AccountRechargeRecord[]; // Balance recharge history records
  createdAt: string;
  updatedAt?: string;
}

export interface CashInTransaction {
  id: string;
  customerPhone: string;
  customerName?: string;
  amount: number;
  lastDigits: string; // The 4 digits entered by user to match agent account
  accountId?: string; // ID of the matched CashInAccount
  accountNumber?: string; // Full agent account number from which it was deducted
  accountName?: string;
  category?: 'bkash' | 'nagad' | 'flexiload' | 'own' | 'paybill' | 'other';
  isOwnNumberTransfer?: boolean;
  date: string; // e.g. "2026-08-30" or ISO
  createdAt: string;
  note?: string;
  paybillId?: string; // Associated paybill entry ID for automated bill payment tracking
}

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
  stockQuantity?: number; // Number of pieces in stock
  createdAt: string;
  updatedAt?: string;
}

export interface ShopCustomerAccount {
  id: string;
  name: string; // Acts as username
  phone: string; // Acts as password
  division?: string;
  district?: string;
  thana?: string;
  address: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ShopOrderItem {
  productId: string;
  name: string;
  productName?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  category?: string;
}

export interface ShopOrder {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  division?: string;
  district?: string;
  thana?: string;
  customerAddress: string;
  items: ShopOrderItem[];
  subtotal: number;
  deliveryCharge: number;
  advancePaidAmount?: number;
  dueOnDeliveryAmount?: number;
  totalAmount: number;
  transactionId?: string;
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'online' | 'advance_delivery';
  paymentStatus?: 'unpaid' | 'paid' | 'advance_paid';
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  note?: string;
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

export interface RemoteTypedNumberItem {
  id: string;
  number: string;
  createdAt: string;
}

export interface RemoteTypeState {
  liveNumber: string;
  isTyping: boolean;
  sentNumbers: RemoteTypedNumberItem[];
  updatedAt: string;
}
