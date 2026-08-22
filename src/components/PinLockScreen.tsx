import React, { useState, useEffect } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { Lock, ShieldCheck, X, KeyRound, ArrowRight, ArrowLeft, UserPlus, User, Phone, Clock, Camera, Trash2, MessageCircle, ShoppingBag } from 'lucide-react';
import { Contact, Product, ChatMessage, ChatQuickFAQ } from '../types';
import { APP_PROPRIETOR_NAME } from '../version';
import { VisitorLiveChatModal } from './VisitorLiveChatModal';
import { VisitorShopModal } from './VisitorShopModal';

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

  // New States for Shop Status level indicators and Saved logins
  const [localShopStatus, setLocalShopStatus] = useState<'open' | 'closed'>('open');
  const shopStatus = propShopStatus || localShopStatus;
  const [rememberedCustId, setRememberedCustId] = useState<string | null>(null);
  const [rememberedCustName, setRememberedCustName] = useState<string | null>(null);
  const [rememberedCustNum, setRememberedCustNum] = useState<string | null>(null);

  // Brute force protection lockout states
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number>(0);

  useEffect(() => {
    // Dynamic storage sync helper
    const syncStatus = () => {
      const status = (localStorage.getItem('hellopoint_shop_status') as 'open' | 'closed') || 'open';
      setLocalShopStatus(status);

      setRememberedCustId(localStorage.getItem('hellopoint_remembered_cust_id'));
      setRememberedCustName(localStorage.getItem('hellopoint_remembered_cust_name'));
      setRememberedCustNum(localStorage.getItem('hellopoint_remembered_cust_num'));
    };

    syncStatus();
    // Watch other context storage updates dynamically
    window.addEventListener('storage', syncStatus);
    return () => window.removeEventListener('storage', syncStatus);
  }, []);

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
        localStorage.setItem('hellopoint_pin_session_time', Date.now().toString());
        setFailedAttempts(0);
        onUnlock('owner');
      }
      // If it doesn't match the owner's 4-digit PIN, is it the beginning of a customer's phone?
      // Do nothing, let them keep entering up to 11 digits seamlessly.
    } else {
      // First-time owner setup
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
      setErrorMsg('');
      setFailedAttempts(0);
      
      // Store customer's login details dynamically
      localStorage.setItem('hellopoint_remembered_cust_id', customer.id);
      localStorage.setItem('hellopoint_remembered_cust_name', customer.name);
      localStorage.setItem('hellopoint_remembered_cust_num', completedPhone);

      setRememberedCustId(customer.id);
      setRememberedCustName(customer.name);
      setRememberedCustNum(completedPhone);

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

      {/* Main Landing / Locked Screen Card */}
      <div className="relative w-full max-w-sm rounded-[24px] p-4.5 flex flex-col justify-between h-auto transition-all duration-300 transform bg-white border-slate-150 shadow-[0_12px_32px_-6px_rgba(78,57,175,0.08)] border">
        
        {/* Brand logo section */}
        <div className="mb-3 flex flex-col items-center w-full">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-650 to-indigo-700 text-white shadow-sm border border-purple-400/20 mb-2.5">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>

          {/* HelloPoint Brand Title & Direct authentication Form on-card */}
          <div className="flex flex-col items-center gap-1.5 justify-center w-full">
            <h1 className="text-[38px] sm:text-[46px] font-black tracking-tight sm:tracking-tighter leading-none select-none flex items-center gap-2">
              <span>
                <span className="text-slate-900">Hello</span>
                <span className="bg-gradient-to-r from-[#6200EE] via-[#7C4DFF] to-[#00B0FF] bg-clip-text text-transparent">Point</span>
              </span>
              {shopStatus === 'open' ? (
                <div className="border rounded-full px-1.5 py-0.2 flex items-center gap-0.5 text-[8px] font-black tracking-wide bg-emerald-50 text-emerald-700 border-emerald-200/40">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse relative flex" />
                  <span>Open</span>
                </div>
              ) : (
                <div className="border rounded-full px-1.5 py-0.2 flex items-center gap-0.5 text-[8px] font-black tracking-wide bg-red-50 text-red-700 border-red-200/40">
                  <span className="w-1 h-1 rounded-full bg-red-500 relative flex" />
                  <span>Closed</span>
                </div>
              )}
            </h1>

            {/* VISITOR SERVICES: LIVE CHAT & ONLINE SHOP - DIRECTLY UNDER HELLOPOINT LOGO */}
            <div className="w-full mt-2.5 mb-1">
              <div className="grid grid-cols-2 gap-1.5">
                {/* 1. Live Chat Button with dot */}
                <button
                  type="button"
                  onClick={() => {
                    setChatInitialMessage('');
                    setShowLiveChatModal(true);
                  }}
                  className="relative flex items-center justify-center gap-1.5 py-2 px-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200/80 rounded-xl text-emerald-900 shadow-2xs active:scale-95 transition-all cursor-pointer group"
                >
                  {/* Blinking Dot Indicator in front of name */}
                  <span className="relative flex h-2 w-2 shrink-0">
                    {shopStatus === 'open' ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                    )}
                  </span>

                  <span className="text-[9.5px] font-black tracking-tight whitespace-nowrap">
                    {lang === 'bn' ? 'লাইভ চ্যাট' : 'Live Chat'}
                  </span>
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                </button>

                {/* 2. Online Shop Button */}
                <button
                  type="button"
                  onClick={() => setShowShopModal(true)}
                  className="relative flex items-center justify-center gap-1.5 py-2 px-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border border-purple-200/80 rounded-xl text-purple-900 shadow-2xs active:scale-95 transition-all cursor-pointer group"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-purple-600 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="text-[9.5px] font-black tracking-tight whitespace-nowrap">
                    {lang === 'bn' ? 'অনলাইন শপ' : 'Online Shop'}
                  </span>
                  {products.filter(p => p.inStock).length > 0 && (
                    <span className="text-[7.5px] font-black bg-purple-600 text-white px-1 py-0.2 rounded-full leading-none shrink-0">
                      {products.filter(p => p.inStock).length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Direct Number & PIN Authentication Card Input - Strict User Intent */}
            <form 
              onSubmit={handleLoginSubmit}
              className={`w-full mt-2 transition-all transform duration-300 ${
                isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
              }`}
            >
              {/* Clean Title */}
              <div className="flex flex-col items-center mb-2.5">
                <h2 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">
                  {lang === 'bn' ? 'মোবাইল নম্বর লিখুন' : 'ENTER MOBILE NUMBER'}
                </h2>
              </div>

              {/* Lockout Countdown Timer */}
              {lockoutTimeLeft > 0 && (
                <div className="w-full bg-red-50 border border-red-100 p-2 rounded-xl flex flex-col items-center text-center text-red-700 font-extrabold text-[10.5px] mb-2 select-none shadow-inner">
                  <div className="flex items-center gap-1 mb-0.5 text-[9px] uppercase tracking-wider text-red-800">
                    <span className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
                    <span>🔒 Lockout Active</span>
                  </div>
                  <span>
                    Try again in {lockoutTimeLeft}s
                  </span>
                </div>
              )}

              {/* Input for Mobile Number or PIN */}
              <div className="w-full mb-2.5">
                <input
                  type="tel"
                  maxLength={11}
                  value={pin}
                  onChange={handleInputChange}
                  placeholder={lang === 'bn' ? 'মোবাইল বা পিন নম্বর' : 'Mobile / PIN'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-center text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-purple-400 focus:bg-white transition-all font-mono tracking-wider"
                  disabled={lockoutTimeLeft > 0}
                  autoFocus
                />
              </div>

              {/* Error alerts inside the layout */}
              {errorMsg && (
                <p className="text-[9px] font-extrabold text-red-650 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg text-center leading-normal max-w-full mb-2.5 animate-fade-in">
                  {errorMsg}
                </p>
              )}

              {/* Proceed and Reg Options */}
              <div className="flex flex-col gap-1 w-full">
                <button
                  type="submit"
                  disabled={lockoutTimeLeft > 0 || !pin}
                  className="w-full py-2 px-3 bg-gradient-to-r from-purple-650 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white text-[10px] font-black rounded-xl shadow-tiny active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider disabled:opacity-50"
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
                  className="w-full py-1 text-purple-600 hover:text-purple-700 text-[9.5px] font-black transition-all cursor-pointer text-center underline underline-offset-1"
                >
                  {lang === 'bn' ? 'নতুন অ্যাকাউন্ট অনুরোধ করুন' : 'Request Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Remembered Customer Quick Login Widget */}
        {rememberedCustId && rememberedCustNum && rememberedCustName && (
          <div className="w-full bg-purple-50/50 border border-purple-100 p-3 rounded-2xl flex flex-col items-center text-center mb-4 transition-all">
            <p className="text-[8.5px] font-black text-purple-500 uppercase tracking-widest leading-none mb-1.5">
              {lang === 'bn' ? 'আগের সংরক্ষিত গ্রাহক' : 'Remembered Customer'}
            </p>
            <p className="text-xs font-black text-slate-800 leading-none">
              {rememberedCustName}
            </p>
            <button
              onClick={() => {
                onUnlock('customer', rememberedCustId);
              }}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-705 hover:to-indigo-705 active:scale-95 text-white text-[10px] font-black rounded-xl shadow-tiny transition-all cursor-pointer"
            >
              <span>{lang === 'bn' ? 'সহজ লগইন এ প্রবেশ করুন' : 'Tap to Login'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('hellopoint_remembered_cust_id');
                localStorage.removeItem('hellopoint_remembered_cust_name');
                localStorage.removeItem('hellopoint_remembered_cust_num');
                setRememberedCustId(null);
                setRememberedCustName(null);
                setRememberedCustNum(null);
              }}
              className="text-[8.5px] font-extrabold text-slate-450 hover:text-red-500 mt-1.5 underline underline-offset-2 transition-all cursor-pointer"
            >
              {lang === 'bn' ? 'অন্য অ্যাকাউন্ট লগইন' : 'Switch Customer / Logout'}
            </button>
          </div>
        )}

        {/* Detailed Premium Contact Infobox */}
        <div className="w-full bg-slate-50 border border-slate-100/80 rounded-2xl p-3.5 space-y-1.5 text-left mb-2">
          <h4 className="text-[9px] font-black text-slate-450 uppercase tracking-widest mb-2 text-center pb-1 border-b border-slate-200/60">
            {lang === 'bn' ? 'টাকা তুলতে ও পাঠাতে যোগাযোগ করুন' : 'GET IN TOUCH & AGENTS'}
          </h4>
          <div className="space-y-1 text-[10.5px]">
            <div className="flex items-center justify-between font-bold text-slate-650 bg-white/85 px-2.5 py-1.5 rounded-lg border border-slate-100 gap-2">
              <span className="flex items-center gap-1 font-extrabold text-[#da1c5c] shrink-0 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#da1c5c]" />
                {lang === 'bn' ? 'বিকাশ এজেন্ট' : 'bKash Agent'}
              </span>
              <span className="font-mono text-slate-800 tracking-wide font-black shrink-0 whitespace-nowrap">01756565454</span>
            </div>
            <div className="flex items-center justify-between font-bold text-slate-650 bg-white/85 px-2.5 py-1.5 rounded-lg border border-slate-100 gap-2">
              <span className="flex items-center gap-1 font-extrabold text-[#f7941d] shrink-0 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f7941d]" />
                {lang === 'bn' ? 'নগদ এজেন্ট' : 'Nagad Agent'}
              </span>
              <span className="font-mono text-slate-800 tracking-wide font-black shrink-0 whitespace-nowrap">01754543737</span>
            </div>
            <div className="flex items-center justify-between font-bold text-slate-650 bg-white/85 px-2.5 py-1.5 rounded-lg border border-slate-100 gap-2">
              <span className="flex items-center gap-1 font-extrabold text-emerald-600 shrink-0 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {lang === 'bn' ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}
              </span>
              <span className="font-mono text-slate-800 tracking-wide font-black shrink-0 whitespace-nowrap">01783586858</span>
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
        onOrderInquiry={(prod, customerName, customerPhone, note) => {
          setShowShopModal(false);
          const inquiryMsg = `${lang === 'bn' ? 'আমি এই প্রডাক্টটি নিতে আগ্রহী / বিস্তারিত জানতে চাই:' : 'I am interested in this product:'}\n📦 ${prod.name}\n💰 ${currency}${prod.price}${prod.category ? ` (${prod.category})` : ''}${note ? `\n📝 ${lang === 'bn' ? 'নোট:' : 'Note:'} ${note}` : ''}`;
          setChatInitialMessage(inquiryMsg);
          setChatInitialName(customerName);
          setChatInitialPhone(customerPhone);
          setShowLiveChatModal(true);
        }}
      />
    </div>
  );
}
