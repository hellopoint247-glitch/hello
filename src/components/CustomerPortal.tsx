import React, { useState, useMemo, useEffect } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { 
  LogOut, 
  User, 
  Phone, 
  Search, 
  Printer, 
  FileText, 
  Image, 
  PenTool, 
  DollarSign, 
  CheckCircle, 
  Check,
  AlertTriangle, 
  MapPin, 
  BookOpen, 
  ChevronRight, 
  Clock, 
  X,
  Camera,
  MessageSquare,
  Mail,
  CheckCheck,
  Eye,
  EyeOff,
  Sparkles,
  ClipboardPaste
} from 'lucide-react';
import { Contact, Transaction, RechargeRequest, ChatMessage, PayBillEntry, PayBillRequest } from '../types';
import { getContactSummary } from '../utils/storage';
import { soundEngine } from '../utils/audio';
import { motion, AnimatePresence } from 'motion/react';
import { ChatBox } from './ChatBox';
import { normalizeBdPhoneNumber } from '../utils/phoneUtils';

interface CustomerPortalProps {
  customer: Contact;
  allTransactions: Transaction[];
  lang: 'bn' | 'en';
  currency: string;
  onLogout: () => void;
  setLang: (l: 'bn' | 'en') => void;
  themeColor?: string;
  onUpdatePhoto?: (contactId: string, photoBase64: string) => void;
  rechargeRequests?: RechargeRequest[];
  onCreateRechargeRequest?: (phone: string, amount: number, method: 'bkash' | 'nagad' | 'flexiload') => void;
  onClearRechargeRequest?: (requestId: string) => void;
  chatMessages?: ChatMessage[];
  onSendChatMessage?: (contactId: string, text: string, senderRole: 'owner' | 'customer', senderName: string) => void;
  onMarkChatsAsRead?: (contactId: string, role: 'owner' | 'customer') => void;
  paybills?: PayBillEntry[];
  onSavePayBill?: (paybill: PayBillEntry) => void;
  onCreatePayBillRequest?: (billerNumber: string, amount: number, billerDetails: string, secondDate: string, phone: string) => void;
  paybillRequests?: PayBillRequest[];
  onCustomerVisit?: () => void;
}

export function CustomerPortal({ 
  customer, 
  allTransactions, 
  lang, 
  currency, 
  onLogout,
  setLang,
  themeColor = '#6244a6',
  onUpdatePhoto,
  rechargeRequests = [],
  onCreateRechargeRequest,
  onClearRechargeRequest,
  chatMessages = [],
  onSendChatMessage,
  onMarkChatsAsRead,
  paybills = [],
  onSavePayBill,
  onCreatePayBillRequest,
  paybillRequests = [],
  onCustomerVisit
}: CustomerPortalProps) {
  useEffect(() => {
    onCustomerVisit?.();
  }, [onCustomerVisit]);

  const [searchQuery, setSearchQuery] = useState('');
  const [hideRunningBalance, setHideRunningBalance] = useState<boolean>(
    () => localStorage.getItem('hellopoint_hide_running_balance') === 'true'
  );

  const [cardDensity, setCardDensity] = useState<'compact' | 'comfortable' | 'large'>(() => {
    return (localStorage.getItem('hellopoint_card_density') as 'compact' | 'comfortable' | 'large') || 'compact';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const density = (localStorage.getItem('hellopoint_card_density') as 'compact' | 'comfortable' | 'large') || 'compact';
      setCardDensity(density);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleHideRunningBalance = () => {
    const newValue = !hideRunningBalance;
    setHideRunningBalance(newValue);
    localStorage.setItem('hellopoint_hide_running_balance', String(newValue));
  };
  const [filterType, setFilterType] = useState<'all' | 'gave' | 'got'>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);

  const unreadChatsCount = useMemo(() => {
    return (chatMessages || []).filter(m => m.contactId === customer.id && m.senderRole === 'owner' && !m.readByCustomer).length;
  }, [chatMessages, customer.id]);

  // Recharge request UI states
  const [isRechargeExpanded, setIsRechargeExpanded] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'bkash' | 'nagad' | 'flexiload' | 'paybill' | null>(null);
  const [rechargePhoneInput, setRechargePhoneInput] = useState('');
  const [rechargeAmountInput, setRechargeAmountInput] = useState('');
  const [rechargeError, setRechargeError] = useState('');

  // Pay-Bill state variables
  const [paybillBillerNum, setPaybillBillerNum] = useState('');
  const [paybillAmount, setPaybillAmount] = useState('');
  const [paybillName, setPaybillName] = useState('');
  const [paybillDueDate, setPaybillDueDate] = useState('');
  const [paybillPhone, setPaybillPhone] = useState('');
  const [paybillError, setPaybillError] = useState('');
  const [paybillAutoFilled, setPaybillAutoFilled] = useState(false);
  const [showPaybillSuccessPopup, setShowPaybillSuccessPopup] = useState(false);
  const [paybillSuccessSerial, setPaybillSuccessSerial] = useState('');

  const myCurrentRequest = useMemo(() => {
    const list = rechargeRequests.filter(r => r.contactId === customer.id && r.status !== 'cancelled');
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }, [rechargeRequests, customer.id]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use URL.createObjectURL to pre-emptively bypass loading original huge format as base64 string,
    // which is the root cause of standard FileReader iOS Safari crashes on 12-48MP camera images.
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
          if (onUpdatePhoto) {
            onUpdatePhoto(customer.id, dataUrl);
          }
        }
      } catch (err) {
        console.error("Canvas photo compression failed:", err);
      } finally {
        // Essential: reclaim allocation pool immediately
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback in case of any security sandbox block in external iframe environments
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
            if (onUpdatePhoto) {
              onUpdatePhoto(customer.id, dataUrl);
            }
          }
        };
        fbImg.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  };

  const handleSubmitRecharge = (e: React.FormEvent) => {
    e.preventDefault();
    setRechargeError('');

    const cleanNum = normalizeBdPhoneNumber(rechargePhoneInput);
    if (!cleanNum || cleanNum.length !== 11 || !cleanNum.startsWith('01')) {
      setRechargeError(lang === 'bn' ? 'অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নম্বর লিখুন (যেমন: 017XXXXXXXX)।' : 'Please enter a valid 11-digit mobile number.');
      return;
    }

    const amt = parseFloat(rechargeAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setRechargeError(lang === 'bn' ? 'টাকার সঠিক পরিমাণ লিখুন।' : 'Please enter a valid positive amount.');
      return;
    }

    if (/^01\d{9}$/.test(rechargeAmountInput.trim()) || amt > 1000000) {
      setRechargeError(lang === 'bn' ? '⚠️ টাকার পরিমাণের জায়গায় মোবাইল নম্বর বসানো হয়েছে বলে মনে হচ্ছে! সঠিক টাকার পরিমাণ লিখুন।' : '⚠️ Mobile number placed in Amount field!');
      return;
    }

    if (!selectedMethod) {
      setRechargeError(lang === 'bn' ? 'দয়া করে রিচার্জের মাধ্যম সিলেক্ট করুন।' : 'Please select a payment method.');
      return;
    }

    if (onCreateRechargeRequest) {
      onCreateRechargeRequest(cleanNum, amt, selectedMethod);
    }
    soundEngine.playIPhoneVerificationSound();

    // Reset fields
    setRechargePhoneInput('');
    setRechargeAmountInput('');
    setSelectedMethod(null);
    setIsRechargeExpanded(false);
  };

  const formatDateForInput = (dateStr?: string): string => {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return trimmed;
  };

  const handleBillerNumberChange = (val: string) => {
    setPaybillBillerNum(val);
    setPaybillError('');
    const trimmedVal = val.trim();
    if (trimmedVal) {
      const matchPb = (paybills || []).find(
        (pb) => pb.billerNumber.trim().toLowerCase() === trimmedVal.toLowerCase()
      );
      const matchReq = (paybillRequests || []).find(
        (req) => req.billerNumber.trim().toLowerCase() === trimmedVal.toLowerCase()
      );
      const match = matchPb || matchReq;

      if (match) {
        let filledAny = false;
        if ('billerDetails' in match && match.billerDetails) {
          setPaybillName(match.billerDetails);
          filledAny = true;
        }
        if ('note' in match && match.note && match.note.trim()) {
          setPaybillPhone(match.note.trim());
          filledAny = true;
        } else if ('phone' in match && match.phone && match.phone.trim()) {
          setPaybillPhone(match.phone.trim());
          filledAny = true;
        }
        if (filledAny) {
          setPaybillAutoFilled(true);
        }
      } else {
        setPaybillAutoFilled(false);
      }
    } else {
      setPaybillAutoFilled(false);
    }
  };

  const handleSubmitPaybill = (e: React.FormEvent) => {
    e.preventDefault();
    setPaybillError('');

    // 1. Mandatory Biller ID & Misplaced validation
    const billerNumClean = paybillBillerNum.trim();
    if (!billerNumClean) {
      setPaybillError(lang === 'bn' ? 'দয়া করে বিলার আইডি লিখুন (সব তথ্য বাধ্যতামূলক)।' : 'Biller ID is required.');
      return;
    }
    if (/[a-zA-Z\u0980-\u09FF]/.test(billerNumClean)) {
      setPaybillError(lang === 'bn' ? '⚠️ বিলার আইডিতে নাম বা অন্য লেখা বসানো হয়েছে! অনুগ্রহ করে শুধুমাত্র বিলার আইডি/সংখ্যা লিখুন।' : '⚠️ Name or text placed in Biller ID field! Please enter numeric Biller ID.');
      return;
    }

    // 2. Mandatory Amount & Misplaced validation
    const amountStr = paybillAmount.trim();
    if (!amountStr) {
      setPaybillError(lang === 'bn' ? 'দয়া করে বিলের টাকার পরিমাণ লিখুন (সব তথ্য বাধ্যতামূলক)।' : 'Bill amount is required.');
      return;
    }
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      setPaybillError(lang === 'bn' ? '⚠️ টাকার পরিমাণের জায়গায় ভুল তথ্য বসানো হয়েছে! সঠিক টাকার পরিমাণ লিখুন।' : '⚠️ Invalid amount value!');
      return;
    }
    if (/^01\d{9}$/.test(amountStr) || amt > 1000000) {
      setPaybillError(lang === 'bn' ? '⚠️ টাকার পরিমাণের জায়গায় মোবাইল নম্বর বসানো হয়েছে বলে মনে হচ্ছে! সঠিক টাকার পরিমাণ লিখুন।' : '⚠️ Mobile number placed in Amount field!');
      return;
    }

    // 3. Mandatory Biller Name & Misplaced validation
    const nameClean = paybillName.trim();
    if (!nameClean) {
      setPaybillError(lang === 'bn' ? 'দয়া করে বিলার বা গ্রাহকের নাম লিখুন (সব তথ্য বাধ্যতামূলক)।' : 'Biller name is required.');
      return;
    }
    if (/^\d+$/.test(nameClean)) {
      setPaybillError(lang === 'bn' ? '⚠️ বিলার নামের জায়গায় মোবাইল নম্বর বা বিলার আইডি বসানো হয়েছে! অনুগ্রহ করে সঠিক নাম লিখুন।' : '⚠️ Phone number or ID placed in Biller Name field! Enter valid name.');
      return;
    }

    // 4. Mandatory Due Date
    const dueDateClean = paybillDueDate.trim();
    if (!dueDateClean) {
      setPaybillError(lang === 'bn' ? 'দয়া করে বিল পরিশোধের শেষ তারিখ বেছে নিন (সব তথ্য বাধ্যতামূলক)।' : 'Last payment date is required.');
      return;
    }

    // 5. Mandatory Mobile Phone & Misplaced validation
    const phoneRaw = paybillPhone.trim();
    if (!phoneRaw) {
      setPaybillError(lang === 'bn' ? 'দয়া করে মোবাইল নম্বর লিখুন (সব তথ্য বাধ্যতামূলক)।' : 'Mobile phone number is required.');
      return;
    }
    const cleanPhone = normalizeBdPhoneNumber(phoneRaw);
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
      setPaybillError(lang === 'bn' ? '⚠️ অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নম্বর লিখুন (যেমন: 01712345678)।' : '⚠️ Enter valid 11-digit mobile number.');
      return;
    }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const currentMonthPaybillsCount = (paybills || []).filter(pb => {
      const rawDate = pb.date && pb.date.trim() ? pb.date.trim() : (pb.createdAt || '');
      const d = new Date(rawDate);
      const mk = !isNaN(d.getTime()) 
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : currentMonthKey;
      return mk === currentMonthKey;
    }).length;

    const currentMonthRequestsCount = (paybillRequests || []).filter(req => {
      const d = new Date(req.createdAt || '');
      const mk = !isNaN(d.getTime()) 
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : currentMonthKey;
      return mk === currentMonthKey;
    }).length;

    const serialNum = currentMonthPaybillsCount + currentMonthRequestsCount + 1;
    const paddedSerial = String(serialNum).padStart(4, '0');

    if (onCreatePayBillRequest) {
      onCreatePayBillRequest(
        billerNumClean,
        amt,
        nameClean,
        dueDateClean,
        cleanPhone
      );
    }

    setPaybillSuccessSerial(paddedSerial);
    soundEngine.playIPhoneVerificationSound();
    setShowPaybillSuccessPopup(true);

    // Reset fields
    setPaybillBillerNum('');
    setPaybillAmount('');
    setPaybillName('');
    setPaybillDueDate('');
    setPaybillPhone('');
    setPaybillAutoFilled(false);
    setSelectedMethod(null);
    setIsRechargeExpanded(false);
  };

  // Get only this customer's transactions with progressive running balance
  const customerTxs = useMemo(() => {
    const list = allTransactions.filter(t => t.contactId === customer.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    let running = 0;
    const mapped = list.map(t => {
      if (t.type === 'GAVE') {
        running += t.amount;
      } else {
        running -= t.amount;
      }
      return {
        ...t,
        runningBalance: running
      };
    });
    
    return mapped;
  }, [allTransactions, customer.id]);

  // Summary Metrics using shared ledger helper logic
  const summary = useMemo(() => {
    return getContactSummary(customer.id, allTransactions);
  }, [customer.id, allTransactions]);

  // Translate numbers to Bengali digits
  const toBn = (enStr: string | number): string => {
    if (lang !== 'bn') return String(enStr);
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(enStr).replace(/[0-9]/g, (digit) => bnDigits[parseInt(digit, 10)]);
  };

  // Human-friendly date printing
  const formatTxDate = (isoString: string) => {
    try {
      const dateObj = new Date(isoString);
      if (isNaN(dateObj.getTime())) return isoString;
      
      const day = dateObj.getDate();
      const monthNamesBn = [
        'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
        'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
      ];
      const monthNamesEn = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      
      const month = lang === 'bn' ? monthNamesBn[dateObj.getMonth()] : monthNamesEn[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      
      return lang === 'bn' 
        ? `${toBn(day)} ${month} ${toBn(year)}` 
        : `${day} ${month} ${year}`;
    } catch {
      return isoString;
    }
  };

  // Filter transactions based on type and query search strings
  const filteredTxs = useMemo(() => {
    return customerTxs
      .filter(t => {
        // Query match
        const lowerQuery = (searchQuery || '').trim().toLowerCase();
        if (lowerQuery) {
          const matchNote = (t.note || '').toLowerCase().includes(lowerQuery);
          const matchBill = (t.billNo || '').toLowerCase().includes(lowerQuery);
          const amtNum = Number(t.amount) || 0;
          const matchAmt = String(amtNum).toLowerCase().includes(lowerQuery);
          const matchBnAmt = toBn(amtNum).includes(lowerQuery);
          if (!matchNote && !matchBill && !matchAmt && !matchBnAmt) return false;
        }

        // Type match
        if (filterType === 'gave' && t.type !== 'GAVE') return false;
        if (filterType === 'got' && t.type !== 'GOT') return false;

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [customerTxs, searchQuery, filterType, lang]);

  const getNormalizedDateKey = (dateStr: string) => {
    if (!dateStr) return 'unknown';
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.substring(0, 10);
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {}
    return dateStr.substring(0, 10);
  };

  const isDateToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const key = getNormalizedDateKey(dateStr);
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (key === todayKey) return true;
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      }
    } catch {}
    return false;
  };

  const dateGroupedPortalTxs = useMemo(() => {
    const groups: {
      dateKey: string;
      displayDate: string;
      items: typeof filteredTxs;
    }[] = [];

    const groupMap = new Map<string, typeof groups[0]>();

    filteredTxs.forEach((tx) => {
      const key = getNormalizedDateKey(tx.date || tx.createdAt);
      let group = groupMap.get(key);
      if (!group) {
        group = {
          dateKey: key,
          displayDate: formatTxDate(tx.date || tx.createdAt),
          items: []
        };
        groupMap.set(key, group);
        groups.push(group);
      }

      group.items.push(tx);
    });

    return groups;
  }, [filteredTxs, lang]);

  const handlePrintPortal = () => {
    window.print();
  };

  return (
    <div id="customer-portal-root" className="min-h-screen bg-[#4A4459] flex flex-col font-sans text-slate-100 select-none pb-8 print:bg-white print:text-slate-900 print:pb-0">
      
      {/* PROFESSIONAL COMPACT SOFT PURPLE-SLATE HEADER */}
      <header className="bg-[#3c3649]/95 backdrop-blur-md border-b border-[#5e5571] text-white shadow-sm sticky top-0 z-50 print:hidden select-none">
        <div className="max-w-3xl mx-auto px-3 py-1.5 sm:py-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/25 border border-purple-400/50 flex items-center justify-center font-bold text-purple-200 shadow-inner text-xs sm:text-sm">
              
            </div>
            <div>
              <h1 className="text-[11px] sm:text-xs font-extrabold tracking-wider uppercase text-white">
                {lang === 'bn' ? 'হ্যালো পয়েন্ট গ্রাহক খাতা' : 'HELLO POINT CUST PORTAL'}
              </h1>
              <p className="text-[8px] sm:text-[9px] font-semibold text-purple-200/80 uppercase tracking-wider leading-none mt-0.5">
                {lang === 'bn' ? 'নিরাপদ ডিজিটাল খাতা' : 'SECURE DIGITAL STATEMENT'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Language Toggle switch */}
            <button 
              onClick={() => {
                const nl = lang === 'bn' ? 'en' : 'bn';
                setLang(nl);
                localStorage.setItem('hellopoint_lang', nl);
              }}
              className="text-[9px] font-bold border border-[#5e5571] bg-[#2e2938] hover:bg-[#433b52] text-slate-100 hover:text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md transition-colors uppercase cursor-pointer"
            >
              {lang === 'bn' ? 'ENGLISH' : 'বাংলা'}
            </button>

            {/* Logout Trigger button */}
            <button 
              onClick={onLogout}
              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/40 text-[9px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md transition-colors uppercase flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>{lang === 'bn' ? 'লগআউট' : 'LOGOUT'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-2 py-1.5 sm:px-3 sm:py-2.5 w-full flex-1 space-y-1.5 sm:space-y-2.5 print:p-0">
        
        {/* CUSTOMER PROFILE CARD (#363042 ON #4A4459 BACKGROUND) */}
        <div id="portal-usercard" className="bg-[#363042] rounded-xl border border-[#5e5571] px-2.5 py-1.5 sm:p-2.5 shadow-sm flex flex-row justify-between items-center gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            
            {/* Profile Avatar with Camera Button */}
            <div className="relative group shrink-0">
              <div 
                onClick={() => {
                  if (customer.photoUrl) {
                    setZoomedImage({ url: customer.photoUrl, name: customer.name });
                  }
                }}
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-[#5e5571] overflow-hidden bg-gradient-to-br from-purple-700 to-indigo-800 relative flex items-center justify-center shadow-xs select-none ${customer.photoUrl ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''}`}
              >
                {customer.photoUrl ? (
                  <img 
                    src={customer.photoUrl} 
                    alt={customer.name} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-purple-100 font-bold text-sm sm:text-base select-none">
                    <span>{customer.name.trim().charAt(0).toUpperCase()}</span>
                  </div>
                )}
                
                {customer.photoUrl && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[7px] font-bold uppercase text-center p-0.5">
                    {lang === 'bn' ? 'বড়' : 'Zoom'}
                  </div>
                )}
              </div>
              
              {/* Camera Trigger */}
              <label 
                className="absolute -bottom-0.5 -right-0.5 bg-purple-600 hover:bg-purple-500 text-white p-0.5 rounded-full shadow-xs cursor-pointer hover:scale-110 active:scale-95 transition-all border border-[#363042] flex items-center justify-center"
                title={lang === 'bn' ? 'প্রোফাইল ছবি পরিবর্তন করুন' : 'Change Profile Picture'}
              >
                <Camera className="w-2 h-2" />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handlePhotoUpload}
                  className="hidden" 
                />
              </label>
            </div>

            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white select-text leading-tight truncate">
                {customer.name}
              </h2>
              <div className="text-[11px] font-semibold text-purple-200 flex items-center gap-1 mt-0.5 select-text">
                <Phone className="w-2.5 h-2.5 text-purple-300 shrink-0" />
                <span className="font-mono text-purple-200">{toBn(customer.phone)}</span>
              </div>
            </div>
          </div>

          {/* Inbox Button */}
          <button 
            id="portal-inbox-trigger"
            onClick={() => setShowChatModal(true)}
            title={lang === 'bn' ? 'মেসেজ ইনবক্স' : 'Message Inbox'}
            className={`bg-[#2b2635] hover:bg-[#433b52] text-amber-300 p-2 rounded-lg border border-[#5e5571] transition-all flex items-center justify-center cursor-pointer shadow-xs relative shrink-0 ${
              unreadChatsCount > 0 
                ? 'ring-2 ring-amber-400/50 bg-amber-400/15' 
                : 'hover:scale-105 active:scale-95'
            }`}
          >
            <Mail className="w-4 h-4 text-amber-300" />
            {unreadChatsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 bg-rose-600 text-white rounded-full text-[8px] font-black flex items-center justify-center px-0.5 border border-[#363042] shadow-sm">
                {toBn(unreadChatsCount)}
              </span>
            )}
          </button>
        </div>

        {/* ACCOUNT BALANCE SUMMARY CARD */}
        <div className={`rounded-xl px-3 py-2 sm:p-3 text-white shadow-sm flex items-center justify-between border transition-all ${
          summary.balance > 0 
            ? 'bg-gradient-to-br from-[#452936] to-[#363042] border-rose-400/40' 
            : summary.balance < 0 
            ? 'bg-gradient-to-br from-[#223d32] to-[#363042] border-emerald-400/40' 
            : 'bg-[#363042] border-[#5e5571]'
        }`}>
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-bold tracking-wide">
              {summary.balance > 0 ? (
                <span className="text-rose-300">{lang === 'bn' ? 'দোকানের পাওনা টাকা' : 'Outstanding Shop Due'}</span>
              ) : summary.balance < 0 ? (
                <span className="text-emerald-300">{lang === 'bn' ? 'আপনার সর্বমোট জমা' : 'Your Net Advance'}</span>
              ) : (
                <span className="text-slate-200">{lang === 'bn' ? 'হিসাব পরিশোধিত' : 'Ledger settled'}</span>
              )}
            </p>
            
            <h1 className="text-xl sm:text-2xl font-black mt-0.5 text-white tracking-tight leading-none font-mono">
              {currency}{toBn(Math.abs(summary.balance).toFixed(2))}
            </h1>
          </div>

          <div>
            {summary.balance > 0 ? (
              <div id="due-badge" className="bg-rose-500/25 text-rose-200 border border-rose-400/40 font-bold px-2.5 py-0.5 rounded-lg text-[10px] sm:text-xs uppercase tracking-wide leading-none">
                {lang === 'bn' ? 'মোট বকেয়া' : 'TOTAL DUE'}
              </div>
            ) : summary.balance < 0 ? (
              <div id="credit-badge" className="bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 font-bold px-2.5 py-0.5 rounded-lg text-[10px] sm:text-xs uppercase tracking-wide leading-none">
                {lang === 'bn' ? 'মোট জমা' : 'TOTAL DEPOSIT'}
              </div>
            ) : (
              <div id="settled-badge" className="bg-purple-900/60 text-purple-200 border border-purple-400/40 font-bold px-2.5 py-0.5 rounded-lg text-[10px] sm:text-xs uppercase tracking-wide leading-none">
                {lang === 'bn' ? 'পরিশোধিত' : 'SETTLED'}
              </div>
            )}
          </div>
        </div>

        {/* RECHARGE & PAY-BILL COLLAPSIBLE CARD */}
        <div className="bg-[#363042] rounded-xl border border-[#5e5571] shadow-sm p-1.5 sm:p-2 space-y-2">
          {myCurrentRequest ? (
            myCurrentRequest.status === 'pending' ? (
              <div className="bg-indigo-950/50 border border-indigo-500/35 rounded-xl p-3 text-center space-y-1.5 select-text">
                <div className="inline-flex items-center justify-center w-8 h-8 bg-indigo-900/60 text-indigo-400 rounded-full border border-indigo-500/30">
                  <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <h4 className="text-xs font-bold text-indigo-300 tracking-wide uppercase">
                  {lang === 'bn' ? 'অনুরোধ পেন্ডিং আছে' : 'RECHARGE REQUEST PENDING'}
                </h4>
                <p className="text-xs font-medium text-slate-300 leading-normal max-w-md mx-auto">
                  {lang === 'bn' 
                    ? 'আপনার রিকুয়েষ্ট টি গ্রহণ করা হয়েছে অনুগ্রহ করে অপেক্ষা করুন, প্রয়োজনে আপনার সাথে যোগাযোগ করা হতে পারে, ধন্যবাদ।'
                    : 'Your request has been received, please wait. We might contact you if needed. Thank you.'}
                </p>
                <div className="pt-1.5 flex flex-wrap justify-center gap-2 text-xs font-semibold text-slate-300">
                  <span className="bg-[#0b0f17] px-2.5 py-1 rounded-lg border border-[#1e2638] flex items-center gap-1 font-mono">
                    📱 {toBn(myCurrentRequest.rechargePhone)}
                  </span>
                  <span className="bg-[#0b0f17] px-2.5 py-1 rounded-lg border border-[#1e2638] flex items-center gap-1 font-mono">
                    💵 {currency}{toBn(myCurrentRequest.amount.toFixed(2))}
                  </span>
                  <span className="bg-[#0b0f17] px-2.5 py-1 rounded-lg border border-[#1e2638] flex items-center gap-1 font-bold uppercase">
                    💰 {myCurrentRequest.method === 'bkash' ? (lang === 'bn' ? 'বিকাশ' : 'bKash') : myCurrentRequest.method === 'nagad' ? (lang === 'bn' ? 'নগদ' : 'Nagad') : (lang === 'bn' ? 'ফ্লেক্সিলোড' : 'Flexiload')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-center space-y-1.5 select-text">
                <div className="inline-flex items-center justify-center w-8 h-8 bg-emerald-900/60 text-emerald-400 rounded-full border border-emerald-500/30">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-xs font-bold text-emerald-300 tracking-wide uppercase">
                  {lang === 'bn' ? 'রিচার্জ সফল হয়েছে!' : 'RECHARGE COMPLETED SECURELY!'}
                </h4>
                <p className="text-xs font-medium text-emerald-200/90 leading-normal max-w-md mx-auto">
                  {lang === 'bn' 
                    ? `আপনার ${toBn(myCurrentRequest.amount.toFixed(2))} ${currency} রিচার্জ সফলভাবে সম্পন্ন করা হয়েছে এবং আপনার খাতার ব্যালেন্সে যোগ করা হয়েছে।`
                    : `Your recharge of ${currency}${toBn(myCurrentRequest.amount.toFixed(2))} has been completed successfully and logged to your ledger.`}
                </p>
                <div className="flex justify-center pt-1.5">
                  <button 
                    onClick={() => {
                      onClearRechargeRequest?.(myCurrentRequest.id);
                      setIsRechargeExpanded(false);
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors uppercase"
                  >
                    {lang === 'bn' ? 'ঠিক আছে' : 'OKAY'}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsRechargeExpanded(!isRechargeExpanded)}
                className="w-full py-1.5 px-3 bg-[#2b2635] hover:bg-[#3d364a] text-slate-100 text-xs font-bold rounded-lg border border-[#5e5571] shadow-xs cursor-pointer flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-purple-300">⚡</span>
                  <span>{lang === 'bn' ? 'রিচার্জ এবং পে-বিল সাবমিট করুন' : 'Recharge & Pay-Bill Submit'}</span>
                </span>
                <span className="text-purple-200 text-xs">{isRechargeExpanded ? '▲' : '▼'}</span>
              </button>

              {isRechargeExpanded && (
                <div className="space-y-3 pt-2.5 border-t border-[#5e5571]">
                  <div>
                    <p className="text-[10px] font-bold text-purple-200 uppercase tracking-wider text-center mb-2">
                      {lang === 'bn' ? 'রিচার্জ বা পেমেন্ট এর মাধ্যম সিলেক্ট করুন' : 'SELECT METHOD'}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMethod('bkash')}
                        className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border font-bold text-xs cursor-pointer ${
                          selectedMethod === 'bkash' 
                            ? 'bg-[#da1c5c]/25 text-pink-200 border-[#da1c5c] ring-1 ring-[#da1c5c]/40' 
                            : 'bg-[#2b2635] text-slate-200 border-[#5e5571] hover:bg-[#3d364a]'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#da1c5c]" />
                        <span>{lang === 'bn' ? 'বিকাশ' : 'bKash'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMethod('nagad')}
                        className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border font-bold text-xs cursor-pointer ${
                          selectedMethod === 'nagad' 
                            ? 'bg-[#f15a22]/25 text-orange-200 border-[#f15a22] ring-1 ring-[#f15a22]/40' 
                            : 'bg-[#2b2635] text-slate-200 border-[#5e5571] hover:bg-[#3d364a]'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#f15a22]" />
                        <span>{lang === 'bn' ? 'নগদ' : 'Nagad'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMethod('flexiload')}
                        className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border font-bold text-xs cursor-pointer ${
                          selectedMethod === 'flexiload' 
                            ? 'bg-purple-900/60 text-purple-200 border-purple-400 ring-1 ring-purple-400/40' 
                            : 'bg-[#2b2635] text-slate-200 border-[#5e5571] hover:bg-[#3d364a]'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                        <span>{lang === 'bn' ? 'ফ্লেক্সিলোড' : 'Flexiload'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMethod('paybill')}
                        className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border font-bold text-xs cursor-pointer ${
                          selectedMethod === 'paybill' 
                            ? 'bg-blue-900/60 text-blue-200 border-blue-400 ring-1 ring-blue-400/40' 
                            : 'bg-[#2b2635] text-slate-200 border-[#5e5571] hover:bg-[#3d364a]'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                        <span>{lang === 'bn' ? 'পে-বিল' : 'Pay-Bill'}</span>
                      </button>
                    </div>
                  </div>

                  {selectedMethod && selectedMethod !== 'paybill' && (
                    <form onSubmit={handleSubmitRecharge} className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-purple-200 uppercase tracking-wider mb-1">
                          {lang === 'bn' ? 'রিচার্জের মোবাইল নম্বর লিখুন' : 'RECHARGE MOBILE PHONE NUMBER'}
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            required
                            value={rechargePhoneInput}
                            onChange={(e) => {
                              setRechargePhoneInput(normalizeBdPhoneNumber(e.target.value));
                              setRechargeError('');
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pasted = e.clipboardData.getData('text');
                              setRechargePhoneInput(normalizeBdPhoneNumber(pasted));
                              setRechargeError('');
                            }}
                            placeholder={lang === 'bn' ? '১১ ডিজিটের মোবাইল নম্বর দিন' : 'e.g. 017XXXXXXXX'}
                            className="w-full bg-[#2b2635] border border-[#5e5571] pl-3.5 pr-14 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-100 placeholder:text-purple-300/50 outline-none focus:border-purple-400 transition-colors tracking-wider text-center"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              let pasted = '';
                              try {
                                if (navigator.clipboard?.readText) {
                                  pasted = await navigator.clipboard.readText();
                                }
                              } catch {}
                              if (!pasted) {
                                try {
                                  pasted = localStorage.getItem('hellopoint_clipboard_fallback') || '';
                                } catch {}
                              }
                              if (pasted) {
                                setRechargePhoneInput(normalizeBdPhoneNumber(pasted));
                                setRechargeError('');
                              }
                            }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-purple-700/70 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg text-[9px] font-bold border border-purple-500/40 transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                            title={lang === 'bn' ? 'কপি করা নম্বর পেস্ট করুন' : 'Paste copied number'}
                          >
                            <ClipboardPaste className="w-3 h-3 shrink-0" />
                            <span>{lang === 'bn' ? 'পেস্ট' : 'Paste'}</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-purple-200 uppercase tracking-wider mb-1">
                          {lang === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'RECHARGE AMOUNT'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-300 font-mono font-bold text-xs">
                            {currency}
                          </span>
                          <input
                            type="number"
                            required
                            min="10"
                            max="1000000"
                            value={rechargeAmountInput}
                            onChange={(e) => setRechargeAmountInput(e.target.value)}
                            placeholder={lang === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Amount value'}
                            className="w-full bg-[#2b2635] border border-[#5e5571] pl-8 pr-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-100 placeholder:text-purple-300/50 outline-none focus:border-purple-400 transition-colors text-center font-mono tracking-wider"
                          />
                        </div>
                      </div>

                      {rechargeError && (
                        <p className="text-xs font-semibold text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-xl px-3 py-2 text-center leading-normal">
                          ⚠️ {rechargeError}
                        </p>
                      )}

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wide"
                      >
                        <span>{lang === 'bn' ? 'অনুরোধ সাবমিট করুন' : 'SUBMIT RECHARGE REQUEST'}</span>
                      </button>
                    </form>
                  )}

                  {selectedMethod === 'paybill' && (
                    <form onSubmit={handleSubmitPaybill} className="space-y-3 text-left">
                      {paybillAutoFilled && (
                        <div className="bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 rounded-xl p-2.5 text-xs font-semibold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            {lang === 'bn' 
                              ? '✨ পূর্বের রেকর্ড অনুযায়ী নাম ও মোবাইল নম্বর অটো-ফিলাপ হয়েছে।' 
                              : '✨ Name and mobile number auto-filled from previous record.'}
                          </span>
                        </div>
                      )}

                      {/* Row 1: Biller ID (Left) & Amount (Right) */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* 1. Biller ID Card */}
                        <div className="bg-[#172535] border border-sky-500/30 rounded-xl p-2 sm:p-2.5 shadow-2xs">
                          <label className="block text-[9.5px] sm:text-[10px] font-bold text-sky-200 uppercase tracking-wide mb-1 text-center truncate">
                            {lang === 'bn' ? 'বিলার আইডি' : 'BILLER ID'} <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={paybillBillerNum}
                            onChange={(e) => handleBillerNumberChange(e.target.value)}
                            placeholder={lang === 'bn' ? 'বিলার আইডি' : 'e.g. 123456'}
                            className={`w-full bg-[#0f1924] border px-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-mono font-bold outline-none transition-colors text-center tracking-wider ${
                              paybillBillerNum && /[a-zA-Z\u0980-\u09FF]/.test(paybillBillerNum)
                                ? 'border-rose-500 text-rose-300'
                                : 'border-sky-400/40 text-sky-50 placeholder:text-sky-300/40 focus:border-sky-400'
                            }`}
                          />
                          {paybillBillerNum && /[a-zA-Z\u0980-\u09FF]/.test(paybillBillerNum) && (
                            <p className="text-[9px] font-semibold text-rose-400 mt-1 text-center leading-tight">
                              ⚠️ শুধুমাত্র ডিজিট লিখুন
                            </p>
                          )}
                        </div>

                        {/* 2. Amount Card (Right) */}
                        <div className="bg-[#172535] border border-sky-500/30 rounded-xl p-2 sm:p-2.5 shadow-2xs">
                          <label className="block text-[9.5px] sm:text-[10px] font-bold text-sky-200 uppercase tracking-wide mb-1 text-center truncate">
                            {lang === 'bn' ? 'টাকার পরিমাণ' : 'AMOUNT'} <span className="text-rose-400">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sky-400 font-mono font-bold text-xs">
                              {currency}
                            </span>
                            <input
                              type="number"
                              required
                              min="1"
                              max="1000000"
                              value={paybillAmount}
                              onChange={(e) => {
                                setPaybillAmount(e.target.value);
                                setPaybillError('');
                              }}
                              placeholder={lang === 'bn' ? 'টাকার পরিমাণ' : 'Amount'}
                              className={`w-full bg-[#0f1924] border pl-7 pr-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold outline-none transition-colors text-center font-mono tracking-wider ${
                                paybillAmount && /^01\d{9}$/.test(paybillAmount)
                                  ? 'border-rose-500 text-rose-300'
                                  : 'border-sky-400/40 text-sky-50 placeholder:text-sky-300/40 focus:border-sky-400'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Name (Left) & Due Date (Right) */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* 3. Name Card */}
                        <div className="bg-[#172535] border border-sky-500/30 rounded-xl p-2 sm:p-2.5 shadow-2xs">
                          <label className="block text-[9.5px] sm:text-[10px] font-bold text-sky-200 uppercase tracking-wide mb-1 text-center truncate">
                            {lang === 'bn' ? 'বাংলায় নাম' : 'NAME'} <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={paybillName}
                            onChange={(e) => {
                              setPaybillName(e.target.value);
                              setPaybillError('');
                            }}
                            placeholder={lang === 'bn' ? 'গ্রাহকের নাম' : 'e.g. Rahis Ali'}
                            className={`w-full bg-[#0f1924] border px-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold outline-none transition-colors text-center ${
                              paybillName && /^\d+$/.test(paybillName.trim())
                                ? 'border-rose-500 text-rose-300'
                                : 'border-sky-400/40 text-sky-50 placeholder:text-sky-300/40 focus:border-sky-400'
                            }`}
                          />
                        </div>

                        {/* 4. Due Date Card (Right) */}
                        <div className="bg-[#172535] border border-sky-500/30 rounded-xl p-2 sm:p-2.5 shadow-2xs">
                          <label className="block text-[9.5px] sm:text-[10px] font-bold text-sky-200 uppercase tracking-wide mb-1 text-center truncate">
                            {lang === 'bn' ? 'বিল ডেট / শেষ সময়' : 'DUE DATE'} <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={paybillDueDate}
                            onChange={(e) => {
                              setPaybillDueDate(e.target.value);
                              setPaybillError('');
                            }}
                            className="w-full bg-[#0f1924] border border-sky-400/40 focus:border-sky-400 px-2 py-1.5 sm:py-2 rounded-lg text-xs font-bold text-sky-100 outline-none transition-colors text-center font-mono cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Row 3: Mobile Phone Number Card (Bottom, full width) */}
                      <div className="bg-[#172535] border border-sky-500/30 rounded-xl p-2 sm:p-2.5 shadow-2xs">
                        <label className="block text-[9.5px] sm:text-[10px] font-bold text-sky-200 uppercase tracking-wide mb-1 text-center truncate">
                          {lang === 'bn' ? 'মোবাইল নাম্বার' : 'MOBILE PHONE NUMBER'} <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            required
                            value={paybillPhone}
                            onChange={(e) => {
                              setPaybillPhone(normalizeBdPhoneNumber(e.target.value));
                              setPaybillError('');
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pasted = e.clipboardData.getData('text');
                              setPaybillPhone(normalizeBdPhoneNumber(pasted));
                              setPaybillError('');
                            }}
                            placeholder={lang === 'bn' ? '১১ ডিজিটের মোবাইল নম্বর দিন' : 'e.g. 017XXXXXXXX'}
                            className={`w-full bg-[#0f1924] border pl-3 pr-16 py-1.5 sm:py-2 rounded-lg text-xs font-mono font-bold outline-none transition-colors tracking-wider text-center ${
                              paybillPhone && paybillPhone.length > 0 && !paybillPhone.startsWith('01')
                                ? 'border-rose-500 text-rose-300'
                                : 'border-sky-400/40 text-sky-50 placeholder:text-sky-300/40 focus:border-sky-400'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              let pasted = '';
                              try {
                                if (navigator.clipboard?.readText) {
                                  pasted = await navigator.clipboard.readText();
                                }
                              } catch {}
                              if (!pasted) {
                                try {
                                  pasted = localStorage.getItem('hellopoint_clipboard_fallback') || '';
                                } catch {}
                              }
                              if (pasted) {
                                setPaybillPhone(normalizeBdPhoneNumber(pasted));
                                setPaybillError('');
                              }
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-sky-700/60 hover:bg-sky-600 text-sky-100 hover:text-white rounded-md text-[9px] font-bold border border-sky-400/40 transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                            title={lang === 'bn' ? 'কপি করা নম্বর পেস্ট করুন' : 'Paste copied number'}
                          >
                            <ClipboardPaste className="w-3 h-3 shrink-0" />
                            <span>{lang === 'bn' ? 'পেস্ট' : 'Paste'}</span>
                          </button>
                        </div>
                      </div>

                      {paybillError && (
                        <p className="text-xs font-semibold text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-xl px-3 py-2 text-center leading-normal">
                          ⚠️ {paybillError}
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedMethod(null)}
                          className="flex-1 py-2.5 px-3 border border-[#5e5571] hover:bg-[#3d364a] text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase text-center"
                        >
                          {lang === 'bn' ? 'বাতিল' : 'CANCEL'}
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-colors uppercase text-center"
                        >
                          {lang === 'bn' ? 'সাবমিট করুন' : 'SUBMIT BILL'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CUMULATIVE STATS CARDS (CLEAN TWO-COLUMN GRID - HARMONIOUS PLUM-SLATE CARDS) */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <div className="bg-[#363042] rounded-xl border border-[#5e5571] px-2.5 py-1.5 sm:p-2.5 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-bold text-purple-200 uppercase tracking-wider leading-none">
              {lang === 'bn' ? 'মোট খরিদ (বাকি)' : 'TOTAL GOODS TAKEN'}
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-rose-400 tracking-tight leading-none mt-0.5 font-mono">
              {currency}{toBn(summary.totalGave.toFixed(2))}
            </span>
            <span className="text-[9px] font-medium text-slate-300 leading-none mt-0.5">
              {lang === 'bn' ? 'দোকানের খাতা হিসাব' : 'goods purchase invoice logs'}
            </span>
          </div>

          <div className="bg-[#363042] rounded-xl border border-[#5e5571] px-2.5 py-1.5 sm:p-2.5 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-bold text-purple-200 uppercase tracking-wider leading-none">
              {lang === 'bn' ? 'মোট পরিশোধ (জমা)' : 'TOTAL PAID / DEPOSITED'}
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-emerald-400 tracking-tight leading-none mt-0.5 font-mono">
              {currency}{toBn(summary.totalGot.toFixed(2))}
            </span>
            <span className="text-[9px] font-medium text-slate-300 leading-none mt-0.5">
              {lang === 'bn' ? `${toBn(summary.entryCount)}টি পেমেন্ট রশিদ` : `${summary.entryCount} total receipts`}
            </span>
          </div>
        </div>

        {/* FILTER BAR (CLEAN SEGMENTED CONTROLS - HARMONIOUS PLUM-SLATE CARD) */}
        <div className="flex justify-between items-center bg-[#363042] border border-[#5e5571] px-2.5 py-1 sm:py-1.5 rounded-xl select-none print:hidden shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-100 uppercase tracking-wide">
              {lang === 'bn' ? 'হিসাব খতিয়ান ফিল্টার' : 'LEDGER ACCOUNT FILTER'}
            </span>
            <button 
              type="button"
              onClick={toggleHideRunningBalance}
              title={hideRunningBalance ? 'জের ব্যালেন্স দেখান' : 'জের ব্যালেন্স লুকান'}
              className="p-0.5 hover:bg-[#2b2635] text-purple-200 hover:text-white rounded transition-colors cursor-pointer inline-flex items-center justify-center"
            >
              {hideRunningBalance ? (
                <EyeOff className="w-3.5 h-3.5 text-purple-300 hover:text-white" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-purple-300 hover:text-white" />
              )}
            </button>
          </div>
          <div className="flex rounded-lg bg-[#2b2635] border border-[#5e5571] p-0.5 select-none text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                filterType === 'all' 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              {lang === 'bn' ? 'সব' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('gave')}
              className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                filterType === 'gave' 
                  ? 'bg-rose-600 text-white shadow-xs' 
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              {lang === 'bn' ? 'ক্রয়' : 'Purchased'}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('got')}
              className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                filterType === 'got' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              {lang === 'bn' ? 'পরিশোধ' : 'Paid'}
            </button>
          </div>
        </div>

        {/* SEARCH BAR (HARMONIOUS PLUM-SLATE CARD) */}
        <div className="bg-[#363042] flex items-center gap-2 px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#5e5571] shadow-sm focus-within:border-purple-300 transition-colors print:hidden">
          <Search className="w-3.5 h-3.5 text-purple-300 shrink-0" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'bn' ? 'নোট, ভাউচার নং বা টাকার পরিমাণ দিয়ে খুঁজুন...' : 'Search by note, bill no or amount...'}
            className="w-full bg-transparent border-none text-xs outline-none text-slate-100 placeholder:text-purple-200/50 font-medium py-0"
          />
          {searchQuery && (
            <button 
              type="button" 
              onClick={() => setSearchQuery('')} 
              className="text-purple-200 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* TABLE COLUMN HEADER */}
        <div className="grid grid-cols-12 items-center text-[9px] font-bold text-purple-200 uppercase px-2 py-0.5 select-none print:hidden">
          <div className="col-span-5 flex items-center gap-1 min-w-0">
            <span className="truncate">{lang === 'bn' ? `তারিখ ও বিবরণ (${filteredTxs.length})` : `Date & Note (${filteredTxs.length})`}</span>
          </div>
          <div className="col-span-4 text-center">
            <span className="text-purple-200 font-bold">{lang === 'bn' ? 'মূল ব্যালেন্স' : 'Amount'}</span>
          </div>
          <div className="col-span-3 text-right">
            <span className="text-purple-200 font-bold">{!hideRunningBalance ? (lang === 'bn' ? 'জের ব্যালেন্স' : 'Balance') : (lang === 'bn' ? 'জের (লুকানো)' : 'Hidden')}</span>
          </div>
        </div>

        {/* TRANSACTION HISTORY ROWS (LIGHT DARK CARDS ON SOFT DARK BACKGROUND #4A4459) */}
        <div className="space-y-1">
            {dateGroupedPortalTxs.length === 0 ? (
              <div className="text-center py-6 text-purple-200 border border-dashed border-[#5e5571] rounded-xl bg-[#363042]/70">
                <Clock className="w-4 h-4 text-purple-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold leading-none">
                  {lang === 'bn' ? 'কোনো লেনদেনের রেকর্ড পাওয়া যায়নি।' : 'No records match search parameters.'}
                </p>
              </div>
            ) : (
              dateGroupedPortalTxs.map((group) => {
                return (
                  <div key={group.dateKey} className="space-y-1 flex flex-col">
                    {group.items.map((tx) => {
                      const isGave = tx.type === 'GAVE';
                      const isToday = isDateToday(tx.date || tx.createdAt);

                      return (
                        <div 
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="bg-[#363042] hover:bg-[#413a4f] border border-[#5e5571] hover:border-purple-300/60 rounded-lg px-2.5 py-1.5 sm:py-2 grid grid-cols-12 items-center cursor-pointer transition-colors shadow-xs select-none text-left gap-1"
                        >
                          {/* Col 1: Date & Note */}
                          <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                            <span 
                              className={`text-[9px] sm:text-[10px] font-mono shrink-0 ${
                                isToday 
                                  ? 'text-amber-300 font-bold' 
                                  : 'text-purple-200 font-medium'
                              }`}
                              title={isToday ? (lang === 'bn' ? 'আজকের লেনদেন' : 'Today\'s transaction') : undefined}
                            >
                              {formatTxDate(tx.date || tx.createdAt)}
                            </span>
                            
                            <span className="text-[#5e5571] text-[9px] shrink-0">|</span>
       
                            <span className="text-xs font-semibold text-white truncate min-w-0 flex-1">
                              {tx.note || (isGave 
                                ? (lang === 'bn' ? 'পণ্য ক্রয় হিসাব' : 'Goods Purchased') 
                                : (lang === 'bn' ? 'টাকা জমা/পরিশোধ' : 'Amount Deposited'))
                              }
                            </span>
                          </div>

                          {/* Col 2: Amount (মূল ব্যালেন্স) */}
                          <div className="col-span-4 flex items-center justify-center text-center">
                            <span className={`text-xs sm:text-sm font-extrabold font-mono tabular-nums tracking-tight whitespace-nowrap text-center ${
                              !isGave ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {!isGave ? '+' : '-'}{currency}{toBn(tx.amount.toFixed(2))}
                            </span>
                          </div>

                          {/* Col 3: Running Balance (জের ব্যালেন্স) */}
                          <div className="col-span-3 flex items-center justify-end text-right">
                            {!hideRunningBalance ? (
                              <span className="text-[11px] sm:text-xs font-mono font-bold tracking-tight inline-flex items-center justify-end shrink-0 whitespace-nowrap text-right">
                                <span className="text-purple-300 font-normal mr-0.5">(</span>
                                <span className={`tabular-nums ${
                                  (tx as any).runningBalance < 0 
                                    ? 'text-emerald-400' 
                                    : (tx as any).runningBalance > 0
                                    ? 'text-rose-400'
                                    : 'text-purple-200'
                                }`}>
                                  {(tx as any).runningBalance < 0 ? '+' : (tx as any).runningBalance > 0 ? '-' : ''}
                                  {currency}{toBn(Math.abs((tx as any).runningBalance).toFixed(1))}
                                </span>
                                <span className="text-purple-300 font-normal ml-0.5">)</span>
                              </span>
                            ) : (
                              <span className="text-xs font-mono text-purple-300 tracking-wider shrink-0 text-right">
                                (•••)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Print Statement Button */}
          <div className="pt-3 pb-1 flex justify-center print:hidden">
            <button 
              onClick={handlePrintPortal}
              className="inline-flex items-center gap-1.5 bg-[#363042] hover:bg-[#413a4f] border border-[#5e5571] text-slate-100 hover:text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-purple-300" />
              <span>{lang === 'bn' ? 'রিপোর্ট প্রিন্ট করুন' : 'Print Statement Report'}</span>
            </button>
          </div>
        </main>

      {/* SYSTEM STATEMENT FOOTER */}
      <footer className="mt-auto border-t border-[#5e5571] bg-[#363042] p-3 text-center print:border-none print:bg-white print:text-slate-800">
        <p className="text-[10px] font-bold text-purple-200 uppercase tracking-wider">
          {lang === 'bn' ? ' হ্যালো পয়েন্ট - মেসার্স এন্টারপ্রাইজ' : ' HELLO POINT LEDGER ACCOUNT SECURITY'}
        </p>
        <p className="text-[9px] font-medium text-purple-300/80 mt-0.5">
          {lang === 'bn' 
            ? 'এই হিসাব বিবরণীটি একটি সংরক্ষিত এন্ট্রি যা কেবল মালিক পরিবর্তন বা রদবদল করতে পারেন।'
            : 'Internal transactions bookkeeping remains certified by admin credentials of overall owner.'}
        </p>
      </footer>

      {/* TRANSACTION DETAILS MODAL */}
      {selectedTx && (
        <div id="tx-receipt-details-portal" className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] print:hidden">
          <div className="bg-[#363042] rounded-2xl border border-[#5e5571] shadow-2xl p-5 w-full max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-[#5e5571] pb-3 mb-3">
              <span className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                {lang === 'bn' ? 'লেনদেনের বিস্তারিত রশিদ' : 'RECEIPT VOUCHER'}
              </span>
              <button 
                onClick={() => setSelectedTx(null)}
                className="w-7 h-7 rounded-lg bg-[#2b2635] hover:bg-[#3d364a] border border-[#5e5571] flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {/* Receipt status */}
              <div className="text-center bg-[#2b2635] border border-[#5e5571] p-3.5 rounded-xl">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block mb-1.5 ${
                  selectedTx.type === 'GAVE' ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {selectedTx.type === 'GAVE' ? (lang === 'bn' ? 'মাল ক্রয় করেছেন' : 'Purchased') : (lang === 'bn' ? 'টাকা পরিশোধ/জমা' : 'Amount Deposited')}
                </span>
                
                <h4 className={`text-2xl font-extrabold font-mono tracking-tight ${
                  selectedTx.type === 'GAVE' ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {selectedTx.type === 'GAVE' ? '-' : '+'} {currency}{toBn(selectedTx.amount.toFixed(2))}
                </h4>
              </div>

              {/* Transaction details block */}
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-300">
                <div className="bg-[#2b2635] p-2.5 rounded-xl border border-[#5e5571]">
                  <span className="text-[9px] font-bold text-purple-200 uppercase block tracking-wider mb-0.5">
                    {lang === 'bn' ? 'রশিদ নং' : 'BILL NO'}
                  </span>
                  <span className="text-white font-mono font-bold select-all">
                    {selectedTx.billNo ? toBn(selectedTx.billNo) : (lang === 'bn' ? '- মন্তব্য নেই -' : 'N/A')}
                  </span>
                </div>

                <div className="bg-[#2b2635] p-2.5 rounded-xl border border-[#5e5571]">
                  <span className="text-[9px] font-bold text-purple-200 uppercase block tracking-wider mb-0.5">
                    {lang === 'bn' ? 'তারিখ ও সময়' : 'DATE & TIME'}
                  </span>
                  <span className="text-slate-100 leading-tight block">
                    {formatTxDate(selectedTx.date || selectedTx.createdAt)}
                  </span>
                </div>
              </div>

              <div className="bg-[#2b2635] p-2.5 rounded-xl border border-[#5e5571] text-xs">
                <span className="text-[9px] font-bold text-purple-200 uppercase block tracking-wider mb-0.5">
                  {lang === 'bn' ? 'বিবরণ বা পণ্য মন্তব্য' : 'REMARKS / INVOICE DETS'}
                </span>
                <span className="text-slate-100 font-semibold">
                  {selectedTx.note || (lang === 'bn' ? 'কোনো বিবরণ রেকর্ড করা নেই।' : 'No note entered.')}
                </span>
              </div>

              {/* Attached voucher photo */}
              {selectedTx.attachFile && (
                <div className="bg-[#2b2635] p-2.5 rounded-xl border border-[#5e5571]">
                  <span className="text-[9px] font-bold text-purple-200 uppercase block tracking-wider mb-1.5 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{lang === 'bn' ? 'সংযুক্ত রশিদের ছবি' : 'ATTACHED VOUCHER DOCUMENT'}</span>
                  </span>
                  <div className="relative rounded-lg overflow-hidden border border-[#5e5571] bg-black/60 max-h-48 flex items-center justify-center">
                    <img 
                      src={selectedTx.attachFile} 
                      alt="receipt attach" 
                      className="max-h-48 object-contain w-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}

              {/* Signature canvas */}
              {selectedTx.signature && (
                <div className="bg-[#2b2635] p-2.5 rounded-xl border border-[#5e5571]">
                  <span className="text-[9px] font-bold text-purple-200 uppercase block tracking-wider mb-1 flex items-center gap-1">
                    <PenTool className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'bn' ? 'গ্রাহকের স্বাক্ষর ভেরিফিকেশন' : 'CUSTOMER SIGNLOCK VERIFIED'}</span>
                  </span>
                  <div className="bg-[#363042] p-2 rounded-lg border border-[#5e5571] flex justify-center items-center h-20">
                    <img 
                      src={selectedTx.signature} 
                      alt="Signature" 
                      className="max-h-16 object-contain invert" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#5e5571] pt-3 mt-3">
              <button
                onClick={() => setSelectedTx(null)}
                className="flex-1 py-2 bg-[#2b2635] hover:bg-[#3d364a] border border-[#5e5571] text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close Receipt'}
              </button>
              <button
                onClick={handlePrintReceipt}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'প্রিন্ট রশিদ' : 'Print Voucher'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN IMAGE ZOOM MODAL */}
      {zoomedImage && (
        <div 
          id="photo-zoom-dialog-overlay"
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] print:hidden"
        >
          <div 
            className="relative bg-[#131823] rounded-2xl p-3 border border-[#222c3f] shadow-2xl flex flex-col items-center justify-center w-full max-w-[340px]"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 bg-[#0b0f17] hover:bg-slate-800 text-slate-300 rounded-lg p-1.5 transition-colors cursor-pointer z-10"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4 text-slate-200" />
            </button>
            <div className="w-full aspect-square rounded-xl overflow-hidden border border-[#1e2638] bg-black/60 flex items-center justify-center mt-6 mb-3">
              <img 
                src={zoomedImage.url} 
                alt={zoomedImage.name} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover" 
              />
            </div>
            <h3 className="text-xs font-bold text-slate-100 mb-2 truncate max-w-full px-2 text-center leading-tight">
              {zoomedImage.name}
            </h3>
          </div>
        </div>
      )}

      {/* ACTIVE CLIENT CHAT DIALOG */}
      <AnimatePresence>
        {showChatModal && (
          <ChatBox 
            currentContactId={customer.id}
            chatMessages={chatMessages}
            senderRole="customer"
            senderName={customer.name}
            onSendMessage={onSendChatMessage || (() => {})}
            onMarkAsRead={onMarkChatsAsRead || (() => {})}
            onClose={() => setShowChatModal(false)}
            lang={lang}
            contactName={customer.name}
            themeColor={themeColor}
          />
        )}
      </AnimatePresence>

      {/* PAY-BILL SUCCESS MODAL */}
      {showPaybillSuccessPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] select-text">
          <div className="w-full max-w-sm bg-[#131823] border border-[#222c3f] rounded-2xl shadow-2xl p-5 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mb-3 shrink-0">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2">
              {lang === 'bn' ? 'বিল সাবমিট সফল!' : 'BILL SUBMIT SUCCESSFUL!'}
            </h3>
            
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              {lang === 'bn' ? (
                <>
                  আপনার বিল সাবমিট সফল হয়েছে ধন্যবাদ। আপনার বিলের সিরিয়াল নাম্বারটি নিচে দেওয়া হলো, এটি আপনার বিলের পেপারে লিখে রাখুন।
                  <br />
                  <span className="font-mono font-bold text-blue-300 bg-blue-950/60 px-3 py-1.5 rounded-xl text-sm border border-blue-500/30 inline-block my-2">
                    {toBn(paybillSuccessSerial)}
                  </span>
                </>
              ) : (
                <>
                  Your bill submission has been successful, thank you. Your bill serial number is shown below, please write it on your bill paper.
                  <br />
                  <span className="font-mono font-bold text-blue-300 bg-blue-950/60 px-3 py-1.5 rounded-xl text-sm border border-blue-500/30 inline-block my-2">
                    {paybillSuccessSerial}
                  </span>
                </>
              )}
            </p>
            
            <button
              onClick={() => setShowPaybillSuccessPopup(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors uppercase"
            >
              {lang === 'bn' ? 'ঠিক আছে' : 'OKAY'}
            </button>
          </div>
        </div>
      )}



    </div>
  );

  // Print voucher invoice details helper
  function handlePrintReceipt() {
    if (!selectedTx) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>HELLO POINT RECEIPT #${selectedTx.billNo || '0000'}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 20px; }
            .details { margin: 20px 0; font-size: 14px; line-height: 1.8; }
            .amount { font-size: 24px; font-weight: bold; text-align: center; color: ${themeColor}; margin: 20px 0; background: ${themeColor}10; padding: 10px; border-radius: 8px; }
            .sig { margin-top: 50px; border-top: 1px solid #ccc; width: 150px; text-align: center; padding-top: 5px; float: right; }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="header">
            <h2>HELLO POINT LEDGER STATEMENT</h2>
            <p>Customer Voucher Statement Receipt</p>
          </div>
          <div class="details">
            <p><strong>Customer Name:</strong> ${customer.name}</p>
            <p><strong>Phone:</strong> ${customer.phone}</p>
            <p><strong>Bill Invoice Number:</strong> #${selectedTx.billNo || 'N/A'}</p>
            <p><strong>Remarks:</strong> ${selectedTx.note || 'No note entered.'}</p>
            <p><strong>Recorded Date:</strong> ${formatTxDate(selectedTx.date || selectedTx.createdAt)}</p>
          </div>
          <div class="amount">
            ${selectedTx.type === 'GAVE' ? '-' : '+'} ${currency}${selectedTx.amount.toFixed(2)}
          </div>
          ${selectedTx.signature ? `
            <div style="margin-top: 20px; text-align: center;">
              <p style="font-size: 11px; color:#aaa; text-transform:uppercase;">Verified Signature</p>
              <img src="${selectedTx.signature}" style="max-height: 80px;" />
            </div>
          ` : ''}
          <div class="sig">Authorized Shop Stamp</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}
