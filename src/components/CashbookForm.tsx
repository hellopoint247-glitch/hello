/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { X, Check, ArrowDownCircle, ArrowUpCircle, Plus, Search } from 'lucide-react';
import { CashbookEntry, Contact, Transaction } from '../types';

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
}

export function CashbookForm({ onClose, onSave, currency, contacts, transactions }: CashbookFormProps) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
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
    if (!contacts || !transactions) return [];
    
    const map = new Map<string, { id: string; balance: number; name: string; phone: string }>();
    
    contacts.filter(c => c.type === 'customer').forEach(c => {
      map.set(c.id, { id: c.id, balance: 0, name: c.name, phone: c.phone });
    });
    
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
    
    return Array.from(map.values());
  }, [contacts, transactions]);

  // Filter based on search query (Supports searching in both English and Bangla names/numbers)
  const filteredPickerCustomers = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return customerSummaries;
    return customerSummaries.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q)
    );
  }, [customerSummaries, pickerSearch]);

  const parseAmountWithBilingualSupport = (str: string): number => {
    if (!str) return NaN;
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    let val = str.trim().replace(/,/g, '');
    for (let i = 0; i < 10; i++) {
      val = val.replace(new RegExp(bnNums[i], 'g'), String(i));
    }
    return parseFloat(val);
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
      note: note.trim() || (type === 'IN' ? 'ক্যাশ ইনপোর্ট' : 'খুচরা খরচ'),
      date: new Date(date).toISOString(),
      contactId: selectedContactId || undefined
    });
  };

  return (
    <>
      <div id="cashbook-entry-modal" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 p-5">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" />
              ক্যাশবুক সরাসরি হিসাব যোগ করুন
            </h3>
            <button 
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <p className="text-[10px] bg-rose-50 border border-rose-100 font-extrabold text-rose-600 rounded-xl py-2 px-3 text-center leading-normal animate-fade-in">
                ⚠️ {error}
              </p>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">লেনদেনের ধরন (Transaction Type)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setType('IN')}
                  className={`flex-1 py-3 px-3 rounded-xl text-[11px] font-black tracking-wide flex items-center justify-center gap-1 border transition-all outline-none cursor-pointer ${
                    type === 'IN' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-tiny font-extrabold'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4 shrink-0" />
                  ক্যাশ ইন (CASH IN)
                </button>
                
                {/* Plus Button beautifully placed in between Cash In and Cash Out */}
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch('');
                    setShowCustomerPicker(true);
                  }}
                  className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center transition-all shrink-0 shadow-md active:scale-95 cursor-pointer"
                  title="কাস্টমার হিসাব থেকে কপি করুন"
                >
                  <Plus className="w-5 h-5 font-black" />
                </button>
                
                <button
                  type="button"
                  onClick={() => setType('OUT')}
                  className={`flex-1 py-3 px-3 rounded-xl text-[11px] font-black tracking-wide flex items-center justify-center gap-1 border transition-all outline-none cursor-pointer ${
                    type === 'OUT' 
                      ? 'bg-rose-50 text-rose-700 border-rose-500 shadow-tiny font-extrabold'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4 shrink-0" />
                  ক্যাশ আউট (CASH OUT)
                </button>
              </div>
            </div>

            {selectedContactId && selectedContactName && (
              <div className="bg-purple-50 border border-purple-100 text-purple-750 rounded-2xl p-3 flex items-center justify-between text-xs font-bold leading-normal animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-pulse shrink-0" />
                  <span>
                    সংযুক্ত কাস্টমার: <span className="font-extrabold text-purple-900">{selectedContactName}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactId(null);
                    setSelectedContactName(null);
                  }}
                  className="text-purple-400 hover:text-purple-600 font-extrabold transition-all cursor-pointer p-0.5 rounded-full hover:bg-purple-100/80"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Amount Box */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">টাকার পরিমাণ <span className="text-red-500">*</span></label>
              <div className="relative bg-slate-5 w-full flex items-center gap-1.5 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus-within:border-green-500 focus-within:bg-white transition-all font-semibold">
                <span className="font-bold text-slate-400">{currency}</span>
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder=""
                  min="0"
                  step="any"
                  required
                  className="w-full bg-transparent border-none outline-none font-mono text-slate-850 font-bold"
                />
              </div>
            </div>

            {/* Note Box */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">বিবরণ / নোট</label>
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder=""
                className="w-full bg-slate-5/70 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-green-500 focus:bg-white transition-all font-semibold text-slate-800"
              />
            </div>

            {/* Date Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">লেনদেনের তারিখ</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-500/5 hover:bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer font-mono"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-3 text-xs font-black text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer"
              >
                বাতিল
              </button>
              <button 
                type="submit" 
                className="flex-1 py-3 text-xs font-black text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                সংরক্ষণ করুন
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Customer Account Picker Overlay Dialog */}
      {showCustomerPicker && (
        <div id="cashbook-customer-picker-overlay" className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-[99999] backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 p-5 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 shrink-0">
              <h3 className="font-extrabold text-slate-850 text-sm flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-purple-600 rounded-full inline-block" />
                কাস্টমার হিসাব কপি করুন
              </h3>
              <button 
                type="button"
                onClick={() => setShowCustomerPicker(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input inside Picker */}
            <div className="relative mb-3.5 shrink-0">
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="কাস্টমারের নাম বা মোবাইল নাম্বার দিয়ে খুঁজুন..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-purple-500 focus:bg-white transition-all font-semibold text-slate-800"
              />
              <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Customer List inside Picker */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none">
              {filteredPickerCustomers.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                  কোন কাস্টমার পাওয়া যায়নি।
                </div>
              ) : (
                filteredPickerCustomers.map(c => {
                  const hasDue = c.balance > 0;
                  const isZero = c.balance === 0;
                  return (
                    <button
                      key={c.phone}
                      type="button"
                      onClick={() => {
                        setAmount(Math.abs(c.balance).toString());
                        setNote(c.name);
                        setType(c.balance >= 0 ? 'IN' : 'OUT');
                        setSelectedContactId(c.id);
                        setSelectedContactName(c.name);
                        setShowCustomerPicker(false);
                      }}
                      className="w-full p-3 rounded-2xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/40 transition-all text-left flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-800 leading-tight">{c.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 font-mono mt-1">{c.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-extrabold font-mono ${isZero ? 'text-slate-500' : hasDue ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {currency} {Math.abs(c.balance).toFixed(2)}
                        </p>
                        <span className={`inline-block text-[8px] font-black px-1.5 py-0.2 rounded-full mt-1 uppercase tracking-wide ${
                          isZero 
                            ? 'bg-slate-100 text-slate-500' 
                            : hasDue 
                              ? 'bg-rose-50 text-rose-600 border border-rose-100/50' 
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
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
