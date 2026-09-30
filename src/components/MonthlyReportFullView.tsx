import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  CalendarDays, 
  Download, 
  Search, 
  Copy, 
  Check, 
  Clock, 
  Smartphone,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { CashInAccount, CashInTransaction } from '../types';
import { isTxOwnNumberTransfer } from '../utils/cashInUtils';

interface MonthlyReportFullViewProps {
  selectedMonthKey: string;
  onMonthChange: (key: string) => void;
  transactions: CashInTransaction[];
  accounts: CashInAccount[];
  currency: string;
  lang: 'bn' | 'en';
  onBack: () => void;
  onOpenDaily: () => void;
}

export function MonthlyReportFullView({
  selectedMonthKey,
  onMonthChange,
  transactions,
  accounts,
  currency,
  lang,
  onBack,
  onOpenDaily
}: MonthlyReportFullViewProps) {
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

  // Generate last 6 months list
  const last6Months = useMemo(() => {
    const months = [];
    const banglaMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      months.push({
        key,
        labelBn: `${banglaMonths[m - 1]} '${String(y).slice(-2)}`,
        labelEn: `${englishMonths[m - 1]} '${String(y).slice(-2)}`,
        fullLabelBn: `${banglaMonths[m - 1]} ${toBengaliNumber(y)}`,
        fullLabelEn: `${englishMonths[m - 1]} ${y}`
      });
    }
    return months;
  }, [lang]);

  const currentMonthObj = useMemo(() => {
    return last6Months.find(m => m.key === selectedMonthKey) || {
      key: selectedMonthKey,
      labelBn: selectedMonthKey,
      labelEn: selectedMonthKey,
      fullLabelBn: selectedMonthKey,
      fullLabelEn: selectedMonthKey
    };
  }, [last6Months, selectedMonthKey]);

  // Compute month analytics
  const monthStats = useMemo(() => {
    const monthTxs = transactions.filter(tx => {
      const txDate = tx.createdAt ? tx.createdAt.slice(0, 7) : (tx.date ? tx.date.slice(0, 7) : '');
      return txDate === selectedMonthKey;
    });

    const sorted = [...monthTxs].sort((a, b) => {
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

    // Requirement: "প্রতি নাম্বারে আলাদা মাসে কত লেনদেন হলো। কোন নাম্বার থেকে কত লাভ হল।"
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
  }, [transactions, accounts, selectedMonthKey]);

  // Filtered transactions by search query and SIM filter
  const filteredTransactions = useMemo(() => {
    return monthStats.transactions.filter(tx => {
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
  }, [monthStats.transactions, selectedSimFilter, searchQuery]);

  const displayDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'short' });
    const time = d.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${day} ${month} • ${time}`;
  };

  // Google Sheets / CSV Export handler for the SELECTED month
  const handleExportMonthGoogleSheet = () => {
    const monthTxs = monthStats.transactions;
    if (monthTxs.length === 0) {
      alert(lang === 'bn' ? 'এই মাসে কোনো লেনদেন পাওয়া যায়নি' : 'No transactions found for this month');
      return;
    }

    const headers = [
      'তারিখ ও সময় (Date)',
      'ক্যাটাগরি (Category)',
      'কাস্টমার নম্বর (Customer Phone)',
      'কাস্টমার নাম (Customer Name)',
      'টাকার পরিমাণ (Amount)',
      'লাস্ট ৪ ডিজিট (Last Digits)',
      'প্রেরক নম্বর (Sender Number)',
      'মুনাফা ১৫টাকা/হাজার (Profit @15/1k)'
    ];

    const rows = monthTxs.map(tx => {
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
      `"মোট (${currentMonthObj.labelBn})"`,
      '""',
      '""',
      '""',
      monthStats.totalCashIn,
      '""',
      '""',
      monthStats.totalProfit.toFixed(2)
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

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 font-sans animate-fade-in pb-16">
      
      {/* 1. TOP NAVIGATION HEADER (Back, Title, Month Switchers, Download) */}
      <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Back button & Title */}
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
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>{lang === 'bn' ? 'মাসিক রিপোর্ট ও লাভ' : 'Monthly Report & Profit'}</span>
              </h1>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {lang === 'bn' ? currentMonthObj.fullLabelBn : currentMonthObj.fullLabelEn}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions (Switch to Daily, Download CSV) */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Switch to Daily Report */}
          <button
            type="button"
            onClick={onOpenDaily}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black cursor-pointer shadow-2xs transition-all active:scale-95 shrink-0"
            title={lang === 'bn' ? 'দৈনিক রিপোর্ট দেখুন' : 'View Daily Report'}
          >
            <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{lang === 'bn' ? 'দৈনিক রিপোর্ট' : 'Daily Report'}</span>
          </button>

          {/* Download CSV */}
          <button
            type="button"
            onClick={handleExportMonthGoogleSheet}
            disabled={monthStats.txCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer shadow-2xs transition-all active:scale-95 disabled:opacity-40 shrink-0"
            title={lang === 'bn' ? 'Excel / CSV ডাউনলোড' : 'Download CSV'}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{lang === 'bn' ? 'Excel / CSV ডাউনলোড' : 'Download CSV'}</span>
          </button>
        </div>
      </div>

      {/* 2. MONTH SELECTOR TABS (Last 6 Months) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {last6Months.map(m => {
          const isSelected = selectedMonthKey === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onMonthChange(m.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-xs scale-102'
                  : 'bg-white dark:bg-[#1E252D] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {lang === 'bn' ? m.labelBn : m.labelEn}
            </button>
          );
        })}
      </div>

      {/* 3. KEY KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Total Cash-In */}
        <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'মাসের মোট ক্যাশ-ইন' : 'Total Cash-In'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-slate-50 mt-1">
            {currency}{monthStats.totalCashIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1">
            {toBengaliNumber(monthStats.txCount)} {lang === 'bn' ? 'টি ক্যাশ-ইন লেনদেন' : 'cash-in txs'}
          </div>
        </div>

        {/* Card 2: Total Profit */}
        <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-4 border border-emerald-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            {lang === 'bn' ? 'মাসের মোট লাভ (১৫৳/১০০০)' : 'Total Profit (@15/1k)'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            +{currency}{monthStats.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-bold mt-1">
            {lang === 'bn' ? '১.৫% এজেন্ট মুনাফা' : '1.5% agent profit'}
          </div>
        </div>

        {/* Card 3: Active SIMs */}
        <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'ব্যবহৃত সিম সংখ্যা' : 'Active SIMs'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-800 dark:text-slate-100 mt-1">
            {toBengaliNumber(monthStats.activeSimsCount)} / {toBengaliNumber(accounts.length)}
          </div>
          <div className="text-[11px] text-slate-400 font-bold mt-1">
            {lang === 'bn' ? 'মাসে লেনদেন সম্পন্ন সিম' : 'SIMs with transactions'}
          </div>
        </div>

        {/* Card 4: Daily Average */}
        <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'দৈনিক গড় ক্যাশ-ইন' : 'Daily Avg Cash-In'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-800 dark:text-slate-100 mt-1">
            {currency}{(monthStats.totalCashIn / 30).toFixed(0)}
          </div>
          <div className="text-[11px] text-slate-400 font-bold mt-1">
            {lang === 'bn' ? 'গড় দৈনিক লেনদেন' : '30-day average'}
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT DESKTOP 2-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT COLUMN (Lg: 5 columns):
            Requirement 4: "প্রতি নাম্বারে আলাদা মাসে কত লেনদেন হলো। কোন নাম্বার থেকে কত লাভ হল। ছোট ছোট লাইনে সাজাও এবং এক্সটা বা অপ্রায়জনীয় টেক্সট না রেখে ফিড কে ক্লিন রাখতে হবে।" */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                  {lang === 'bn' ? 'প্রতি নাম্বারে লেনদেন ও লাভ' : 'By Number / SIM Breakdown'}
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                {toBengaliNumber(monthStats.simBreakdown.length)} {lang === 'bn' ? 'টি সিম' : 'SIMs'}
              </span>
            </div>

            {monthStats.simBreakdown.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-bold">
                {lang === 'bn' ? 'কোনো সিম অ্যাকাউন্ট পাওয়া যায়নি' : 'No SIM accounts found'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 scrollbar-none">
                {monthStats.simBreakdown.map((sim, idx) => {
                  const hasTxs = sim.totalAmount > 0;
                  const isSelectedFilter = selectedSimFilter === sim.lastDigits;
                  const percentOfTotal = monthStats.totalCashIn > 0 
                    ? Math.round((sim.totalAmount / monthStats.totalCashIn) * 100) 
                    : 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedSimFilter(isSelectedFilter ? 'all' : sim.lastDigits);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                        isSelectedFilter
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-400/30'
                          : hasTxs
                            ? 'bg-slate-50/80 dark:bg-slate-850 border-slate-200/90 dark:border-slate-750 hover:border-emerald-300'
                            : 'bg-white dark:bg-[#151b22] border-slate-200/50 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      {/* Top Row: SIM number, provider name, count & percentage */}
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

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                            {toBengaliNumber(sim.count)} {lang === 'bn' ? 'টি লেনদেন' : 'txs'}
                          </span>
                          {percentOfTotal > 0 && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono font-bold">
                              {percentOfTotal}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Total Cash-In & Total Profit in clean small line */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[9.5px] font-bold text-slate-400 block">
                            {lang === 'bn' ? 'মাসে লেনদেন:' : 'Volume:'}
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

        {/* RIGHT COLUMN (Lg: 7 columns):
            Requirement 4: "ছোট ছোট লাইনে সাজাও এবং এক্সটা বা অপ্রায়জনীয় টেক্সট না রেখে ফিড কে ক্লিন রাখতে হবে।" */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white dark:bg-[#1E252D] rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col min-h-[520px]">
            
            {/* Header: Title, Search, Filter badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                  {lang === 'bn' ? 'মাসের লেনদেন ফিড' : 'Monthly Feed'}
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
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>...{selectedSimFilter}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Transactions Feed in small, sleek, clean rows without clutter */}
            <div className="space-y-1.5 pt-2 flex-1 overflow-y-auto pr-1">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-[#151b22] rounded-xl border border-slate-200/60 dark:border-slate-800 text-slate-400 text-xs font-bold space-y-1.5 my-auto">
                  <Clock className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 opacity-70" />
                  <p>
                    {searchQuery 
                      ? (lang === 'bn' ? 'কোনো লেনদেন মেলেনি' : 'No matching transactions')
                      : (lang === 'bn' ? 'এই মাসে কোনো ক্যাশ-ইন লেনদেন হয়নি' : 'No transactions in this month')}
                  </p>
                </div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#151b22] hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between transition-colors shadow-2xs select-none gap-2"
                  >
                    {/* Left: Status dot, Date/Time, Phone, Name, Copy */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-rose-500 ring-2 ring-rose-400/20" />
                      
                      <span className="text-[9.5px] text-slate-400 font-bold font-mono shrink-0">
                        {displayDateTime(tx.createdAt || tx.date)}
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
