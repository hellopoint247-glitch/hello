/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { MessageSquare, Send, X, User, Phone, CheckCheck, ShieldAlert, ArrowRight, UserPlus, Lock, Trash2 } from 'lucide-react';
import { ChatMessage, ChatQuickFAQ } from '../types';
import { DEFAULT_QUICK_FAQS } from '../utils/storage';

interface VisitorLiveChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (contactId: string, text: string, senderRole?: 'owner' | 'customer', senderName?: string, senderPhone?: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onMarkChatsAsRead?: (contactId: string, role: 'owner' | 'customer') => void;
  shopStatus: 'open' | 'closed';
  lang: 'bn' | 'en';
  themeColor?: string;
  initialMessage?: string;
  initialVisitorName?: string;
  initialVisitorPhone?: string;
  onRegisterVisitorContact?: (visitorId: string, visitorName: string, phone?: string) => void;
  quickFaqs?: ChatQuickFAQ[];
  onRequestOpenRegisterModal?: () => void;
}

export function VisitorLiveChatModal({
  isOpen,
  onClose,
  chatMessages,
  onSendMessage,
  onDeleteMessage,
  onMarkChatsAsRead,
  shopStatus,
  lang,
  themeColor = '#6244a6',
  initialMessage = '',
  initialVisitorName = '',
  initialVisitorPhone = '',
  onRegisterVisitorContact,
  quickFaqs = DEFAULT_QUICK_FAQS,
  onRequestOpenRegisterModal
}: VisitorLiveChatModalProps) {
  // Visitor Persistent ID
  const [visitorId] = useState<string>(() => {
    let savedId = localStorage.getItem('hellopoint_visitor_id');
    if (!savedId) {
      savedId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      localStorage.setItem('hellopoint_visitor_id', savedId);
    }
    return savedId;
  });

  // Device registered identity
  const [deviceRegisteredName, setDeviceRegisteredName] = useState<string>(() => {
    return localStorage.getItem('hellopoint_device_registered_name') || '';
  });
  const [deviceRegisteredPhone, setDeviceRegisteredPhone] = useState<string>(() => {
    return localStorage.getItem('hellopoint_device_registered_phone') || '';
  });
  const [isDeviceLocked, setIsDeviceLocked] = useState<boolean>(() => {
    return localStorage.getItem('hellopoint_device_registered_locked') === 'true';
  });

  // Active form values
  const [visitorName, setVisitorName] = useState<string>(() => {
    return initialVisitorName || localStorage.getItem('hellopoint_device_registered_name') || localStorage.getItem('hellopoint_visitor_name') || '';
  });

  const [visitorPhone, setVisitorPhone] = useState<string>(() => {
    return initialVisitorPhone || localStorage.getItem('hellopoint_device_registered_phone') || localStorage.getItem('hellopoint_visitor_phone') || '';
  });

  // Gate unlock status - chats and inputs are HIDDEN until info is submitted
  const [isChatUnlocked, setIsChatUnlocked] = useState<boolean>(() => {
    const isLockedOnDevice = localStorage.getItem('hellopoint_device_registered_locked') === 'true';
    const savedName = localStorage.getItem('hellopoint_device_registered_name') || localStorage.getItem('hellopoint_visitor_name');
    const savedPhone = localStorage.getItem('hellopoint_device_registered_phone') || localStorage.getItem('hellopoint_visitor_phone');
    return Boolean(isLockedOnDevice && savedName && savedPhone);
  });

  // Used FAQ IDs tracking (Requirement 1: Once clicked and replied, only that FAQ hides)
  const [usedFaqIds, setUsedFaqIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hellopoint_used_faqs_' + visitorId) || '[]');
    } catch {
      return [];
    }
  });

  const [deviceWarningMsg, setDeviceWarningMsg] = useState<string>('');
  const [inputValidationMsg, setInputValidationMsg] = useState<string>('');
  const [inputText, setInputText] = useState<string>(initialMessage || '');
  const [isAutoReplying, setIsAutoReplying] = useState<boolean>(false);
  const [typingText, setTypingText] = useState<string>('typing...');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      activeTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Sync initial message if provided
  useEffect(() => {
    if (initialMessage) {
      setInputText(initialMessage);
    }
  }, [initialMessage]);

  useEffect(() => {
    if (initialVisitorName) {
      setVisitorName(initialVisitorName);
    }
    if (initialVisitorPhone) {
      setVisitorPhone(initialVisitorPhone);
    }
  }, [initialVisitorName, initialVisitorPhone]);

  // Messages for this visitor
  const currentVisitorMessages = chatMessages.filter(m => m.contactId === visitorId);

  // Mark as read when opened or new messages arrive
  useEffect(() => {
    if (isOpen && isChatUnlocked && onMarkChatsAsRead && visitorId) {
      onMarkChatsAsRead(visitorId, 'customer');
    }
  }, [isOpen, isChatUnlocked, chatMessages.length, visitorId, onMarkChatsAsRead]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen && isChatUnlocked) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, isChatUnlocked, currentVisitorMessages.length, isAutoReplying]);

  const activeFaqs = (quickFaqs && quickFaqs.length > 0 ? quickFaqs : DEFAULT_QUICK_FAQS).filter(f => f.active !== false);
  const visibleFaqs = activeFaqs.filter(faq => !usedFaqIds.includes(faq.id));

  const cleanDigits = (s: string) => {
    if (!s) return '';
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    let res = s.trim();
    for (let i = 0; i < 10; i++) {
      res = res.replaceAll(bnNums[i], String(i));
    }
    return res.replace(/\D/g, '');
  };

  // Submit gate form
  const handleStartChatSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setInputValidationMsg('');
    setDeviceWarningMsg('');

    const trimmedName = visitorName.trim();
    const cleanedPhone = cleanDigits(visitorPhone);

    if (!trimmedName) {
      setInputValidationMsg(lang === 'bn' ? 'দয়া করে আপনার নাম লিখুন।' : 'Please enter your name.');
      return;
    }

    if (cleanedPhone.length !== 11) {
      setInputValidationMsg(lang === 'bn' ? 'দয়া করে ১১ ডিজিটের সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid 11-digit mobile number.');
      return;
    }

    // Check device lock consistency (Requirement 5)
    if (isDeviceLocked && deviceRegisteredPhone && deviceRegisteredPhone !== cleanedPhone) {
      setDeviceWarningMsg(
        lang === 'bn'
          ? `এই ডিভাইস থেকে ইতিপূর্বে (${deviceRegisteredName || 'পূর্বের নাম'}, ${deviceRegisteredPhone}) নম্বর দিয়ে চ্যাট রেজিস্টার করা হয়েছে। দয়া করে আপনার আগের তথ্য দিয়ে সাবমিট করুন অথবা নাম, মোবাইল নম্বর ও ছবি দিয়ে 'নতুন অ্যাকাউন্ট' খুলুন।`
          : `This device is previously registered with (${deviceRegisteredName || 'Previous Name'}, ${deviceRegisteredPhone}). Please use your registered info or create a new account with photo.`
      );
      return;
    }

    // Save & lock info on this device
    localStorage.setItem('hellopoint_device_registered_name', trimmedName);
    localStorage.setItem('hellopoint_device_registered_phone', cleanedPhone);
    localStorage.setItem('hellopoint_device_registered_locked', 'true');
    localStorage.setItem('hellopoint_visitor_name', trimmedName);
    localStorage.setItem('hellopoint_visitor_phone', cleanedPhone);

    setDeviceRegisteredName(trimmedName);
    setDeviceRegisteredPhone(cleanedPhone);
    setIsDeviceLocked(true);
    setIsChatUnlocked(true);

    if (onRegisterVisitorContact) {
      onRegisterVisitorContact(visitorId, trimmedName, cleanedPhone);
    }
  };

  const handleFillRegisteredInfo = () => {
    if (deviceRegisteredName) setVisitorName(deviceRegisteredName);
    if (deviceRegisteredPhone) setVisitorPhone(deviceRegisteredPhone);
    setDeviceWarningMsg('');
    setInputValidationMsg('');
  };

  // Handle Ready-Made FAQ Click (Requirement 1 & Requirement 2)
  // 1. Ready-made messages give their answer in both open & closed states.
  // 2. Once clicked and replied, ONLY that FAQ hides from the bottom list.
  const handleQuickFaqClick = (faq: ChatQuickFAQ) => {
    if (isAutoReplying) return;

    const currentName = visitorName.trim() || deviceRegisteredName || (lang === 'bn' ? 'ভিজিটর' : 'Visitor');
    const currentPhone = visitorPhone.trim() || deviceRegisteredPhone || '';

    // 1. Send customer's selected question immediately with their Name & Phone
    onSendMessage(visitorId, faq.question, 'customer', currentName, currentPhone);

    // 2. Show typing... for 10 seconds, then reply and hide this specific FAQ (Requirement 1 & 2)
    const replyAnswer = (faq.answer && faq.answer.trim()) 
      ? faq.answer.trim() 
      : (lang === 'bn' ? 'ধন্যবাদ আপনার প্রশ্নের জন্য। আমরা আপনার সাথে শীঘ্রই যোগাযোগ করব।' : 'Thank you for your question. We will connect with you shortly.');

    setIsAutoReplying(true);
    setTypingText('typing...');

    const timer = setTimeout(() => {
      onSendMessage(visitorId, replyAnswer, 'owner', 'প্রোপাইটার (HelloPoint)');
      setIsAutoReplying(false);

      // Hide only this clicked ready-made question after reply is delivered
      setUsedFaqIds(prev => {
        const next = Array.from(new Set([...prev, faq.id]));
        localStorage.setItem('hellopoint_used_faqs_' + visitorId, JSON.stringify(next));
        return next;
      });
    }, 10000); // 10 seconds delay so customer feels it is a genuine response

    activeTimersRef.current.push(timer);
  };

  // Handle Custom Message Send (Requirement 2 & Requirement 3)
  // When shop is closed, typed message receives the shop closed warning.
  // Owner receives customer's exact Name & Phone Number.
  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const currentName = visitorName.trim() || deviceRegisteredName || (lang === 'bn' ? 'ভিজিটর' : 'Visitor');
    const currentPhone = visitorPhone.trim() || deviceRegisteredPhone || '';
    const trimmedMsg = inputText.trim();

    if (!trimmedMsg) return;

    // Send customer's message with their Name and Phone Number
    onSendMessage(visitorId, trimmedMsg, 'customer', currentName, currentPhone);
    setInputText('');

    // Check if Shop is closed (Requirement 2: Custom typed message triggers shop closed warning)
    if (shopStatus === 'closed') {
      setIsAutoReplying(true);
      setTypingText(lang === 'bn' ? 'টাইপ করছেন...' : 'typing...');
      const timer = setTimeout(() => {
        const closedReply = lang === 'bn'
          ? 'আমাদের শপ এখন বন্ধ আছে, অনলাইনে আসার সাথে সাথে আপনার সাথে যোগাযোগ করা হবে। ধন্যবাদ।'
          : 'Our shop is currently closed. We will get in touch with you as soon as we are online. Thank you.';
        onSendMessage(visitorId, closedReply, 'owner', 'প্রোপাইটার (HelloPoint)');
        setIsAutoReplying(false);
      }, 2500);
      activeTimersRef.current.push(timer);
      return;
    }

    // Check if this is the customer's very first custom message (Shop is open)
    const welcomedKey = 'hellopoint_welcomed_' + visitorId;
    const hasBeenWelcomed = localStorage.getItem(welcomedKey) === 'true';
    const customerSentCount = currentVisitorMessages.filter(m => m.senderRole === 'customer').length;

    if (!hasBeenWelcomed && customerSentCount === 0) {
      localStorage.setItem(welcomedKey, 'true');
      setIsAutoReplying(true);
      setTypingText(lang === 'bn' ? 'টাইপ করছেন...' : 'typing...');
      const timer = setTimeout(() => {
        const busyReply = lang === 'bn'
          ? 'আমরা অন্য চ্যাটে ব্যস্ত আছি, কিছুক্ষণের মধ্যে আপনার সাথে আমাদের একজন প্রতিনিধি যুক্ত হবেন।'
          : 'We are currently busy with other chats. A representative will connect with you shortly.';
        onSendMessage(visitorId, busyReply, 'owner', 'প্রোপাইটার (HelloPoint)');
        setIsAutoReplying(false);
      }, 3500);
      activeTimersRef.current.push(timer);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="visitor-live-chat-overlay"
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[99999] animate-fade-in font-sans select-text"
    >
      <div 
        className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-slate-150 transform transition-all flex flex-col h-[600px] max-h-[92vh]"
      >
        {/* Header */}
        <div 
          className="p-4 text-white flex justify-between items-center shadow-sm shrink-0"
          style={{ backgroundColor: themeColor }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <MessageSquare className="w-5 h-5 text-yellow-300" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                {shopStatus === 'open' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white" />
                )}
              </span>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black truncate leading-tight">
                {lang === 'bn' ? 'লাইভ চ্যাট সাপোর্ট' : 'Live Chat Support'}
              </h3>
              <p className="text-[10px] font-bold text-white/90 flex items-center gap-1.5 leading-none mt-1">
                <span className={`w-2 h-2 rounded-full ${shopStatus === 'open' ? 'bg-emerald-300 animate-pulse' : 'bg-rose-300'}`} />
                <span>
                  {shopStatus === 'open' 
                    ? (lang === 'bn' ? 'দোকান খোলা • লাইভ সাপোর্ট' : 'Shop Open • Live Support')
                    : (lang === 'bn' ? 'দোকান বন্ধ • মেসেজ পাঠিয়ে রাখুন' : 'Shop Closed • Leave Message')}
                </span>
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* GATE SCREEN: REQUIREMENT 4 & 5 - SUBMIT INFO BEFORE REVEALING CHAT FEATURES */}
        {/* ========================================================================= */}
        {!isChatUnlocked ? (
          <div className="flex-1 flex flex-col justify-between p-5 bg-gradient-to-b from-purple-50/50 via-white to-slate-50 overflow-y-auto">
            <div className="space-y-4 pt-2">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-13 h-13 rounded-2xl bg-purple-100/80 border border-purple-200 flex items-center justify-center text-purple-700 shadow-sm">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-black text-slate-850">
                  {lang === 'bn' ? 'লাইভ চ্যাটে প্রবেশ করতে আপনার তথ্য দিন' : 'Enter Details to Start Live Chat'}
                </h4>
                <p className="text-xs font-semibold text-slate-500 max-w-xs leading-relaxed">
                  {lang === 'bn'
                    ? 'চ্যাট শুরু করতে আপনার নাম ও মোবাইল নম্বর লিখে সাবমিট করুন।'
                    : 'Please provide your name and mobile number to proceed.'}
                </p>
              </div>

              {/* Form Card */}
              <form onSubmit={handleStartChatSubmit} className="space-y-3.5 bg-white p-4 rounded-2xl border border-purple-100 shadow-sm">
                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                    {lang === 'bn' ? 'আপনার নাম' : 'YOUR NAME'} <span className="text-purple-600 font-black">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={visitorName}
                      onChange={(e) => {
                        setVisitorName(e.target.value);
                        setInputValidationMsg('');
                        setDeviceWarningMsg('');
                      }}
                      placeholder={lang === 'bn' ? 'আপনার নাম লিখুন' : 'Enter your name'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-400/20 transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                    {lang === 'bn' ? 'মোবাইল নম্বর' : 'MOBILE NUMBER'} <span className="text-purple-600 font-black">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      maxLength={11}
                      value={visitorPhone}
                      onChange={(e) => {
                        setVisitorPhone(cleanDigits(e.target.value));
                        setInputValidationMsg('');
                        setDeviceWarningMsg('');
                      }}
                      placeholder="01XXXXXXXXX"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2.5 text-xs font-bold text-slate-850 placeholder:text-slate-400 outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-400/20 transition-all font-mono tracking-wide"
                    />
                  </div>
                </div>

                {/* Validation Error Alert */}
                {inputValidationMsg && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-650 text-xs font-bold text-center animate-fade-in">
                    {inputValidationMsg}
                  </div>
                )}

                {/* Device Warning Alert (Requirement 5) */}
                {deviceWarningMsg && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2.5 animate-fade-in shadow-2xs">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4.5 h-4.5 text-amber-700 shrink-0 mt-0.5" />
                      <p className="font-semibold leading-relaxed">
                        {deviceWarningMsg}
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {deviceRegisteredPhone && (
                        <button
                          type="button"
                          onClick={handleFillRegisteredInfo}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-[11px] transition-all cursor-pointer text-center"
                        >
                          {lang === 'bn' ? 'আগের তথ্য পূরণ করুন' : 'Fill Registered Info'}
                        </button>
                      )}
                      
                      {onRequestOpenRegisterModal && (
                        <button
                          type="button"
                          onClick={onRequestOpenRegisterModal}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[11px] transition-all cursor-pointer text-center flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{lang === 'bn' ? 'ছবি দিয়ে একাউন্ট খুলুন' : 'Create Account with Photo'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-98"
                >
                  <span>{lang === 'bn' ? 'সাবমিট ও চ্যাট শুরু করুন' : 'Submit & Start Live Chat'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Note & Direct Account creation link */}
            <div className="text-center pt-3 pb-1 space-y-1">
              <p className="text-[10px] font-semibold text-slate-400">
                {lang === 'bn' ? 'আপনার তথ্য আমাদের কাছে সম্পূর্ণ নিরাপদ ও গোপনীয়।' : 'Your information is completely safe with us.'}
              </p>
              {onRequestOpenRegisterModal && (
                <button
                  type="button"
                  onClick={onRequestOpenRegisterModal}
                  className="text-[11px] font-black text-purple-700 hover:text-purple-900 underline underline-offset-2 transition-all cursor-pointer"
                >
                  {lang === 'bn' ? 'কাস্টমার অ্যাকাউন্ট খুলতে এখানে ক্লিক করুন (ছবি আবশ্যক)' : 'Click here to create a customer account (Photo mandatory)'}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* UNLOCKED CHAT VIEW: MESSAGE THREAD + COMPACT READY-MADE CHIPS AT BOTTOM + INPUT */
          /* ========================================================================= */
          <>
            {/* Identity Banner */}
            <div className="bg-purple-50/90 border-b border-purple-100 px-4 py-2 flex items-center justify-between gap-2 shrink-0 select-none">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-full bg-purple-200/80 flex items-center justify-center shrink-0 text-purple-700">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-black text-slate-800 truncate block">
                    {visitorName || deviceRegisteredName} {visitorPhone && <span className="font-mono text-purple-900 font-bold text-[10.5px]">({visitorPhone})</span>}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{lang === 'bn' ? 'সংযুক্ত' : 'Connected'}</span>
              </div>
            </div>

            {/* Message Thread Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70 scrollbar-thin">
              
              {/* Clean Welcome greeting bubble */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1 text-left">
                <div className="flex items-center gap-1.5 text-purple-700">
                  <span className="text-xs font-black uppercase tracking-wider">
                    {lang === 'bn' ? 'হ্যালো পয়েন্টে স্বাগতম!' : 'Welcome to Hello Point!'}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  {lang === 'bn' 
                    ? 'আপনার যেকোনো প্রশ্ন নিচে লিখুন অথবা রেডিমেড বাটনে ট্যাপ করুন।' 
                    : 'Type your message below or tap any quick button.'}
                </p>
              </div>

              {/* Active chat messages between visitor and owner */}
              {currentVisitorMessages.map((msg) => {
                const isMe = msg.senderRole === 'customer';
                return (
                  <div 
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 animate-fade-in`}
                  >
                    <div className="flex items-center gap-1 text-[8.5px] font-extrabold text-slate-400 px-1">
                      <span>{isMe ? (msg.senderName || visitorName || 'আপনি') : (msg.senderName || 'প্রোপাইটার (HelloPoint)')}</span>
                    </div>

                    <div className="relative group/vmsg flex items-center gap-1">
                      {onDeleteMessage && isMe && (
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(msg.id)}
                          className="opacity-0 group-hover/vmsg:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
                          title={lang === 'bn' ? 'মেসেজ মুছুন' : 'Delete'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                      <div 
                        className={`max-w-[85%] p-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed break-words shadow-2xs ${
                          isMe 
                            ? 'bg-gradient-to-br from-purple-600 to-indigo-650 text-white rounded-tr-none font-semibold' 
                            : 'bg-white border border-slate-200 text-slate-900 rounded-tl-none font-medium'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>

                      {onDeleteMessage && !isMe && (
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(msg.id)}
                          className="opacity-0 group-hover/vmsg:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
                          title={lang === 'bn' ? 'মেসেজ মুছুন' : 'Delete'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 px-1">
                      <span>
                        {(() => {
                          try {
                            return new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          } catch {
                            return '';
                          }
                        })()}
                      </span>
                      {isMe && (
                        <CheckCheck className={`w-3 h-3 ${msg.readByOwner ? 'text-purple-600' : 'text-slate-350'}`} />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Requirement 1: Automated typing... indicator */}
              {isAutoReplying && (
                <div className="flex items-center gap-2 p-2.5 bg-white border border-purple-150 rounded-2xl rounded-tl-none w-fit animate-pulse text-purple-700 shadow-2xs">
                  <div className="flex items-center gap-1 px-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-bounce" style={{ animationDuration: '0.8s', animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-bounce" style={{ animationDuration: '0.8s', animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-bounce" style={{ animationDuration: '0.8s', animationDelay: '400ms' }} />
                  </div>
                  <span className="text-[11px] font-bold italic text-slate-500 font-mono">
                    {typingText}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ========================================================================= */}
            {/* REQUIREMENT 1 & 2: READY-MADE CHAT CHIPS (HIDES ONCE REPLIED) */}
            {/* ========================================================================= */}
            {visibleFaqs.length > 0 && (
              <div className="px-3 pt-2 pb-1.5 bg-white border-t border-purple-100 shrink-0">
                <div className="flex items-center justify-between pb-1 px-0.5">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-purple-700">
                    {lang === 'bn' ? 'রেডিমেড প্রশ্নসমূহ' : 'QUICK QUESTIONS'}
                  </span>
                  <span className="text-[8.5px] font-bold text-slate-400">
                    {lang === 'bn' ? 'ট্যাপ করে অটো-রিপ্লাই পান' : 'Tap for instant reply'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
                  {visibleFaqs.map((faq) => (
                    <button
                      key={faq.id}
                      type="button"
                      disabled={isAutoReplying}
                      onClick={() => handleQuickFaqClick(faq)}
                      className="shrink-0 text-[10px] sm:text-[10.5px] font-bold text-purple-950 bg-purple-50 hover:bg-purple-600 hover:text-white border border-purple-200/90 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs group text-left disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      title={faq.question}
                    >
                      <span className="text-xs">{faq.icon || '💬'}</span>
                      <span className="truncate max-w-[170px] sm:max-w-[200px]">{faq.question}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Enhanced Large & Prominent Chat Input Section */}
            <div className="p-3 bg-gradient-to-b from-white to-purple-50/40 border-t border-purple-200 shrink-0 shadow-lg">
              <form onSubmit={handleSend} className="space-y-1.5">
                <div className="relative flex items-center gap-2 bg-white rounded-2xl border-2 border-purple-400 focus-within:border-purple-600 focus-within:ring-4 focus-within:ring-purple-500/20 shadow-sm p-1 transition-all">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={lang === 'bn' ? 'আপনার মেসেজ লিখুন...' : 'Type a message...'}
                    className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isAutoReplying}
                    className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 active:scale-95 text-white flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 font-black text-xs tracking-wide"
                    title={lang === 'bn' ? 'মেসেজ পাঠান' : 'Send Message'}
                  >
                    <span>{lang === 'bn' ? 'পাঠান' : 'Send'}</span>
                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
