import React, { useState, useEffect } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { 
  ShieldCheck, 
  X, 
  KeyRound, 
  ArrowRight, 
  ArrowLeft, 
  UserPlus, 
  User, 
  Users, 
  Phone, 
  Clock, 
  Camera, 
  Trash2, 
  MessageCircle, 
  Download,
  Sparkles,
  Lock
} from 'lucide-react';
import { Contact, ChatMessage, ChatQuickFAQ } from '../types';
import { usePwaInstall } from '../utils/usePwaInstall';
import { VisitorLiveChatModal } from './VisitorLiveChatModal';
import { soundEngine } from '../utils/audio';
import { PremiumAppLoader } from './PremiumAppLoader';

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

interface PinLockScreenProps {
  onUnlock: (role: 'owner' | 'customer', customerId?: string) => void;
  contacts: Contact[];
  lang: 'bn' | 'en';
  onGoogleSignIn?: () => void;
  onVerifyPhone?: (phone: string) => Promise<Contact | null>;
  user?: any;
  onRegisterRequest?: (name: string, phone: string, photoUrl?: string) => Promise<{ success: boolean; isAlreadyPending?: boolean; message: string }>;
  setLang?: (lang: 'bn' | 'en') => void;
  chatMessages?: ChatMessage[];
  onSendChatMessage?: (contactId: string, text: string, senderRole?: 'owner' | 'customer', senderName?: string, senderPhone?: string) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  currency?: string;
  themeColor?: string;
  quickFaqs?: ChatQuickFAQ[];
  onMarkChatsAsRead?: (contactId: string, role: 'owner' | 'customer') => void;
}

export function PinLockScreen({ 
  onUnlock, 
  contacts, 
  lang, 
  onGoogleSignIn: _onGoogleSignIn, 
  onVerifyPhone, 
  user: _user,
  onRegisterRequest,
  setLang,
  chatMessages = [],
  onSendChatMessage,
  onDeleteChatMessage,
  currency: _currency = '৳',
  themeColor = '#6244a6',
  quickFaqs,
  onMarkChatsAsRead
}: PinLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Visitor Feature Modals State
  const [showLiveChatModal, setShowLiveChatModal] = useState<boolean>(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<string>('');
  const [chatInitialName] = useState<string>('');
  const [chatInitialPhone] = useState<string>('');

  // PWA Install hook (hidden once installed)
  const { isInstalled, promptInstall, showGuide, setShowGuide } = usePwaInstall();

  // Register state management
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [registerName, setRegisterName] = useState<string>('');
  const [registerPhone, setRegisterPhone] = useState<string>('');
  const [registerPhoto, setRegisterPhoto] = useState<string>('');
  const [registerError, setRegisterError] = useState<string>('');
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState<boolean>(false);
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState<string | null>(null);

  // Saved logins (up to last 2 accounts)
  const [rememberedCustomers, setRememberedCustomers] = useState<RememberedCustomer[]>(() => getStoredRememberedCustomers());

  // Brute force protection lockout states
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number>(0);

  useEffect(() => {
    // Dynamic storage sync helper - deferred via setTimeout(0) to avoid updating during parent render
    const syncStatus = () => {
      setTimeout(() => {
        setRememberedCustomers(getStoredRememberedCustomers());
      }, 0);
    };

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
  };

  const handleRemoveOneByOne = () => {
    const existing = getStoredRememberedCustomers();
    if (!existing || existing.length === 0) {
      saveRememberedList([]);
      setRememberedCustomers([]);
      return;
    }
    const updated = existing.slice(1);
    saveRememberedList(updated);
    setRememberedCustomers(updated);
  };

  const handleRemoveSpecific = (id: string) => {
    const existing = getStoredRememberedCustomers();
    const updated = existing.filter((c) => c.id !== id && c.phone !== id);
    saveRememberedList(updated);
    setRememberedCustomers(updated);
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
    <div 
      id="unified-auth-viewport" 
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 pt-14 pb-8 z-[9999] font-sans overflow-y-auto select-none bg-[#060505] text-slate-100"
    >
      {/* =========================================================================
          WALLPAPER PALETTE BACKGROUND: Obsidian (#060505), Charcoal (#494545), 
          Slate (#545454), Silver (#9d9b9b), Light Platinum (#adaaab)
          ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Subtle Textured Wallpaper Image Backdrop */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-15 filter blur-xs"
          style={{ backgroundImage: "url('/assets/aistudio/143181_wallpaper_a7315b30.png')" }}
        />
        {/* Deep Slate floating liquid glow */}
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-gradient-to-tr from-[#494545]/50 via-[#545454]/30 to-[#9d9b9b]/20 blur-3xl animate-float-slow opacity-60" />
        {/* Soft Silver & Platinum floating glow */}
        <div className="absolute -bottom-32 -right-32 w-[440px] h-[440px] rounded-full bg-gradient-to-bl from-[#9d9b9b]/30 via-[#545454]/25 to-[#494545]/40 blur-3xl animate-float-reverse opacity-60" />
        {/* Deep ambient charcoal center pulse */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-[#545454]/15 blur-3xl animate-pulse pointer-events-none opacity-50" />
        {/* Micro titanium grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(173,170,171,0.08)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />
      </div>

      {/* =========================================================================
          TOP BAR: Frosted Obsidian Header with Language Switch & Security Dot
          ========================================================================= */}
      <div className="absolute top-0 inset-x-0 bg-[#060505]/90 backdrop-blur-xl border-b border-[#494545]/80 py-2.5 px-4 flex justify-between items-center z-[10000] shadow-[0_4px_30px_rgba(0,0,0,0.5)] select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-0.8 rounded-full bg-[#494545]/60 border border-[#545454] text-[#adaaab] shadow-[0_0_12px_rgba(173,170,171,0.15)] shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffffff] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#adaaab]" />
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider text-[#adaaab]">
              {lang === 'bn' ? 'নিরাপদ খাতা' : 'SECURE'}
            </span>
          </div>
          <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wide truncate">
            {lang === 'bn' ? 'নিরাপদ ডিজিটাল খাতা' : 'SECURE DIGITAL STATEMENT'}
          </span>
        </div>
        
        {/* Language Selection Switch on-screen */}
        {setLang && (
          <button 
            type="button"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="relative px-3 py-1 rounded-xl bg-[#494545]/60 hover:bg-[#545454] text-[#adaaab] hover:text-white border border-[#545454] hover:border-[#adaaab] shadow-[0_0_15px_rgba(157,155,155,0.15)] active:scale-95 transition-all text-[9.5px] font-black tracking-wide shrink-0 cursor-pointer flex items-center gap-1.5 backdrop-blur-md"
          >
            <Sparkles className="w-3 h-3 text-[#adaaab]" />
            <span>{lang === 'bn' ? 'ENGLISH / ভাষা' : 'বাংলা / LANG'}</span>
          </button>
        )}
      </div>

      {/* =========================================================================
          MAIN AUTH SECTION: Login Card with Companion Saved Accounts Beside It
          ========================================================================= */}
      <div className="relative flex flex-col md:flex-row items-center justify-center gap-3.5 w-full max-w-3xl my-auto py-2 z-10">
        
        {/* Main Landing / Locked Screen Card */}
        <div className="relative w-full max-w-sm rounded-[28px] p-4 sm:p-5 flex flex-col justify-between h-auto transition-all duration-300 bg-[#060505]/90 backdrop-blur-2xl border border-[#494545] shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(173,170,171,0.08)] before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-[#adaaab]/40 before:to-transparent before:rounded-t-[28px]">
          
          {/* Brand logo & Visual Header */}
          <div className="mb-2 flex flex-col items-center w-full">
            {/* Luminous Liquid Glass Shield Icon */}
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#494545] via-[#545454] to-[#9d9b9b] text-white shadow-[0_0_20px_rgba(173,170,171,0.25)] border border-[#adaaab]/35 mb-1.5 group">
              <ShieldCheck className="w-5 h-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
              {/* Ambient silver pulse ring */}
              <div className="absolute inset-0 rounded-2xl border border-[#adaaab]/40 animate-ping opacity-25 pointer-events-none" />
            </div>

            {/* HelloPoint Brand Title */}
            <div className="flex flex-col items-center gap-0.5 justify-center w-full">
              <h1 className="text-3xl sm:text-[38px] font-black tracking-tight leading-none select-none flex items-center justify-center">
                <span className="text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">Hello</span>
                <span className="bg-gradient-to-r from-white via-[#adaaab] to-[#9d9b9b] bg-clip-text text-transparent drop-shadow-[0_2px_15px_rgba(255,255,255,0.35)]">
                  Point
                </span>
              </h1>
              <p className="text-[9.5px] font-bold text-[#adaaab]/90 uppercase tracking-widest text-center">
                {lang === 'bn' ? 'ডিজিটাল হিসাব খাতা ও কাস্টমার লেজার' : 'DIGITAL CASHBOOK & CUSTOMER LEDGER'}
              </p>

              {/* VISITOR SERVICES: LIVE CHAT | APP INSTALL | NEW ACCOUNT (Liquid Glass Buttons) */}
              <div className="w-full mt-2 mb-1.5">
                <div className={`grid ${!isInstalled ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
                  {/* 1. Live Chat Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setChatInitialMessage('');
                      setShowLiveChatModal(true);
                    }}
                    className="relative flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-2 bg-[#494545]/40 hover:bg-[#545454]/60 border border-[#545454] hover:border-[#adaaab] rounded-xl text-white shadow-[0_4px_12px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-all cursor-pointer group backdrop-blur-md"
                    title={lang === 'bn' ? 'লাইভ চ্যাট' : 'Live Chat'}
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#adaaab]" />
                    </span>

                    <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-tight whitespace-nowrap text-white">
                      {lang === 'bn' ? 'লাইভ চ্যাট' : 'Live Chat'}
                    </span>
                    <MessageCircle className="w-3.5 h-3.5 text-[#adaaab] group-hover:scale-110 group-hover:text-white transition-all shrink-0" />
                  </button>

                  {/* 2. App Install Button (Hidden once installed) */}
                  {!isInstalled && (
                    <button
                      type="button"
                      onClick={promptInstall}
                      className="relative flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-2 bg-[#494545]/40 hover:bg-[#545454]/60 border border-[#545454] hover:border-[#adaaab] rounded-xl text-white shadow-[0_4px_12px_rgba(0,0,0,0.4)] active:scale-[0.98] transition-all cursor-pointer group backdrop-blur-md"
                      title={lang === 'bn' ? 'অ্যাপ ইন্সটল করুন' : 'Install App'}
                    >
                      <Download className="w-3.5 h-3.5 text-[#adaaab] group-hover:scale-110 group-hover:text-white transition-all shrink-0 animate-bounce" />
                      <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-tight whitespace-nowrap text-white">
                        {lang === 'bn' ? 'অ্যাপ ইন্সটল' : 'Install App'}
                      </span>
                    </button>
                  )}

                  {/* 3. New Account Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(true);
                      setRegisterName('');
                      setRegisterPhone('');
                      setRegisterError('');
                      setRegisterSuccessMsg(null);
                    }}
                    className="relative flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-2 bg-gradient-to-r from-[#494545]/80 via-[#545454]/80 to-[#494545]/80 hover:from-[#545454] hover:to-[#545454] border-2 border-[#9d9b9b]/60 hover:border-[#adaaab] rounded-xl text-white shadow-[0_4px_14px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all cursor-pointer group backdrop-blur-md overflow-hidden"
                    title={lang === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'New Account'}
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#adaaab] group-hover:scale-110 group-hover:text-white transition-all shrink-0 drop-shadow" />
                    <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-tight whitespace-nowrap text-white">
                      {lang === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'New Account'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Direct Number & PIN Authentication Card Input (Obsidian & Platinum Panel) */}
              <form 
                onSubmit={handleLoginSubmit}
                className={`w-full bg-[#060505]/85 backdrop-blur-xl border border-[#494545] rounded-2xl p-3 sm:p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_10px_25px_rgba(0,0,0,0.5)] transition-all transform duration-300 ${
                  isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
                }`}
              >
                {/* Clean Title with Refined Glass Badge */}
                <div className="flex flex-col items-center mb-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#494545]/60 border border-[#545454] text-[#adaaab] text-[9px] font-bold uppercase tracking-wider mb-0.5 shadow-sm backdrop-blur-md">
                    <KeyRound className="w-3 h-3 text-[#adaaab]" />
                    <span>{lang === 'bn' ? 'সরাসরি লগইন' : 'DIRECT LOGIN'}</span>
                  </div>
                  <h2 className="text-[9.5px] font-bold text-[#adaaab]/90 uppercase tracking-widest text-center">
                    {lang === 'bn' ? 'মোবাইল বা পিন নম্বর লিখুন' : 'ENTER MOBILE OR PIN'}
                  </h2>
                </div>

                {/* Lockout Countdown Timer */}
                {lockoutTimeLeft > 0 && (
                  <div className="w-full bg-rose-950/60 border border-rose-500/40 p-2 rounded-xl flex flex-col items-center text-center text-rose-300 font-extrabold text-[10px] mb-2 select-none shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                    <div className="flex items-center gap-1.5 mb-0.5 text-[8.5px] uppercase tracking-wider text-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                      <span><Lock className="w-3 h-3 inline mr-1" />{lang === 'bn' ? 'লকআউট সক্রিয়' : 'Lockout Active'}</span>
                    </div>
                    <span>
                      {lang === 'bn' ? `${lockoutTimeLeft} সেকেন্ড পর আবার চেষ্টা করুন` : `Try again in ${lockoutTimeLeft}s`}
                    </span>
                  </div>
                )}

                {/* Input for Mobile Number or PIN - High-contrast Obsidian & Platinum Input */}
                <div className="w-full mb-2.5">
                  <input
                    type="tel"
                    maxLength={11}
                    value={pin}
                    onChange={handleInputChange}
                    placeholder={lang === 'bn' ? 'মোবাইল অথবা ৪ ডিজিটের পিন' : 'Mobile / 4-Digit PIN'}
                    className="w-full bg-[#060505]/90 border border-[#545454] hover:border-[#9d9b9b] focus:border-[#adaaab] focus:ring-2 focus:ring-[#adaaab]/25 rounded-xl px-3 py-2.5 text-center text-base font-bold text-white placeholder-[#9d9b9b]/50 outline-none transition-all font-mono tracking-widest shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)]"
                    disabled={lockoutTimeLeft > 0}
                    autoFocus
                  />
                </div>

                {/* Error alerts inside the layout */}
                {errorMsg && (
                  <p className="text-[9.5px] font-bold text-rose-200 bg-rose-950/70 border border-rose-500/50 px-2.5 py-1.5 rounded-xl text-center leading-normal max-w-full mb-2 animate-fade-in shadow-[0_0_15px_rgba(244,63,94,0.25)]">
                    {errorMsg}
                  </p>
                )}

                {/* Proceed Submit Button */}
                <div className="flex flex-col gap-1.5 w-full">
                  <button
                    type="submit"
                    disabled={lockoutTimeLeft > 0 || !pin}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-[#adaaab] via-[#ffffff] to-[#adaaab] hover:from-white hover:via-white hover:to-[#adaaab] text-[#060505] text-xs font-black rounded-xl shadow-[0_4px_20px_rgba(255,255,255,0.18)] hover:shadow-[0_4px_25px_rgba(255,255,255,0.3)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 tracking-wider uppercase disabled:opacity-40"
                  >
                    <span>{lang === 'bn' ? 'প্রবেশ করুন' : 'PROCEED'}</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </form>

              {/* =========================================================================
                  MOBILE COMPACT SAVED ACCOUNTS MICRO-CHIPS (Obsidian & Platinum Aesthetic)
                  ========================================================================= */}
              {rememberedCustomers.length > 0 && (
                <div className="md:hidden w-full mt-2.5 mb-0.5 bg-[#060505]/95 backdrop-blur-xl border border-[#494545] p-2.5 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-md bg-[#494545]/60 border border-[#545454] flex items-center justify-center">
                        <Users className="w-2.5 h-2.5 text-[#adaaab]" />
                      </div>
                      <span className="text-[9.5px] font-black text-white tracking-wide">
                        {lang === 'bn' ? 'সেভ থাকা অ্যাকাউন্ট:' : 'Saved Accounts:'}
                      </span>
                      <span className="text-[8px] font-mono font-black px-1.5 py-0.2 rounded-md bg-[#494545] text-[#adaaab] border border-[#545454]">
                        {toBn(rememberedCustomers.length)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveOneByOne}
                      className="text-[8.5px] font-bold text-[#adaaab] hover:text-white px-2 py-0.5 rounded-md hover:bg-[#494545] border border-[#545454]/60 transition-all cursor-pointer"
                    >
                      {lang === 'bn' ? 'মুছুন' : 'Clear'}
                    </button>
                  </div>

                  <div className={`grid ${rememberedCustomers.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5`}>
                    {rememberedCustomers.map((cust) => (
                      <div
                        key={cust.id || cust.phone}
                        onClick={() => {
                          soundEngine.playPinUnlockSound();
                          addRememberedCustomer(cust);
                          onUnlock('customer', cust.id);
                        }}
                        className="flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl bg-gradient-to-r from-[#112940]/95 via-[#183b5e]/95 to-[#112940]/95 hover:from-[#183b5e] hover:to-[#183b5e] border-2 border-sky-400/65 hover:border-sky-300 text-left transition-all cursor-pointer active:scale-95 group shadow-[0_4px_16px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/30"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-sky-600 via-sky-500 to-sky-400 text-white font-black text-[10.5px] flex items-center justify-center shrink-0 border border-sky-200/60 shadow-[0_0_8px_rgba(56,189,248,0.4)]">
                            {cust.name ? cust.name.charAt(0).toUpperCase() : <User className="w-3 h-3 text-sky-100" />}
                          </div>
                          {/* ONLY CUSTOMER NAME IS SHOWN - SOFT LIGHT BLUE HIGHLIGHT FOR INSTANT RECOGNITION */}
                          <span className="text-[11.5px] font-black text-sky-100 group-hover:text-white truncate leading-tight tracking-tight drop-shadow-xs">
                            {cust.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <ArrowRight className="w-3.5 h-3.5 text-sky-300 group-hover:text-white group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSpecific(cust.id);
                            }}
                            className="p-1 rounded-md text-sky-300/70 hover:text-white hover:bg-sky-900/60 transition-colors"
                            title={lang === 'bn' ? 'মুছুন' : 'Remove'}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Compact 3-Column Agent Infobox (Obsidian & Slate Theme, High Legibility) */}
          <div className="w-full bg-[#060505]/95 backdrop-blur-xl border border-[#494545] rounded-2xl p-2.5 space-y-1.5 text-left mt-2.5 shadow-[0_10px_25px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
            <h4 className="text-[9px] font-extrabold text-[#adaaab] uppercase tracking-widest text-center pb-1 border-b border-[#494545]">
              {lang === 'bn' ? 'টাকা তুলতে ও পাঠাতে যোগাযোগ করুন' : 'GET IN TOUCH & AGENTS'}
            </h4>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-[#494545]/35 p-1.5 rounded-xl border border-[#545454] hover:border-[#adaaab]/60 transition-all flex flex-col items-center shadow-xs">
                <span className="flex items-center gap-1 text-[8.5px] font-black text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
                  {lang === 'bn' ? 'বিকাশ' : 'bKash'}
                </span>
                <span className="font-mono text-white text-[10px] tracking-tight font-black mt-0.5 select-all">01756565454</span>
              </div>
              <div className="bg-[#494545]/35 p-1.5 rounded-xl border border-[#545454] hover:border-[#adaaab]/60 transition-all flex flex-col items-center shadow-xs">
                <span className="flex items-center gap-1 text-[8.5px] font-black text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
                  {lang === 'bn' ? 'নগদ' : 'Nagad'}
                </span>
                <span className="font-mono text-white text-[10px] tracking-tight font-black mt-0.5 select-all">01754543737</span>
              </div>
              <div className="bg-[#494545]/35 p-1.5 rounded-xl border border-[#545454] hover:border-[#adaaab]/60 transition-all flex flex-col items-center shadow-xs">
                <span className="flex items-center gap-1 text-[8.5px] font-black text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                  {lang === 'bn' ? 'WhatsApp' : 'WhatsApp'}
                </span>
                <span className="font-mono text-white text-[10px] tracking-tight font-black mt-0.5 select-all">01783586858</span>
              </div>
            </div>
          </div>

        </div>

        {/* =========================================================================
            DESKTOP SIDE PANEL: COMPANION CARD BESIDE THE LOGIN CARD
            (Obsidian & Platinum Theme, Crystal-Clear Contrast, Eye-Friendly)
            ========================================================================= */}
        {rememberedCustomers.length > 0 && (
          <div className="hidden md:flex flex-col w-64 lg:w-72 bg-[#060505]/95 backdrop-blur-2xl border border-[#494545] rounded-[28px] p-4.5 shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(173,170,171,0.08)] self-center animate-fade-in relative ring-1 ring-white/5 before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-[#adaaab]/40 before:to-transparent before:rounded-t-[28px]">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#494545]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#494545]/60 border border-[#545454] flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-[#adaaab]" />
                </div>
                <span className="text-xs font-black text-white tracking-wide">
                  {lang === 'bn' ? 'সংরক্ষিত অ্যাকাউন্ট' : 'Saved Accounts'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-[#494545] text-[#adaaab] border border-[#545454] shadow-xs">
                {toBn(rememberedCustomers.length)}/২
              </span>
            </div>

            <p className="text-[10.5px] font-medium text-[#adaaab] mb-3 leading-relaxed">
              {lang === 'bn' ? '১-ক্লিকে সরাসরি কাস্টমার একাউন্টে প্রবেশ করুন:' : '1-click direct customer account login:'}
            </p>

            <div className="flex flex-col gap-2">
              {rememberedCustomers.map((cust) => (
                <div 
                  key={cust.id || cust.phone}
                  onClick={() => {
                    soundEngine.playPinUnlockSound();
                    addRememberedCustomer(cust);
                    onUnlock('customer', cust.id);
                  }}
                  className="group relative flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-[#112940]/95 via-[#183b5e]/95 to-[#112940]/95 hover:from-[#183b5e] hover:to-[#183b5e] border-2 border-sky-400/65 hover:border-sky-300 transition-all cursor-pointer shadow-[0_6px_20px_rgba(56,189,248,0.25)] hover:shadow-[0_8px_25px_rgba(56,189,248,0.35)] active:scale-[0.98] ring-1 ring-sky-400/30"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-sky-600 via-sky-500 to-sky-400 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(56,189,248,0.4)] border border-sky-200/60">
                      {cust.name ? cust.name.charAt(0).toUpperCase() : <User className="w-4 h-4 text-sky-100" />}
                    </div>
                    {/* ONLY CUSTOMER NAME IS DISPLAYED - SOFT LIGHT BLUE HIGHLIGHT FOR INSTANT RECOGNITION */}
                    <p className="text-xs font-black text-sky-100 group-hover:text-white truncate tracking-tight drop-shadow-xs">
                      {cust.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-sky-400 via-sky-200 to-sky-400 hover:from-sky-300 hover:to-sky-200 text-[#061727] border border-sky-100 text-[10.5px] font-black transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(56,189,248,0.35)] group-hover:scale-105">
                      <span>{lang === 'bn' ? 'প্রবেশ' : 'Login'}</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform stroke-[2.5] text-[#061727]" />
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSpecific(cust.id);
                      }}
                      className="p-1.5 rounded-lg text-sky-300/70 hover:text-white hover:bg-sky-900/60 transition-colors"
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
              className="text-[10px] font-bold text-[#9d9b9b] hover:text-white hover:bg-[#494545]/40 py-1.5 px-3 rounded-xl border border-transparent hover:border-[#545454] mt-3 text-center transition-all cursor-pointer"
            >
              {lang === 'bn' ? 'সংরক্ষিত অ্যাকাউন্ট সরান' : 'Remove saved accounts'}
            </button>
          </div>
        )}

      </div>
      
      {/* =========================================================================
          CUSTOMER REGISTRATION FULL PAGE VIEW (Obsidian & Platinum Aesthetic)
          ========================================================================= */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-[#060505]/95 backdrop-blur-2xl z-[10000] overflow-y-auto animate-fade-in flex flex-col justify-between p-4 sm:p-6 font-sans">
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
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#494545]/60 hover:bg-[#545454]/80 text-[#adaaab] hover:text-white border border-[#545454] transition-all text-xs font-bold active:scale-95 cursor-pointer shadow-sm backdrop-blur-md"
              >
                <ArrowLeft className="w-4 h-4 text-[#adaaab]" />
                <span>{lang === 'bn' ? 'ফিরে যান' : 'Back to Login'}</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-white bg-[#494545]/80 border border-[#545454] px-3 py-1 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.5)]">
                  {lang === 'bn' ? 'কাস্টমার রেজিস্ট্রেশন' : 'Customer Signup'}
                </span>
              </div>
            </div>

            {/* Registration Card (Obsidian & Platinum Modal) */}
            <div className="bg-[#060505]/95 backdrop-blur-2xl border border-[#494545] rounded-[32px] shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_35px_rgba(173,170,171,0.1)] p-6 sm:p-7 flex flex-col relative before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-[#adaaab]/40 before:to-transparent before:rounded-t-[32px]">
              {/* Header */}
              <div className="flex flex-col items-center mb-5 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#494545] via-[#545454] to-[#9d9b9b] text-white mb-2.5 shadow-[0_0_20px_rgba(173,170,171,0.25)] border border-[#adaaab]/30">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                  {lang === 'bn' ? 'নতুন কাস্টমার একাউন্ট অনুরোধ' : 'CREATE CUSTOMER ACCOUNT'}
                </h2>
                <p className="text-[11px] font-semibold text-[#adaaab]/90 mt-1">
                  {lang === 'bn' ? 'আপনার সঠিক তথ্য দিয়ে অনুরোধ সাবমিট করুন' : 'Fill details below to submit request'}
                </p>
              </div>

              {/* Inputs Form */}
              <div className="space-y-4">
                {/* Mandatory Photo Selection block */}
                <div className="flex flex-col items-center justify-center bg-[#494545]/20 border border-[#545454] rounded-2xl p-4 mb-1">
                  <p className="text-[10px] font-black text-[#adaaab] uppercase tracking-widest mb-2 px-0.5 text-center flex items-center gap-1">
                    <span>{lang === 'bn' ? 'আপনার ছবি যুক্ত করুন' : 'ADD YOUR PHOTO'}</span>
                    <span className="text-rose-400 font-black">({lang === 'bn' ? 'বাধ্যতামূলক *' : 'MANDATORY *'})</span>
                  </p>
                  <div className="relative group shrink-0">
                    <div 
                      className="w-20 h-20 rounded-full border-2 border-[#adaaab]/50 overflow-hidden bg-[#060505] relative flex items-center justify-center shadow-[0_0_20px_rgba(173,170,171,0.2)]"
                    >
                      {registerPhoto ? (
                        <img 
                          src={registerPhoto} 
                          alt="Profile Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-10 h-10 text-[#adaaab]" />
                      )}
                    </div>
                    
                    {/* Photo Actions with canvas scaler embedded directly */}
                    <div className="absolute -bottom-1 -right-1 flex gap-1">
                      <label 
                        className="bg-gradient-to-r from-[#494545] to-[#545454] hover:from-[#545454] hover:to-[#545454] text-white p-2 rounded-full border-2 border-[#060505] shadow-[0_0_12px_rgba(173,170,171,0.3)] transition-all cursor-pointer flex items-center justify-center active:scale-90"
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
                          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 p-2 rounded-full border border-rose-500/40 shadow-sm transition-all cursor-pointer flex items-center justify-center active:scale-95"
                          title={lang === 'bn' ? 'ছবি মুছুন' : 'Remove Photo'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-[#adaaab] uppercase tracking-wider mb-1.5 px-0.5">
                    {lang === 'bn' ? 'আপনার পুরো নাম' : 'YOUR FULL NAME'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#adaaab]">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      placeholder={lang === 'bn' ? 'আপনার পুরো নাম লিখুন' : 'Enter your full name'}
                      className="w-full bg-[#060505]/90 border border-[#545454] focus:border-[#adaaab] focus:ring-2 focus:ring-[#adaaab]/20 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-white placeholder-[#9d9b9b]/50 outline-none transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-[#adaaab] uppercase tracking-wider mb-1.5 px-0.5">
                    {lang === 'bn' ? '১১ ডিজিটের মোবাইল নম্বর' : '11-DIGIT MOBILE NUMBER'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#adaaab]">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      maxLength={11}
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="01XXXXXXXXX"
                      className="w-full bg-[#060505]/90 border border-[#545454] focus:border-[#adaaab] focus:ring-2 focus:ring-[#adaaab]/20 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-white placeholder-[#9d9b9b]/50 outline-none transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] font-mono"
                    />
                  </div>
                </div>

                {registerError && (
                  <div className="text-[10.5px] font-black text-rose-200 bg-rose-950/70 border border-rose-500/50 px-3.5 py-2.5 rounded-xl text-center shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                    {registerError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isRegisterSubmitting}
                  onClick={handleRegisterSubmit}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#adaaab] via-[#ffffff] to-[#adaaab] hover:from-white hover:to-white text-[#060505] text-xs font-black rounded-2xl shadow-[0_4px_25px_rgba(255,255,255,0.2)] hover:shadow-[0_4px_30px_rgba(255,255,255,0.3)] transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider mt-2 disabled:opacity-50"
                >
                  {isRegisterSubmitting ? (
                    <>
                      <span className="border-2 border-[#060505] border-t-transparent rounded-full w-4 h-4 animate-spin" />
                      <span>{lang === 'bn' ? 'অনুরোধ পাঠানো হচ্ছে...' : 'SUBMITTING...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{lang === 'bn' ? 'অনুরোধ পাঠান' : 'SUBMIT REQUEST'}</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] font-bold text-[#9d9b9b] select-none mt-4 text-center leading-normal">
                {lang === 'bn' ? 'অনুরোধ পাঠানোর পর দোকান মালিকের অনুমোদনের জন্য অপেক্ষা করুন।' : 'After submitting, wait for shop owner approval.'}
              </p>
            </div>
          </div>

          <div className="text-center py-2 select-none">
            <p className="text-[8.5px] font-bold text-[#9d9b9b]/80 tracking-wider uppercase">
              Proprietor & App Design: Mahbub Hasan
            </p>
          </div>
        </div>
      )}

      {/* REGISTRATION PENDING ALERT MODAL (Obsidian & Amber) */}
      {registerSuccessMsg && (
        <div className="fixed inset-0 bg-[#060505]/85 backdrop-blur-md flex items-center justify-center p-4 z-[10001] animate-fade-in font-sans">
          <div 
            className="relative w-full max-w-sm bg-[#060505]/95 backdrop-blur-2xl border border-[#494545] rounded-[32px] shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(173,170,171,0.15)] p-6 flex flex-col items-center transition-all transform duration-300"
          >
            {/* Pulsing Alert Icon */}
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#494545]/60 border border-amber-400/40 text-amber-400 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
              <Clock className="w-8 h-8 animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-amber-400/15 animate-ping" />
            </div>

            <h3 className="text-sm font-black text-white uppercase tracking-wider text-center mb-2">
              {lang === 'bn' ? 'অনুরোধ পেন্ডিং আছে' : 'REQUEST PENDING'}
            </h3>

            {/* Precise message matching user intent */}
            <p className="text-xs font-bold text-amber-200 text-center leading-relaxed px-4 bg-[#494545]/40 border border-amber-500/30 rounded-2xl py-3.5 mb-4 shadow-inner">
              {registerSuccessMsg}
            </p>

            <button
              onClick={() => {
                setRegisterSuccessMsg(null);
                setShowRegisterModal(false);
                setRegisterName('');
                setRegisterPhone('');
              }}
              className="w-full py-3 bg-gradient-to-r from-[#adaaab] via-white to-[#adaaab] hover:from-white hover:to-white text-[#060505] text-xs font-black rounded-2xl shadow-[0_4px_20px_rgba(255,255,255,0.2)] transition-all active:scale-[0.98] cursor-pointer"
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
      {showLiveChatModal && (
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
          shopStatus="open"
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
      )}

      {/* REGISTRATION SUBMISSION LOADER */}
      <PremiumAppLoader
        isOpen={isRegisterSubmitting}
        title={lang === 'bn' ? 'অনুরোধ পাঠানো হচ্ছে...' : 'Submitting Request...'}
        icon={UserPlus}
        iconGradient="from-[#494545] to-[#545454]"
        ringColor="border-[#adaaab]"
        progressColor="from-[#545454] to-[#adaaab]"
      />

      {/* PWA INSTALL INSTRUCTIONS MODAL (Obsidian & Platinum) */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060505]/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#060505]/95 backdrop-blur-2xl border border-[#494545] rounded-3xl p-5 max-w-sm w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#adaaab] hover:text-white hover:bg-[#494545] cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#494545]/60 border border-[#545454] flex items-center justify-center text-[#adaaab] shadow-[0_0_12px_rgba(173,170,171,0.25)]">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  {lang === 'bn' ? 'অ্যাপ ইন্সটল করার নিয়ম' : 'How to Install App'}
                </h3>
                <p className="text-[11px] text-[#adaaab] font-bold">HelloPoint Digital Cashbook</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-white bg-[#494545]/20 p-3 rounded-2xl border border-[#545454]">
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded bg-[#adaaab] text-[#060505] font-black text-[10px] shrink-0 mt-0.5">১</span>
                <span>{lang === 'bn' ? 'Android/Chrome-এ: ব্রাউজারের উপরে ৩-ডট মেনু (⋮) চাপুন এবং "Install app" বা "Add to Home screen" নির্বাচন করুন।' : 'On Android/Chrome: Tap 3 dots (⋮) and select "Install app" or "Add to Home screen".'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded bg-[#adaaab] text-[#060505] font-black text-[10px] shrink-0 mt-0.5">২</span>
                <span>{lang === 'bn' ? 'iPhone/Safari-তে: নিচে Share বাটনে ট্যাপ করে "Add to Home Screen" (+) এ চাপুন।' : 'On iPhone/Safari: Tap Share button and select "Add to Home Screen" (+).'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-[#adaaab] via-white to-[#adaaab] hover:from-white hover:to-white text-[#060505] text-xs font-black shadow-md cursor-pointer transition-all"
            >
              {lang === 'bn' ? 'ঠিক আছে' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
