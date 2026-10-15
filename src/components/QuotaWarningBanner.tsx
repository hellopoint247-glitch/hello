/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, X, Database, ShieldCheck } from 'lucide-react';
import { subscribeQuotaState, isQuotaExceeded, FIRESTORE_UPGRADE_URL } from '../utils/firebase';

interface QuotaWarningBannerProps {
  lang: 'bn' | 'en';
}

export const QuotaWarningBanner: React.FC<QuotaWarningBannerProps> = ({ lang }) => {
  const [quotaExceeded, setQuotaExceeded] = useState(() => isQuotaExceeded());
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const unsub = subscribeQuotaState((exceeded) => {
      setQuotaExceeded(exceeded);
    });
    return unsub;
  }, []);

  if (!quotaExceeded || dismissed) {
    return null;
  }

  const isBn = lang === 'bn';

  return (
    <div className="relative z-50 bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-100 px-4 py-2.5 backdrop-blur-md transition-all">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2.5 flex-1">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-xs sm:text-sm">
            <div className="font-semibold flex items-center gap-1.5 flex-wrap">
              <span>
                {isBn 
                  ? 'ক্লাউড ডেটাবেস কোটা সীমা পূর্ণ হয়েছে (Free Daily Write Quota Limit)' 
                  : 'Cloud Database Quota Limit Exceeded (Free Daily Write Limit)'}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-3 h-3" />
                {isBn ? 'অফলাইন মোড সক্রিয় — ডাটা সুরক্ষিত' : 'Offline Mode Active — Data Safe'}
              </span>
            </div>
            <p className="text-xs opacity-90 mt-0.5 text-slate-700 dark:text-slate-300">
              {isBn
                ? 'ফ্রি টিয়ার ডেটাবেসের দৈনিক রাইট লিমিট পূর্ণ হয়েছে। আপনার সকল হিসাব ও লেনদেন এই ডিভাইসে সম্পূর্ণ নিরাপদ রয়েছে এবং স্বয়ংক্রিয়ভাবে আগামী দিন কোটা রিসেট হলে ক্লাউড সিঙ্ক চালু হবে।'
                : 'Free tier database daily write limit reached. All your entries are safely saved on this device, and cloud sync will resume when the quota resets tomorrow.'}
            </p>

            {expanded && (
              <div className="mt-2.5 pt-2 border-t border-amber-500/20 text-[11px] space-y-1.5 text-slate-600 dark:text-slate-400">
                <p>
                  <strong>{isBn ? 'কারণ:' : 'Reason:'}</strong>{' '}
                  {isBn
                    ? "Firestore Free Tier (Spark Plan) এ প্রতিদিন ২০,০০০ রাইট লিমিট থাকে। এটি রাত ১২:০০ টা (PST) সময়ে রিসেট হয়।"
                    : "Firestore Free Tier (Spark Plan) has a daily limit of 20,000 writes. Quota resets daily at midnight PST."}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={FIRESTORE_UPGRADE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] transition-colors shadow-sm"
                  >
                    <Database className="w-3 h-3" />
                    <span>{isBn ? 'ফায়ারবেস কনসোল আপগ্রেড / কোটা দেখুন' : 'Firebase Console / Upgrade'}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <a
                    href="https://firebase.google.com/pricing#cloud-firestore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/15 text-slate-800 dark:text-slate-200 font-medium text-[11px] transition-colors"
                  >
                    <span>{isBn ? 'কোটা পলিসি বিস্তারিত' : 'Quota Pricing Policy'}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-medium underline underline-offset-2 text-amber-800 dark:text-amber-300 hover:opacity-80 px-1"
          >
            {expanded 
              ? (isBn ? 'কম দেখান' : 'Show Less') 
              : (isBn ? 'বিস্তারিত' : 'Details')}
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1 rounded hover:bg-amber-500/20 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title={isBn ? 'বন্ধ করুন' : 'Dismiss'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
