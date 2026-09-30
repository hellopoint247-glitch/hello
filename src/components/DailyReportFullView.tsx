import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  TrendingUp, 
  Search, 
  Copy, 
  Check, 
  Clock, 
  Smartphone,
  Filter,
  CheckCircle2,
  X
} from 'lucide-react';
import { CashInAccount, CashInTransaction } from '../types';
import { isTxOwnNumberTransfer } from '../utils/cashInUtils';

interface DailyReportFullViewProps {
  date: string;
  onDateChange: (date: string) => void;
  transactions: CashInTransaction[];
  accounts: CashInAccount[];
  currency: string;
  lang: 'bn' | 'en';
  onBack: () => void;
  onOpenMonthly: () => void;
}

export function DailyReportFullView({
  date,
  onDateChange,
  transactions,
  accounts,
  currency,
  lang,
  onBack,
  onOpenMonthly
}: DailyReportFullViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSimFilter, setSelectedSimFilter] = useState<string>('all');

  const toBengaliNumber = (num: number | string): string => {
    if (lang !== 'bn') return String(num);
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const changeDailyDateByDays = (days: number) => {
    const [y, m, d] = date.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + days);
    const newY = curr.getFullYear();
    const newM = String(curr.getMonth() + 1).padStart(2, '0');
    const newD = String(curr.getDate()).padStart(2, '0');
    onDateChange(`${newY}-${newM}-${newD}`);
  };

  const formatDailyDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const banglaMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
      const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      let prefix = '';
      if (dateStr === todayStr) {
        prefix = lang === 'bn' ? 'আজ, ' : 'Today, ';
      } else if (dateStr === yesterdayStr) {
        prefix = lang === 'bn' ? 'গতকাল, ' : 'Yesterday, ';
      }

      if (lang === 'bn') {
        return `${prefix}${toBengaliNumber(d)} ${banglaMonths[m - 1]} ${toBengaliNumber(y)}`;
      }
      return `${prefix}${d} ${englishMonths[m - 1]} ${y}`;
    } catch {
      return dateStr;
    }
  };

  const displayTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Filter transactions for this day
  const dailyStats = useMemo(() => {
    const dayTxs = transactions.filter(tx => {
      const d = tx.createdAt ? tx.createdAt.slice(0, 10) : (tx.date ? tx.date.slice(0, 10) : '');
      return d === date;
    });

    const sorted = [...dayTxs].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date).getTime() || 0;
      const timeB = new Date(b.createdAt || b.date).getTime() || 0;
      return timeB - timeA;
    });

    const totalCashIn = sorted.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    // 15 Taka profit per 1000 Taka (1.5%) - excluding own number transfers
    const totalProfit = sorted
      .filter(tx => !isTxOwnNumberTransfer(tx, accounts))
      .reduce((sum, tx) => sum + ((Number(tx.amount) || 0) / 1000) * 15, 0);
    const txCount = sorted.length;

    // SIM breakdown for the day
    const simMap = new Map<string, {
      id: string;
      accountNumber: string;
      accountName?: string;
      lastDigits: string;
      provider?: string;
      totalAmount: number;
      count: number;
      profit: number;
    }>();

    for (const acc of accounts) {
      simMap.set(acc.lastDigits, {
        id: acc.id,
        accountNumber: acc.accountNumber,
        accountName: acc.accountName,
        lastDigits: acc.lastDigits,
        provider: acc.provider,
        totalAmount: 0,
        count: 0,
        profit: 0
      });
    }

    for (const tx of sorted) {
      const key = tx.lastDigits || 'other';
      const amt = Number(tx.amount) || 0;
      const isOwn = isTxOwnNumberTransfer(tx, accounts);
      const txProfit = isOwn ? 0 : (amt / 1000) * 15;

      if (simMap.has(key)) {
        const item = simMap.get(key)!;
        item.totalAmount += amt;
        item.count += 1;
        item.profit += txProfit;
      } else {
        simMap.set(key, {
          id: tx.accountId || key,
          accountNumber: tx.accountNumber || `...${tx.lastDigits}`,
          accountName: tx.accountName,
          lastDigits: tx.lastDigits || '----',
          provider: 'other',
          totalAmount: amt,
          count: 1,
          profit: txProfit
        });
      }
    }

    const simBreakdown = Array.from(simMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const activeSimsCount = simBreakdown.filter(s => s.totalAmount > 0).length;

    return {
      totalCashIn,
      totalProfit,
      txCount,
      transactions: sorted,
      simBreakdown,
      activeSimsCount
    };
  }, [transactions, accounts, date]);

  // Filtered transactions by search query and SIM filter
  const filteredTransactions = useMemo(() => {
    return dailyStats.transactions.filter(tx => {
      if (selectedSimFilter !== 'all' && tx.lastDigits !== selectedSimFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const phone = (tx.customerPhone || '').toLowerCase();
        const name = (tx.customerName || '').toLowerCase();
        const digits = (tx.lastDigits || '').toLowerCase();
        return phone.includes(q) || name.includes(q) || digits.includes(q);
      }
      return true;
    });
  }, [dailyStats.transactions, selectedSimFilter, searchQuery]);

  // Export Day CSV handler
  const handleExportDailyCsv = () => {
    if (dailyStats.transactions.length === 0) {
      alert(lang === 'bn' ? 'এই দিনে কোনো লেনদেন নেই' : 'No transactions on this day');
      return;
    }

    const headers = [
      'তারিখ ও সময় (Date & Time)',
      'ক্যাটাগরি (Category)',
      'কাস্টমার নম্বর (Customer Phone)',
      'কাস্টমার নাম (Customer Name)',
      'টাকার পরিমাণ (Amount)',
      'সিম লাস্ট ৪ ডিজিট (SIM Last 4)',
      'প্রেরক নম্বর (Agent SIM)',
      'মুনাফা ১৫টাকা/হাজার (Profit @15/1k)'
    ];

    const rows = dailyStats.transactions.map(tx => {
      const formattedDate = new Date(tx.createdAt || tx.date).toLocaleString('bn-BD');
      const isOwn = isTxOwnNumberTransfer(tx, accounts);
      const profit = isOwn ? '0.00 (নিজ নম্বর)' : ((tx.amount / 1000) * 15).toFixed(2);
      const catName = tx.category === 'own' ? 'নিজ' : tx.category === 'nagad' ? 'নগদ' : tx.category === 'flexiload' ? 'ফ্লেক্সিলোড' : 'বিকাশ';
      return [
        `"${formattedDate}"`,
        `"${catName}"`,
        `"${tx.customerPhone}"`,
        `"${tx.customerName || ''}"`,
        tx.amount,
        `"${tx.lastDigits}"`,
        `"${tx.accountNumber || ''}"`,
        profit
      ];
    });

    const summaryRow = [
      `"মোট (${date})"`,
      '""',
      '""',
      '""',
      dailyStats.totalCashIn,
      '""',
      '""',
      dailyStats.totalProfit.toFixed(2)
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(',')), summaryRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HelloPoint_DailyReport_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 font-sans animate-fade-in pb-16">
      
      {/* 1. TOP NAVIGATION HEADER (Back, Title, Date Selector, Switch to Monthly) */}
      <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Back button & Page Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-2xs flex items-center gap-1 text-xs font-black"
            title={lang === 'bn' ? 'ক্যাশ-ইন এ ফিরে যান' : 'Back to Cash-In'}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>{lang === 'bn' ? 'দৈনিক রিপোর্ট ও লাভ' : 'Daily Report & Profit'}</span>
              </h1>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {formatDailyDateDisplay(date)}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Date switchers & Switch to Monthly Report */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Quick Date Navigator */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-850 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700">
            <button
              type="button"
              onClick={() => changeDailyDateByDays(-1)}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors shadow-2xs"
              title={lang === 'bn' ? 'পূর্বের দিন' : 'Previous Day'}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDateChange(todayIso)}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                date === todayIso
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {lang === 'bn' ? 'আজ' : 'Today'}
            </button>
            <button
              type="button"
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                onDateChange(y.toISOString().split('T')[0]);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                date === (() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  return y.toISOString().split('T')[0];
                })()
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {lang === 'bn' ? 'গতকাল' : 'Yesterday'}
            </button>
            <button
              type="button"
              onClick={() => changeDailyDateByDays(1)}
              disabled={date >= todayIso}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors shadow-2xs disabled:opacity-40"
              title={lang === 'bn' ? 'পরের দিন' : 'Next Day'}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <input
              type="date"
              value={date}
              max={todayIso}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* Switch to Monthly Report */}
          <button
            type="button"
            onClick={onOpenMonthly}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-black cursor-pointer shadow-2xs transition-all active:scale-95 shrink-0"
            title={lang === 'bn' ? 'মাসিক রিপোর্ট দেখুন' : 'View Monthly Report'}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{lang === 'bn' ? 'মাসিক রিপোর্ট' : 'Monthly Report'}</span>
          </button>

          {/* Export Day CSV */}
          <button
            type="button"
            onClick={handleExportDailyCsv}
            disabled={dailyStats.txCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-black cursor-pointer shadow-2xs transition-all active:scale-95 disabled:opacity-40 shrink-0"
            title={lang === 'bn' ? 'CSV ডাউনলোড' : 'Download CSV'}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
          </button>
        </div>
      </div>

      {/* 2. TOP KPI CARDS (Desktop 4-column grid, mobile 2-column grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Total Cash-In */}
        <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-4 border border-blue-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'মোট ক্যাশ-ইন' : 'Total Cash-In'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-slate-50 mt-1">
            {currency}{dailyStats.totalCashIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-1">
            {toBengaliNumber(dailyStats.txCount)} {lang === 'bn' ? 'টি লেনদেন' : 'transactions'}
          </div>
        </div>

        {/* Card 2: Total Profit */}
        <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-4 border border-emerald-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            {lang === 'bn' ? 'মোট লাভ (হাজারে ১৫৳)' : 'Total Profit (@15/1k)'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            +{currency}{dailyStats.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-bold mt-1">
            {dailyStats.totalCashIn > 0 
              ? `${lang === 'bn' ? 'গড় মার্জিন ১.৫%' : '1.5% margin'}`
              : `${lang === 'bn' ? 'আজ কোনো লাভ হয়নি' : 'No profit yet'}`}
          </div>
        </div>

        {/* Card 3: Active SIMs */}
        <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'সক্রিয় সিম সংখ্যা' : 'Active SIMs'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-800 dark:text-slate-100 mt-1">
            {toBengaliNumber(dailyStats.activeSimsCount)} / {toBengaliNumber(accounts.length)}
          </div>
          <div className="text-[11px] text-slate-400 font-bold mt-1">
            {lang === 'bn' ? 'লেনদেন হওয়া সিম' : 'SIMs with transactions'}
          </div>
        </div>

        {/* Card 4: Average transaction size */}
        <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'গড় ক্যাশ-ইন সাইজ' : 'Average Cash-In'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-800 dark:text-slate-100 mt-1">
            {currency}{dailyStats.txCount > 0 ? (dailyStats.totalCashIn / dailyStats.txCount).toFixed(0) : '0'}
          </div>
          <div className="text-[11px] text-slate-400 font-bold mt-1">
            {lang === 'bn' ? 'প্রতি লেনদেনে গড়' : 'Per transaction average'}
          </div>
        </div>
      </div>

      {/* 3. DESKTOP 2-COLUMN LAYOUT: SIM-wise Breakdown on Left/Top & Transactions Feed on Right/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT COLUMN (Lg: 5 columns): SIM-wise Breakdown for Today */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                  {lang === 'bn' ? 'প্রতি নাম্বারে লেনদেন ও লাভ' : 'SIM Breakdown & Profit'}
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                {toBengaliNumber(dailyStats.simBreakdown.length)} {lang === 'bn' ? 'টি সিম' : 'SIMs'}
              </span>
            </div>

            {dailyStats.simBreakdown.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-bold">
                {lang === 'bn' ? 'কোনো সিম অ্যাকাউন্ট পাওয়া যায়নি' : 'No SIM accounts found'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-none">
                {dailyStats.simBreakdown.map((sim, idx) => {
                  const hasTxs = sim.totalAmount > 0;
                  const isSelectedFilter = selectedSimFilter === sim.lastDigits;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedSimFilter(isSelectedFilter ? 'all' : sim.lastDigits);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                        isSelectedFilter
                          ? 'bg-purple-50/90 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-400/30'
                          : hasTxs
                            ? 'bg-slate-50/80 dark:bg-slate-850 border-slate-200/90 dark:border-slate-750 hover:border-purple-300'
                            : 'bg-white dark:bg-[#151b22] border-slate-200/50 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      {/* Top row: SIM number, provider title, count */}
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-400 text-amber-950 font-mono font-black text-[10px] shrink-0">
                            ...{sim.lastDigits}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate font-mono">
                            {sim.accountNumber}
                          </span>
                          {sim.accountName && (
                            <span className="text-[10px] text-slate-400 truncate">
                              ({sim.accountName})
                            </span>
                          )}
                        </div>

                        <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 font-mono shrink-0">
                          {toBengaliNumber(sim.count)} {lang === 'bn' ? 'টি' : 'tx'}
                        </span>
                      </div>

                      {/* Bottom row: Total Amount & Profit */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[9.5px] font-bold text-slate-400 block">
                            {lang === 'bn' ? 'মোট ক্যাশ-ইন:' : 'Cash-In:'}
                          </span>
                          <span className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-slate-100">
                            {currency}{sim.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[9.5px] font-bold text-emerald-600 block">
                            {lang === 'bn' ? 'লাভ (১৫৳/১০০০):' : 'Profit:'}
                          </span>
                          <span className="text-xs sm:text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                            +{currency}{sim.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (Lg: 7 columns): Today's Transactions Feed */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col min-h-[500px]">
            
            {/* Transactions Header with Search & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                  {lang === 'bn' ? 'আজকের লেনদেন তালিকা' : 'Today\'s Transactions'}
                </h2>
                <span className="text-xs font-mono font-bold text-slate-400">
                  ({toBengaliNumber(filteredTransactions.length)})
                </span>
              </div>

              {/* Search & SIM Filter badge */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'bn' ? 'নম্বর খুঁজুন...' : 'Search number...'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {selectedSimFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedSimFilter('all')}
                    className="px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-black flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>...{selectedSimFilter}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* List of Transactions in small compact sleek lines */}
            <div className="space-y-1.5 pt-2 flex-1 overflow-y-auto pr-1">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-[#151b22] rounded-xl border border-slate-200/60 dark:border-slate-800 text-slate-400 text-xs font-bold space-y-1.5 my-auto">
                  <Clock className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 opacity-70" />
                  <p>
                    {searchQuery 
                      ? (lang === 'bn' ? 'কোনো লেনদেন মেলেনি' : 'No matching transactions')
                      : (lang === 'bn' ? 'এই দিনে কোনো ক্যাশ-ইন লেনদেন হয়নি' : 'No transactions on this day')}
                  </p>
                </div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#151b22] hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between transition-colors shadow-2xs select-none gap-2"
                  >
                    {/* Left: Indicator dot, Time, Phone, Name, Copy */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-rose-500 ring-2 ring-rose-400/20" />
                      
                      <span className="text-[9.5px] text-slate-400 font-bold font-mono shrink-0">
                        {displayTime(tx.createdAt || tx.date)}
                      </span>

                      <span className="text-slate-300 dark:text-slate-700 text-[9px] shrink-0 font-light">|</span>

                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate font-mono">
                          {tx.category === 'paybill'
                            ? (lang === 'bn' ? 'বিল পেমেন্ট' : 'Bill Payment')
                            : (tx.customerPhone || (tx.customerName ? tx.customerName : (lang === 'bn' ? 'নম্বর ছাড়া' : 'No number')))}
                        </span>

                        {tx.category === 'paybill' ? (
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold truncate max-w-[120px] sm:max-w-[160px]">
                            ({tx.customerPhone || tx.note || 'Pay Bill'})
                          </span>
                        ) : (
                          tx.customerName && tx.customerPhone && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[90px] sm:max-w-[130px]">
                              ({tx.customerName})
                            </span>
                          )
                        )}

                        {tx.customerPhone && (
                          <button
                            type="button"
                            onClick={() => handleCopy(tx.customerPhone || '', tx.id)}
                            className="p-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer shrink-0"
                            title={lang === 'bn' ? 'নম্বর কপি' : 'Copy'}
                          >
                            {copiedId === tx.id ? (
                              <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Category chip */}
                      {tx.category && (
                        <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold shrink-0 ${
                          tx.category === 'bkash' 
                            ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
                            : tx.category === 'nagad'
                            ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
                            : tx.category === 'flexiload'
                            ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                            : tx.category === 'paybill'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        }`}>
                          {tx.category === 'bkash' ? (lang === 'bn' ? 'বিকাশ' : 'bKash') :
                           tx.category === 'nagad' ? (lang === 'bn' ? 'নগদ' : 'Nagad') :
                           tx.category === 'flexiload' ? (lang === 'bn' ? 'ফ্লেক্সি' : 'Flexi') :
                           tx.category === 'paybill' ? (lang === 'bn' ? 'বিল পেমেন্ট' : 'Bill Payment') :
                           (lang === 'bn' ? 'নিজ' : 'Self')}
                        </span>
                      )}

                      {/* Own number transfer indicator (if not already shown as own category) */}
                      {tx.category !== 'own' && isTxOwnNumberTransfer(tx, accounts) && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[8.5px] font-bold shrink-0">
                          {lang === 'bn' ? 'নিজ নম্বর' : 'Own SIM'}
                        </span>
                      )}

                      {/* SIM lastDigits chip */}
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[9px] font-mono font-bold shrink-0 ml-auto">
                        ...{tx.lastDigits}
                      </span>
                    </div>

                    {/* Right: Amount & Profit */}
                    <div className="shrink-0 text-right select-none pl-1">
                      <div className="text-xs sm:text-sm font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
                        -{currency}{(Number(tx.amount) || 0).toFixed(2)}
                      </div>
                      <div className="text-[9px] font-bold font-mono">
                        {isTxOwnNumberTransfer(tx, accounts) ? (
                          <span className="text-slate-400 dark:text-slate-500">
                            +{currency}0.00
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{currency}{(((Number(tx.amount) || 0) / 1000) * 15).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
