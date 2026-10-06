import React, { useState, useEffect } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { Lock, ShieldCheck, X, KeyRound, ArrowRight, ArrowLeft, UserPlus, User, Users, Phone, Clock, Camera, Trash2, MessageCircle, ShoppingBag, Radio } from 'lucide-react';
import { Contact, Product, ChatMessage, ChatQuickFAQ, ShopOrder, ShopCustomerAccount, RemoteTypeState } from '../types';

export interface RememberedCustomer {
  id: string;
  name: string;
  phone: string;
}

const getStoredRememberedCustomers = (): RememberedCustomer[] => {
  try {
    let raw = localStorage.getItem('hellopoint_remembered_customers');
    if (!raw && typeof window !== 'undefined' && window.localStorage) {
      raw = window.localStorage.getItem('hellopoint_remembered_customers');
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(item => item && (item.id || item.phone));
        if (valid.length > 0) {
          return valid.slice(0, 2);
        }
      }
    }
  } catch {
    // ignore
  }

  // Backwards compatibility migration from legacy single remembered customer
  try {
    const legacyId = localStorage.getItem('hellopoint_remembered_cust_id') || 
      (typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('hellopoint_remembered_cust_id') : null);
    const legacyName = localStorage.getItem('hellopoint_remembered_cust_name') || 
      (typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('hellopoint_remembered_cust_name') : null);
    const legacyNum = localStorage.getItem('hellopoint_remembered_cust_num') || 
      (typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('hellopoint_remembered_cust_num') : null);
    if (legacyId && legacyName && legacyNum) {
      const single = [{ id: legacyId, name: legacyName, phone: legacyNum }];
      saveRememberedList(single);
      return single;
    }
  } catch {
    // ignore
  }

  return [];
};

const saveRememberedList = (list: RememberedCustomer[]) => {
  try {
    const capped = list.slice(0, 2);
    const serialized = JSON.stringify(capped);
    if (capped.length === 0) {
      localStorage.removeItem('hellopoint_remembered_customers');
      localStorage.removeItem('hellopoint_remembered_cust_id');
      localStorage.removeItem('hellopoint_remembered_cust_name');
      localStorage.removeItem('hellopoint_remembered_cust_num');
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('hellopoint_remembered_customers');
        window.localStorage.removeItem('hellopoint_remembered_cust_id');
        window.localStorage.removeItem('hellopoint_remembered_cust_name');
        window.localStorage.removeItem('hellopoint_remembered_cust_num');
      }
    } else {
      localStorage.setItem('hellopoint_remembered_customers', serialized);
      localStorage.setItem('hellopoint_remembered_cust_id', capped[0].id);
      localStorage.setItem('hellopoint_remembered_cust_name', capped[0].name);
      localStorage.setItem('hellopoint_remembered_cust_num', capped[0].phone);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('hellopoint_remembered_customers', serialized);
        window.localStorage.setItem('hellopoint_remembered_cust_id', capped[0].id);
        window.localStorage.setItem('hellopoint_remembered_cust_name', capped[0].name);
        window.localStorage.setItem('hellopoint_remembered_cust_num', capped[0].phone);
      }
    }
  } catch (e) {
    console.error('Failed to save remembered customer list:', e);
  }
};
import { APP_PROPRIETOR_NAME } from '../version';
import { VisitorLiveChatModal } from './VisitorLiveChatModal';
import { VisitorShopModal } from './VisitorShopModal';
import { VisitorRemoteTypeModal, getInitialRemoteTypeState, syncRemoteTypeStateInstant } from './RemoteTypeModals';
import { soundEngine } from '../utils/audio';
import { PremiumAppLoader } from './PremiumAppLoader';

interface PinLockScreenProps {
  onUnlock: (role: 'owner' | 'customer', customerId?: string) => void;
  contacts: Contact[];
  lang: 'bn' | 'en';
  onGoogleSignIn?: () => void;
  onVerifyPhone?: (phone: string) => Promise<Contact | null>;
  user?: any;
  onRegisterRequest?: (name: string, phone: string, photoUrl?: string) => Promise<{ success: boolean; isAlreadyPending?: boolean; message: string }>;
  setLang?: (lang: 'bn' | 'en') => void;
  products?: Product[];
  shopOrders?: ShopOrder[];
  shopCustomers?: ShopCustomerAccount[];
  onCreateShopOrder?: (order: ShopOrder) => void;
  onSaveShopCustomer?: (customer: ShopCustomerAccount) => void;
  remoteTypeState?: RemoteTypeState;
  onUpdateRemoteTypeState?: (state: RemoteTypeState) => void;
  chatMessages?: ChatMessage[];
  onSendChatMessage?: (contactId: string, text: string, senderRole?: 'owner' | 'customer', senderName?: string, senderPhone?: string) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  currency?: string;
  themeColor?: string;
  shopStatus?: 'open' | 'closed';
  quickFaqs?: ChatQuickFAQ[];
  onMarkChatsAsRead?: (contactId: string, role: 'owner' | 'customer') => void;
}

export function PinLockScreen({ 
  onUnlock, 
  contacts, 
  lang, 
  onGoogleSignIn, 
  onVerifyPhone, 
  user,
  onRegisterRequest,
  setLang,
  products = [],
  shopOrders = [],
  shopCustomers = [],
  onCreateShopOrder,
  onSaveShopCustomer,
  remoteTypeState,
  onUpdateRemoteTypeState,
  chatMessages = [],
  onSendChatMessage,
  onDeleteChatMessage,
  currency = '৳',
  themeColor = '#6244a6',
  shopStatus: propShopStatus,
  quickFaqs,
  onMarkChatsAsRead
}: PinLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Visitor Feature Modals State
  const [showLiveChatModal, setShowLiveChatModal] = useState<boolean>(false);
  const [showShopModal, setShowShopModal] = useState<boolean>(false);
  const [showRemoteTypeModal, setShowRemoteTypeModal] = useState<boolean>(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<string>('');
  const [chatInitialName, setChatInitialName] = useState<string>('');
  const [chatInitialPhone, setChatInitialPhone] = useState<string>('');

  // Register state management
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [registerName, setRegisterName] = useState<string>('');
  const [registerPhone, setRegisterPhone] = useState<string>('');
  const [registerPhoto, setRegisterPhoto] = useState<string>('');
  const [registerError, setRegisterError] = useState<string>('');
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState<boolean>(false);
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState<string | null>(null);

  // New States for Shop Status level indicators and Saved logins (up to last 2 accounts)
  const [localShopStatus, setLocalShopStatus] = useState<'open' | 'closed'>('open');
  const shopStatus = propShopStatus || localShopStatus;
  const [rememberedCustomers, setRememberedCustomers] = useState<RememberedCustomer[]>(() => getStoredRememberedCustomers());
  const [rememberedCustId, setRememberedCustId] = useState<string | null>(() => getStoredRememberedCustomers()[0]?.id || null);
  const [rememberedCustName, setRememberedCustName] = useState<string | null>(() => getStoredRememberedCustomers()[0]?.name || null);
  const [rememberedCustNum, setRememberedCustNum] = useState<string | null>(() => getStoredRememberedCustomers()[0]?.phone || null);

  // Brute force protection lockout states
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number>(0);

  useEffect(() => {
    // Dynamic storage sync helper
    const syncStatus = () => {
      const status = (localStorage.getItem('hellopoint_shop_status') as 'open' | 'closed') || 'open';
      setLocalShopStatus(status);

      const list = getStoredRememberedCustomers();
      setRememberedCustomers(list);
      if (list.length > 0) {
        setRememberedCustId(list[0].id);
        setRememberedCustName(list[0].name);
        setRememberedCustNum(list[0].phone);
      } else {
        setRememberedCustId(null);
        setRememberedCustName(null);
        setRememberedCustNum(null);
      }
    };

    syncStatus();
    // Watch other context storage updates dynamically
    window.addEventListener('storage', syncStatus);
    return () => window.removeEventListener('storage', syncStatus);
  }, []);

  const addRememberedCustomer = (newCust: RememberedCustomer) => {
    if (!newCust || (!newCust.id && !newCust.phone)) return;
    const existing = getStoredRememberedCustomers();
    const cleanNum = (s: string) => (s || '').replace(/\D/g, '');
    const cleanNew = cleanNum(newCust.phone);
    // Remove any existing entry with same id or phone
    const filtered = existing.filter(
      (c) => c.id !== newCust.id && cleanNum(c.phone) !== cleanNew
    );
    // Prepend new login at front (most recent), keeping maximum 2 accounts
    const updated = [newCust, ...filtered].slice(0, 2);
    saveRememberedList(updated);
    setRememberedCustomers(updated);
    setRememberedCustId(updated[0]?.id || null);
    setRememberedCustName(updated[0]?.name || null);
    setRememberedCustNum(updated[0]?.phone || null);
  };

  const handleRemoveOneByOne = () => {
    const existing = getStoredRememberedCustomers();
    if (!existing || existing.length === 0) {
      saveRememberedList([]);
      setRememberedCustomers([]);
      setRememberedCustId(null);
      setRememberedCustName(null);
      setRememberedCustNum(null);
      return;
    }
    // Remove one account at a time (the first one):
    // If 2 exist, leaves 1. If 1 exists, leaves 0.
    const updated = existing.slice(1);
    saveRememberedList(updated);
    setRememberedCustomers(updated);
    if (updated.length > 0) {
      setRememberedCustId(updated[0].id);
      setRememberedCustName(updated[0].name);
      setRememberedCustNum(updated[0].phone);
    } else {
      setRememberedCustId(null);
      setRememberedCustName(null);
      setRememberedCustNum(null);
    }
  };

  const handleRemoveSpecific = (id: string) => {
    const existing = getStoredRememberedCustomers();
    const updated = existing.filter((c) => c.id !== id && c.phone !== id);
    saveRememberedList(updated);
    setRememberedCustomers(updated);
    if (updated.length > 0) {
      setRememberedCustId(updated[0].id);
      setRememberedCustName(updated[0].name);
      setRememberedCustNum(updated[0].phone);
    } else {
      setRememberedCustId(null);
      setRememberedCustName(null);
      setRememberedCustNum(null);
    }
  };

  // Timer cooldown helper for Lockout security
  useEffect(() => {
    if (lockoutTimeLeft <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimeLeft]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (lockoutTimeLeft > 0) return;
    const val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) return;
    setPin(val);
    setErrorMsg('');

    // Seamless auto-detection on-change helper
    if (val.length === 4) {
      const savedPin = localStorage.getItem('hellopoint_pin') || '1234';
      if (val === savedPin) {
        processPinCheck(val);
      }
    } else if (val.length === 11) {
      processCustomerPhoneCheck(val);
    }
  };

  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutTimeLeft > 0) return;

    if (pin.length === 4) {
      processPinCheck(pin);
    } else if (pin.length === 11) {
      processCustomerPhoneCheck(pin);
    } else {
      setErrorMsg(lang === 'bn' ? 'দয়া করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।' : 'Please enter a valid 11-digit mobile number.');
    }
  };

  const processPinCheck = (completedPin: string) => {
    if (lockoutTimeLeft > 0) return;
    const savedPin = localStorage.getItem('hellopoint_pin');
    if (savedPin) {
      if (completedPin === savedPin) {
        soundEngine.playPinUnlockSound();
        localStorage.setItem('hellopoint_pin_session_time', Date.now().toString());
        setFailedAttempts(0);
        onUnlock('owner');
      }
      // If it doesn't match the owner's 4-digit PIN, is it the beginning of a customer's phone?
      // Do nothing, let them keep entering up to 11 digits seamlessly.
    } else {
      // First-time owner setup
      soundEngine.playPinUnlockSound();
      localStorage.setItem('hellopoint_pin', completedPin);
      localStorage.setItem('hellopoint_pin_session_time', Date.now().toString());
      setFailedAttempts(0);
      onUnlock('owner');
    }
  };

  const processCustomerPhoneCheck = async (completedPhone: string) => {
    if (lockoutTimeLeft > 0) return;
    
    setErrorMsg(lang === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Verifying...');

    let customer: Contact | null = null;
    if (onVerifyPhone) {
      customer = await onVerifyPhone(completedPhone);
    } else {
      const cleanNum = (s: string) => s.replace(/\D/g, '');
      const cleanCompleted = cleanNum(completedPhone);
      customer = contacts.find(c => c.type === 'customer' && cleanNum(c.phone) === cleanCompleted) || null;
    }

    if (customer) {
      soundEngine.playPinUnlockSound();
      setErrorMsg('');
      setFailedAttempts(0);
      
      // Store customer's login details dynamically - LAST 2 ACCOUNTS KEPT
      addRememberedCustomer({
        id: customer.id,
        name: customer.name,
        phone: completedPhone,
      });

      onUnlock('customer', customer.id);
    } else {
      const nextFailCount = failedAttempts + 1;
      const remainingAttempts = 5 - nextFailCount;
      if (remainingAttempts <= 0) {
        setLockoutTimeLeft(30);
        triggerError(lang === 'bn' ? 'অতিরিক্ত ভুল চেষ্টা! ৩০ সেকেন্ড অপেক্ষা করুন।' : 'Too many failed attempts! Wait 30s.');
      } else {
        setFailedAttempts(nextFailCount);
        triggerError(
          lang === 'bn' 
            ? `এই নম্বরটি পাওয়া যায়নি! আর ${remainingAttempts} বার চেষ্টা করতে পারবেন।` 
            : `Incorrect mobile number! ${remainingAttempts} attempts remaining.`
        );
      }
      setPin('');
    }
  };

  const handleRegisterSubmit = async () => {
    setRegisterError('');
    if (!registerName.trim()) {
      setRegisterError(lang === 'bn' ? 'অনুগ্রহ করে আপনার নাম দিন।' : 'Please enter your name.');
      return;
    }
    const cleanNum = (s: string) => s.replace(/\D/g, '');
    const cleanP = cleanNum(registerPhone);
    if (cleanP.length !== 11) {
      setRegisterError(lang === 'bn' ? 'অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid 11-digit phone number.');
      return;
    }
    if (!registerPhoto || !registerPhoto.trim()) {
      setRegisterError(lang === 'bn' ? 'অ্যাকাউন্ট খোলার জন্য ছবি যুক্ত করা বাধ্যতামূলক।' : 'Photo is mandatory for creating an account.');
      return;
    }

    setIsRegisterSubmitting(true);
    if (onRegisterRequest) {
      const res = await onRegisterRequest(registerName, registerPhone, registerPhoto || undefined);
      setIsRegisterSubmitting(false);
      if (res.success) {
        setRegisterSuccessMsg(res.message);
        setRegisterName('');
        setRegisterPhone('');
        setRegisterPhoto('');
      } else {
        setRegisterError(res.message);
      }
    } else {
      setIsRegisterSubmitting(false);
      setRegisterError(lang === 'bn' ? 'সিস্টেম অফলাইন অবস্থায় আছে!' : 'System is currently offline!');
    }
  };

  const handleDelete = () => {
    setErrorMsg('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg('');
    setPin('');
  };

  const triggerError = (msg: string) => {
    soundEngine.playPinErrorSound();
    setErrorMsg(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const toBn = (enStr: string | number): string => {
    if (lang !== 'bn') return String(enStr);
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(enStr).replace(/[0-9]/g, (digit) => bnDigits[parseInt(digit, 10)]);
  };

  return (
    <div id="unified-auth-viewport" className="fixed inset-0 flex items-center justify-center p-4 pt-16 z-[9999] font-sans overflow-y-auto select-none transition-colors duration-300 bg-slate-50 text-slate-805">
      
      {/* TOP HEADER WITH LANGUAGE TOGGLE & SECURE DIGITAL STATEMENT */}
      <div className="absolute top-0 inset-x-0 bg-white border-b border-slate-150 py-2.5 px-4 flex justify-between items-center z-[10000] shadow-tiny select-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="font-extrabold text-[8.5px] tracking-wider uppercase text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded leading-none shrink-0">
            {lang === 'bn' ? 'নিরাপদ খাতা' : 'SECURE LEDGER'}
          </div>
          <span className="text-[10px] sm:text-xs font-black text-slate-855 uppercase tracking-wide truncate">
            {lang === 'bn' ? 'নিরাপদ ডিজিটাল খাতা' : 'SECURE DIGITAL STATEMENT'}
          </span>
        </div>
        
        {/* Language Selection Switch on-screen */}
        {setLang && (
          <button 
            type="button"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="bg-purple-50 hover:bg-purple-100 text-purple-755 border border-purple-200/50 hover:border-purple-300 active:scale-95 transition-all text-[9px] px-2 py-0.8 rounded-md font-black tracking-wide shrink-0 cursor-pointer"
          >
            {lang === 'bn' ? 'ENGLISH / ভাষা' : 'বাংলা / LANG'}
          </button>
        )}
      </div>

      {/* Decorative premium ambient gradient backdrops */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse bg-purple-200/30"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-45 animate-pulse bg-indigo-100/30" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main Landing / Locked Screen Card - Refined Premium Clean Card with Crisp Contrast */}
      <div className="relative w-full max-w-sm rounded-3xl p-5 sm:p-5.5 flex flex-col justify-between h-auto transition-all duration-300 transform bg-white border border-slate-200/90 shadow-[0_10px_35px_-5px_rgba(15,23,42,0.08),0_0_1px_rgba(15,23,42,0.1)]">
        
        {/* Brand logo section */}
        <div className="mb-2.5 flex flex-col items-center w-full">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-sm border border-white/20 mb-2">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>

          {/* HelloPoint Brand Title & Direct authentication Form on-card */}
          <div className="flex flex-col items-center gap-1.5 justify-center w-full">
            <h1 className="text-[38px] sm:text-[46px] font-black tracking-tight sm:tracking-tighter leading-none select-none flex items-center gap-2">
              <span>
                <span className="text-slate-900">Hello</span>
                <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">Point</span>
              </span>
              {shopStatus === 'open' ? (
                <div className="border rounded-full px-2 py-0.5 flex items-center gap-1 text-[8.5px] font-extrabold tracking-wide bg-emerald-50 text-emerald-700 border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse relative flex" />
                  <span>Open</span>
                </div>
              ) : (
                <div className="border rounded-full px-2 py-0.5 flex items-center gap-1 text-[8.5px] font-extrabold tracking-wide bg-rose-50 text-rose-700 border-rose-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 relative flex" />
                  <span>Closed</span>
                </div>
              )}
            </h1>

            {/* VISITOR SERVICES: LIVE CHAT, ONLINE SHOP & REMOTE TYPE - DIRECTLY UNDER HELLOPOINT LOGO */}
            <div className="w-full mt-2 mb-2">
              <div className="grid grid-cols-3 gap-1.5">
                {/* 1. Live Chat Button with dot */}
                <button
                  type="button"
                  onClick={() => {
                    setChatInitialMessage('');
                    setShowLiveChatModal(true);
                  }}
                  className="relative flex items-center justify-center gap-1 py-2.5 px-2 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 rounded-xl text-emerald-800 shadow-2xs active:scale-[0.98] transition-all cursor-pointer group"
                >
                  {/* Blinking Dot Indicator in front of name */}
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    {shopStatus === 'open' ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="inline-flex rounded-full h-1.5 w-1.5 bg-slate-400"></span>
                    )}
                  </span>

                  <span className="text-[9.5px] sm:text-[10px] font-bold tracking-tight whitespace-nowrap">
                    {lang === 'bn' ? 'লাইভ চ্যাট' : 'Live Chat'}
                  </span>
                  <MessageCircle className="w-3 h-3 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                </button>

                {/* 2. Online Shop Button */}
                <button
                  type="button"
                  onClick={() => setShowShopModal(true)}
                  className="relative flex items-center justify-center gap-1 py-2.5 px-2 bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200/80 rounded-xl text-indigo-800 shadow-2xs active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <ShoppingBag className="w-3 h-3 text-indigo-600 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="text-[9.5px] sm:text-[10px] font-bold tracking-tight whitespace-nowrap">
                    {lang === 'bn' ? 'অনলাইন শপ' : 'Online Shop'}
                  </span>
                  {products.filter(p => p.inStock).length > 0 && (
                    <span className="text-[7.5px] font-black bg-indigo-600 text-white px-1 py-0.2 rounded-full leading-none shrink-0">
                      {products.filter(p => p.inStock).length}
                    </span>
                  )}
                </button>

                {/* 3. Remote Type Button */}
                <button
                  type="button"
                  onClick={() => setShowRemoteTypeModal(true)}
                  className="relative flex items-center justify-center gap-1 py-2.5 px-2 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/90 rounded-xl text-amber-900 shadow-2xs active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <Radio className="w-3 h-3 text-amber-600 group-hover:scale-110 transition-transform shrink-0 animate-pulse" />
                  <span className="text-[9.5px] sm:text-[10px] font-bold tracking-tight whitespace-nowrap">
                    {lang === 'bn' ? 'Air Typing' : 'Air Typing'}
                  </span>
                </button>
              </div>
            </div>

            {/* Direct Number & PIN Authentication Card Input */}
            <form 
              onSubmit={handleLoginSubmit}
              className={`w-full bg-slate-50/70 border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs transition-all transform duration-300 ${
                isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
              }`}
            >
              {/* Clean Title with Refined Badge */}
              <div className="flex flex-col items-center mb-2.5">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[9px] font-bold uppercase tracking-wider mb-1 shadow-2xs">
                  <KeyRound className="w-3 h-3 text-purple-600" />
                  <span>{lang === 'bn' ? 'লগইন' : 'LOGIN'}</span>
                </div>
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                  {lang === 'bn' ? 'মোবাইল নম্বর লিখুন' : 'ENTER MOBILE NUMBER'}
                </h2>
              </div>

              {/* Lockout Countdown Timer */}
              {lockoutTimeLeft > 0 && (
                <div className="w-full bg-rose-50 border border-rose-200 p-2 rounded-xl flex flex-col items-center text-center text-rose-700 font-extrabold text-[10.5px] mb-2 select-none shadow-2xs">
                  <div className="flex items-center gap-1 mb-0.5 text-[9px] uppercase tracking-wider text-rose-800">
                    <span className="w-1 h-1 rounded-full bg-rose-500 animate-ping" />
                    <span>🔒 Lockout Active</span>
                  </div>
                  <span>
                    Try again in {lockoutTimeLeft}s
                  </span>
                </div>
              )}

              {/* Input for Mobile Number or PIN - Clear high-contrast styling */}
              <div className="w-full mb-2.5">
                <input
                  type="tel"
                  maxLength={11}
                  value={pin}
                  onChange={handleInputChange}
                  placeholder={lang === 'bn' ? 'মোবাইল বা পিন নম্বর' : 'Mobile / PIN'}
                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 rounded-xl px-3.5 py-2.5 text-center text-sm font-bold text-slate-900 placeholder-slate-400 outline-none transition-all font-mono tracking-wider shadow-2xs"
                  disabled={lockoutTimeLeft > 0}
                  autoFocus
                />
              </div>

              {/* Error alerts inside the layout */}
              {errorMsg && (
                <p className="text-[9.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-1.5 rounded-lg text-center leading-normal max-w-full mb-2.5 animate-fade-in">
                  {errorMsg}
                </p>
              )}

              {/* Proceed and Reg Options */}
              <div className="flex flex-col gap-1.5 w-full">
                <button
                  type="submit"
                  disabled={lockoutTimeLeft > 0 || !pin}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[11px] font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 tracking-wide disabled:opacity-50"
                >
                  <span>{lang === 'bn' ? 'প্রবেশ করুন' : 'PROCEED'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterModal(true);
                    setRegisterName('');
                    setRegisterPhone('');
                    setRegisterError('');
                    setRegisterSuccessMsg(null);
                  }}
                  className="w-full py-1 text-purple-600 hover:text-purple-800 text-[10px] font-bold transition-all cursor-pointer text-center hover:underline underline-offset-2"
                >
                  {lang === 'bn' ? 'নতুন অ্যাকাউন্ট অনুরোধ করুন' : 'Request Create Account'}
                </button>
              </div>
            </form>

            {/* Remembered Customer Quick Login Widget (Last 2 accounts saved) - Positioned Below the Login Form */}
            {rememberedCustomers.length > 0 && (
              <div className="w-full bg-slate-50/80 border border-slate-200/90 p-3 rounded-2xl flex flex-col mt-2.5 mb-1 transition-all shadow-2xs">
                <div className="flex items-center justify-between w-full mb-2 pb-1.5 border-b border-slate-200/70">
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider leading-none flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-600" />
                    <span>
                      {lang === 'bn' ? 'সংরক্ষিত গ্রাহক অ্যাকাউন্ট' : 'Remembered Accounts'}
                    </span>
                  </p>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {toBn(rememberedCustomers.length)}/২
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 w-full">
                  {rememberedCustomers.map((cust, idx) => (
                    <div
                      key={cust.id || cust.phone || idx}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs hover:border-purple-300 transition-all group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {cust.name ? cust.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                            {cust.name}
                          </p>
                          <p className="text-[10px] font-mono font-medium text-slate-500 truncate leading-tight">
                            {cust.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playPinUnlockSound();
                            addRememberedCustomer(cust);
                            onUnlock('customer', cust.id);
                          }}
                          className="flex items-center gap-1 py-1.5 px-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white text-[10px] font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
                        >
                          <span>{lang === 'bn' ? 'সহজ লগইন' : 'Login'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecific(cust.id)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title={lang === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleRemoveOneByOne}
                  className="text-[9px] font-bold text-slate-400 hover:text-rose-600 mt-2 text-center transition-colors cursor-pointer hover:underline underline-offset-2"
                  title={lang === 'bn' ? 'ক্লিক করলে সংরক্ষিত অ্যাকাউন্ট একে একে মুছে যাবে' : 'Click to remove saved accounts one by one'}
                >
                  {lang === 'bn' ? 'অন্য অ্যাকাউন্ট লগইন (সংরক্ষিত অ্যাকাউন্ট সরান)' : 'Switch Customer / Remove Saved'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Premium Contact Infobox */}
        <div className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 space-y-1.5 text-left mb-2 shadow-2xs">
          <h4 className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest mb-2 text-center pb-1.5 border-b border-slate-200/70">
            {lang === 'bn' ? 'টাকা তুলতে ও পাঠাতে যোগাযোগ করুন' : 'GET IN TOUCH & AGENTS'}
          </h4>
          <div className="space-y-1.5 text-[10.5px]">
            <div className="flex items-center justify-between font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 gap-2 shadow-2xs">
              <span className="flex items-center gap-1.5 font-bold text-[#da1c5c] shrink-0 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#da1c5c]" />
                {lang === 'bn' ? 'বিকাশ এজেন্ট' : 'bKash Agent'}
              </span>
              <span className="font-mono text-slate-900 tracking-wide font-bold shrink-0 whitespace-nowrap">01756565454</span>
            </div>
            <div className="flex items-center justify-between font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 gap-2 shadow-2xs">
              <span className="flex items-center gap-1.5 font-bold text-[#e67e10] shrink-0 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e67e10]" />
                {lang === 'bn' ? 'নগদ এজেন্ট' : 'Nagad Agent'}
              </span>
              <span className="font-mono text-slate-900 tracking-wide font-bold shrink-0 whitespace-nowrap">01754543737</span>
            </div>
            <div className="flex items-center justify-between font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 gap-2 shadow-2xs">
              <span className="flex items-center gap-1.5 font-bold text-emerald-600 shrink-0 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {lang === 'bn' ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}
              </span>
              <span className="font-mono text-slate-900 tracking-wide font-bold shrink-0 whitespace-nowrap">01783586858</span>
            </div>
          </div>
        </div>

      </div>
      
      {/* CUSTOMER REGISTRATION FULL PAGE VIEW */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-900 z-[10000] overflow-y-auto animate-fade-in flex flex-col justify-between p-4 sm:p-6 font-sans">
          <div className="w-full max-w-md mx-auto my-auto py-4">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  setShowRegisterModal(false);
                  setRegisterName('');
                  setRegisterPhone('');
                  setRegisterPhoto('');
                  setRegisterError('');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all text-xs font-bold active:scale-95 cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 text-purple-400" />
                <span>{lang === 'bn' ? 'ফিরে যান' : 'Back to Login'}</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 bg-purple-950/70 border border-purple-800/70 px-3 py-1 rounded-full">
                  {lang === 'bn' ? 'কাস্টমার রেজিস্ট্রেশন' : 'Customer Signup'}
                </span>
              </div>
            </div>

            {/* Registration Card */}
            <div className="bg-white border border-slate-200/90 rounded-[32px] shadow-2xl p-6 sm:p-7 flex flex-col">
              {/* Header */}
              <div className="flex flex-col items-center mb-5 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 mb-2.5 shadow-sm">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h2 className="text-sm sm:text-base font-black text-slate-850 uppercase tracking-wide">
                  {lang === 'bn' ? 'নতুন কাস্টমার একাউন্ট অনুরোধ' : 'CREATE CUSTOMER ACCOUNT'}
                </h2>
                <p className="text-[11px] font-semibold text-slate-400 mt-1">
                  {lang === 'bn' ? 'আপনার তথ্য দিয়ে অনুরোধ সাবমিট করুন' : 'Fill details below to submit request'}
                </p>
              </div>

              {/* Inputs Form */}
              <div className="space-y-4">
                {/* Mandatory Photo Selection block */}
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-150 rounded-2xl p-3.5 mb-1">
                  <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest mb-2 px-0.5 text-center flex items-center gap-1">
                    <span>{lang === 'bn' ? 'আপনার ছবি যুক্ত করুন' : 'ADD YOUR PHOTO'}</span>
                    <span className="text-red-500 font-black">({lang === 'bn' ? 'বাধ্যতামূলক *' : 'MANDATORY *'})</span>
                  </p>
                  <div className="relative group shrink-0">
                    <div 
                      className="w-20 h-20 rounded-full border-2 border-purple-300 overflow-hidden bg-white relative flex items-center justify-center shadow-inner"
                    >
                      {registerPhoto ? (
                        <img 
                          src={registerPhoto} 
                          alt="Profile Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-10 h-10 text-slate-300" />
                      )}
                    </div>
                    
                    {/* Photo Actions with canvas scaler embedded directly */}
                    <div className="absolute -bottom-1 -right-1 flex gap-1">
                      <label 
                        className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full border-2 border-white shadow-md transition-all cursor-pointer flex items-center justify-center active:scale-90"
                        title={lang === 'bn' ? 'ছবি নির্বাচন করুন' : 'Choose Photo'}
                      >
                        <Camera className="w-4 h-4" />
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const objectUrl = URL.createObjectURL(file);
                            const img = new window.Image();
                            img.onload = () => {
                              try {
                                const canvas = document.createElement('canvas');
                                const MAX_WIDTH = 300;
                                const MAX_HEIGHT = 300;
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
                                  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                                  setRegisterPhoto(dataUrl);
                                }
                              } catch (err) {
                                console.error("Canvas photo compression failed:", err);
                              } finally {
                                URL.revokeObjectURL(objectUrl);
                              }
                            };
                            img.onerror = () => {
                              URL.revokeObjectURL(objectUrl);
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const fbImg = new window.Image();
                                fbImg.onload = () => {
                                  const canvas = document.createElement('canvas');
                                  const MAX_WIDTH = 300;
                                  const MAX_HEIGHT = 300;
                                  let width = fbImg.width;
                                  let height = fbImg.height;
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
                                    ctx.drawImage(fbImg, 0, 0, width, height);
                                    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                                    setRegisterPhoto(dataUrl);
                                  }
                                };
                                fbImg.src = event.target?.result as string;
                              };
                              reader.readAsDataURL(file);
                            };
                            img.src = objectUrl;
                          }}
                          className="hidden" 
                        />
                      </label>

                      {registerPhoto && (
                        <button
                          type="button"
                          onClick={() => setRegisterPhoto('')}
                          className="bg-red-50 hover:bg-red-100 text-red-650 p-2 rounded-full border border-red-200 shadow-sm transition-all cursor-pointer flex items-center justify-center active:scale-95"
                          title={lang === 'bn' ? 'ছবি মুছুন' : 'Remove Photo'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
                    {lang === 'bn' ? 'আপনার পুরো নাম' : 'YOUR FULL NAME'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      placeholder={lang === 'bn' ? 'আপনার পুরো নাম লিখুন' : 'Enter your full name'}
                      className="w-full bg-slate-50 border border-slate-200/90 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
                    {lang === 'bn' ? '১১ ডিজিটের মোবাইল নম্বর' : '11-DIGIT MOBILE NUMBER'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      maxLength={11}
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="01XXXXXXXXX"
                      className="w-full bg-slate-50 border border-slate-200/90 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-slate-850 placeholder-slate-400 outline-none focus:border-purple-500 focus:bg-white transition-all shadow-inner font-mono"
                    />
                  </div>
                </div>

                {registerError && (
                  <div className="text-[10.5px] font-black text-red-650 bg-red-50 border border-red-150 px-3.5 py-2.5 rounded-xl text-center">
                    {registerError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isRegisterSubmitting}
                  onClick={handleRegisterSubmit}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black rounded-2xl shadow hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider mt-2 disabled:opacity-50"
                >
                  {isRegisterSubmitting ? (
                    <>
                      <span className="border-2 border-white border-t-transparent rounded-full w-3.5 h-3.5 animate-spin" />
                      <span>{lang === 'bn' ? 'অনুরোধ পাঠানো হচ্ছে...' : 'SUBMITTING...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{lang === 'bn' ? 'অনুরোধ পাঠান' : 'SUBMIT REQUEST'}</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] font-bold text-slate-400 select-none mt-4 text-center leading-normal">
                {lang === 'bn' ? 'অনুরোধ পাঠানোর পর দোকান মালিকের অনুমোদনের জন্য অপেক্ষা করুন।' : 'After submitting, wait for shop owner approval.'}
              </p>
            </div>
          </div>

          <div className="text-center py-2 select-none">
            <p className="text-[8.5px] font-bold text-slate-500 tracking-wider uppercase">
              Proprietor & App Design: Mahbub Hasan
            </p>
          </div>
        </div>
      )}

      {/* REGISTRATION PENDING ALERT MODAL */}
      {registerSuccessMsg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[10001] animate-fade-in font-sans">
          <div 
            className="relative w-full max-w-sm bg-white border border-slate-200/90 rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] p-6 flex flex-col items-center transition-all transform duration-300"
          >
            {/* Pulsing Alert Icon */}
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 text-amber-500 mb-4">
              <Clock className="w-8 h-8 animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
            </div>

            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider text-center mb-2">
              {lang === 'bn' ? 'অনুরোধ পেন্ডিং আছে' : 'REQUEST PENDING'}
            </h3>

            {/* Precise message matching user intent */}
            <p className="text-xs font-black text-slate-700 text-center leading-relaxed px-5 bg-amber-50/50 border border-amber-100 rounded-2xl py-3.5 mb-4">
              {registerSuccessMsg}
            </p>

            <button
              onClick={() => {
                setRegisterSuccessMsg(null);
                setShowRegisterModal(false);
                setRegisterName('');
                setRegisterPhone('');
              }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black rounded-2xl shadow hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              {lang === 'bn' ? 'আচ্ছা, বুঝতে পেরেছি' : 'Ok, Got It'}
            </button>
          </div>
        </div>
      )}

      {/* Subtle Proprietor Notice at bottom */}
      <div className="absolute bottom-2 inset-x-0 text-center select-none px-4 z-[10000] flex flex-col items-center gap-1 pointer-events-none">
        <p className="text-[8px] sm:text-[8.5px] font-bold text-slate-400 tracking-wider uppercase opacity-85">
          Proprietor & App Design: Mahbub Hasan
        </p>
      </div>

      {/* VISITOR LIVE CHAT MODAL */}
      <VisitorLiveChatModal 
        isOpen={showLiveChatModal}
        onClose={() => {
          setShowLiveChatModal(false);
          setChatInitialMessage('');
        }}
        lang={lang}
        chatMessages={chatMessages}
        onSendMessage={onSendChatMessage || (() => {})}
        onDeleteMessage={onDeleteChatMessage}
        themeColor={themeColor}
        shopStatus={shopStatus}
        initialMessage={chatInitialMessage}
        initialVisitorName={chatInitialName}
        initialVisitorPhone={chatInitialPhone}
        quickFaqs={quickFaqs}
        onMarkChatsAsRead={onMarkChatsAsRead}
        onRequestOpenRegisterModal={() => {
          setShowLiveChatModal(false);
          setShowRegisterModal(true);
        }}
      />

      {/* VISITOR ONLINE SHOP MODAL */}
      <VisitorShopModal 
        isOpen={showShopModal}
        onClose={() => setShowShopModal(false)}
        lang={lang}
        products={products}
        currency={currency}
        themeColor={themeColor}
        shopOrders={shopOrders}
        shopCustomers={shopCustomers}
        onCreateShopOrder={onCreateShopOrder}
        onSaveShopCustomer={onSaveShopCustomer}
      />

      {/* VISITOR REMOTE TYPE DIALPAD MODAL */}
      <VisitorRemoteTypeModal
        isOpen={showRemoteTypeModal}
        onClose={() => setShowRemoteTypeModal(false)}
        lang={lang}
        remoteState={remoteTypeState || getInitialRemoteTypeState()}
        onUpdateRemoteState={onUpdateRemoteTypeState || syncRemoteTypeStateInstant}
      />

      {/* REGISTRATION SUBMISSION LOADER */}
      <PremiumAppLoader
        isOpen={isRegisterSubmitting}
        title={lang === 'bn' ? 'অনুরোধ পাঠানো হচ্ছে...' : 'Submitting Request...'}
        icon={UserPlus}
        iconGradient="from-purple-600 to-indigo-650"
        ringColor="border-purple-500"
        progressColor="from-purple-500 to-indigo-500"
      />
    </div>
  );
}
