import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Search, 
  X, 
  Edit3, 
  Trash2,
  FileSpreadsheet,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react';
import { CashInAccount, CashInTransaction, Contact } from '../types';
import { PremiumAppLoader } from './PremiumAppLoader';
import { soundEngine } from '../utils/audio';

interface CashInViewProps {
  accounts: CashInAccount[];
  transactions: CashInTransaction[];
  contacts: Contact[];
  currency: string;
  lang: 'bn' | 'en';
  themeColor: string;
  onSaveAccount: (account: CashInAccount) => Promise<void> | void;
  onDeleteAccount: (accountId: string) => Promise<void> | void;
  onSaveTransaction: (tx: CashInTransaction, updatedAccount?: CashInAccount) => Promise<void> | void;
  onDeleteTransaction: (txId: string, refundAccount?: boolean) => Promise<void> | void;
}

export function CashInView({
  accounts,
  transactions,
  contacts,
  currency,
  lang,
  themeColor,
  onSaveAccount,
  onDeleteAccount,
  onSaveTransaction,
  onDeleteTransaction
}: CashInViewProps) {
  // Input Form States
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [formError, setFormError] = useState('');

  // Processing & Loading State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [successTx, setSuccessTx] = useState<{
    tx: CashInTransaction;
    account?: CashInAccount;
    prevBalance?: number;
    newBalance?: number;
  } | null>(null);

  // Modals & Forms
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddBalanceModal, setShowAddBalanceModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CashInAccount | null>(null);
  const [activeAccountForRecharge, setActiveAccountForRecharge] = useState<CashInAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<CashInAccount | null>(null);
  const [txToDelete, setTxToDelete] = useState<CashInTransaction | null>(null);

  // Add Account form fields
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [accModalError, setAccModalError] = useState('');

  // Add Balance form fields
  const [selectedAccIdForBalance, setSelectedAccIdForBalance] = useState<string>('');
  const [balanceAddAmount, setBalanceAddAmount] = useState('');
  const [balanceModalError, setBalanceModalError] = useState('');

  // Filter & Search states
  const [searchTxQuery, setSearchTxQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Monthly stats visibility - Hidden by default as requested
  const [showMonthlyStats, setShowMonthlyStats] = useState(false);

  // Month-wise analytics filter (Default to current month, last 6 months)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Auto-detect customer name if existing contact
  useEffect(() => {
    const clean = customerPhone.replace(/\D/g, '');
    if (clean.length >= 6) {
      const match = contacts.find(c => {
        const cClean = c.phone.replace(/\D/g, '');
        return cClean && (cClean.endsWith(clean) || clean.endsWith(cClean));
      });
      if (match && !customerName) {
        setCustomerName(match.name);
      }
    }
  }, [customerPhone, contacts]);

  // Total balance calculation across all numbers
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
  }, [accounts]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Find matching account by last 4 digits (or exact match)
  const findMatchingAccount = (digits: string): CashInAccount | undefined => {
    const cleanDigits = digits.trim().replace(/\D/g, '');
    if (!cleanDigits) return undefined;
    return accounts.find(acc => {
      const cleanAcc = acc.accountNumber.replace(/\D/g, '');
      return cleanAcc.endsWith(cleanDigits) || acc.lastDigits === cleanDigits;
    });
  };

  // Generate last 6 months list with Bengali and English names
  const last6Months = useMemo(() => {
    const months = [];
    const banglaMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      months.push({
        key,
        year,
        monthIdx,
        labelBn: banglaMonths[monthIdx],
        labelEn: englishMonths[monthIdx]
      });
    }
    return months;
  }, []);

  // Compute month analytics for the selected month
  const selectedMonthStats = useMemo(() => {
    const monthTxs = transactions.filter(tx => {
      const txDate = tx.createdAt ? tx.createdAt.slice(0, 7) : (tx.date ? tx.date.slice(0, 7) : '');
      return txDate === selectedMonthKey;
    });

    const totalCashIn = monthTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    // 15 Taka profit per 1000 Taka (1.5%)
    const totalProfit = (totalCashIn / 1000) * 15;
    const txCount = monthTxs.length;

    const currentMonthObj = last6Months.find(m => m.key === selectedMonthKey);

    return {
      totalCashIn,
      totalProfit,
      txCount,
      transactions: monthTxs,
      labelBn: currentMonthObj?.labelBn || selectedMonthKey,
      labelEn: currentMonthObj?.labelEn || selectedMonthKey
    };
  }, [transactions, selectedMonthKey, last6Months]);

  // Google Sheets / CSV Export handler for the SELECTED month
  const handleExportMonthGoogleSheet = () => {
    const monthTxs = selectedMonthStats.transactions;
    if (monthTxs.length === 0) {
      alert(lang === 'bn' ? 'এই মাসে কোনো লেনদেন পাওয়া যায়নি' : 'No transactions found for this month');
      return;
    }

    const headers = [
      'তারিখ ও সময় (Date)',
      'কাস্টমার নম্বর (Customer Phone)',
      'কাস্টমার নাম (Customer Name)',
      'টাকার পরিমাণ (Amount)',
      'লাস্ট ৪ ডিজিট (Last Digits)',
      'প্রেরক নম্বর (Sender Number)',
      'মুনাফা ১৫টাকা/হাজার (Profit @15/1k)'
    ];

    const rows = monthTxs.map(tx => {
      const formattedDate = new Date(tx.createdAt || tx.date).toLocaleString('bn-BD');
      const profit = ((tx.amount / 1000) * 15).toFixed(2);
      return [
        `"${formattedDate}"`,
        `"${tx.customerPhone}"`,
        `"${tx.customerName || ''}"`,
        tx.amount,
        `"${tx.lastDigits}"`,
        `"${tx.accountNumber || ''}"`,
        profit
      ];
    });

    const summaryRow = [
      `"মোট (${selectedMonthStats.labelBn})"`,
      '""',
      '""',
      selectedMonthStats.totalCashIn,
      '""',
      '""',
      selectedMonthStats.totalProfit.toFixed(2)
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(',')), summaryRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HelloPoint_CashIn_${selectedMonthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Form Submit
  const handleSubmitCashIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanPhone = customerPhone.trim();
    const numAmount = parseFloat(amount);
    const cleanLastDigits = lastDigits.trim().replace(/\D/g, '');

    if (!cleanPhone) {
      setFormError(lang === 'bn' ? 'মোবাইল নম্বর লিখুন' : 'Please enter customer mobile number');
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError(lang === 'bn' ? 'সঠিক টাকার পরিমাণ লিখুন' : 'Please enter a valid amount');
      return;
    }

    if (!cleanLastDigits) {
      setFormError(lang === 'bn' ? 'লাস্ট ৪ ডিজিট দিন' : 'Please enter the last 4 digits');
      return;
    }

    // Match account
    const matchedAccount = findMatchingAccount(cleanLastDigits);
    if (!matchedAccount) {
      setFormError(
        lang === 'bn' 
          ? `"${cleanLastDigits}" ডিজিটের সাথে কোনো নম্বর পাওয়া যায়নি!`
          : `No account found matching last digits "${cleanLastDigits}"!`
      );
      return;
    }

    // Trigger smooth loading animation
    setIsProcessing(true);
    setProcessingProgress(15);

    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 95;
        }
        return prev + 30;
      });
    }, 120);

    setTimeout(async () => {
      clearInterval(interval);
      setProcessingProgress(100);

      // Perform deduction
      const prevBal = matchedAccount.balance;
      const newBal = Math.max(0, prevBal - numAmount);
      const updatedAccount: CashInAccount = {
        ...matchedAccount,
        balance: newBal,
        updatedAt: new Date().toISOString()
      };

      const newTx: CashInTransaction = {
        id: 'tx-cashin-' + Date.now(),
        customerPhone: cleanPhone,
        customerName: customerName.trim() || undefined,
        amount: numAmount,
        lastDigits: cleanLastDigits,
        accountId: matchedAccount.id,
        accountNumber: matchedAccount.accountNumber,
        accountName: matchedAccount.accountName,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };

      try {
        await onSaveTransaction(newTx, updatedAccount);
        setIsProcessing(false);
        setSuccessTx({
          tx: newTx,
          account: updatedAccount,
          prevBalance: prevBal,
          newBalance: newBal
        });

        // Reset form
        setCustomerPhone('');
        setCustomerName('');
        setAmount('');
        setLastDigits('');
      } catch (err) {
        setIsProcessing(false);
        setFormError(lang === 'bn' ? 'ক্যাশ-ইন সম্পন্ন করতে সমস্যা হয়েছে' : 'Failed to complete cash-in');
      }
    }, 600);
  };

  // Add / Edit Account Handler
  const handleSaveAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccModalError('');

    const cleanNum = newAccNumber.trim();
    const cleanBal = parseFloat(newAccBalance) || 0;

    if (!cleanNum || cleanNum.length < 4) {
      setAccModalError(lang === 'bn' ? 'সঠিক মোবাইল নম্বর লিখুন (কমপক্ষে ৪ ডিজিট)' : 'Please enter a valid number (min 4 digits)');
      return;
    }

    const digits = cleanNum.slice(-4);

    const accountToSave: CashInAccount = {
      id: editingAccount?.id || 'acc-' + Date.now(),
      accountNumber: cleanNum,
      accountName: newAccName.trim() || undefined,
      balance: cleanBal,
      lastDigits: digits,
      createdAt: editingAccount?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    soundEngine.playSimBalanceRechargeSound();
    await onSaveAccount(accountToSave);
    setShowAddAccountModal(false);
    setEditingAccount(null);
    setNewAccNumber('');
    setNewAccName('');
    setNewAccBalance('');
  };

  // Direct Tap to Recharge / Add Balance Handler
  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBalanceModalError('');

    const numAmount = parseFloat(balanceAddAmount);
    const targetId = selectedAccIdForBalance || activeAccountForRecharge?.id;

    if (!targetId) {
      setBalanceModalError(lang === 'bn' ? 'নম্বর সিলেক্ট করুন' : 'Please select an account');
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setBalanceModalError(lang === 'bn' ? 'টাকার পরিমাণ লিখুন' : 'Please enter a valid amount');
      return;
    }

    const acc = accounts.find(a => a.id === targetId);
    if (!acc) return;

    const updated: CashInAccount = {
      ...acc,
      balance: (Number(acc.balance) || 0) + numAmount,
      updatedAt: new Date().toISOString()
    };

    soundEngine.playSimBalanceRechargeSound();
    await onSaveAccount(updated);
    setShowAddBalanceModal(false);
    setActiveAccountForRecharge(null);
    setSelectedAccIdForBalance('');
    setBalanceAddAmount('');
  };

  // Confirm delete account without window.confirm (guaranteed to work in iframe)
  const handleConfirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    try {
      await onDeleteAccount(accountToDelete.id);
      setAccountToDelete(null);
    } catch (err) {
      console.error('Delete account failed', err);
      setAccountToDelete(null);
    }
  };

  // Confirm delete transaction and refund balance if needed
  const handleConfirmDeleteTx = async () => {
    if (!txToDelete) return;
    try {
      await onDeleteTransaction(txToDelete.id, true);
      setTxToDelete(null);
    } catch (err) {
      console.error('Delete transaction failed', err);
      setTxToDelete(null);
    }
  };

  return (
    <div id="cashin-main-container" className="space-y-3 font-sans pb-16">
      
      {/* 1. CASH-IN INPUT FORM WITH COMPACT TOTAL BALANCE RIGHT NEXT TO TITLE */}
      <div 
        id="cashin-input-card"
        className="bg-white dark:bg-[#1E252D] rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'bn' ? 'ক্যাশ-ইন' : 'Cash-In'}</span>
            </h2>

            {/* Compact Total Balance next to Cash-In text */}
            <div 
              id="cashin-compact-balance"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-black shadow-2xs"
              title={lang === 'bn' ? 'মোট ব্যালেন্স' : 'Total Balance'}
            >
              <span>{currency}</span>
              <span>{totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* The Form Fields Grid */}
        <form onSubmit={handleSubmitCashIn} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            
            {/* Mobile Number */}
            <div className="sm:col-span-4">
              <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile number'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Amount */}
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                {lang === 'bn' ? 'টাকার পরিমাণ' : 'Amount'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Name (Optional) */}
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                {lang === 'bn' ? 'নাম (ঐচ্ছিক)' : 'Name (Optional)'}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={lang === 'bn' ? 'কাস্টমার নাম' : 'Customer Name'}
                className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Last 4 Digits */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                {lang === 'bn' ? 'লাস্ট ৪ ডিজিট' : 'Last 4'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={6}
                value={lastDigits}
                onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, ''))}
                placeholder=""
                className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl px-2.5 py-2 text-xs font-mono font-black text-amber-900 dark:text-amber-300 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
          </div>

          {/* Quick select chips for available SIM last digits */}
          {accounts.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              <span className="text-[9px] font-bold text-slate-400 mr-0.5">
                {lang === 'bn' ? 'সিম নির্বাচন:' : 'Select SIM:'}
              </span>
              {accounts.map((acc) => {
                const isSelected = lastDigits === acc.lastDigits;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setLastDigits(acc.lastDigits)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-white shadow-xs scale-105 ring-2 ring-amber-400'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 hover:bg-amber-100'
                    }`}
                  >
                    <span>...{acc.lastDigits}</span>
                    <span className="text-[8.5px] opacity-80">({currency}{acc.balance})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Form Error Banner */}
          {formError && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 text-xs font-bold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 active:scale-98 text-white text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4 stroke-[2.5]" />
            <span>{lang === 'bn' ? 'ক্যাশ-ইন সম্পন্ন করুন' : 'Submit Cash-In'}</span>
          </button>
        </form>
      </div>

      {/* 2. COLLAPSIBLE MONTHLY REPORT & PROFIT (Below Cash-In Card, Hidden by default, with inside Google Sheet export) */}
      <div 
        id="cashin-monthly-profit-section"
        className="bg-white dark:bg-[#1E252D] rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 overflow-hidden"
      >
        {/* Toggle Header Bar */}
        <button
          type="button"
          onClick={() => setShowMonthlyStats(!showMonthlyStats)}
          className="w-full p-3 flex items-center justify-between bg-slate-50/70 dark:bg-[#171d24] hover:bg-slate-100/80 dark:hover:bg-[#19222c] transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                {lang === 'bn' ? 'মাসিক হিসাব ও লাভ' : 'Monthly Report & Profit'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold ml-1.5">
                ({lang === 'bn' ? 'হাজারে ১৫৳ লাভ' : '15 Tk/1k profit'})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {showMonthlyStats ? (lang === 'bn' ? 'লুকান' : 'Hide') : (lang === 'bn' ? 'দেখান' : 'Show')}
            </span>
            <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500">
              {showMonthlyStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>
        </button>

        {/* Collapsible Content */}
        <AnimatePresence>
          {showMonthlyStats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-3"
            >
              {/* Month Selector Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {last6Months.map(m => {
                  const isSelected = selectedMonthKey === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMonthKey(m.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs scale-102'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {lang === 'bn' ? m.labelBn : m.labelEn}
                    </button>
                  );
                })}
              </div>

              {/* Month Profit & Cash-In Summary Card with Google Sheet inside */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 p-3 rounded-xl border border-emerald-100/80 dark:border-emerald-900/40 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {selectedMonthStats.labelBn} {lang === 'bn' ? 'মাসে ক্যাশ-ইন' : 'Cash-In'}
                    </span>
                    <div className="text-sm sm:text-base font-black font-mono text-slate-800 dark:text-slate-100">
                      {currency}{selectedMonthStats.totalCashIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[9.5px] text-slate-400 font-bold">
                      {selectedMonthStats.txCount} {lang === 'bn' ? 'টি ট্রানজ্যাকশন' : 'transactions'}
                    </div>
                  </div>

                  <div className="space-y-0.5 text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      <TrendingUp className="w-3 h-3" />
                      <span>{lang === 'bn' ? 'মোট লাভ (১৫৳/হাজার)' : 'Profit (15/1k)'}</span>
                    </span>
                    <div className="text-sm sm:text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                      +{currency}{selectedMonthStats.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[9.5px] text-emerald-600/80 dark:text-emerald-400/80 font-bold">
                      {lang === 'bn' ? '১৫ টাকা হারে মুনাফা' : '@15 Tk per 1,000'}
                    </div>
                  </div>
                </div>

                {/* Google Sheet Export Button inside the Month card */}
                <div className="pt-2 border-t border-emerald-100/60 dark:border-emerald-900/40 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {lang === 'bn' ? `${selectedMonthStats.labelBn} মাসের ডাটা শিট:` : `${selectedMonthStats.labelEn} Data Sheet:`}
                  </span>
                  <button
                    type="button"
                    id="btn-export-month-google-sheet"
                    onClick={handleExportMonthGoogleSheet}
                    disabled={selectedMonthStats.txCount === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer disabled:opacity-40"
                    title={lang === 'bn' ? 'গুগল শিট / এক্সেল সিএসভি ডাউনলোড' : 'Download Google Sheet / Excel CSV'}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'গুগল শিট ডাউনলোড' : 'Google Sheet Download'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. TWO-COLUMN RESPONSIVE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        
        {/* LEFT COLUMN: Mobile Number & Balance List (+ Icon in header, Tap on row to Recharge) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1E252D] rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-[#171d24] border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">
              {lang === 'bn' ? 'মোবাইল নম্বর ও ব্যালেন্স' : 'Mobile number & Balance'}
            </h3>
            
            {/* Direct + icon to add new number */}
            <button
              type="button"
              id="btn-add-cashin-number-plus"
              onClick={() => {
                setEditingAccount(null);
                setNewAccNumber('');
                setNewAccName('');
                setNewAccBalance('');
                setShowAddAccountModal(true);
              }}
              className="w-7 h-7 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer"
              title={lang === 'bn' ? 'নতুন নম্বর যোগ করুন' : 'Add Number'}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <p className="text-xs font-bold">{lang === 'bn' ? 'কোনো নম্বর যোগ করা হয়নি' : 'No numbers added'}</p>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-black cursor-pointer inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'নম্বর যোগ করুন' : 'Add Number'}</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {accounts.map((acc) => (
                <div 
                  key={acc.id}
                  onClick={() => {
                    // Tap on number row directly opens recharge / add balance modal
                    setActiveAccountForRecharge(acc);
                    setSelectedAccIdForBalance(acc.id);
                    setBalanceAddAmount('');
                    setShowAddBalanceModal(true);
                  }}
                  className="group flex items-center justify-between px-3 py-2.5 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors"
                  title={lang === 'bn' ? 'ব্যালেন্স রিচার্জ করতে ট্যাপ করুন' : 'Tap to add balance / recharge'}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs font-mono font-black text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                        {acc.accountNumber}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 text-[8.5px] font-mono font-black shrink-0">
                        ...{acc.lastDigits}
                      </span>
                    </div>
                    {acc.accountName && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate ml-3.5">
                        {acc.accountName}
                      </div>
                    )}
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="text-xs sm:text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {currency}{acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold group-hover:text-emerald-600">
                        {lang === 'bn' ? 'রিচার্জ করতে ট্যাপ' : 'Tap to recharge'}
                      </div>
                    </div>

                    {/* Operational Action Buttons: Edit & Working Delete Modal Trigger */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingAccount(acc);
                          setNewAccNumber(acc.accountNumber);
                          setNewAccName(acc.accountName || '');
                          setNewAccBalance(String(acc.balance));
                          setShowAddAccountModal(true);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 cursor-pointer"
                        title={lang === 'bn' ? 'এডিট' : 'Edit'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAccountToDelete(acc);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                        title={lang === 'bn' ? 'মুছুন' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Ultra-Compact Slim History with Copy Number */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1E252D] rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-3 bg-gradient-to-r from-teal-50 to-slate-50 dark:from-[#19222c] dark:to-[#171d24] border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">
              {lang === 'bn' ? 'ক্যাশ-ইন হিস্ট্রি' : 'Cash-In History'}
            </h3>
            
            <div className="text-[10px] font-bold text-slate-400">
              {transactions.length} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
            </div>
          </div>

          {/* Search bar */}
          <div className="px-3 py-1.5 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <Search className="w-3 h-3 text-slate-400" />
              <input
                type="text"
                value={searchTxQuery}
                onChange={(e) => setSearchTxQuery(e.target.value)}
                placeholder={lang === 'bn' ? 'নম্বর দিয়ে খুঁজুন...' : 'Search phone...'}
                className="w-full bg-transparent border-none outline-none text-[11px] font-bold text-slate-800 dark:text-slate-100"
              />
              {searchTxQuery && (
                <button type="button" onClick={() => setSearchTxQuery('')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-1">
              <p className="text-xs font-bold">{lang === 'bn' ? 'এখনও কোনো ক্যাশ-ইন করা হয়নি' : 'No history yet'}</p>
            </div>
          ) : (
            /* Ultra-Compact & Ultra-Slim History List with 1-Click Copy and Direct Delete */
            <div className="divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[500px] overflow-y-auto">
              {transactions
                .filter(tx => {
                  if (!searchTxQuery) return true;
                  const q = searchTxQuery.toLowerCase();
                  return tx.customerPhone.includes(q) || (tx.customerName && tx.customerName.toLowerCase().includes(q));
                })
                .map((tx) => (
                  <div 
                    key={tx.id}
                    className="flex items-center justify-between px-2.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-[11px] group"
                  >
                    {/* Left: Customer Number & Instant Copy */}
                    <div className="flex items-center gap-1 min-w-0 pr-1.5">
                      <span className="font-mono font-black text-slate-800 dark:text-slate-100 text-[11px]">
                        {tx.customerPhone}
                      </span>

                      {/* Mini Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleCopy(tx.customerPhone, tx.id)}
                        className="p-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer transition-colors"
                        title={lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy'}
                      >
                        {copiedId === tx.id ? (
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                      </button>

                      {tx.customerName && (
                        <span className="text-[9px] text-slate-400 truncate max-w-[70px] sm:max-w-[90px]">
                          ({tx.customerName})
                        </span>
                      )}
                    </div>

                    {/* Middle: Last 4 digits indicator */}
                    <div className="shrink-0 px-1">
                      <span className="px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 text-[8px] font-mono font-bold">
                        ...{tx.lastDigits}
                      </span>
                    </div>

                    {/* Right: Amount, Time & Delete Action */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        <div className="font-mono font-black text-teal-600 dark:text-teal-400 text-[11px] leading-tight">
                          {currency}{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[8px] text-slate-400 font-mono leading-tight">
                          {new Date(tx.createdAt || tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Delete History Transaction Button */}
                      <button
                        type="button"
                        onClick={() => setTxToDelete(tx)}
                        className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                        title={lang === 'bn' ? 'হিস্ট্রি থেকে মুছুন' : 'Delete transaction'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. SMOOTH PROCESSING / LOADING ANIMATION (STANDARDIZED) */}
      <PremiumAppLoader
        isOpen={isProcessing}
        title={lang === 'bn' ? 'ক্যাশ-ইন সম্পন্ন হচ্ছে...' : 'Processing Cash-In...'}
        icon={Send}
        iconGradient="from-emerald-600 to-teal-500"
        ringColor="border-emerald-500"
        progressColor="from-emerald-500 to-teal-500"
        progress={processingProgress}
      />

      {/* 5. SUCCESS CONFIRMATION MODAL */}
      <AnimatePresence>
        {successTx && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSuccessTx(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 p-4 text-white">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-1 border border-white/30">
                  <CheckCircle2 className="w-6 h-6 text-white stroke-[2.5]" />
                </div>
                <h3 className="text-base font-black">
                  {lang === 'bn' ? 'ক্যাশ-ইন সফল!' : 'Successful!'}
                </h3>
                <p className="text-xs text-emerald-100 font-bold font-mono">
                  {successTx.tx.customerPhone}
                </p>
              </div>

              <div className="p-4 space-y-2.5">
                <div className="bg-slate-50 dark:bg-[#151b22] rounded-xl p-2.5 space-y-1.5 text-xs text-left">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>{lang === 'bn' ? 'পরিমাণ:' : 'Amount:'}</span>
                    <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {currency}{successTx.tx.amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                    <span>{lang === 'bn' ? 'লাস্ট ডিজিট:' : 'Last 4:'}</span>
                    <span className="font-mono font-bold">...{successTx.tx.lastDigits}</span>
                  </div>

                  {successTx.newBalance !== undefined && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                      <span>{lang === 'bn' ? 'অবশিষ্ট ব্যালেন্স:' : 'Remaining:'}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {currency}{successTx.newBalance.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSuccessTx(null)}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs cursor-pointer"
                >
                  {lang === 'bn' ? 'ঠিক আছে' : 'OK'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. ADD / EDIT NUMBER MODAL */}
      <AnimatePresence>
        {showAddAccountModal && (
          <div 
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 font-sans"
            onClick={() => setShowAddAccountModal(false)}
          >
            <div 
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black">
                  {editingAccount ? (lang === 'bn' ? 'নম্বর সম্পাদনা' : 'Edit Number') : (lang === 'bn' ? 'নতুন নম্বর যোগ' : 'Add Number')}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setShowAddAccountModal(false)}
                  className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleSaveAccountSubmit} className="p-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase mb-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile number'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase mb-1">
                    {lang === 'bn' ? 'নাম / বিবরণ (ঐচ্ছিক)' : 'Label (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: সিম ১ / বিকাশ' : 'e.g. SIM 1'}
                    className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase mb-1">
                    {lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Balance'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {accModalError && (
                  <p className="text-xs text-rose-500 font-bold">{accModalError}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAccountModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black cursor-pointer shadow-xs"
                  >
                    {lang === 'bn' ? 'সংরক্ষণ' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. TAP-ON-NUMBER DIRECT RECHARGE / ADD BALANCE MODAL */}
      <AnimatePresence>
        {showAddBalanceModal && (
          <div 
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 font-sans"
            onClick={() => setShowAddBalanceModal(false)}
          >
            <div 
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-black">
                    {lang === 'bn' ? 'ব্যালেন্স রিচার্জ' : 'Recharge Balance'}
                  </h3>
                  {activeAccountForRecharge && (
                    <p className="text-[10px] text-emerald-100 font-mono">
                      {activeAccountForRecharge.accountNumber} (বর্তমান: {currency}{activeAccountForRecharge.balance})
                    </p>
                  )}
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowAddBalanceModal(false)}
                  className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleAddBalanceSubmit} className="p-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase mb-1">
                    {lang === 'bn' ? 'রিচার্জের পরিমাণ' : 'Amount to add'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    autoFocus
                    value={balanceAddAmount}
                    onChange={(e) => setBalanceAddAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-[#151b22] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                {/* Preset quick buttons */}
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[500, 1000, 2000, 5000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBalanceAddAmount(String((parseFloat(balanceAddAmount) || 0) + val))}
                      className="py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 text-[10px] font-mono font-bold hover:bg-emerald-100 cursor-pointer"
                    >
                      +{val}
                    </button>
                  ))}
                </div>

                {balanceModalError && (
                  <p className="text-xs text-rose-500 font-bold">{balanceModalError}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddBalanceModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer shadow-xs"
                  >
                    {lang === 'bn' ? 'যোগ করুন' : 'Add Balance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. IN-APP DELETE ACCOUNT CONFIRMATION MODAL (100% Guaranteed to work in iFrame) */}
      <AnimatePresence>
        {accountToDelete && (
          <div 
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 font-sans"
            onClick={() => setAccountToDelete(null)}
          >
            <div 
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden text-center p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {lang === 'bn' ? 'নম্বর মুছে ফেলতে চান?' : 'Delete Number?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 font-bold">
                  {accountToDelete.accountNumber} ({currency}{accountToDelete.balance})
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAccountToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {lang === 'bn' ? 'না' : 'No'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAccount}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer shadow-xs"
                >
                  {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. IN-APP DELETE TRANSACTION CONFIRMATION MODAL */}
      <AnimatePresence>
        {txToDelete && (
          <div 
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 font-sans"
            onClick={() => setTxToDelete(null)}
          >
            <div 
              className="bg-white dark:bg-[#1E252D] rounded-3xl max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden text-center p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {lang === 'bn' ? 'লেনদেন মুছে ফেলতে চান?' : 'Delete Transaction?'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-1 font-bold">
                  {txToDelete.customerPhone} — {currency}{txToDelete.amount}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
                  {lang === 'bn' ? 'নম্বরের ব্যালেন্সে টাকা ফেরত যোগ হবে' : 'Amount will be refunded to SIM balance'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTxToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteTx}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer shadow-xs"
                >
                  {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
