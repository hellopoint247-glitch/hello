/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Contact, Transaction, CashbookEntry, PayBillEntry, Product, ChatQuickFAQ, CashInAccount, CashInTransaction, ShopOrder, ShopCustomerAccount, CustomerLoginNotification } from '../types';
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
const SHOP_ORDERS_KEY = 'hellopoint_shop_orders';
const SHOP_CUSTOMERS_KEY = 'hellopoint_shop_customers';
const CUSTOMER_LOGINS_KEY = 'hellopoint_customer_logins';

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
    stockQuantity: 25,
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
    stockQuantity: 12,
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
    stockQuantity: 18,
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
    stockQuantity: 10,
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

// Pre-populated data restoring and safeguarding the store's actual customers
export const DEFAULT_CONTACTS: Contact[] = [
  {
    "updatedAt": "2026-10-16T15:33:23.324Z",
    "id": "contact-1780380842335",
    "name": "কাস্টমার (01728549509)",
    "phone": "01728549509",
    "type": "customer",
    "createdAt": "2026-06-02T06:14:08.597Z"
  },
  {
    "phone": "",
    "name": "আনোয়ার / কাদির",
    "type": "customer",
    "createdAt": "2026-06-22T05:28:17.822Z",
    "updatedAt": "2026-10-16T15:29:04.820Z",
    "id": "contact-1781158297091"
  },
  {
    "createdAt": "2026-09-22T12:29:42.121Z",
    "id": "contact-1781962173615",
    "phone": "01646295564",
    "type": "customer",
    "name": "রুবেল / কাস্টমার",
    "updatedAt": "2026-10-16T15:27:23.292Z"
  },
  {
    "createdAt": "2026-06-04T15:23:13.450Z",
    "phone": "01736187764",
    "id": "contact-1780586354959",
    "updatedAt": "2026-10-15T14:35:41.601Z",
    "name": "দৈনিক লোড গ্রাহক",
    "type": "customer"
  },
  {
    "createdAt": "2026-10-03T04:08:24.345Z",
    "phone": "01743258998",
    "id": "contact-1780469182390",
    "type": "customer",
    "name": "পুলক দা (Pulok Da)",
    "updatedAt": "2026-10-14T15:55:16.351Z"
  },
  {
    "phone": "",
    "name": "দোকান খরচ / গ্রাহক",
    "createdAt": "2026-06-04T15:36:48.396Z",
    "type": "customer",
    "id": "contact-1780587389441",
    "updatedAt": "2026-10-14T14:50:55.807Z"
  },
  {
    "type": "customer",
    "id": "contact-1780847819011",
    "name": "দোকান সামগ্রী হিসাব",
    "createdAt": "2026-09-04T13:29:00.118Z",
    "phone": "",
    "updatedAt": "2026-10-14T10:54:55.335Z"
  },
  {
    "id": "contact-1780238095178",
    "updatedAt": "2026-10-14T10:52:37.870Z",
    "type": "customer",
    "phone": "",
    "name": "ওয়াইফাই গ্রাহক (WiFi)",
    "createdAt": "2026-05-31T14:35:05.618Z"
  },
  {
    "updatedAt": "2026-10-14T10:52:22.913Z",
    "createdAt": "2026-05-31T09:14:23.048Z",
    "id": "contact-1780218847616",
    "name": "শাফি (Shafii)",
    "phone": "",
    "type": "customer"
  },
  {
    "createdAt": "2026-05-31T13:33:07.021Z",
    "phone": "01774466423",
    "id": "contact-1780218997441",
    "updatedAt": "2026-10-14T10:51:34.524Z",
    "type": "customer",
    "name": "ব্যাংক হিসাব (Bank)"
  },
  {
    "createdAt": "2026-09-26T06:49:32.678Z",
    "id": "contact-1788183599584",
    "type": "customer",
    "phone": "",
    "name": "আজিদ",
    "updatedAt": "2026-10-14T04:37:18.582Z"
  },
  {
    "createdAt": "2026-10-13T15:20:04.977Z",
    "id": "contact-1791904804977",
    "updatedAt": "2026-10-13T15:23:34.194Z",
    "name": "deu2",
    "phone": "",
    "type": "customer"
  },
  {
    "name": "deu",
    "type": "customer",
    "phone": "",
    "createdAt": "2026-10-13T15:16:49.731Z",
    "id": "contact-1791904609731",
    "updatedAt": "2026-10-13T15:19:10.302Z"
  },
  {
    "createdAt": "2026-10-13T15:01:47.764Z",
    "type": "customer",
    "phone": "",
    "name": "Fojlu",
    "id": "contact-1791903707764",
    "updatedAt": "2026-10-13T15:02:34.893Z"
  },
  {
    "createdAt": "2026-10-13T14:52:37.957Z",
    "phone": "",
    "id": "contact-1780231090350",
    "updatedAt": "2026-10-13T14:52:37.957Z",
    "type": "customer",
    "name": "বিকাশ"
  },
  {
    "updatedAt": "2026-10-13T13:32:19.748Z",
    "phone": "",
    "name": "এম্বি",
    "id": "contact-1780839912656",
    "type": "customer",
    "createdAt": "2026-06-07T13:45:21.539Z"
  },
  {
    "phone": "01810848021",
    "createdAt": "2026-09-20T12:08:30.306Z",
    "name": "বিকাশ কাস্টমার",
    "type": "customer",
    "id": "contact-1781158271230",
    "updatedAt": "2026-10-13T05:06:36.373Z"
  },
  {
    "createdAt": "2026-10-13T04:59:53.716Z",
    "updatedAt": "2026-10-13T05:03:29.071Z",
    "id": "contact-1782991942331",
    "phone": "",
    "name": "হালিমা বেগম / আজাদ",
    "type": "customer"
  },
  {
    "createdAt": "2026-06-04T13:52:31.865Z",
    "phone": "01795485049",
    "id": "contact-1780581125756",
    "updatedAt": "2026-10-12T15:32:45.751Z",
    "type": "customer",
    "name": "মসজিদ হিসাব"
  },
  {
    "id": "contact-1780839584559",
    "type": "customer",
    "createdAt": "2026-10-12T13:41:41.655Z",
    "name": "খরচ",
    "phone": "",
    "updatedAt": "2026-10-12T13:41:41.655Z"
  },
  {
    "type": "customer",
    "phone": "",
    "name": "ফ্লেক্সিলোড",
    "id": "contact-1782658551655",
    "createdAt": "2026-10-02T14:21:52.069Z",
    "updatedAt": "2026-10-12T13:39:29.800Z"
  },
  {
    "updatedAt": "2026-10-11T11:54:04.135Z",
    "id": "contact-1787842201733",
    "type": "customer",
    "name": "মামুন (Mamun)",
    "phone": "",
    "createdAt": "2026-09-30T13:57:38.672Z"
  },
  {
    "createdAt": "2026-10-08T08:12:32.180Z",
    "phone": "",
    "id": "contact-1782395254210",
    "type": "customer",
    "updatedAt": "2026-10-11T05:19:43.876Z",
    "name": "মেজো ভাই / ভাবি"
  },
  {
    "type": "customer",
    "id": "contact-1780413132021",
    "phone": "",
    "createdAt": "2026-09-06T15:03:00.948Z",
    "name": "রুবেল (গাড়ি)",
    "updatedAt": "2026-10-10T08:09:52.812Z"
  },
  {
    "id": "contact-1781535671825",
    "createdAt": "2026-08-21T14:54:18.323Z",
    "type": "customer",
    "name": "খালেদ / রুয়েল",
    "phone": "",
    "updatedAt": "2026-10-10T07:35:58.174Z"
  },
  {
    "id": "contact-1780242059599",
    "phone": "",
    "createdAt": "2026-05-31T15:41:36.559Z",
    "updatedAt": "2026-10-10T07:06:29.432Z",
    "type": "customer",
    "name": "ওয়াইফাই / বিকাশ গ্রাহক"
  },
  {
    "phone": "01715860095",
    "updatedAt": "2026-10-10T07:05:28.429Z",
    "name": "ওয়াইফাই / বিকাশ গ্রাহক",
    "id": "contact-1780849087969",
    "createdAt": "2026-06-07T16:18:17.537Z",
    "type": "customer"
  },
  {
    "phone": "01617845581",
    "updatedAt": "2026-10-09T16:26:48.009Z",
    "type": "customer",
    "id": "contact-1780832630181",
    "name": "কাস্টমার (01617845581)",
    "createdAt": "2026-06-07T11:48:15.062Z"
  },
  {
    "createdAt": "2026-09-30T13:59:59.427Z",
    "id": "contact-1780247821312",
    "phone": "",
    "type": "customer",
    "name": "আক্কাস ভাই",
    "updatedAt": "2026-10-09T13:02:52.941Z"
  },
  {
    "createdAt": "2026-07-06T16:11:35.486Z",
    "phone": "",
    "name": "সাবেক",
    "type": "customer",
    "id": "contact-1783354281781",
    "updatedAt": "2026-10-09T03:42:00.581Z"
  },
  {
    "updatedAt": "2026-10-09T03:16:32.161Z",
    "name": "mitul",
    "type": "customer",
    "phone": "",
    "createdAt": "2026-09-22T14:48:38.879Z",
    "id": "contact-1790088518879"
  },
  {
    "id": "contact-1781967447774",
    "phone": "01762585267",
    "createdAt": "2026-06-20T14:57:55.788Z",
    "updatedAt": "2026-10-08T07:40:35.514Z",
    "type": "customer",
    "name": "কাস্টমার (01762585267)"
  },
  {
    "id": "contact-1782543777665",
    "type": "customer",
    "updatedAt": "2026-10-08T07:27:03.769Z",
    "name": "রাজু ভাই",
    "phone": "",
    "createdAt": "2026-06-27T07:03:15.076Z"
  },
  {
    "phone": "",
    "createdAt": "2026-06-21T09:20:33.358Z",
    "updatedAt": "2026-10-07T15:28:03.283Z",
    "name": "সুরামান আলি",
    "id": "contact-1782033613203",
    "type": "customer"
  },
  {
    "createdAt": "2026-09-14T15:16:06.062Z",
    "updatedAt": "2026-10-07T15:27:51.929Z",
    "name": "ফ্লেক্সিলোড",
    "phone": "",
    "id": "contact-1780314008322",
    "type": "customer"
  },
  {
    "type": "customer",
    "phone": "01749913041",
    "name": "সিয়াম (Siam)",
    "createdAt": "2026-06-07T11:46:28.758Z",
    "id": "contact-1780832725974",
    "updatedAt": "2026-10-07T08:40:53.318Z"
  },
  {
    "updatedAt": "2026-10-04T13:47:39.238Z",
    "id": "contact-1784900421959",
    "type": "customer",
    "name": "বিকাশ",
    "phone": "",
    "createdAt": "2026-09-28T07:28:57.941Z"
  },
  {
    "name": "omna",
    "type": "customer",
    "phone": "",
    "createdAt": "2026-10-03T15:28:26.424Z",
    "updatedAt": "2026-10-03T15:28:26.424Z",
    "id": "contact-1781508194169"
  },
  {
    "id": "contact-1782129239024",
    "updatedAt": "2026-09-30T16:38:58.621Z",
    "type": "customer",
    "createdAt": "2026-06-22T11:56:10.126Z",
    "name": "রুয়েল",
    "phone": ""
  },
  {
    "name": "বিদ্যুৎ বিল / বিকাশ",
    "type": "customer",
    "createdAt": "2026-06-15T07:20:34.311Z",
    "phone": "01710187721",
    "updatedAt": "2026-09-29T12:27:53.702Z",
    "id": "contact-1781508007242"
  },
  {
    "createdAt": "2026-06-21T09:44:50.758Z",
    "phone": "",
    "id": "contact-1782034409798",
    "type": "customer",
    "name": "ফ্লেক্সিলোড",
    "updatedAt": "2026-09-28T16:06:37.768Z"
  },
  {
    "type": "customer",
    "updatedAt": "2026-09-28T05:35:58.502Z",
    "name": "এম্বি",
    "phone": "",
    "id": "contact-1787492756370",
    "createdAt": "2026-08-23T13:46:25.350Z"
  },
  {
    "phone": "",
    "createdAt": "2026-09-16T08:15:52.042Z",
    "updatedAt": "2026-09-27T14:04:37.173Z",
    "id": "contact-1785656651477",
    "name": "টান্ডা",
    "type": "customer"
  },
  {
    "name": "Moklis, sundor",
    "updatedAt": "2026-09-26T12:21:05.710Z",
    "type": "customer",
    "phone": "",
    "createdAt": "2026-09-23T12:07:37.281Z",
    "id": "contact-1790165257281"
  },
  {
    "phone": "",
    "createdAt": "2026-09-03T14:45:04.248Z",
    "type": "customer",
    "name": "ফলিক (বিদ্যুৎ বিল)",
    "id": "contact-1788446692450",
    "updatedAt": "2026-09-26T04:12:38.319Z"
  },
  {
    "type": "customer",
    "id": "contact-1782184131461",
    "createdAt": "2026-06-23T03:09:18.383Z",
    "phone": "",
    "name": "শেফার",
    "updatedAt": "2026-09-23T14:39:36.503Z"
  },
  {
    "phone": "",
    "createdAt": "2026-09-08T06:13:15.243Z",
    "updatedAt": "2026-09-22T14:38:28.136Z",
    "name": "জেনি / জুলির জামাই",
    "id": "contact-1788847964910",
    "type": "customer"
  },
  {
    "updatedAt": "2026-09-20T17:26:27.648Z",
    "id": "contact-1789661021557",
    "phone": "",
    "type": "customer",
    "createdAt": "2026-09-17T16:03:41.557Z",
    "name": "layes"
  },
  {
    "phone": "01712497482",
    "id": "contact-1781792422609",
    "type": "customer",
    "updatedAt": "2026-09-20T12:17:58.163Z",
    "name": "কাস্টমার (01712497482)",
    "createdAt": "2026-06-18T14:20:35.108Z"
  },
  {
    "id": "contact-1783229692732",
    "createdAt": "2026-07-05T05:35:02.292Z",
    "type": "customer",
    "name": "তাজুল মামা",
    "updatedAt": "2026-09-20T11:50:31.102Z",
    "phone": "01746943653"
  },
  {
    "updatedAt": "2026-09-19T13:15:59.167Z",
    "type": "customer",
    "phone": "",
    "name": "নিজ",
    "id": "contact-1780483284216",
    "createdAt": "2026-09-19T13:15:59.167Z"
  },
  {
    "createdAt": "2026-08-29T14:55:08.403Z",
    "id": "contact-1788015208475",
    "phone": "",
    "type": "customer",
    "name": "আইপিএস ও মালামাল হিসাব",
    "updatedAt": "2026-09-15T12:06:47.602Z"
  },
  {
    "name": "এম্বি+মিনিট",
    "type": "customer",
    "createdAt": "2026-07-01T11:08:57.447Z",
    "id": "contact-1780323831243",
    "updatedAt": "2026-09-10T12:14:50.924Z",
    "phone": ""
  },
  {
    "updatedAt": "2026-09-09T12:06:47.754Z",
    "phone": "01711467107",
    "id": "contact-1780218107844",
    "type": "customer",
    "createdAt": "2026-09-09T12:06:47.754Z",
    "name": "বিকাশ কাস্টমার"
  },
  {
    "createdAt": "2026-09-06T02:37:27.401Z",
    "id": "contact-1788662235448",
    "phone": "",
    "type": "customer",
    "updatedAt": "2026-09-06T02:37:36.927Z",
    "name": "এম্বি"
  },
  {
    "type": "customer",
    "id": "contact-1787663352980",
    "name": "জুস",
    "updatedAt": "2026-08-28T12:10:17.358Z",
    "phone": "",
    "createdAt": "2026-08-25T13:09:22.902Z"
  },
  {
    "createdAt": "2026-06-21T07:04:12.521Z",
    "phone": "",
    "id": "contact-1782025054015",
    "type": "customer",
    "name": "ক্যাশ জমা",
    "updatedAt": "2026-08-22T08:16:54.274Z"
  },
  {
    "id": "contact-1780731327631",
    "type": "customer",
    "createdAt": "2026-06-06T07:35:34.170Z",
    "name": "পারিবারিক হিসাব",
    "phone": "",
    "updatedAt": "2026-08-05T14:16:47.788Z"
  },
  {
    "type": "customer",
    "id": "contact-1783229532724",
    "createdAt": "2026-07-05T05:33:21.745Z",
    "name": "সাবেক",
    "phone": "",
    "updatedAt": "2026-07-05T05:33:21.745Z"
  },
  {
    "updatedAt": "2026-06-30T15:58:27.317Z",
    "name": "এম্বি+মিনিট",
    "type": "customer",
    "phone": "",
    "id": "contact-1780591717918",
    "createdAt": "2026-06-04T16:48:51.499Z"
  },
  {
    "phone": "",
    "type": "customer",
    "id": "contact-1780239727147",
    "name": "মিনিট",
    "updatedAt": "2026-06-30T14:28:27.361Z",
    "createdAt": "2026-05-31T15:02:16.897Z"
  },
  {
    "createdAt": "2026-06-02T14:58:33.764Z",
    "name": "bill",
    "type": "customer",
    "updatedAt": "2026-06-02T14:58:33.764Z",
    "id": "contact-1780412300050",
    "phone": ""
  },
  {
    "id": "contact-1780244039610",
    "createdAt": "2026-05-31T16:14:08.736Z",
    "type": "customer",
    "phone": "",
    "updatedAt": "2026-05-31T16:14:16.313Z",
    "name": "mb"
  },
  {
    "updatedAt": "2026-05-31T13:32:02.348Z",
    "id": "contact-1780219010807",
    "type": "customer",
    "name": "mb",
    "createdAt": "2026-05-31T13:32:02.348Z",
    "phone": ""
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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(DEFAULT_CONTACTS));
      return DEFAULT_CONTACTS;
    }
    return parsed;
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
    setTimeout(() => {
      window.dispatchEvent(new Event('storage'));
    }, 0);
  }
}

export function loadShopOrders(): ShopOrder[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(SHOP_ORDERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveShopOrders(orders: ShopOrder[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SHOP_ORDERS_KEY, JSON.stringify(orders));
    setTimeout(() => {
      window.dispatchEvent(new Event('storage'));
    }, 0);
  }
}

export function loadShopCustomers(): ShopCustomerAccount[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(SHOP_CUSTOMERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveShopCustomers(customers: ShopCustomerAccount[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SHOP_CUSTOMERS_KEY, JSON.stringify(customers));
    setTimeout(() => {
      window.dispatchEvent(new Event('storage'));
    }, 0);
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
    setTimeout(() => {
      window.dispatchEvent(new Event('storage'));
    }, 0);
  }
}

export function loadCustomerLoginNotifications(): CustomerLoginNotification[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(CUSTOMER_LOGINS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveCustomerLoginNotifications(logins: CustomerLoginNotification[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CUSTOMER_LOGINS_KEY, JSON.stringify(logins.slice(0, 50)));
    setTimeout(() => {
      window.dispatchEvent(new Event('storage'));
    }, 0);
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
    if (!Array.isArray(parsed)) return [];

    // Auto-prune recharge history older than 3 months without altering current account balance
    const now = new Date();
    const oldestAllowedDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const oldestAllowedKey = `${oldestAllowedDate.getFullYear()}-${String(oldestAllowedDate.getMonth() + 1).padStart(2, '0')}`;

    let accountsModified = false;
    const cleaned = parsed.map((acc: CashInAccount) => {
      if (!acc.rechargeHistory || acc.rechargeHistory.length === 0) return acc;
      const validHistory = acc.rechargeHistory.filter(r => {
        const dStr = r.date || r.createdAt || '';
        const mKey = dStr.length >= 7 ? dStr.substring(0, 7) : '';
        return !mKey || mKey >= oldestAllowedKey;
      });
      if (validHistory.length !== acc.rechargeHistory.length) {
        accountsModified = true;
        return { ...acc, rechargeHistory: validHistory };
      }
      return acc;
    });

    if (accountsModified) {
      saveCashInAccounts(cleaned);
    }
    return cleaned;
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
    if (!Array.isArray(parsed)) return [];

    // Auto-prune Cash In transactions older than 3 months (Current month + previous 2 months)
    const now = new Date();
    const oldestAllowedDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const oldestAllowedKey = `${oldestAllowedDate.getFullYear()}-${String(oldestAllowedDate.getMonth() + 1).padStart(2, '0')}`;

    const validTxs = parsed.filter((tx: CashInTransaction) => {
      const dStr = tx.date || tx.createdAt || '';
      const mKey = dStr.length >= 7 ? dStr.substring(0, 7) : '';
      return !mKey || mKey >= oldestAllowedKey;
    });

    if (validTxs.length !== parsed.length) {
      saveCashInTransactions(validTxs);
    }
    return validTxs;
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

/**
 * Match a given last number or account string against registered Cash-In accounts.
 * Strictly matches:
 * 1. Exact match with account's registered lastDigits (e.g. "5454" === "5454")
 * 2. Or the account's full phone number ends with the entered lastDigits (e.g. "017...5454" ends with "5454")
 * 3. Or full phone number exact match
 * Does NOT do loose substring inclusion to prevent unrelated SIMs from falsely matching.
 */
export function findMatchingCashInAccount(
  accountOrLastDigits: string | undefined | null,
  accounts: CashInAccount[]
): CashInAccount | undefined {
  if (!accountOrLastDigits || !accounts || accounts.length === 0) return undefined;
  const clean = accountOrLastDigits.trim().replace(/\D/g, '');
  if (!clean) return undefined;

  // 1. Direct exact match by registered lastDigits
  let matched = accounts.find(acc => {
    const accLast = (acc.lastDigits || '').trim().replace(/\D/g, '');
    return accLast.length > 0 && accLast === clean;
  });
  if (matched) return matched;

  // 2. Direct exact match by full account number
  matched = accounts.find(acc => {
    const accDigits = (acc.accountNumber || '').trim().replace(/\D/g, '');
    return accDigits.length > 0 && accDigits === clean;
  });
  if (matched) return matched;

  // 3. Match if the account number ends with the entered lastDigits (e.g., entered 4 digits matching last 4 digits of phone)
  if (clean.length >= 3) {
    matched = accounts.find(acc => {
      const accDigits = (acc.accountNumber || '').trim().replace(/\D/g, '');
      return accDigits.length >= clean.length && accDigits.endsWith(clean);
    });
    if (matched) return matched;
  }

  return undefined;
}

