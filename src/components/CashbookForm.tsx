/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Plus, Search, Users } from 'lucide-react';
import { Contact, Transaction } from '../types';

interface CashbookFormProps {
  onClose: () => void;
  onSave: (data: {
    amount: number;
    type: 'IN' | 'OUT';
    note: string;
    date: string;
    contactId?: string;
  }) => void;
  currency: string;
  contacts?: Contact[];
  transactions?: Transaction[];
  initialType?: 'IN' | 'OUT';
}

export function CashbookForm({ onClose, onSave, currency, contacts = [], transactions = [], initialType = 'IN' }: CashbookFormProps) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'IN' | 'OUT'>(initialType);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [error, setError] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);
  
  // Customer Picker Modal State
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Calculate each customer's balance/due amount dynamically
  const customerSummaries = useMemo(() => {
    if (!contacts || contacts.length === 0) return [];
    
    const map = new Map<string, { id: string; balance: number; name: string; phone: string }>();
    
    // Include ALL contacts so none are lost in search
    contacts.forEach(c => {
      map.set(c.id, { 
        id: c.id, 
        balance: 0, 
        name: c.name || 'কাস্টমার', 
        phone: c.phone || '' 
      });
    });
    
    if (transactions && transactions.length > 0) {
      const txLen = transactions.length;
      for (let i = 0; i < txLen; i++) {
        const t = transactions[i];
        const entry = map.get(t.contactId);
        if (entry) {
          if (t.type === 'GAVE') {
            entry.balance += t.amount;
          } else {
            entry.balance -= t.amount;
          }
        }
      }
    }
    
    return Array.from(map.values());
  }, [contacts, transactions]);

  // Convert Bengali numerals to standard English numerals for search & parsing
  const toEnglishDigits = (str: string): string => {
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    let res = str;
    for (let i = 0; i < 10; i++) {
      res = res.replace(new RegExp(bnNums[i], 'g'), String(i));
    }
    return res;
  };

  // Filter based on search query (Supports searching in both English and Bangla names/numbers)
  const filteredPickerCustomers = useMemo(() => {
    const rawQ = pickerSearch.trim().toLowerCase();
    if (!rawQ) return customerSummaries;

    const engQ = toEnglishDigits(rawQ);
    const cleanRawQ = rawQ.replace(/[\s\-\+\(\)]/g, '');
    const cleanEngQ = engQ.replace(/[\s\-\+\(\)]/g, '');

    return customerSummaries.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const engPhone = toEnglishDigits(phone);
      const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
      const cleanEngPhone = engPhone.replace(/[\s\-\+\(\)]/g, '');

      return (
        name.includes(rawQ) || 
        name.includes(engQ) ||
        phone.includes(rawQ) ||
        phone.includes(engQ) ||
        (cleanRawQ && cleanPhone.includes(cleanRawQ)) ||
        (cleanEngQ && cleanEngPhone.includes(cleanEngQ))
      );
    });
  }, [customerSummaries, pickerSearch]);

  const parseAmountWithBilingualSupport = (str: string): number => {
    if (!str) return NaN;
    const engStr = toEnglishDigits(str).trim().replace(/,/g, '');
    return parseFloat(engStr);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseAmountWithBilingualSupport(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('সঠিক টাকার অংক লিখুন!');
      return;
    }
    
    onSave({
      amount: parsedAmount,
      type,
      note: note.trim() || (type === 'IN' ? 'ক্যাশ জমা' : 'ক্যাশ খরচ'),
      date: new Date(date).toISOString(),
      contactId: selectedContactId || undefined
    });
  };

  const selectedCustomer = useMemo(() => {
    if (!selectedContactId) return null;
    return customerSummaries.find(c => c.id === selectedContactId) || null;
  }, [selectedContactId, customerSummaries]);

  return (
    <>
      <div id="cashbook-entry-modal" className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
        <div className="bg-[#202a3a] dark:bg-[#202a3a] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-700/80 p-5 text-white">
          <div className="flex justify-between items-center mb-4 border-b border-slate-700/70 pb-3">
            <h3 className="font-black text-white text-sm flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${type === 'IN' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              ক্যাশবুক সরাসরি হিসাব যোগ করুন
            </h3>
            <button 
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-700/60 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <p className="text-xs bg-rose-500/20 border border-rose-500/40 font-bold text-rose-300 rounded-xl py-2 px-3 text-center leading-normal animate-fade-in">
                ⚠️ {error}
              </p>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">লেনদেনের ধরন (Transaction Type)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setType('IN')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black tracking-wide flex items-center justify-center gap-1.5 border transition-all outline-none cursor-pointer ${
                    type === 'IN' 
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500 shadow-sm ring-1 ring-emerald-500/50' 
                      : 'bg-[#17202c] border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  ক্যাশ ইন (+ IN / বাম)
                </button>
                
                {/* Plus Button to pick customer */}
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch('');
                    setShowCustomerPicker(true);
                  }}
                  className="w-10 h-10 rounded-full bg-brand-primary hover:bg-brand-hover text-white flex items-center justify-center transition-all shrink-0 shadow-md active:scale-95 cursor-pointer border border-white/20"
                  title="কাস্টমার তালিকা থেকে নির্বাচন করুন"
                >
                  <Plus className="w-5 h-5 font-black" />
                </button>
                
                <button
                  type="button"
                  onClick={() => setType('OUT')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black tracking-wide flex items-center justify-center gap-1.5 border transition-all outline-none cursor-pointer ${
                    type === 'OUT' 
                      ? 'bg-rose-600/30 text-rose-300 border-rose-500 shadow-sm ring-1 ring-rose-500/50' 
                      : 'bg-[#17202c] border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  ক্যাশ আউট (- OUT / ডান)
                </button>
              </div>

              {!selectedContactId && (
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch('');
                    setShowCustomerPicker(true);
                  }}
                  className="mt-2.5 w-full py-2 px-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/40 text-purple-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
                >
                  <Users className="w-3.5 h-3.5 text-purple-300" />
                  <span>কাস্টমার হিসাব থেকে কাস্টমার আনুন</span>
                </button>
              )}
            </div>

            {selectedContactId && selectedContactName && (
              <div className="bg-purple-950/40 border border-purple-500/40 text-purple-200 rounded-2xl p-3 flex flex-col gap-1.5 text-xs font-bold leading-normal animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse shrink-0" />
                    <span>
                      সংযুক্ত কাস্টমার: <span className="font-black text-white">{selectedContactName}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContactId(null);
                      setSelectedContactName(null);
                    }}
                    className="text-purple-300 hover:text-white font-extrabold transition-all cursor-pointer p-1 rounded-full hover:bg-purple-800/50"
                    title="সংযোগ বাদ দিন"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {selectedCustomer && (
                  <div className="flex items-center justify-between text-[11px] text-purple-300/90 font-mono">
                    <span>কাস্টমার ব্যালেন্স:</span>
                    <span className={`font-black ${selectedCustomer.balance > 0 ? 'text-rose-400' : selectedCustomer.balance < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {currency} {Math.abs(selectedCustomer.balance).toFixed(2)} ({selectedCustomer.balance > 0 ? 'বাকি' : selectedCustomer.balance < 0 ? 'জমা' : 'সমতা'})
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-purple-300/90">
                  <span>ক্যাশবুক অবস্থান:</span>
                  <span className={`font-black px-1.5 py-0.5 rounded text-[10.5px] ${
                    type === 'IN' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {type === 'IN' ? 'ক্যাশ ইন (বাম কলাম / + ব্যালেন্স)' : 'ক্যাশ আউট (ডান কলাম / - ব্যালেন্স)'}
                  </span>
                </div>

                <div className="pt-1.5 border-t border-purple-500/20 flex items-center justify-between text-[10.5px] text-purple-200">
                  <span className="flex items-center gap-1 text-purple-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    রিয়েল টাইম সিঙ্ক:
                  </span>
                  <span className="font-bold text-white text-[10px]">
                    কাস্টমার হিসাবের সাথে ব্যালেন্স আপডেট হবে
                  </span>
                </div>
              </div>
            )}

            {/* Amount Box */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                টাকার পরিমাণ <span className="text-rose-400">*</span>
              </label>
              <div className="relative bg-[#17202c] w-full flex items-center gap-2 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus-within:border-brand-primary transition-all font-semibold">
                <span className="font-bold text-slate-400">{currency}</span>
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="০.০০"
                  required
                  autoFocus
                  className="w-full bg-transparent border-none outline-none font-mono text-white font-bold text-base placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Note Box */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">বিবরণ / নোট</label>
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="যেমন: খুচরা মালামাল, চা-নাস্তা বা কাস্টমার নাম..."
                className="w-full bg-[#17202c] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-brand-primary transition-all font-semibold text-white placeholder:text-slate-500"
              />
            </div>

            {/* Date Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">লেনদেনের তারিখ</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#17202c] hover:bg-[#1f2b3b] border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-200 outline-none transition-all cursor-pointer font-mono"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-700/70 flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-2.5 text-xs font-black text-slate-300 hover:text-white bg-[#17202c] hover:bg-[#1e2a39] border border-slate-700 rounded-xl transition-all cursor-pointer"
              >
                বাতিল
              </button>
              <button 
                type="submit" 
                className="flex-1 py-2.5 text-xs font-black text-white bg-brand-primary hover:bg-brand-hover rounded-xl shadow-md transition-all cursor-pointer border border-white/20"
              >
                সংরক্ষণ করুন
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Customer Account Picker Overlay Dialog */}
      {showCustomerPicker && (
        <div id="cashbook-customer-picker-overlay" className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-[99999] backdrop-blur-sm animate-fade-in">
          <div className="bg-[#202a3a] dark:bg-[#202a3a] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-700/80 p-5 flex flex-col max-h-[82vh] text-white">
            <div className="flex justify-between items-center mb-3.5 border-b border-slate-700/70 pb-3 shrink-0">
              <h3 className="font-black text-white text-sm flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-brand-primary rounded-full inline-block" />
                কাস্টমার হিসাব নির্বাচন ({customerSummaries.length})
              </h3>
              <button 
                type="button"
                onClick={() => setShowCustomerPicker(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-700/60 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input inside Picker */}
            <div className="relative mb-3 shrink-0">
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="কাস্টমারের নাম বা মোবাইল নাম্বার দিয়ে খুঁজুন..."
                autoFocus
                className="w-full bg-[#17202c] border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-brand-primary transition-all font-semibold text-white placeholder:text-slate-400"
              />
              <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Customer List inside Picker */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none custom-scrollbar">
              {filteredPickerCustomers.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                  কোনো কাস্টমার পাওয়া যায়নি।
                </div>
              ) : (
                filteredPickerCustomers.map(c => {
                  const hasDue = c.balance > 0;
                  const isZero = c.balance === 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setAmount(Math.abs(c.balance).toString());
                        setNote(c.name);
                        // Do NOT override type here - let user choose left (IN) or right (OUT) freely!
                        setSelectedContactId(c.id);
                        setSelectedContactName(c.name);
                        setShowCustomerPicker(false);
                      }}
                      className="w-full p-2.5 rounded-2xl border border-slate-700/70 bg-[#17202c] hover:bg-[#253244] hover:border-brand-primary/50 transition-all text-left flex items-center justify-between cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-black text-white leading-tight truncate">{c.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{c.phone || 'মোবাইল নাম্বার নেই'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-black font-mono ${isZero ? 'text-slate-400' : hasDue ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {currency} {Math.abs(c.balance).toFixed(2)}
                        </p>
                        <span className={`inline-block text-[8.5px] font-black px-1.5 py-0.2 rounded-full mt-0.5 uppercase tracking-wide border ${
                          isZero 
                            ? 'bg-slate-700/50 text-slate-300 border-slate-600' 
                            : hasDue 
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {isZero ? 'সমতা' : hasDue ? 'বাকি' : 'জমা'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
