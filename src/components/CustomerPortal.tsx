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
  Sparkles
} from 'lucide-react';
import { Contact, Transaction, RechargeRequest, ChatMessage, PayBillEntry, PayBillRequest } from '../types';
import { getContactSummary } from '../utils/storage';
import { soundEngine } from '../utils/audio';
import { motion, AnimatePresence } from 'motion/react';
import { ChatBox } from './ChatBox';

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
  paybillRequests = []
}: CustomerPortalProps) {
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

    const cleanNum = rechargePhoneInput.trim().replace(/\D/g, '');
    if (cleanNum.length < 10 || cleanNum.length > 11) {
      setRechargeError(lang === 'bn' ? 'সঠিক ১০ বা ১১ ডিজিটের ফোন নম্বর লিখুন।' : 'Please enter a valid 10 or 11 digit phone number.');
      return;
    }

    const amt = parseFloat(rechargeAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setRechargeError(lang === 'bn' ? 'টাকার সঠিক পরিমাণ লিখুন।' : 'Please enter a valid positive amount.');
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
    if (/[a-zA-Z\u0980-\u09FF]/.test(phoneRaw)) {
      setPaybillError(lang === 'bn' ? '⚠️ মোবাইল নম্বরের জায়গায় নাম বা অন্য লেখা বসানো হয়েছে! অনুগ্রহ করে ডিজিট লিখুন।' : '⚠️ Name or text placed in Mobile Number field!');
      return;
    }
    const cleanPhone = phoneRaw.replace(/\D/g, '');
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
      setPaybillError(lang === 'bn' ? '⚠️ মোবাইল নম্বরের জায়গায় বিলার আইডি বা ভুল সংখ্যা বসানো হয়েছে! অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নম্বর লিখুন (যেমন: 01712345678)।' : '⚠️ Biller ID or invalid number placed in Mobile Number field! Enter valid 11-digit mobile number.');
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
        const lowerQuery = searchQuery.trim().toLowerCase();
        if (lowerQuery) {
          const matchNote = t.note?.toLowerCase().includes(lowerQuery);
          const matchBill = t.billNo?.toLowerCase().includes(lowerQuery);
          const matchAmt = String(t.amount).toLowerCase().includes(lowerQuery);
          if (!matchNote && !matchBill && !matchAmt) return false;
        }

        // Type match
        if (filterType === 'gave' && t.type !== 'GAVE') return false;
        if (filterType === 'got' && t.type !== 'GOT') return false;

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [customerTxs, searchQuery, filterType]);

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
    <div id="customer-portal-root" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 select-none pb-8 print:bg-white print:pb-0">
      
      {/* HIGH-RES TOP COMPACT GRADIENT BANNER */}
      <header className="bg-gradient-to-r from-purple-700 to-indigo-850 text-white shadow-sm sticky top-0 z-50 print:hidden select-none">
        <div className="max-w-4xl mx-auto px-3 py-1.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-7.5 h-7.5 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-black text-amber-300 shadow-inner text-xs">
              
            </div>
            <div>
              <h1 className="text-[10.5px] font-black tracking-wider uppercase text-purple-100">
                {lang === 'bn' ? 'হ্যালো পয়েন্ট গ্রাহক খাতা' : 'HELLO POINT CUST PORTAL'}
              </h1>
              <p className="text-[8.5px] font-bold text-slate-200 uppercase tracking-wider leading-none mt-0.5">
                {lang === 'bn' ? 'নিরাপদ ডিজিটাল খাতা' : 'SECURE DIGITAL STATEMENT'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Language Toggle switch */}
            <button 
              onClick={() => {
                const nl = lang === 'bn' ? 'en' : 'bn';
                setLang(nl);
                localStorage.setItem('hellopoint_lang', nl);
              }}
              className="text-[8px] font-black border border-white/25 hover:bg-white/10 px-1.5 py-0.5 rounded transition-all uppercase cursor-pointer"
            >
              {lang === 'bn' ? 'ENGLISH' : 'বাংলা'}
            </button>

            {/* Logout Trigger button */}
            <button 
              onClick={onLogout}
              className="bg-rose-650 hover:bg-rose-500 text-white text-[8.5px] font-black px-2 py-1 rounded-lg transition-all uppercase flex items-center gap-1 cursor-pointer shadow-tiny"
            >
              <LogOut className="w-3 h-3" />
              <span>{lang === 'bn' ? 'লগআউট' : 'LOGOUT'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-2 py-2 w-full flex-1 space-y-2 print:p-0">
        
        {/* CUSTOMER GREETING & INFO BAR */}
        <div id="portal-usercard" className="bg-white rounded-xl border border-purple-200/80 p-2.5 shadow-tiny flex flex-row justify-between items-center gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            
            {/* Interactive Larger Profile Image containing Camera Action for File input selection */}
            <div className="relative group shrink-0">
              <div 
                onClick={() => {
                  if (customer.photoUrl) {
                    setZoomedImage({ url: customer.photoUrl, name: customer.name });
                  }
                }}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-600 relative flex items-center justify-center shadow-md ring-2 ring-purple-500/30 select-none ${customer.photoUrl ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all' : ''}`}
              >
                {customer.photoUrl ? (
                  <img 
                    src={customer.photoUrl} 
                    alt={customer.name} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-black text-lg relative uppercase tracking-wider select-none">
                    <span className="drop-shadow-xs">{customer.name.trim().charAt(0).toUpperCase()}</span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent pointer-events-none" />
                  </div>
                )}
                
                {/* Visual semi-transparent overlay on hover to invite interaction */}
                {customer.photoUrl && (
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-black uppercase text-center p-0.5">
                    {lang === 'bn' ? 'বড় করুন' : 'Zoom'}
                  </div>
                )}
              </div>
              
              {/* Overlay Camera trigger button */}
              <label 
                className="absolute -bottom-0.5 -right-0.5 bg-brand-primary text-white p-1 rounded-full shadow cursor-pointer hover:scale-110 active:scale-95 transition-all border border-white flex items-center justify-center"
                title={lang === 'bn' ? 'প্রোফাইল ছবি পরিবর্তন করুন' : 'Change Profile Picture'}
              >
                <Camera className="w-2.5 h-2.5" />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handlePhotoUpload}
                  className="hidden" 
                />
              </label>
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 select-text leading-tight flex items-center gap-1.5 flex-wrap">
                <span className="truncate">{customer.name}</span>
                {customer.photoUrl && (
                  <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 py-0.2 rounded-full font-black border border-emerald-100 uppercase tracking-wider shrink-0">{lang === 'bn' ? 'প্রোফাইল ছবিযুক্ত' : 'Verified'}</span>
                )}
              </h2>
              <p className="text-[10.5px] font-bold text-slate-500 flex items-center gap-1 mt-1 leading-none select-text">
                <Phone className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                <span className="bg-brand-light text-brand-hover px-1.5 py-0.2 rounded font-mono font-black">{toBn(customer.phone)}</span>
              </p>
            </div>
          </div>

          {/* Improved Inbox trigger button with ✉️ icon and eye-catching movement when new message arrives */}
          <button 
            id="portal-inbox-trigger"
            onClick={() => setShowChatModal(true)}
            title={lang === 'bn' ? 'মেসেজ ইনবক্স' : 'Message Inbox'}
            className={`bg-amber-400 hover:bg-amber-300 text-purple-950 p-2.5 rounded-2xl transition-all flex items-center justify-center cursor-pointer shadow-md relative shrink-0 ${
              unreadChatsCount > 0 
                ? 'animate-wiggle ring-4 ring-rose-500/50 bg-amber-300 scale-110' 
                : 'hover:scale-105'
            }`}
          >
            <span className={`text-xl leading-none select-none inline-block ${unreadChatsCount > 0 ? 'animate-bounce' : ''}`}>✉️</span>
            {unreadChatsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center px-1 border-2 border-white shadow-md animate-pulse">
                {toBn(unreadChatsCount)}
              </span>
            )}
          </button>
        </div>

        {/* COMPACT EXQUISITE ACCOUNT BALANCE HEADER CARD */}
        <div className="bg-gradient-to-br from-brand-primary to-brand-hover rounded-xl p-3 text-white shadow-tiny flex items-center justify-between relative overflow-hidden select-none border border-brand-primary/10">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-6 -mt-6 blur-lg pointer-events-none" />
          
          <div className="relative z-10 flex flex-col justify-center">
            <p className="text-[8.5px] uppercase tracking-wider text-purple-150 font-black">
              {summary.balance > 0 ? (
                <span className="text-yellow-300 font-extrabold">{lang === 'bn' ? 'দোকানের পাওনা টাকা' : 'Outstanding Shop Due'}</span>
              ) : summary.balance < 0 ? (
                <span className="text-emerald-300 font-extrabold">{lang === 'bn' ? 'আপনার সর্বমোট জমা' : 'Your Net Advance'}</span>
              ) : (
                <span className="text-white/70 font-extrabold">{lang === 'bn' ? 'হিসাব পরিশোধিত' : 'Ledger settled'}</span>
              )}
            </p>
            
            <h1 className="text-base sm:text-xl font-black mt-0.5 text-white tracking-tight leading-none">
              {currency}{toBn(Math.abs(summary.balance).toFixed(2))}
            </h1>
          </div>

          {/* Custom styled dynamic status pill badge with required exact texts */}
          <div className="relative z-10">
            {summary.balance > 0 ? (
              <div id="due-badge" className="bg-yellow-450 text-[#300540] font-extrabold px-2.5 py-1 rounded-md text-[9px] uppercase tracking-wide leading-none shadow-sm">
                {lang === 'bn' ? 'মোট বকেয়া' : 'TOTAL DUE'}
              </div>
            ) : summary.balance < 0 ? (
              <div id="credit-badge" className="bg-[#34c759] text-white font-extrabold px-2.5 py-1 rounded-md text-[9px] uppercase tracking-wide leading-none shadow-sm">
                {lang === 'bn' ? 'মোট জমা' : 'TOTAL DEPOSIT'}
              </div>
            ) : (
              <div id="settled-badge" className="bg-white/10 text-white/90 font-extrabold px-2 py-1 rounded-md text-[8.5px] uppercase tracking-wide leading-none">
                {lang === 'bn' ? 'পরিশোধিত' : 'SETTLED'}
              </div>
            )}
          </div>
        </div>

        {/* RECHARGE PANEL */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-tiny p-2.5 space-y-2">
          {myCurrentRequest ? (
            // If there's an active request for this customer phone session
            myCurrentRequest.status === 'pending' ? (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-center space-y-1.5 select-text">
                <div className="inline-flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full animate-pulse">
                  <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <h4 className="text-[11px] font-black text-indigo-900 tracking-wide uppercase">
                  {lang === 'bn' ? 'অনুরোধ পেন্ডিং আছে' : 'RECHARGE REQUEST PENDING'}
                </h4>
                <p className="text-[11px] font-bold text-slate-705 leading-normal max-w-md mx-auto">
                  {lang === 'bn' 
                    ? 'আপনার রিকুয়েষ্ট টি গ্রহণ করা হয়েছে অনুগ্রহ করে অপেক্ষা করুন, প্রয়োজনে আপনার সাথে যোগাযোগ করা হতে পারে, ধন্যবাদ।'
                    : 'Your request has been received, please wait. We might contact you if needed. Thank you.'}
                </p>
                <div className="pt-1.5 flex flex-wrap justify-center gap-2 text-[10.5px] font-bold text-slate-700">
                  <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1 font-mono">
                    📱 {toBn(myCurrentRequest.rechargePhone)}
                  </span>
                  <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1 font-mono">
                    💵 {currency}{toBn(myCurrentRequest.amount.toFixed(2))}
                  </span>
                  <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1 font-black uppercase tracking-wide">
                    💰 {myCurrentRequest.method === 'bkash' ? (lang === 'bn' ? 'বিকাশ' : 'bKash') : myCurrentRequest.method === 'nagad' ? (lang === 'bn' ? 'নগদ' : 'Nagad') : (lang === 'bn' ? 'ফ্লেক্সিলোড' : 'Flexiload')}
                  </span>
                </div>
              </div>
            ) : (
              // Successful Completion Card
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-center space-y-1.5 select-text animate-fade-in">
                <div className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full">
                  <Check className="w-4 h-4 text-emerald-600 animate-bounce" />
                </div>
                <h4 className="text-[11px] font-black text-emerald-950 tracking-wide uppercase">
                  {lang === 'bn' ? 'রিচার্জ সফল হয়েছে!' : 'RECHARGE COMPLETED SECURELY!'}
                </h4>
                <p className="text-[11.5px] font-bold text-emerald-800 leading-normal max-w-md mx-auto">
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
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black rounded-lg shadow-tiny cursor-pointer transition-all uppercase"
                  >
                    {lang === 'bn' ? 'ঠিক আছে' : 'OKAY'}
                  </button>
                </div>
              </div>
            )
          ) : (
            // Form to make request
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsRechargeExpanded(!isRechargeExpanded)}
                className="w-full py-2 px-3 bg-[#6244a6] hover:bg-[#523496] text-white text-[10.5px] font-black rounded-xl shadow-tiny cursor-pointer flex items-center justify-between transition-all"
                style={{ backgroundColor: themeColor }}
              >
                <span className="flex items-center gap-1 uppercase tracking-wide">
                  ⚡ {lang === 'bn' ? 'রিচার্জ এবং পে-বিল সাবমিট করুন' : 'Recharge & Pay-Bill Submit'}
                </span>
                <span>{isRechargeExpanded ? '▲' : '▼'}</span>
              </button>

              {isRechargeExpanded && (
                <div className="space-y-2.5 pt-1.5 border-t border-slate-100 animate-slide-down">
                  {/* Option Grid */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-1.5">
                      {lang === 'bn' ? 'রিচার্জ বা পেমেন্ট এর মাধ্যম সিলেক্ট করুন' : 'SELECT METHOD'}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedMethod('bkash')}
                        className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border font-bold text-[11px] cursor-pointer ${
                          selectedMethod === 'bkash' 
                            ? 'bg-[#da1c5c]/10 text-[#da1c5c] border-[#da1c5c] ring-2 ring-[#da1c5c]/25' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-[#da1c5c]" />
                        <span>{lang === 'bn' ? 'বিকাশ' : 'bKash'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMethod('nagad')}
                        className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border font-bold text-[11px] cursor-pointer ${
                          selectedMethod === 'nagad' 
                            ? 'bg-[#f15a22]/10 text-[#f15a22] border-[#f15a22] ring-2 ring-[#f15a22]/25' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-[#f15a22]" />
                        <span>{lang === 'bn' ? 'নগদ' : 'Nagad'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMethod('flexiload')}
                        className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border font-bold text-[11px] cursor-pointer ${
                          selectedMethod === 'flexiload' 
                            ? 'bg-purple-50 text-purple-700 border-purple-400 ring-2 ring-purple-400/20' 
                            : 'bg-slate-50 text-slate-755 border-slate-200 hover:bg-slate-100'
                        }`}
                        style={selectedMethod === 'flexiload' ? { color: themeColor, borderColor: themeColor, backgroundColor: `${themeColor}10` } : {}}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600" style={{ backgroundColor: themeColor }} />
                        <span>{lang === 'bn' ? 'ফ্লেক্সিলোড' : 'Flexiload'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMethod('paybill')}
                        className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border font-bold text-[11px] cursor-pointer ${
                          selectedMethod === 'paybill' 
                            ? 'bg-blue-50 text-blue-700 border-blue-400 ring-2 ring-blue-400/20' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span>{lang === 'bn' ? 'পে-বিল' : 'Pay-Bill'}</span>
                      </button>
                    </div>
                  </div>

                  {selectedMethod && selectedMethod !== 'paybill' && (
                    <form onSubmit={handleSubmitRecharge} className="space-y-3 animate-fade-in">
                      {/* Phone Input */}
                      <div>
                        <label className="block text-[9.5px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          {lang === 'bn' ? 'রিচার্জের মোবাইল নম্বর লিখুন' : 'RECHARGE MOBILE PHONE NUMBER'}
                        </label>
                        <input
                          type="tel"
                          pattern="[0-9]*"
                          maxLength={11}
                          required
                          value={rechargePhoneInput}
                          onChange={(e) => setRechargePhoneInput(e.target.value)}
                          placeholder={lang === 'bn' ? '১১ ডিজিটের মোবাইল নম্বর দিন' : 'e.g. 017XXXXXXXX'}
                          className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-purple-600 transition-all tracking-wider text-center"
                        />
                      </div>

                      {/* Amount Input */}
                      <div>
                        <label className="block text-[9.5px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          {lang === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'RECHARGE AMOUNT'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">
                            {currency}
                          </span>
                          <input
                            type="number"
                            required
                            min="10"
                            max="10000"
                            value={rechargeAmountInput}
                            onChange={(e) => setRechargeAmountInput(e.target.value)}
                            placeholder={lang === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Amount value'}
                            className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-purple-600 transition-all text-center font-mono tracking-wider"
                          />
                        </div>
                      </div>

                      {rechargeError && (
                        <p className="text-[9.5px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-1.5 text-center leading-normal">
                          ⚠️ {rechargeError}
                        </p>
                      )}

                      {/* Action buttons */}
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-gradient-to-r from-purple-650 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white text-[10.5px] font-black rounded-xl shadow-tiny cursor-pointer transition-all flex items-center justify-center gap-1.5 uppercase tracking-wide"
                        style={{ backgroundImage: `linear-gradient(to right, ${themeColor}, color-mix(in srgb, ${themeColor} 85%, black))` }}
                      >
                        <span>{lang === 'bn' ? 'অনুরোধ সাবমিট করুন' : 'SUBMIT RECHARGE REQUEST'}</span>
                      </button>
                    </form>
                  )}

                  {selectedMethod === 'paybill' && (
                    <form onSubmit={handleSubmitPaybill} className="space-y-3 animate-fade-in text-left">
                      {/* Auto-filled notification banner */}
                      {paybillAutoFilled && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-2.5 text-[10px] font-bold flex items-center gap-2 animate-fade-in shadow-xs">
                          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
                          <span>
                            {lang === 'bn' 
                              ? '✨ পূর্বের রেকর্ড অনুযায়ী নাম ও মোবাইল নম্বর অটো-ফিলাপ হয়েছে।' 
                              : '✨ Name and mobile number auto-filled from previous record.'}
                          </span>
                        </div>
                      )}

                      {/* Biller ID Card */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 hover:border-blue-400 transition-all">
                        <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          {lang === 'bn' ? 'বিলার আইডি দিন' : 'BILLER ID / ACCOUNT NUMBER'} <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={paybillBillerNum}
                          onChange={(e) => handleBillerNumberChange(e.target.value)}
                          placeholder={lang === 'bn' ? 'বিলার আইডি লিখুন (শুধু ডিজিট)' : 'e.g. 123456'}
                          className={`w-full bg-white border px-3.5 py-2 rounded-xl text-xs font-mono font-bold outline-none transition-all text-center tracking-wider ${
                            paybillBillerNum && /[a-zA-Z\u0980-\u09FF]/.test(paybillBillerNum)
                              ? 'border-rose-400 text-rose-600 bg-rose-50/30'
                              : 'border-slate-200 text-slate-800 focus:border-blue-600'
                          }`}
                        />
                        {paybillBillerNum && /[a-zA-Z\u0980-\u09FF]/.test(paybillBillerNum) && (
                          <p className="text-[9px] font-bold text-rose-500 mt-1 text-center">
                            ⚠️ বিলার আইডিতে নাম/অক্ষর বসানো যাবে না, শুধুমাত্র ডিজিট লিখুন।
                          </p>
                        )}
                      </div>

                      {/* Amount Input Card */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 hover:border-blue-400 transition-all">
                        <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          {lang === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'BILL AMOUNT'} <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">
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
                            placeholder={lang === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Amount value'}
                            className={`w-full bg-white border pl-8 pr-3 py-2 rounded-xl text-xs font-bold outline-none transition-all text-center font-mono tracking-wider ${
                              paybillAmount && /^01\d{9}$/.test(paybillAmount)
                                ? 'border-rose-400 text-rose-600 bg-rose-50/30'
                                : 'border-slate-200 text-slate-800 focus:border-blue-600'
                            }`}
                          />
                        </div>
                        {paybillAmount && /^01\d{9}$/.test(paybillAmount) && (
                          <p className="text-[9px] font-bold text-rose-500 mt-1 text-center">
                            ⚠️ টাকার পরিমাণের জায়গায় মোবাইল নম্বর বসানো হয়েছে!
                          </p>
                        )}
                      </div>

                      {/* Biller Name Card */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 hover:border-blue-400 transition-all">
                        <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          {lang === 'bn' ? 'বাংলায় নাম লিখুন' : 'BILLER NAME / DESCRIPTION'} <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={paybillName}
                          onChange={(e) => {
                            setPaybillName(e.target.value);
                            setPaybillError('');
                          }}
                          placeholder={lang === 'bn' ? 'বাংলায় নাম লিখুন' : 'e.g. Rahis Ali'}
                          className={`w-full bg-white border px-3.5 py-2 rounded-xl text-xs font-bold outline-none transition-all text-center ${
                            paybillName && /^\d+$/.test(paybillName.trim())
                              ? 'border-rose-400 text-rose-600 bg-rose-50/30'
                              : 'border-slate-200 text-slate-800 focus:border-blue-600'
                          }`}
                        />
                        {paybillName && /^\d+$/.test(paybillName.trim()) && (
                          <p className="text-[9px] font-bold text-rose-500 mt-1 text-center">
                            ⚠️ নামের জায়গায় বিলার আইডি বা মোবাইল নম্বর বসানো হয়েছে!
                          </p>
                        )}
                      </div>

                      {/* Due Date Card */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 hover:border-blue-400 transition-all">
                        <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          {lang === 'bn' ? 'বিল পরিশোধের শেষ সময়' : 'LAST PAYMENT DATE'} <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={paybillDueDate}
                          onChange={(e) => {
                            setPaybillDueDate(e.target.value);
                            setPaybillError('');
                          }}
                          className="w-full bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 transition-all text-center"
                        />
                      </div>

                      {/* Mobile Number Card */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 hover:border-blue-400 transition-all">
                        <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          {lang === 'bn' ? 'মোবাইল নাম্বার' : 'MOBILE PHONE NUMBER'} <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <input
                          type="tel"
                          pattern="[0-9]*"
                          maxLength={11}
                          required
                          value={paybillPhone}
                          onChange={(e) => {
                            setPaybillPhone(e.target.value);
                            setPaybillError('');
                          }}
                          placeholder={lang === 'bn' ? '১১ ডিজিটের মোবাইল নম্বর দিন' : 'e.g. 017XXXXXXXX'}
                          className={`w-full bg-white border px-3.5 py-2 rounded-xl text-xs font-mono font-bold outline-none transition-all tracking-wider text-center ${
                            paybillPhone && (/[a-zA-Z\u0980-\u09FF]/.test(paybillPhone) || (paybillPhone.replace(/\D/g, '').length > 0 && !paybillPhone.replace(/\D/g, '').startsWith('01')))
                              ? 'border-rose-400 text-rose-600 bg-rose-50/30'
                              : 'border-slate-200 text-slate-800 focus:border-blue-600'
                          }`}
                        />
                        {paybillPhone && /[a-zA-Z\u0980-\u09FF]/.test(paybillPhone) && (
                          <p className="text-[9px] font-bold text-rose-500 mt-1 text-center">
                            ⚠️ মোবাইল নম্বর ফিল্ডে নাম বা লেখা বসানো হয়েছে!
                          </p>
                        )}
                      </div>

                      {paybillError && (
                        <p className="text-[9.5px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center leading-normal shadow-xs">
                          ⚠️ {paybillError}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedMethod(null)}
                          className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-500 text-[10.5px] font-black rounded-xl transition-all cursor-pointer uppercase text-center"
                        >
                          {lang === 'bn' ? 'বাতিল' : 'CANCEL'}
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[10.5px] font-black rounded-xl shadow-tiny cursor-pointer transition-all uppercase text-center"
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

        {/* CUMULATIVE STATS COMPACT GRID ROW */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-white rounded-xl border border-slate-100 p-2 flex flex-col justify-between h-[52px] shadow-tiny">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">
              {lang === 'bn' ? 'মোট খরিদ (বাকি)' : 'TOTAL GOODS TAKEN'}
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-850 tracking-tight leading-none mt-0.5">
              {currency}{toBn(summary.totalGave.toFixed(2))}
            </span>
            <span className="text-[7.5px] font-bold text-slate-400 leading-none">
              {lang === 'bn' ? 'দোকানের ক্রিসেন্ট খাতা' : 'goods purchase invoice logs'}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-2 flex flex-col justify-between h-[52px] shadow-tiny">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">
              {lang === 'bn' ? 'মোট পরিশোধ (জমা)' : 'TOTAL PAID / DEPOSITED'}
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-850 tracking-tight leading-none mt-0.5">
              {currency}{toBn(summary.totalGot.toFixed(2))}
            </span>
            <span className="text-[7.5px] font-bold text-slate-400 leading-none">
              {lang === 'bn' ? `${toBn(summary.entryCount)}টি পেমেন্ট রশিদ` : `${summary.entryCount} total receipts`}
            </span>
          </div>
        </div>

        {/* Categorical swapper - outside the grid */}
        <div className="flex justify-between items-center bg-slate-50 border border-slate-205/65 p-1.5 rounded-lg mt-1.5 select-none print:hidden">
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider">
              {lang === 'bn' ? 'হিসাব খতিয়ান ফিল্টার' : 'LEDGER ACCOUNT FILTER'}
            </span>
            <button 
              type="button"
              onClick={toggleHideRunningBalance}
              title={hideRunningBalance ? 'জের ব্যালেন্স দেখান' : 'জের ব্যালেন্স লুকান'}
              className="p-0.5 hover:bg-slate-200 active:scale-95 text-slate-500 rounded transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
            >
              {hideRunningBalance ? (
                <EyeOff className="w-3.5 h-3.5 text-slate-400 hover:text-purple-600" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-purple-600" />
              )}
            </button>
          </div>
          <div className="flex rounded-lg bg-slate-200 p-0.5 select-none text-[8.5px] font-extrabold">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterType === 'all' 
                  ? 'bg-purple-650 text-white shadow-tiny font-black' 
                  : 'text-slate-550 hover:text-slate-855'
              }`}
            >
              {lang === 'bn' ? 'সব' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('gave')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterType === 'gave' 
                  ? 'bg-rose-500 text-white font-black shadow-tiny' 
                  : 'text-slate-550 hover:text-slate-855'
              }`}
            >
              {lang === 'bn' ? 'ক্রয়' : 'Purchased'}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('got')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                filterType === 'got' 
                  ? 'bg-emerald-600 text-white font-black shadow-tiny' 
                  : 'text-slate-550 hover:text-slate-855'
              }`}
            >
              {lang === 'bn' ? 'পরিশোধ' : 'Paid'}
            </button>
          </div>
        </div>

        {/* Render Timeline entries - LONG BILLER CARD STYLE */}
        <div className="space-y-3 sm:space-y-3.5">
            {dateGroupedPortalTxs.length === 0 ? (
              <div className="text-center py-6 text-slate-400 border border-dashed border-slate-150 rounded-xl">
                <Clock className="w-5 h-5 text-slate-350 mx-auto mb-1 animate-pulse" />
                <p className="text-[10px] font-bold leading-none">
                  {lang === 'bn' ? 'কোনো লেনদেনের রেকর্ড পাওয়া যায়নি।' : 'No records match search parameters.'}
                </p>
              </div>
            ) : (
              dateGroupedPortalTxs.map((group) => {
                // Card density mapping configurations for transaction rows
                const rowStyles = {
                  compact: {
                    containerPadding: "px-2 py-0.5 sm:py-1 gap-1",
                    dateText: "text-[7.5px] sm:text-[8px]",
                    separator: "text-[7.5px]",
                    noteText: "text-[9.5px] sm:text-[10px]",
                    amountText: "text-[10px] sm:text-[10.5px]",
                    balanceText: "text-[10px] sm:text-[10.5px]"
                  },
                  comfortable: {
                    containerPadding: "px-2.5 py-1 sm:py-1.5 gap-1.5",
                    dateText: "text-[8px] sm:text-[8.5px]",
                    separator: "text-[8px]",
                    noteText: "text-[10.5px] sm:text-[11px]",
                    amountText: "text-[11px] sm:text-[11.5px]",
                    balanceText: "text-[11px] sm:text-[11.5px]"
                  },
                  large: {
                    containerPadding: "px-3 py-1.5 sm:py-2 gap-2",
                    dateText: "text-[9px] sm:text-[9.5px]",
                    separator: "text-[9px]",
                    noteText: "text-[11.5px] sm:text-[12px]",
                    amountText: "text-[12px] sm:text-[12.5px]",
                    balanceText: "text-[12px] sm:text-[12.5px]"
                  }
                };

                const style = rowStyles[cardDensity] || rowStyles.comfortable;

                return (
                  <div key={group.dateKey} className="space-y-1 sm:space-y-1.5 flex flex-col">
                    {/* Entries for this date */}
                    {group.items.map((tx) => {
                      const isGave = tx.type === 'GAVE';
                      const isToday = isDateToday(tx.date || tx.createdAt);

                      return (
                        <div 
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className={`${
                            !isGave
                              ? 'bg-emerald-50/70 hover:bg-emerald-100/60 border-emerald-200/80'
                              : 'bg-white hover:bg-slate-50 border-slate-200/50'
                          } border rounded-lg ${style.containerPadding} flex items-center justify-between cursor-pointer transition-all shadow-tiny hover:border-purple-300 select-none text-left`}
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                            {/* Date: Light yellow/amber for today, muted slate for other days */}
                            <span 
                              className={`${style.dateText} font-mono shrink-0 ${
                                isToday 
                                  ? 'text-amber-500 dark:text-yellow-300 font-black' 
                                  : 'text-slate-400 font-bold'
                              }`}
                              title={isToday ? (lang === 'bn' ? 'আজকের লেনদেন' : 'Today\'s transaction') : undefined}
                            >
                              {formatTxDate(tx.date || tx.createdAt)}
                            </span>
                            
                            <span className={`text-slate-300 ${style.separator} shrink-0 font-light`}>|</span>
       
                            {/* Note / Comment and Main Balance (মুল ব্যালেন্স ক্যাটাগরির ডান পাশে) */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className={`${style.noteText} font-extrabold text-slate-700 truncate min-w-0`}>
                                {tx.note || (isGave 
                                  ? (lang === 'bn' ? 'পণ্য ক্রয় হিসাব' : 'Goods Purchased') 
                                  : (lang === 'bn' ? 'টাকা জমা/পরিশোধ' : 'Amount Deposited'))
                                }
                              </span>

                              {/* Main Balance (মুল ব্যালেন্স) */}
                              <span className={`${style.amountText} font-black font-mono tracking-tight shrink-0 whitespace-nowrap ${
                                !isGave ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {!isGave ? '+' : '-'}{currency}{toBn(tx.amount.toFixed(2))}
                              </span>
                            </div>
                          </div>
         
                          {/* Running Balance Column (জের ব্যালেন্স একটু বড় হবে) */}
                          <div className="shrink-0 text-right flex items-center justify-end select-none pl-1.5">
                            {!hideRunningBalance ? (
                              <span className={`${style.balanceText} font-bold tracking-tight leading-none inline-flex items-center gap-0.5 shrink-0`}>
                                <span className="text-slate-400 font-normal">(</span>
                                <span className={`font-black font-mono ${
                                  (tx as any).runningBalance < 0 
                                    ? 'text-emerald-600 dark:text-emerald-400' 
                                    : (tx as any).runningBalance > 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                  {(tx as any).runningBalance < 0 ? '+' : (tx as any).runningBalance > 0 ? '-' : ''}
                                  {currency}{toBn(Math.abs((tx as any).runningBalance).toFixed(1))}
                                </span>
                                <span className="text-slate-400 font-normal">)</span>
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold text-slate-300 tracking-wider leading-none shrink-0">
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

          {/* Print Report Text at the extremely bottom of history list */}
          <div className="pt-5 pb-1 flex justify-center print:hidden">
            <button 
              onClick={handlePrintPortal}
              className="inline-flex items-center gap-2 bg-brand-light hover:bg-brand-light/95 border border-brand-primary/20 text-brand-hover font-black text-[11px] px-5 py-2.5 rounded-full shadow-sm transition-all duration-200 cursor-pointer animate-pulse hover:animate-none"
            >
              <Printer className="w-4 h-4 text-brand-hover" />
              <span>{lang === 'bn' ? 'রিপোর্ট প্রিন্ট করুন' : 'Print Statement Report'}</span>
            </button>
          </div>
        </main>

      {/* DENSE SYSTEM STATEMENT FOOTER */}
      <footer className="mt-auto border-t border-slate-200 bg-white p-3 text-center print:border-none print:bg-white">
        <p className="text-[9px] font-black text-slate-405 uppercase tracking-widest">
          {lang === 'bn' ? ' হ্যালো পয়েন্ট - মেসার্স এন্টারপ্রাইজ' : ' HELLO POINT LEDGER ACCOUNT SECURITY'}
        </p>
        <p className="text-[7.5px] font-bold text-slate-400 mt-1 uppercase tracking-wide">
          {lang === 'bn' 
            ? 'এই হিসাব বিবরণীটি একটি সংরক্ষিত এন্ট্রি যা কেবল মালিক পরিবর্তন বা রদবদল করতে পারেন।'
            : 'Internal transactions bookkeeping remains certified by admin credentials of overall owner.'}
        </p>
      </footer>

      {/* COMPACT MODAL: VIEW SINGLE LEDGER TRANSACTION DETAILS (RECEIPT PREVIEW) */}
      {selectedTx && (
        <div id="tx-receipt-details-portal" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] print:hidden">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 w-full max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
              <span className="text-[9.5px] font-black text-brand-primary uppercase tracking-widest">
                {lang === 'bn' ? 'লেনদেনের বিস্তারিত রশিদ' : 'RECEIPT VOUCHER'}
              </span>
              <button 
                onClick={() => setSelectedTx(null)}
                className="w-6 h-6 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              
              {/* Receipt status */}
              <div className="text-center bg-slate-50 border border-slate-150 p-3 rounded-2xl">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full inline-block mb-1.5 ${
                  selectedTx.type === 'GAVE' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}>
                  {selectedTx.type === 'GAVE' ? (lang === 'bn' ? 'মাল ক্রয় করেছেন' : 'Purchased') : (lang === 'bn' ? 'টাকা পরিশোধ/জমা' : 'Amount Deposited')}
                </span>
                
                <h4 className={`text-2xl font-light font-sans tracking-tight ${
                  selectedTx.type === 'GAVE' ? 'text-[#ff3b30]' : 'text-[#34c759]'
                }`}>
                  {selectedTx.type === 'GAVE' ? '-' : '+'} {currency}{toBn(selectedTx.amount.toFixed(2))}
                </h4>
              </div>

              {/* Transaction details block */}
              <div className="grid grid-cols-2 gap-3 text-[10.5px] font-bold text-slate-550">
                <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider mb-0.5">
                    {lang === 'bn' ? 'রশিদ নং' : 'BILL NO'}
                  </span>
                  <span className="text-slate-800 font-mono font-black select-all">
                    {selectedTx.billNo ? toBn(selectedTx.billNo) : (lang === 'bn' ? '- মন্তব্য নেই -' : 'N/A')}
                  </span>
                </div>

                <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider mb-0.5">
                    {lang === 'bn' ? 'তারিখ ও সময়' : 'DATE & TIME'}
                  </span>
                  <span className="text-slate-800 leading-tight block">
                    {formatTxDate(selectedTx.date || selectedTx.createdAt)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 text-[10.5px]">
                <span className="text-[8.5px] font-black text-slate-400 uppercase block tracking-wider mb-0.5">
                  {lang === 'bn' ? 'বিবরণ বা পণ্য মন্তব্য' : 'REMARKS / INVOICE DETS'}
                </span>
                <span className="text-slate-800 font-bold">
                  {selectedTx.note || (lang === 'bn' ? 'কোনো বিবরণ রেকর্ড করা নেই।' : 'No note entered.')}
                </span>
              </div>

              {/* Media upload view (attached voucher paper photo) */}
              {selectedTx.attachFile && (
                <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase block tracking-wider mb-1.5 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{lang === 'bn' ? 'সংযুক্ত রশিদের ছবি' : 'ATTACHED VOUCHER DOCUMENT'}</span>
                  </span>
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-white max-h-48 flex items-center justify-center">
                    <img 
                      src={selectedTx.attachFile} 
                      alt="receipt attach" 
                      className="max-h-48 object-contain scale-in duration-300 w-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}

              {/* Base64 dynamic Signature canvas */}
              {selectedTx.signature && (
                <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase block tracking-wider mb-1 flex items-center gap-1">
                    <PenTool className="w-3.5 h-3.5 text-[#ff9500]" />
                    <span>{lang === 'bn' ? 'গ্রাহকের স্বাক্ষর ভেরিফিকেশন' : 'CUSTOMER SIGNLOCK VERIFIED'}</span>
                  </span>
                  <div className="bg-orange-50/40 p-2 rounded-lg border border-orange-100/50 flex justify-center items-center h-24">
                    <img 
                      src={selectedTx.signature} 
                      alt="Signature" 
                      className="max-h-20 object-contain selection:bg-transparent"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}

            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-3 mt-3">
              <button
                onClick={() => setSelectedTx(null)}
                className="flex-1 py-1.8 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10.5px] font-black rounded-xl transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close Receipt'}
              </button>
              <button
                onClick={handlePrintReceipt}
                className="flex-1 py-1.8 bg-purple-650 hover:bg-purple-600 text-white text-[10.5px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-tiny"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'প্রিন্ট রশিদ' : 'Print Voucher'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL CUSTOM FULL-SCREEN IMAGE ZOOM MODAL */}
      {zoomedImage && (
        <div 
          id="photo-zoom-dialog-overlay"
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[999999] animate-fade-in print:hidden"
        >
          <div 
            className="relative bg-white rounded-3xl p-3 border border-slate-100 shadow-2xl flex flex-col items-center justify-center w-full max-w-[340px] animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 bg-slate-100/80 hover:bg-slate-200 text-slate-700 rounded-full p-1.5 transition-all active:scale-90 cursor-pointer z-10"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4 text-slate-800" />
            </button>
            <div className="w-full aspect-square rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center shadow-inner mt-6 mb-3">
              <img 
                src={zoomedImage.url} 
                alt={zoomedImage.name} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover animate-fade-in"
              />
            </div>
            <h3 className="text-xs font-black text-slate-800 mb-2 truncate max-w-full px-2 text-center leading-tight">
              {zoomedImage.name}
            </h3>
          </div>
        </div>
      )}

      {/* ACTIVE CLIENT CHAT DIALOG FOR CUSTOMER VIEW */}
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

      {/* Pay-Bill Success Modal Popup */}
      {showPaybillSuccessPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-fade-in select-text">
          <div className="w-full max-w-sm bg-white border border-slate-200/95 rounded-[32px] shadow-2xl p-6 flex flex-col items-center text-center animate-slide-up">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shrink-0">
              <Check className="w-6 h-6 animate-bounce text-emerald-600" />
            </div>
            
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">
              {lang === 'bn' ? 'বিল সাবমিট সফল!' : 'BILL SUBMIT SUCCESSFUL!'}
            </h3>
            
            <p className="text-xs text-slate-650 leading-relaxed mb-5">
              {lang === 'bn' ? (
                <>
                  আপনার বিল সাবমিট সফল হয়েছে ধন্যবাদ। আপনার বিলের সিরিয়াল নাম্বারটি নিচে দেওয়া হলো, এটি আপনার বিলের পেপারে লিখে রাখুন।
                  <br />
                  <span className="font-mono font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl text-sm border border-blue-100 inline-block my-2">
                    {toBn(paybillSuccessSerial)}
                  </span>
                </>
              ) : (
                <>
                  Your bill submission has been successful, thank you. Your bill serial number is shown below, please write it on your bill paper.
                  <br />
                  <span className="font-mono font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl text-sm border border-blue-100 inline-block my-2">
                    {paybillSuccessSerial}
                  </span>
                </>
              )}
            </p>
            
            <button
              onClick={() => setShowPaybillSuccessPopup(false)}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-tiny cursor-pointer transition-all active:scale-95 uppercase"
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
