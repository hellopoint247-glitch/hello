/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { 
  ArrowLeft, 
  MoreVertical, 
  FileText, 
  Bell, 
  MessageSquare, 
  Edit3, 
  Trash2, 
  RotateCcw,
  PhoneCall,
  Search,
  CheckCircle2,
  X,
  User,
  Camera,
  Eye,
  EyeOff
} from 'lucide-react';
import { Contact, Transaction, ChatMessage } from '../types';
import { getContactSummary } from '../utils/storage';
import { AnimatePresence } from 'motion/react';
import { ChatBox } from './ChatBox';

interface CustomerDetailProps {
  contact: Contact;
  transactions: Transaction[];
  allContacts?: Contact[];
  onSelectContact?: (contactId: string) => void;
  onSaveTransaction?: (data: any) => Promise<void> | void;
  onBack: () => void;
  onNavigateToForm: (contactId: string, isGaveMode: boolean, transactionId?: string) => void;
  onDeleteTransaction: (id: string) => void;
  onDeleteContact?: (id: string) => void;
  onClearAllEntries?: (contactId: string) => void;
  currency: string;
  onUpdatePhoto?: (contactId: string, photoBase64: string) => void;
  onUpdateContactInfo?: (contactId: string, name: string, phone: string) => void;
  chatMessages?: ChatMessage[];
  onSendChatMessage?: (contactId: string, text: string, senderRole: 'owner' | 'customer', senderName: string) => void;
  onDeleteChatMessage?: (messageId: string) => void;
  onMarkChatsAsRead?: (contactId: string, role: 'owner' | 'customer') => void;
}

export function CustomerDetail({
  contact,
  transactions,
  allContacts = [],
  onSelectContact,
  onSaveTransaction,
  onBack,
  onNavigateToForm,
  onDeleteTransaction,
  onDeleteContact,
  onClearAllEntries,
  currency,
  onUpdatePhoto,
  onUpdateContactInfo,
  chatMessages = [],
  onSendChatMessage,
  onDeleteChatMessage,
  onMarkChatsAsRead
}: CustomerDetailProps) {
  const [searchTxQuery, setSearchTxQuery] = useState('');
  const [hideRunningBalance, setHideRunningBalance] = useState<boolean>(
    () => localStorage.getItem('hellopoint_hide_running_balance') === 'true'
  );

  const [cardDensity, setCardDensity] = useState<'compact' | 'comfortable' | 'large'>(() => {
    return (localStorage.getItem('hellopoint_card_density') as 'compact' | 'comfortable' | 'large') || 'compact';
  });

  const [showDeleteContactConfirm, setShowDeleteContactConfirm] = useState(false);
  const [showClearEntriesConfirm, setShowClearEntriesConfirm] = useState(false);

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
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [showChatBox, setShowChatBox] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(contact.name);
  const [editPhone, setEditPhone] = useState(contact.phone);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (showEditModal) {
      setEditName(contact.name);
      setEditPhone(contact.phone);
      setEditError('');
    }
  }, [showEditModal, contact]);

  const unreadChatsCount = useMemo(() => {
    return (chatMessages || []).filter(m => m.contactId === contact.id && m.senderRole === 'customer' && !m.readByOwner).length;
  }, [chatMessages, contact.id]);

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
            onUpdatePhoto(contact.id, dataUrl);
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
              onUpdatePhoto(contact.id, dataUrl);
            }
          }
        };
        fbImg.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEditModal) {
          setShowEditModal(false);
        } else if (showDeleteContactConfirm) {
          setShowDeleteContactConfirm(false);
        } else if (showClearEntriesConfirm) {
          setShowClearEntriesConfirm(false);
        } else if (txToDelete) {
          setTxToDelete(null);
        } else if (zoomedImage) {
          setZoomedImage(null);
        } else if (showChatBox) {
          setShowChatBox(false);
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEditModal, showDeleteContactConfirm, showClearEntriesConfirm, txToDelete, zoomedImage, showChatBox, onBack]);

  // Calculate contact balance details
  const summary = useMemo(() => {
    return getContactSummary(contact.id, transactions);
  }, [contact.id, transactions]);

  // Balance calculation progressively to match Screenshot 2's "Bal. ৳ ..." details on each line item
  // We need items in chronological order to calculate running balance
  const txsWithRunningBalance = useMemo(() => {
    const list = [...transactions].filter(t => t.contactId === contact.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    
    let running = 0;
    const mapped = list.map(t => {
      if (t.type === 'GAVE') {
        running += t.amount; // shop gave, so customer owes more
      } else {
        running -= t.amount; // shop got, so customer owes less
      }
      return {
        ...t,
        runningBalance: running
      };
    });
    
    // Return order matching screen (newest first)
    return mapped.reverse().filter(t => {
      const matchSearch = (t.note || '').toLowerCase().includes(searchTxQuery.toLowerCase()) || 
        (t.billNo && t.billNo.toLowerCase().includes(searchTxQuery.toLowerCase())) ||
        (toBengaliNumber(t.amount).includes(searchTxQuery) || t.amount.toString().includes(searchTxQuery));
      return matchSearch;
    });
  }, [contact.id, transactions, searchTxQuery]);

  const isWeOwe = summary.balance < 0; 
  const isTheyOwe = summary.balance > 0;
  const absBalance = Math.abs(summary.balance);

  const toBengaliNumber = (num: number | string): string => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
  };

  const displayTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = d.getDate().toString().padStart(2, '0');
      const year = d.getFullYear().toString().substring(2);
      const mName = months[d.getMonth()];
      
      return `${day} ${mName} ${year}`;
    } catch (e) {
      return dateStr;
    }
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

  const formatDateHeader = (dateKey: string) => {
    try {
      const [yStr, mStr, dStr] = dateKey.split('-');
      if (!yStr || !mStr || !dStr) return dateKey;
      
      const dayNum = parseInt(dStr, 10);
      const monthNum = parseInt(mStr, 10) - 1;
      const yearNum = parseInt(yStr, 10);
      
      const monthNamesBn = [
        'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
        'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
      ];
      const monthName = monthNamesBn[monthNum] || mStr;

      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      let prefix = '';
      if (dateKey === todayKey) {
        prefix = 'আজ, ';
      } else if (dateKey === yesterdayKey) {
        prefix = 'গতকাল, ';
      }

      return `${prefix}${toBengaliNumber(dayNum)} ${monthName} ${toBengaliNumber(yearNum)}`;
    } catch {
      return dateKey;
    }
  };

  // Group customer transactions by date
  const dateGroupedTransactions = useMemo(() => {
    const groups: {
      dateKey: string;
      displayDate: string;
      items: {
        tx: typeof txsWithRunningBalance[0];
        globalIndex: number;
      }[];
    }[] = [];

    const groupMap = new Map<string, typeof groups[0]>();

    txsWithRunningBalance.forEach((tx, globalIndex) => {
      const key = getNormalizedDateKey(tx.date || tx.createdAt);
      let group = groupMap.get(key);
      if (!group) {
        group = {
          dateKey: key,
          displayDate: formatDateHeader(key),
          items: []
        };
        groupMap.set(key, group);
        groups.push(group);
      }

      group.items.push({ tx, globalIndex });
    });

    return groups;
  }, [txsWithRunningBalance]);

  const copyToClipboard = (txt: string) => {
    if (!txt) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => {
        setFeedbackMsg('নোটটি বা এসএমএস কপি হয়েছে!');
        setTimeout(() => setFeedbackMsg(''), 2500);
      }).catch(() => {
        fallbackCopyToClipboard(txt);
      });
    } else {
      fallbackCopyToClipboard(txt);
    }
  };

  const fallbackCopyToClipboard = (txt: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = txt;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      if (successful) {
        setFeedbackMsg('নোটটি বা এসএমএস কপি হয়েছে!');
        setTimeout(() => setFeedbackMsg(''), 2500);
      }
      document.body.removeChild(textArea);
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
  };

  const triggerSMSAlert = () => {
    const message = `প্রিয় ${contact.name}, আপনার কাছে বকেয়া হিসাব রয়েছে ${currency} ${absBalance.toFixed(2)} টাকা। অনুগ্রহ করে দ্রুত পরিশোধের ব্যবস্থা করুন। ধন্যবাদ, Hello Point।`;
    copyToClipboard(message);
    setFeedbackMsg('রিমাইন্ডার মেসেজ ক্লিপবোর্ডে কপি হয়েছে!');
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const triggerWhatsAppReminder = () => {
    const message = `প্রিয় ${contact.name}, আপনার কাছে আমাদের পাওনা হিসাব রয়েছে: ${currency} ${absBalance.toFixed(2)} টাকা। - Hello Point`;
    const url = `https://wa.me/${contact.phone ? contact.phone : ''}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const exportSingleCustomerToGoogleSheet = () => {
    try {
      const csvRows = [];
      const BOM = '\uFEFF';
      
      csvRows.push([`হ্যালো পয়েন্ট - কাস্টমার খতিয়ান রিপোর্ট`]);
      csvRows.push([`কাস্টমারের নাম: ${contact.name}`]);
      csvRows.push([`মোবাইল নম্বর: ${contact.phone || 'নেই'}`]);
      csvRows.push([`তারিখ: ${new Date().toLocaleDateString('bn-BD')}`]);
      csvRows.push([]);
      csvRows.push([
        'ক্রমিক নং',
        'তারিখ ও সময়',
        'বিবরণ',
        `পেয়েছি/জমা (${currency})`,
        `দিয়েছি/বকেয়া (${currency})`,
        `চলতি জের (${currency})`
      ]);

      const chronoList = [...txsWithRunningBalance].reverse();
      
      let totalGave = 0;
      let totalGot = 0;

      chronoList.forEach((t, index) => {
        const isGave = t.type === 'GAVE';
        const receivedStr = !isGave ? t.amount.toFixed(2) : '0.00';
        const givenStr = isGave ? t.amount.toFixed(2) : '0.00';
        
        if (isGave) {
          totalGave += t.amount;
        } else {
          totalGot += t.amount;
        }

        const dateStr = displayTime(t.date || t.createdAt);
        const noteStr = t.note || 'সাধারণ লেনদেন';
        
        csvRows.push([
          index + 1,
          dateStr,
          noteStr,
          receivedStr,
          givenStr,
          t.runningBalance.toFixed(2)
        ]);
      });

      csvRows.push([]);
      csvRows.push([
        'মোট হিসাব',
        '',
        '',
        `মোট পেয়েছি: ${totalGot.toFixed(2)}`,
        `মোট দিয়েছি: ${totalGave.toFixed(2)}`,
        `নেট জের: ${summary.balance.toFixed(2)}`
      ]);

      const csvContent = BOM + csvRows.map(row => 
        row.map(value => {
          const strVal = String(value).replace(/"/g, '""');
          return `"${strVal}"`;
        }).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileNameStr = `হ্যালো_পয়েন্ট_খতিয়ান_${contact.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        
      link.setAttribute('download', fileNameStr);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export single customer to Google Sheet:', err);
    }
  };

  return (
    <div id="customer-detail-viewport" className="flex flex-col min-h-screen bg-[#eaeff5] dark:bg-[#252B33] text-slate-800 dark:text-[#F1F3F5] font-sans pb-20 select-none print:bg-white print:p-0">
      
      {/* Deep Purple Header containing Back buttons and options menu - Hides on print */}
      <header className="bg-brand-primary text-white px-3 py-3.5 flex items-center justify-between shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <button 
            id="btn-back"
            onClick={onBack}
            className="p-1 hover:bg-white/10 rounded-full transition-all text-white cursor-pointer"
            title="ফিরে যান"
          >
            <ArrowLeft className="w-5.5 h-5.5" />
          </button>
          
          <div>
            <h2 id="detail-customer-name" className="text-base font-black tracking-tight flex items-center gap-2">
              <span>{contact.name}</span>
            </h2>
            {contact.phone && (
              <p className="text-[10px] text-white/70 flex items-center gap-0.5">
                <PhoneCall className="w-3 h-3 text-yellow-300" />
                {contact.phone}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Detailed Chat Button with Badge */}
          <button 
            id="detail-chat-trigger"
            onClick={() => setShowChatBox(true)}
            className="p-1.5 hover:bg-white/10 rounded-full transition-all text-white relative cursor-pointer"
            title="গ্রাহকের সাথে চ্যাট করুন"
          >
            <MessageSquare className="w-5.5 h-5.5 text-white" />
            {unreadChatsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 bg-red-650 text-white rounded-full text-[8.5px] font-black flex items-center justify-center px-1 border border-brand-primary shadow-md">
                {unreadChatsCount}
              </span>
            )}
          </button>

          <div className="relative">
            <button 
              id="detail-ellipsis-menu"
              onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
              className="p-1.5 hover:bg-white/10 rounded-full transition-all text-white cursor-pointer"
              title="মেনু"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          
            {showOptionsDropdown && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-100 rounded-lg shadow-xl z-20 text-slate-800 overflow-hidden divide-y divide-slate-50">
                {contact.phone && (
                  <a 
                    href={`tel:${contact.phone}`}
                    className="w-full text-left px-3.5 py-2 text-[11px] font-bold hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 block"
                  >
                    <PhoneCall className="w-4 h-4 text-emerald-600" /> সরাসরি কল
                  </a>
                )}
                <button 
                  onClick={() => {
                    setShowEditModal(true);
                    setShowOptionsDropdown(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-[11px] font-bold hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-rose-500" /> তথ্য পরিবর্তন (Edit)
                </button>
                <button 
                  onClick={() => {
                    exportSingleCustomerToGoogleSheet();
                    setShowOptionsDropdown(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-[11px] font-bold hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-600" /> গুগল শিট ডাউনলোড
                </button>

                <button 
                  onClick={() => {
                    setShowClearEntriesConfirm(true);
                    setShowOptionsDropdown(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-[11px] font-bold hover:bg-amber-50 text-amber-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-amber-600" /> সব এন্ট্রি ক্লিয়ার
                </button>

                <button 
                  onClick={() => {
                    setShowDeleteContactConfirm(true);
                    setShowOptionsDropdown(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-[11px] font-bold hover:bg-red-50 text-red-600 flex items-center gap-1.5 cursor-pointer animate-pulse"
                >
                  <Trash2 className="w-4 h-4 text-red-600" /> কাস্টমার ডিলিট (Delete)
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating Alert Banner if feedback is stored */}
      {feedbackMsg && (
        <div className="fixed top-14 left-4 right-4 max-w-md mx-auto bg-purple-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl z-40 flex items-center gap-2 border border-purple-500 animate-bounce print:hidden">
          <CheckCircle2 className="w-4.5 h-4.5 text-yellow-300 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Main Container - Responsive Single Column on Mobile, Dual Column Desktop Workspace on md: and above */}
      <div className="p-3 flex-1 max-w-full md:max-w-6xl mx-auto w-full print:hidden pb-24 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-5 items-start">

          {/* LEFT COLUMN (ON DESKTOP): Transaction History Feed & Search */}
          <div className="order-2 md:order-1 md:col-span-7 lg:col-span-7 space-y-2.5">
            {/* Small search within customer transaction entries */}
            <div className="bg-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-tiny">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                value={searchTxQuery}
                onChange={(e) => setSearchTxQuery(e.target.value)}
                placeholder="নোট বা বিবরণ দিয়ে খুঁজুন..."
                className="w-full bg-transparent border-none text-[10.5px] outline-none placeholder:text-slate-400 font-bold"
              />
              {searchTxQuery && (
                <button onClick={() => setSearchTxQuery('')} className="text-slate-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Ledger Entries List */}
            <div>
              <div className="flex justify-between items-center text-[9px] font-black tracking-widest text-slate-400 uppercase px-1 mb-1.5 pb-1 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span>লেনদেন খতিয়ান তালিকা ({txsWithRunningBalance.length})</span>
                  <button 
                    type="button"
                    onClick={toggleHideRunningBalance}
                    title={hideRunningBalance ? 'জের ব্যালেন্স দেখান' : 'জের ব্যালেন্স লুকান'}
                    className="p-0.5 hover:bg-slate-100 active:scale-95 text-slate-500 rounded transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                  >
                    {hideRunningBalance ? (
                      <EyeOff className="w-3.5 h-3.5 text-slate-400 hover:text-purple-600" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-purple-600" />
                    )}
                  </button>
                </div>
                <span className="flex gap-2">
                  <span className="text-emerald-600">● পেয়েছি (+)</span>
                  <span className="text-rose-500">● দিয়েছি (-)</span>
                </span>
              </div>

              <div id="ledger-rows-wrapper" className="space-y-3 sm:space-y-3.5 w-full flex flex-col">
                {dateGroupedTransactions.length === 0 ? (
                  <div className="text-center py-6 bg-white rounded-lg border border-slate-100 shadow-tiny text-slate-400 text-[9.5px] font-bold col-span-full">
                    কোনো লেনদেনের এন্ট্রি পাওয়া যায়নি।
                  </div>
                ) : (
                  dateGroupedTransactions.map((group) => {
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
                        {/* Transaction items belonging to this specific date */}
                        {group.items.map(({ tx: t, globalIndex: index }) => {
                          const isGaveType = t.type === 'GAVE';
                          const isToday = isDateToday(t.date || t.createdAt);

                          return (
                            <div 
                              key={t.id}
                              onClick={() => {
                                setExpandedTxId(expandedTxId === t.id ? null : t.id);
                              }}
                              className="bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-tiny hover:border-purple-300 select-none text-left flex flex-col overflow-hidden"
                              id={`tx-card-${t.id}`}
                            >
                              {/* Top-Row: Serial, Date, Category/Note, Mul Balance, and Jer Balance */}
                              <div className={`${style.containerPadding} flex items-center justify-between cursor-pointer`}>
                                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                                  {/* Serial Number: Clean typography without background or border */}
                                  <span 
                                    className="font-black font-mono text-[10px] sm:text-[11px] text-slate-700 dark:text-slate-200 shrink-0 min-w-[14px] text-center select-none"
                                    title={`ক্রমিক নং: ${toBengaliNumber(index + 1)}`}
                                  >
                                    {toBengaliNumber(index + 1)}
                                  </span>

                                  {/* Date: Light yellow/amber for today, muted slate for previous days */}
                                  <span 
                                    className={`${style.dateText} font-mono shrink-0 ${
                                      isToday 
                                        ? 'text-amber-500 dark:text-yellow-300 font-black' 
                                        : 'text-slate-400 dark:text-slate-400 font-bold'
                                    }`}
                                    title={isToday ? 'আজকের লেনদেন' : undefined}
                                  >
                                    {displayTime(t.date || t.createdAt)}
                                  </span>
                                  
                                  <span className={`text-slate-300 dark:text-slate-600 ${style.separator} shrink-0 font-light`}>|</span>

                                  {/* Note / Category & Main Balance (মুল ব্যালেন্স ক্যাটাগরির ডান পাশে) */}
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className={`${style.noteText} font-extrabold text-slate-800 dark:text-slate-100 truncate`}>
                                      {t.note || (isGaveType ? 'দিলেন (GAVE)' : 'পেলেন (RECEIVED)')}
                                    </span>

                                    {/* Main Balance (মুল ব্যালেন্স) right next to Category */}
                                    <span className={`${style.amountText} font-black font-mono tracking-tight shrink-0 whitespace-nowrap ${
                                      !isGaveType 
                                        ? 'text-emerald-600 dark:text-emerald-400' 
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                      {!isGaveType ? '+' : '-'}{currency}{t.amount.toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                {/* Running Balance Column (জের ব্যালেন্স একটু বড় হবে) */}
                                <div className="shrink-0 text-right flex items-center justify-end select-none pl-1.5">
                                  {!hideRunningBalance ? (
                                    <span className={`${style.balanceText} font-bold tracking-tight leading-none inline-flex items-center gap-0.5 shrink-0`}>
                                      <span className="text-slate-400 dark:text-slate-500 font-normal">(</span>
                                      <span className={`font-black font-mono ${
                                        t.runningBalance < 0 
                                          ? 'text-emerald-600 dark:text-emerald-400' 
                                          : t.runningBalance > 0
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-slate-600 dark:text-slate-400'
                                      }`}>
                                        {t.runningBalance < 0 ? '+' : t.runningBalance > 0 ? '-' : ''}
                                        {currency}{Math.abs(t.runningBalance).toFixed(1)}
                                      </span>
                                      <span className="text-slate-400 dark:text-slate-500 font-normal">)</span>
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-extrabold text-slate-300 dark:text-slate-500 tracking-wider leading-none shrink-0">
                                      (•••)
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Expandable Area: All extra details inside the card */}
                              {expandedTxId === t.id && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-3 animate-fade-in text-left select-text cursor-default"
                                >
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10.5px] text-slate-600">
                                    {/* Left Details block */}
                                    <div className="space-y-1">
                                      <p className="font-bold">
                                        ⚖️ <span className="text-slate-400">লেনদেন পরবর্তী ব্যালেন্স (জের):</span> <span className={`font-mono font-extrabold ${t.runningBalance > 0 ? 'text-rose-600 dark:text-rose-400' : t.runningBalance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                          {currency}{Math.abs(t.runningBalance).toFixed(2)}
                                          {t.runningBalance > 0 ? ' (পাওনা/Receivable)' : t.runningBalance < 0 ? ' (জমা/Deposit)' : ' (সমতা/Balanced)'}
                                        </span>
                                      </p>
                                      {t.billNo && (
                                        <p className="font-bold">
                                          📝 <span className="text-slate-400">ভাউচার / রসিদ নং:</span> <span className="font-mono text-xs text-purple-900 font-extrabold">{t.billNo}</span>
                                        </p>
                                      )}
                                      <p className="font-bold">
                                        📅 <span className="text-slate-400">লেনদেনের আসল সময়:</span> <span className="text-slate-700">{new Date(t.date || t.createdAt).toLocaleDateString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                      </p>
                                      <p className="font-bold">
                                        📊 <span className="text-slate-400">নিট হিসাবের প্রভাব:</span> <span className={isGaveType ? 'text-rose-600' : 'text-emerald-600'}>
                                          {isGaveType ? 'কাস্টমার বকেয়া বৃদ্ধি পেয়েছে' : 'কাস্টমার বকেয়া পরিশোধ করেছে/জমা দিয়েছে'}
                                        </span>
                                      </p>
                                    </div>

                                    {/* Signature and Attachment section */}
                                    <div className="flex gap-3 justify-start sm:justify-end items-center flex-wrap">
                                      {t.attachFile && (
                                        <div className="text-center">
                                          <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">সংযুক্ত রশিদ</span>
                                          <div className="border border-slate-200 bg-white p-0.5 rounded-lg shadow-tiny overflow-hidden">
                                            <img 
                                              src={t.attachFile} 
                                              alt="Bill Attachment" 
                                              className="h-14 w-14 object-cover hover:scale-105 transition-all duration-300 rounded cursor-zoom-in" 
                                              referrerPolicy="no-referrer"
                                              onClick={() => {
                                                const win = window.open();
                                                if (win) {
                                                  win.document.write(`<img src="${t.attachFile}" style="max-width:100%; max-height:100vh; margin:auto; display:block;" />`);
                                                }
                                              }}
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {t.signature && (
                                        <div className="text-center">
                                          <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">ডিজিটাল স্বাক্ষর</span>
                                          <div className="border border-slate-200 bg-white p-0.5 rounded-lg shadow-tiny overflow-hidden flex items-center justify-center">
                                            <img 
                                              src={t.signature} 
                                              alt="Signature" 
                                              className="h-14 w-14 object-contain opacity-85 rounded bg-slate-50" 
                                              referrerPolicy="no-referrer"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action buttons inside card */}
                                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-2 text-xs">
                                    <button
                                      onClick={() => {
                                        onNavigateToForm(contact.id, isGaveType, t.id);
                                      }}
                                      className="px-3 py-1.5 font-bold text-slate-650 bg-white hover:bg-slate-100 border border-slate-205 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-tiny"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                      <span>সম্পাদন</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        setTxToDelete(t);
                                      }}
                                      className="px-3 py-1.5 font-bold text-rose-600 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-tiny"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                      <span>মুছুন</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (ON DESKTOP): Customer Profile, Balance Card & Desktop Cash Out/Cash In */}
          <div className="order-1 md:order-2 md:col-span-5 lg:col-span-5 space-y-3 md:sticky md:top-3">
            {/* UNIFIED CUSTOMER PROFILE & BALANCE CARD (Original Exact Design) */}
            <div className="bg-gradient-to-r from-brand-primary via-brand-primary to-brand-hover rounded-2xl p-3 sm:p-4 text-white shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 relative overflow-hidden select-none border border-brand-primary/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl pointer-events-none" />
              
              {/* Left / Info Section: Avatar + Name + Phone + Badges */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Interactive profile picture inside CustomerDetail */}
                <div className="relative group shrink-0">
                  <div 
                    onClick={() => {
                      if (contact.photoUrl) {
                        setZoomedImage({ url: contact.photoUrl, name: contact.name });
                      }
                    }}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/80 overflow-hidden bg-white/10 relative flex items-center justify-center shadow-lg ring-2 ring-white/20 ${contact.photoUrl ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all' : ''}`}
                  >
                    {contact.photoUrl ? (
                      <img 
                        src={contact.photoUrl} 
                        alt={contact.name} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-600 text-white font-black text-xl sm:text-2xl relative uppercase tracking-wider select-none">
                        <span className="drop-shadow-md">{contact.name.trim().charAt(0).toUpperCase()}</span>
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent pointer-events-none" />
                      </div>
                    )}
                    
                    {/* Overlay on hover */}
                    {contact.photoUrl && (
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[7.5px] font-black uppercase text-center p-0.5 text-white">
                        বড় করুন
                      </div>
                    )}
                  </div>
                  
                  {/* Input camera triggers */}
                  <label 
                    className="absolute -bottom-1 -right-1 bg-yellow-400 hover:bg-yellow-350 text-slate-900 p-1 rounded-full shadow-md cursor-pointer hover:scale-110 active:scale-95 transition-all border border-brand-primary flex items-center justify-center"
                    title="প্রোফাইল ছবি পরিবর্তন করুন"
                  >
                    <Camera className="w-3 h-3" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload}
                      className="hidden" 
                    />
                  </label>
                </div>

                {/* Customer Name & Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black tracking-tight leading-tight text-white truncate">
                      {contact.name}
                    </h3>
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="p-1 hover:bg-white/20 active:scale-90 text-yellow-300 hover:text-yellow-250 rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0"
                      title="সম্পাদন করুন"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {contact.photoUrl && (
                      <span className="text-[7.5px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-black border border-white/15 uppercase tracking-widest shrink-0">ছবিযুক্ত</span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-[11px] font-bold text-white/85 flex items-center gap-1 mt-0.5 font-mono truncate">
                    <PhoneCall className="w-3 h-3 text-yellow-300 shrink-0" />
                    <span>{contact.phone || 'মোবাইল নং নেই'}</span>
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[7.5px] sm:text-[8px] text-white/80 tracking-wider uppercase font-black bg-white/15 px-2 py-0.5 rounded-full inline-block">
                      {contact.type === 'customer' ? 'গ্রাহক খতিয়ান' : 'সরবরাহকারী'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Section: Total Balance Box & Quick Actions */}
              <div className="flex items-center justify-between sm:justify-end bg-white/10 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/20 shrink-0 gap-3">
                <div className="flex flex-col items-start sm:items-end">
                  <div className="flex items-center gap-1">
                    <span className="text-[8.5px] sm:text-[9px] font-extrabold uppercase tracking-wider text-white/80">চলতি জের:</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[8px] sm:text-[8.5px] font-black tracking-wide ${
                      isTheyOwe ? 'bg-rose-500 text-white shadow-xs' :
                      isWeOwe ? 'bg-emerald-500 text-white shadow-xs' :
                      'bg-white/20 text-white'
                    }`}>
                      {isTheyOwe ? 'আপনি পাবেন' :
                       isWeOwe ? 'আপনি দেবেন' :
                       'সমতা হিসাব'}
                    </span>
                  </div>
                  <h1 className={`text-lg sm:text-xl font-black font-mono tracking-tight ${
                    isTheyOwe ? 'text-rose-200' :
                    isWeOwe ? 'text-emerald-200' :
                    'text-white'
                  }`}>
                    {currency} {absBalance.toFixed(2)}
                  </h1>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-1 border-l border-white/20 pl-2">
                  <button 
                    id="action-report-download"
                    onClick={exportSingleCustomerToGoogleSheet}
                    title="গুগল শিট ডাউনলোড"
                    className="p-1.5 sm:px-2 sm:py-1 bg-white/15 hover:bg-white/25 active:scale-95 rounded-lg text-[9px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-300" />
                    <span className="hidden sm:inline">শিট</span>
                  </button>
                  <button 
                    id="action-reminder-alert"
                    onClick={triggerWhatsAppReminder}
                    title="ওয়াটসঅ্যাপ তাগাদা"
                    className="p-1.5 sm:px-2 sm:py-1 bg-white/15 hover:bg-white/25 active:scale-95 rounded-lg text-[9px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                    <span className="hidden sm:inline">ওয়াটসঅ্যাপ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop-only Cash In / Cash Out Action buttons in the Right Column */}
            <div className="hidden md:flex gap-2.5 pt-1">
              <button 
                id="desktop-btn-you-got"
                onClick={() => onNavigateToForm(contact.id, false)} 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-2.5 px-3 rounded-xl font-black tracking-wide text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
              >
                YOU GOT (+) পেয়েছি
              </button>
              <button 
                id="desktop-btn-you-gave"
                onClick={() => onNavigateToForm(contact.id, true)} 
                className="flex-1 bg-rose-500 hover:bg-rose-600 active:scale-98 text-white py-2.5 px-3 rounded-xl font-black tracking-wide text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
              >
                YOU GAVE (-) দিয়েছি
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Persistent Bottom Action split layout buttons (Mobile only, hidden on desktop where buttons are on the left) */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 p-2.5 bg-white border-t border-slate-100 flex gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10 max-w-sm mx-auto rounded-t-xl print:hidden">
        <button 
          id="btn-you-got"
          onClick={() => onNavigateToForm(contact.id, false)} 
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-2 px-3 rounded-lg font-black tracking-wide text-xs flex items-center justify-center gap-0.5 shadow transition-all cursor-pointer"
        >
          YOU GOT (+) পেয়েছি
        </button>
        <button 
          id="btn-you-gave"
          onClick={() => onNavigateToForm(contact.id, true)} 
          className="flex-1 bg-rose-500 hover:bg-rose-600 active:scale-98 text-white py-2 px-3 rounded-lg font-black tracking-wide text-xs flex items-center justify-center gap-0.5 shadow transition-all cursor-pointer"
        >
          YOU GAVE (-) দিয়েছি
        </button>
      </footer>


      {/* Hidden printable layout for single customer statement ledger formatting as PDF receipt */}
      <div className="hidden print:block font-sans text-slate-900 p-6 max-w-4xl mx-auto">
        <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-slate-800">Hello Point</h1>
            <p className="text-[10px] text-slate-400">কাস্টমার হিসাবের খতিয়ান ও রসিদ বিবরণী</p>
          </div>
          <div className="text-right">
            <h3 className="text-base font-bold text-slate-800">{contact.name}</h3>
            <p className="text-[9px] font-mono text-slate-500">{contact.phone || 'মোবাইল: নেই'}</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg flex justify-between items-center text-xs">
          <div>
            <span>মোট এন্ট্রি সংখ্যা: <strong className="font-mono">{txsWithRunningBalance.length}</strong></span>
          </div>
          <div>
            <span>চলতি ব্যালেন্স: <strong className="font-mono text-sm uppercase">{currency} {absBalance.toFixed(2)} {isTheyOwe ? '(বকেয়া পাওনা)' : isWeOwe ? '(অগ্রিম জমা)' : '(সমতা)'}</strong></span>
          </div>
        </div>

        <h3 className="text-xs font-black uppercase text-slate-500 mt-6 pb-1 border-b border-slate-300">লেনদেনের বিস্তারিত বিবরণ</h3>
        <table className="w-full mt-2 text-left border-collapse text-[10.5px]">
          <thead>
            <tr className="border-b border-slate-400 bg-slate-100">
              <th className="py-2 px-1 text-center w-8">ক্র.নং</th>
              <th className="py-2 px-1">তারিখ</th>
              <th className="py-2 px-1">বিবরণ / মেমো</th>
              <th className="py-2 px-1 text-center">পেয়েছি (+)</th>
              <th className="py-2 px-1 text-right">দিয়েছি (-)</th>
              <th className="py-2 px-1 text-right">জের ব্যালেন্স</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {txsWithRunningBalance.map((t, index) => (
              <tr key={t.id}>
                <td className="py-1.5 px-1 font-mono text-[9px] text-center font-bold text-slate-600 bg-slate-50">
                  {toBengaliNumber(index + 1)}
                </td>
                <td className="py-1.5 px-1 font-mono text-[9px]">{displayTime(t.date || t.createdAt)}</td>
                <td className="py-1.5 px-1">
                  <strong>{t.note || 'সাধারণ লেনদেন'}</strong>
                  {t.billNo && <span className="font-mono text-[8px] ml-1 text-slate-400">(MEMO: {t.billNo})</span>}
                </td>
                <td className="py-1.5 px-1 text-center text-emerald-600 font-mono">
                  {t.type === 'GOT' ? `${currency}${t.amount.toFixed(1)}` : '—'}
                </td>
                <td className="py-1.5 px-1 text-right text-rose-600 font-mono">
                  {t.type === 'GAVE' ? `${currency}${t.amount.toFixed(1)}` : '—'}
                </td>
                <td className="py-1.5 px-1 text-right font-mono font-bold">
                  {currency}{Math.abs(t.runningBalance).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Dynamic signatures mapping block if active signatures are printed */}
        <div className="mt-16 flex justify-between items-center text-[10px] font-bold text-slate-400">
          <div className="text-center w-36">
            <div className="h-6 border-b border-slate-300 mb-1" />
            <span>প্রস্তুতকারী স্বাক্ষর</span>
          </div>
          <div className="text-center w-36">
            <div className="h-6 border-b border-slate-300 mb-1 flex items-center justify-center">
              {txsWithRunningBalance[0]?.signature && (
                <img src={txsWithRunningBalance[0].signature} className="h-5 max-w-full object-contain opacity-75 mx-auto" referrerPolicy="no-referrer" />
              )}
            </div>
            <span>কাস্টমার স্বাক্ষর</span>
          </div>
        </div>

        <div className="mt-16 text-center text-[9px] font-bold text-slate-300 text-center border-t pt-4">
          <p>© Hello Point - নিরাপদ ক্লাউড লেজার ও ব্যাকআপ হিসাব খাতা।</p>
        </div>
      </div>

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

      {/* BEAUTIFUL CUSTOM TRANSACTION DELETION CONFIRMATION DIALOG OVERLAY */}
      {txToDelete && (
        <div id="delete-tx-dialog-overlay" className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 w-full max-w-[300px] text-center transform scale-100 transition-all animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3.5 text-rose-500 animate-bounce">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              লেনদেন মুছে ফেলার নিশ্চিতকরণ
            </h3>
            
            <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">
              আপনি কি নিশ্চিতভাবে এই লেনদেনটি ডিলিট করতে চান? ডিলিট করলে হিসাব থেকে {currency} {txToDelete.amount.toFixed(1)} বাদ যাবে।
            </p>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setTxToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 text-xs font-black transition-all cursor-pointer outline-none"
              >
                না, বন্ধ করুন
              </button>
              <button
                onClick={() => {
                  if (txToDelete) {
                    onDeleteTransaction(txToDelete.id);
                    setTxToDelete(null);
                  }
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm outline-none"
              >
                হ্যাঁ, মুছুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL CUSTOM CONTACT EDITING DIALOG OVERLAY */}
      {showEditModal && (
        <div id="edit-contact-dialog-overlay" className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 w-full max-w-[340px] transform scale-100 transition-all animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3.5 text-indigo-600">
              <User className="w-6 h-6" />
            </div>
            
            <h3 className="text-sm font-black text-slate-800 leading-tight text-center">
              গ্রাহকের তথ্য পরিবর্তন করুন
            </h3>
            
            <p className="text-[10px] font-bold text-slate-500 mt-1.5 leading-relaxed text-center mb-4">
              সাহায্যকারী অপশনটি ব্যবহার করে নাম এবং মোবাইল নম্বর আপডেট করুন
            </p>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 select-none">
                  কাস্টমার নাম
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="নাম লিখুন"
                  className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 rounded-xl py-2 px-3.5 text-xs font-bold border border-slate-200 focus:border-slate-300 outline-none transition-all placeholder:text-slate-400/70"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 select-none">
                  মোবাইল নম্বর
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 rounded-xl py-2 px-3.5 text-xs font-bold border border-slate-200 focus:border-slate-300 outline-none transition-all placeholder:text-slate-400/70"
                  maxLength={17}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setShowDeleteContactConfirm(true);
                }}
                className="text-[10px] font-black text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 rounded-xl px-4 py-1.5 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> কাস্টমার মুছে ফেলুন (Delete)
              </button>
            </div>

            {editError && (
              <p className="mt-3 text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100 rounded-lg py-1.5 px-2.5 text-center leading-normal animate-fade-in">
                ⚠️ {editError}
              </p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 text-xs font-black transition-all cursor-pointer outline-none"
              >
                বাতিল
              </button>
              <button
                onClick={() => {
                  if (!editName.trim()) {
                    setEditError('কাস্টমারের নাম খালি হতে পারবে না!');
                    return;
                  }
                  if (onUpdateContactInfo) {
                    onUpdateContactInfo(contact.id, editName.trim(), editPhone.trim());
                  }
                  setShowEditModal(false);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm outline-none"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE OWNER CHAT DIALOG FOR TARGET CUSTOMER */}
      <AnimatePresence>
        {showChatBox && (
          <ChatBox 
            currentContactId={contact.id}
            chatMessages={chatMessages}
            senderRole="owner"
            senderName="প্রোপাইটার (HelloPoint)"
            onSendMessage={onSendChatMessage || (() => {})}
            onDeleteMessage={onDeleteChatMessage}
            onMarkAsRead={onMarkChatsAsRead || (() => {})}
            onClose={() => setShowChatBox(false)}
            contactName={contact.name}
          />
        )}
      </AnimatePresence>

      {/* BEAUTIFUL CUSTOM YES/NO CONFIRMATION DIALOG FOR CLEAR ALL ENTRIES */}
      {showClearEntriesConfirm && (
        <div id="clear-entries-dialog-overlay" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 w-full max-w-xs text-center transform scale-100 transition-all">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-3.5 text-amber-600 animate-bounce animate-duration-1000">
              <RotateCcw className="w-6 h-6" />
            </div>
            
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              সব এন্ট্রি ক্লিয়ার নিশ্চিতকরণ
            </h3>
            
            <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">
              আপনি কি সত্যি "{contact.name}"-এর সব লেনদেন এন্ট্রি ক্লিয়ার করতে চান? এতে কাস্টমারের খাতা ঠিক থাকবে কিন্তু সকল পূর্বের হিসাব শূন্য হয়ে যাবে।
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setShowClearEntriesConfirm(false)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                না, বন্ধ করুন
              </button>
              <button
                onClick={() => {
                  if (onClearAllEntries) {
                    onClearAllEntries(contact.id);
                  }
                  setShowClearEntriesConfirm(false);
                  setFeedbackMsg('✅ এই কাস্টমারের সকল লেনদেন এন্ট্রি ক্লিয়ার করা হয়েছে');
                  setTimeout(() => setFeedbackMsg(''), 4000);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                হ্যাঁ, সব ক্লিয়ার করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL CUSTOM YES/NO CONFIRMATION DIALOG FOR CUSTOMER DELETION */}
      {showDeleteContactConfirm && (
        <div id="customer-delete-dialog-overlay" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999999]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 w-full max-w-xs text-center transform scale-100 transition-all">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3.5 text-rose-500 animate-bounce animate-duration-1000">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-sm font-black text-slate-800 leading-tight">
              গ্রাহক মুছে ফেলার নিশ্চিতকরণ
            </h3>
            
            <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">
              আপনি কি সত্যি "{contact.name}" গ্রাহক খাতাটি মুছতে চান? গ্রাহক মুছে ফেললে তার সকল পূর্ববর্তী লেনদেন রেকর্ডও মুছে যাবে।
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setShowDeleteContactConfirm(false)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                না, বন্ধ করুন
              </button>
              <button
                onClick={() => {
                  if (onDeleteContact) {
                    onDeleteContact(contact.id);
                  }
                  setShowDeleteContactConfirm(false);
                  onBack();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                হ্যাঁ, মুছুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
