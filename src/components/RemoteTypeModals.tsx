/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import {
  X,
  Copy,
  Check,
  Send,
  Delete,
  Trash2,
  Radio,
  Smartphone,
  CheckCircle2,
  ArrowLeft,
  Volume2,
  RotateCw,
  Lock,
  Heart,
  AlertTriangle
} from 'lucide-react';
import { RemoteTypeState, RemoteTypedNumberItem, PermanentTypedNumberItem } from '../types';
import { db } from '../utils/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { soundEngine } from '../utils/audio';

export const REMOTE_TYPE_STORAGE_KEY = 'hellopoint_remote_type_state';
const BROADCAST_CHANNEL_NAME = 'hellopoint_remote_type_channel';
export const MAX_REMOTE_HISTORY_ITEMS = 15;
export const MAX_PERMANENT_HISTORY_ITEMS = 100;

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  // Ignore if BroadcastChannel is unsupported
}

export const getInitialRemoteTypeState = (): RemoteTypeState => {
  try {
    const raw = localStorage.getItem(REMOTE_TYPE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        liveNumber: typeof parsed.liveNumber === 'string' ? parsed.liveNumber : '',
        liveAmount: typeof parsed.liveAmount === 'string' ? parsed.liveAmount : '',
        isTyping: Boolean(parsed.isTyping),
        isRotated: Boolean(parsed.isRotated),
        sentNumbers: Array.isArray(parsed.sentNumbers)
          ? parsed.sentNumbers.slice(0, MAX_REMOTE_HISTORY_ITEMS)
          : [],
        permanentNumbers: Array.isArray(parsed.permanentNumbers)
          ? parsed.permanentNumbers.slice(0, MAX_PERMANENT_HISTORY_ITEMS)
          : [],
        numberStats: typeof parsed.numberStats === 'object' && parsed.numberStats !== null ? parsed.numberStats : {},
        updatedAt: parsed.updatedAt || new Date(0).toISOString()
      };
    }
  } catch {
    // ignore
  }
  return {
    liveNumber: '',
    liveAmount: '',
    isTyping: false,
    isRotated: false,
    sentNumbers: [],
    permanentNumbers: [],
    numberStats: {},
    updatedAt: new Date(0).toISOString()
  };
};

// Coalesced background sync so rapid typing never blocks the UI thread
let firestoreSyncTimer: ReturnType<typeof setTimeout> | null = null;
let latestPendingState: RemoteTypeState | null = null;

const flushFirestoreRemoteType = (stateToWrite: RemoteTypeState) => {
  if (firestoreSyncTimer) {
    clearTimeout(firestoreSyncTimer);
    firestoreSyncTimer = null;
  }
  latestPendingState = null;
  setDoc(doc(db, 'public', 'remote_type'), {
    liveNumber: stateToWrite.liveNumber || '',
    liveAmount: stateToWrite.liveAmount || '',
    isTyping: stateToWrite.isTyping,
    isRotated: Boolean(stateToWrite.isRotated),
    ownerCopied: Boolean(stateToWrite.ownerCopied),
    ownerCopiedAt: stateToWrite.ownerCopiedAt || '',
    sentNumbers: (stateToWrite.sentNumbers || []).slice(0, MAX_REMOTE_HISTORY_ITEMS),
    permanentNumbers: (stateToWrite.permanentNumbers || []).slice(0, MAX_PERMANENT_HISTORY_ITEMS),
    numberStats: stateToWrite.numberStats || {},
    updatedAt: stateToWrite.updatedAt
  }).catch(() => {
    // ignore background sync notice
  });
};

export const syncRemoteTypeStateInstant = (
  nextState: RemoteTypeState,
  immediateFlush: boolean = false
) => {
  const normalizedState: RemoteTypeState = {
    ...nextState,
    liveNumber: nextState.liveNumber || '',
    liveAmount: nextState.liveAmount || '',
    isRotated: Boolean(nextState.isRotated),
    ownerCopied: Boolean(nextState.ownerCopied),
    ownerCopiedAt: nextState.ownerCopiedAt,
    sentNumbers: (nextState.sentNumbers || []).slice(0, MAX_REMOTE_HISTORY_ITEMS),
    permanentNumbers: (nextState.permanentNumbers || []).slice(0, MAX_PERMANENT_HISTORY_ITEMS),
    numberStats: nextState.numberStats || {}
  };
  latestPendingState = normalizedState;

  // Run local storage & cross-tab BroadcastChannel off the critical keystroke paint frame
  queueMicrotask(() => {
    try {
      const serialized = JSON.stringify(normalizedState);
      localStorage.setItem(REMOTE_TYPE_STORAGE_KEY, serialized);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(REMOTE_TYPE_STORAGE_KEY, serialized);
        } catch {
          // ignore
        }
      }
      if (broadcastChannel) {
        broadcastChannel.postMessage(normalizedState);
      }
    } catch {
      // ignore
    }
  });

  if (
    immediateFlush ||
    normalizedState.liveNumber.length === 11 ||
    normalizedState.liveNumber.length === 0
  ) {
    flushFirestoreRemoteType(normalizedState);
  } else {
    if (firestoreSyncTimer) {
      clearTimeout(firestoreSyncTimer);
    }
    firestoreSyncTimer = setTimeout(() => {
      if (latestPendingState) {
        flushFirestoreRemoteType(latestPendingState);
      }
    }, 180);
  }
};

/**
 * Records typed and copied counts.
 * Rule: When customer types SAME number > 5 times AND owner copies SAME number > 5 times,
 * automatically promote to Permanent History (up to 100 items).
 */
export const checkAndPromotePermanentNumber = (
  number: string,
  amount: string | undefined,
  currentState: RemoteTypeState,
  action: 'typed' | 'copied'
): { nextState: RemoteTypeState; wasPromoted: boolean; isAlreadyPermanent: boolean } => {
  const cleanNum = (number || '').trim();
  if (cleanNum.length !== 11) {
    return { nextState: currentState, wasPromoted: false, isAlreadyPermanent: false };
  }

  const permanentList = [...(currentState.permanentNumbers || [])];
  const existingPermIndex = permanentList.findIndex((p) => p.number === cleanNum);
  const isAlreadyPermanent = existingPermIndex >= 0;

  const stats = { ...(currentState.numberStats || {}) };
  const currentStat = stats[cleanNum] || { typedCount: 0, copiedCount: 0 };

  const newTypedCount = action === 'typed' ? currentStat.typedCount + 1 : currentStat.typedCount;
  const newCopiedCount = action === 'copied' ? currentStat.copiedCount + 1 : currentStat.copiedCount;

  stats[cleanNum] = {
    typedCount: newTypedCount,
    copiedCount: newCopiedCount
  };

  let wasPromoted = false;
  // Qualifies if typed > 5 times AND copied > 5 times
  if (newTypedCount > 5 && newCopiedCount > 5 && !isAlreadyPermanent) {
    const newPermanentItem: PermanentTypedNumberItem = {
      id: 'perm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      number: cleanNum,
      amount: amount || '',
      typedCount: newTypedCount,
      copiedCount: newCopiedCount,
      promotedAt: new Date().toISOString()
    };
    permanentList.unshift(newPermanentItem);
    wasPromoted = true;
  } else if (isAlreadyPermanent && existingPermIndex >= 0) {
    permanentList[existingPermIndex] = {
      ...permanentList[existingPermIndex],
      typedCount: newTypedCount,
      copiedCount: newCopiedCount,
      amount: amount || permanentList[existingPermIndex].amount
    };
  }

  const nextState: RemoteTypeState = {
    ...currentState,
    permanentNumbers: permanentList.slice(0, MAX_PERMANENT_HISTORY_ITEMS),
    numberStats: stats,
    updatedAt: new Date().toISOString()
  };

  return { nextState, wasPromoted, isAlreadyPermanent };
};

export const getOperatorBadge = (num: string, lang: 'bn' | 'en') => {
  if (!num || num.length < 3) return null;
  const prefix = num.slice(0, 3);
  if (prefix === '013' || prefix === '017') {
    return {
      name: lang === 'bn' ? 'গ্রামীণফোন' : 'Grameenphone',
      color: 'bg-sky-100 text-sky-800 border-sky-200',
      darkColor: 'bg-sky-500/20 text-sky-300 border-sky-400/40'
    };
  }
  if (prefix === '018') {
    return {
      name: lang === 'bn' ? 'রবি' : 'Robi',
      color: 'bg-rose-100 text-rose-800 border-rose-200',
      darkColor: 'bg-rose-500/20 text-rose-300 border-rose-400/40'
    };
  }
  if (prefix === '016') {
    return {
      name: lang === 'bn' ? 'সার্কেল' : 'Circle',
      color: 'bg-teal-100 text-teal-800 border-teal-200',
      darkColor: 'bg-teal-500/20 text-teal-300 border-teal-400/40'
    };
  }
  if (prefix === '019' || prefix === '014') {
    return {
      name: lang === 'bn' ? 'বাংলালিংক' : 'Banglalink',
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      darkColor: 'bg-orange-500/20 text-orange-300 border-orange-400/40'
    };
  }
  if (prefix === '015') {
    return {
      name: lang === 'bn' ? 'টেলিটক' : 'Teletalk',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      darkColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
    };
  }
  return null;
};

/**
 * Detects if the entered number has an invalid operator prefix or non-mobile starting digits.
 * User requested:
 * "অপারেটর ছাড়া যদি কোনো নাম্বার টাইপ করা হয় তাহলে চার কোনা বর্ডার লাল হয়ে ওয়ার্মিং দেবে"
 */
export const isInvalidOperatorNumber = (num: string): boolean => {
  if (!num) return false;
  const clean = num.replace(/\D/g, '');
  if (!clean) return false;

  // Bangladeshi phone numbers always start with 0
  if (clean.length >= 1 && clean[0] !== '0') return true;
  // Second digit must be 1 (01)
  if (clean.length >= 2 && clean.slice(0, 2) !== '01') return true;
  // If 3 or more digits, third digit must be a valid operator:
  // 3 or 7 (Grameenphone), 8 (Robi), 6 (Circle), 9 or 4 (Banglalink), 5 (Teletalk)
  if (clean.length >= 3) {
    const thirdDigit = clean[2];
    const validThirdDigits = ['3', '4', '5', '6', '7', '8', '9'];
    if (!validThirdDigits.includes(thirdDigit)) {
      return true;
    }
  }
  return false;
};

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;
  try {
    localStorage.setItem('hellopoint_clipboard_fallback', text);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('hellopoint_clipboard_fallback', text);
    }
  } catch {
    // ignore storage errors
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback for iframe environments
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch {
    return false;
  }
};

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const formatDigits = (n: number | string, lang: 'bn' | 'en') => {
  if (lang !== 'bn') return String(n);
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
};

/**
 * 11 Round Clean Circles Progress Indicator ("আগের ১১ ডট চমৎকার কালারের সাথে")
 */
const ElevenRoundDotsIndicator = memo(function ElevenRoundDotsIndicator({
  count,
  isElevenDigits,
  isInvalidOperator
}: {
  count: number;
  isElevenDigits: boolean;
  isInvalidOperator?: boolean;
}) {
  return (
    <div className={`flex items-center justify-center gap-1.5 xs:gap-2 sm:gap-2.5 py-1.5 px-3.5 rounded-full select-none transition-colors ${
      isInvalidOperator
        ? 'bg-[#1C070A] border border-rose-500/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]'
        : 'bg-[#0C1220] border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]'
    }`}>
      {Array.from({ length: 11 }).map((_, i) => {
        const filled = i < count;
        const isCurrentActive = i === count - 1;
        return (
          <div
            key={i}
            className={`w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center transition-all duration-150 border ${
              isInvalidOperator && filled
                ? 'bg-gradient-to-tr from-rose-500 to-red-400 border-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                : isElevenDigits
                ? 'bg-gradient-to-tr from-emerald-400 to-teal-300 border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.85)] scale-110'
                : filled
                ? isCurrentActive
                  ? 'bg-gradient-to-tr from-cyan-300 to-sky-200 border-white shadow-[0_0_10px_rgba(6,182,212,0.9)] scale-110'
                  : 'bg-gradient-to-tr from-cyan-500 to-sky-400 border-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.6)]'
                : 'bg-[#151D2E] border-slate-700/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]'
            }`}
          >
            {filled && (
              <span
                className={`rounded-full transition-transform ${
                  isInvalidOperator
                    ? 'w-1 h-1 bg-white'
                    : isElevenDigits
                    ? 'w-1.5 h-1.5 bg-emerald-950'
                    : isCurrentActive
                    ? 'w-1.5 h-1.5 bg-slate-900'
                    : 'w-1 h-1 bg-white'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

/**
 * 11 Vertical Round Dots Progress Indicator (Fallback/Auxiliary)
 */
const ElevenVerticalDotsIndicator = memo(function ElevenVerticalDotsIndicator({
  count,
  isElevenDigits
}: {
  count: number;
  isElevenDigits: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-between h-full select-none py-1">
      {Array.from({ length: 11 }).map((_, i) => {
        const filled = i < count;
        const isCurrentActive = i === count - 1;
        return (
          <div
            key={i}
            className={`w-2.5 h-2.5 xs:w-3 xs:h-3 rounded-full flex items-center justify-center transition-all duration-150 border ${
              isElevenDigits
                ? 'bg-gradient-to-tr from-emerald-400 to-teal-300 border-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.85)] scale-105'
                : filled
                ? isCurrentActive
                  ? 'bg-gradient-to-tr from-cyan-300 to-sky-200 border-white shadow-[0_0_8px_rgba(6,182,212,0.9)] scale-110'
                  : 'bg-gradient-to-tr from-cyan-500 to-sky-400 border-cyan-300 shadow-[0_0_5px_rgba(6,182,212,0.6)]'
                : 'bg-[#151D2E] border-slate-700/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]'
            }`}
          >
            {filled && (
              <span
                className={`rounded-full ${
                  isElevenDigits
                    ? 'w-1 h-1 bg-emerald-950'
                    : isCurrentActive
                    ? 'w-1 h-1 bg-slate-900'
                    : 'w-0.5 h-0.5 bg-white'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

const DIALPAD_KEYS = [
  { digit: '1', sub: '• • •' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' }
];

/**
 * Pure Memoized Hardware-Accelerated Dialpad Grid
 * Expanded larger keypad for effortless typing ("কিবোর্ড আরও একটু বড় করতে হবে")
 */
const TactileDialpadGrid = memo(function TactileDialpadGrid({
  lang,
  onDigit,
  onClear,
  onBackspace
}: {
  lang: 'bn' | 'en';
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}) {
  return (
    <div className="w-full grid grid-cols-3 grid-rows-4 gap-2 xs:gap-2.5 sm:gap-3 select-none h-[270px] xs:h-[295px] sm:h-[330px] shrink-0">
      {DIALPAD_KEYS.map(({ digit, sub }) => (
        <button
          key={digit}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onDigit(digit);
          }}
          onClick={(e) => e.preventDefault()}
          style={{ touchAction: 'manipulation' }}
          className="h-full rounded-2xl border border-white/10 bg-[#13192B] hover:bg-[#1b233a] active:bg-cyan-600 active:border-cyan-400 active:scale-95 transition-transform duration-75 flex flex-col items-center justify-center cursor-pointer select-none touch-manipulation shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
        >
          <span className="font-mono text-3xl xs:text-4xl font-black text-white leading-none tracking-tight pointer-events-none">
            {digit}
          </span>
          <span className="text-[9px] xs:text-[10px] font-extrabold text-slate-400 tracking-[0.2em] mt-0.5 pointer-events-none">
            {sub}
          </span>
        </button>
      ))}

      {/* Clear (C) Button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          onClear();
        }}
        onClick={(e) => e.preventDefault()}
        style={{ touchAction: 'manipulation' }}
        className="h-full rounded-2xl border border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-600 active:border-rose-400 active:scale-95 transition-transform duration-75 flex flex-col items-center justify-center cursor-pointer select-none touch-manipulation text-rose-200"
      >
        <span className="text-xl xs:text-2xl sm:text-3xl font-black text-rose-300 leading-none pointer-events-none">
          C
        </span>
        <span className="text-[9px] xs:text-[10px] font-black uppercase tracking-wider text-rose-300/90 mt-0.5 pointer-events-none">
          {lang === 'bn' ? 'মুছুন' : 'CLEAR'}
        </span>
      </button>

      {/* 0 Button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          onDigit('0');
        }}
        onClick={(e) => e.preventDefault()}
        style={{ touchAction: 'manipulation' }}
        className="h-full rounded-2xl border border-white/10 bg-[#13192B] hover:bg-[#1b233a] active:bg-cyan-600 active:border-cyan-400 active:scale-95 transition-transform duration-75 flex flex-col items-center justify-center cursor-pointer select-none touch-manipulation shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
      >
        <span className="font-mono text-3xl xs:text-4xl font-black text-white leading-none pointer-events-none">
          0
        </span>
        <span className="text-[10px] font-extrabold text-slate-400 tracking-widest mt-0.5 pointer-events-none">
          +
        </span>
      </button>

      {/* Backspace Button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          onBackspace();
        }}
        onClick={(e) => e.preventDefault()}
        style={{ touchAction: 'manipulation' }}
        className="h-full rounded-2xl border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-600 active:border-amber-400 active:scale-95 transition-transform duration-75 flex flex-col items-center justify-center cursor-pointer select-none touch-manipulation text-amber-200"
      >
        <Delete className="w-6 h-6 xs:w-7 xs:h-7 text-amber-300 pointer-events-none" />
        <span className="text-[9px] xs:text-[10px] font-black uppercase tracking-wider text-amber-300/90 mt-0.5 pointer-events-none">
          {lang === 'bn' ? 'কাটুন' : 'BACK'}
        </span>
      </button>
    </div>
  );
});

interface VisitorRemoteTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'bn' | 'en';
  remoteState: RemoteTypeState;
  onUpdateRemoteState: (nextState: RemoteTypeState) => void;
}

export function VisitorRemoteTypeModal({
  isOpen,
  onClose,
  lang,
  remoteState,
  onUpdateRemoteState
}: VisitorRemoteTypeModalProps) {
  // Local-first state for 0ms instant typing without re-rendering the entire App/PinLockScreen tree
  const [localLiveNumber, setLocalLiveNumber] = useState<string>(() => remoteState.liveNumber || '');
  const [localLiveAmount, setLocalLiveAmount] = useState<string>(() => remoteState.liveAmount || '');
  const [activeField, setActiveField] = useState<'number' | 'amount'>('number');
  const [localSentNumbers, setLocalSentNumbers] = useState<RemoteTypedNumberItem[]>(() =>
    (remoteState.sentNumbers || []).slice(0, MAX_REMOTE_HISTORY_ITEMS)
  );
  const [justSentToast, setJustSentToast] = useState(false);
  const [ownerCopiedToast, setOwnerCopiedToast] = useState(false);
  const [copyRemainingSec, setCopyRemainingSec] = useState<number>(0);
  const [permanentAlertInfo, setPermanentAlertInfo] = useState<{ show: boolean; number: string }>({
    show: false,
    number: ''
  });
  const [thankYouGreeting, setThankYouGreeting] = useState<{
    show: boolean;
    number: string;
    amount?: string;
    operator?: string;
  }>({
    show: false,
    number: '',
    amount: '',
    operator: ''
  });
  const [greetingCountdownSec, setGreetingCountdownSec] = useState<number>(0);

  const liveNumberRef = useRef<string>(localLiveNumber);
  const liveAmountRef = useRef<string>(localLiveAmount);
  const activeFieldRef = useRef<'number' | 'amount'>('number');
  const sentNumbersRef = useRef<RemoteTypedNumberItem[]>(localSentNumbers);
  const autoSavedIdRef = useRef<string | null>(null);
  const last11CompletedAtRef = useRef<number>(0);
  const lastLocalTypingTimeRef = useRef<number>(0);
  const parentSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUpdateRemoteStateRef = useRef(onUpdateRemoteState);
  const ownerCopiedAutoClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const greetingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greetingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onUpdateRemoteStateRef.current = onUpdateRemoteState;
  }, [onUpdateRemoteState]);

  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  // Schedule non-blocking background sync to Owner & parent state
  const commitStateChange = useCallback(
    (
      nextLiveNumber: string,
      nextLiveAmount: string,
      nextSent: RemoteTypedNumberItem[],
      immediate: boolean = false,
      extraPerm?: PermanentTypedNumberItem[],
      extraStats?: Record<string, { typedCount: number; copiedCount: number }>
    ) => {
      const cappedSent = nextSent.slice(0, MAX_REMOTE_HISTORY_ITEMS);
      liveNumberRef.current = nextLiveNumber;
      liveAmountRef.current = nextLiveAmount;
      sentNumbersRef.current = cappedSent;
      lastLocalTypingTimeRef.current = Date.now();

      const nextState: RemoteTypeState = {
        liveNumber: nextLiveNumber,
        liveAmount: nextLiveAmount,
        isTyping: nextLiveNumber.length > 0 || nextLiveAmount.length > 0,
        isRotated: Boolean(remoteState.isRotated),
        sentNumbers: cappedSent,
        permanentNumbers: (extraPerm || remoteState.permanentNumbers || []).slice(0, MAX_PERMANENT_HISTORY_ITEMS),
        numberStats: extraStats || remoteState.numberStats || {},
        updatedAt: new Date().toISOString()
      };

      // Sync to Firestore & BroadcastChannel in background
      syncRemoteTypeStateInstant(nextState, immediate);

      // Defer parent App.tsx state update until typing pauses for 450ms
      if (parentSyncTimerRef.current) {
        clearTimeout(parentSyncTimerRef.current);
        parentSyncTimerRef.current = null;
      }
      if (immediate) {
        onUpdateRemoteStateRef.current(nextState);
      } else {
        parentSyncTimerRef.current = setTimeout(() => {
          onUpdateRemoteStateRef.current(nextState);
        }, 450);
      }
    },
    [remoteState]
  );

  // Clean up auto-clear timer and interval on unmount
  useEffect(() => {
    return () => {
      if (ownerCopiedAutoClearTimerRef.current) {
        clearTimeout(ownerCopiedAutoClearTimerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (greetingTimerRef.current) {
        clearTimeout(greetingTimerRef.current);
      }
      if (greetingIntervalRef.current) {
        clearInterval(greetingIntervalRef.current);
      }
    };
  }, []);

  // When owner copies number, show notification and auto-clear after 1 minute (60 seconds)
  // User requested: "উইনার নাম্বার কপি করলে ভিউয়ার কার্ড থেকে সাথে সাথে নাম্বার চলে যায়, সেটি ১মিনিট পর অটোমেটিক ভাবে চলে যাবে।"
  useEffect(() => {
    if (!isOpen) return;
    if (remoteState.ownerCopied && (liveNumberRef.current || localLiveNumber)) {
      setOwnerCopiedToast(true);

      if (ownerCopiedAutoClearTimerRef.current) {
        clearTimeout(ownerCopiedAutoClearTimerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      let delay = 60000;
      if (remoteState.ownerCopiedAt) {
        const elapsed = Date.now() - new Date(remoteState.ownerCopiedAt).getTime();
        if (elapsed > 0 && elapsed < 60000) {
          delay = 60000 - elapsed;
        } else if (elapsed >= 60000) {
          delay = 0;
        }
      }

      const initialSec = Math.max(1, Math.ceil(delay / 1000));
      setCopyRemainingSec(initialSec);

      countdownIntervalRef.current = setInterval(() => {
        setCopyRemainingSec((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      ownerCopiedAutoClearTimerRef.current = setTimeout(() => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        liveNumberRef.current = '';
        liveAmountRef.current = '';
        setLocalLiveNumber('');
        setLocalLiveAmount('');
        autoSavedIdRef.current = null;
        setActiveField('number');
        setOwnerCopiedToast(false);
        commitStateChange('', '', sentNumbersRef.current, true);
      }, delay);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      };
    }
  }, [isOpen, remoteState.ownerCopied, remoteState.ownerCopiedAt, commitStateChange]);

  // Instant multi-tab / local broadcast listener
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => {
        const incoming = event.data as RemoteTypeState;
        // If owner explicitly cleared without copying, or if incoming explicitly cleared
        if (incoming && !incoming.liveNumber && liveNumberRef.current && !incoming.ownerCopied) {
          liveNumberRef.current = '';
          liveAmountRef.current = '';
          setLocalLiveNumber('');
          setLocalLiveAmount('');
          autoSavedIdRef.current = null;
          setActiveField('number');
        }
      };
    } catch {}
    return () => {
      try {
        bc?.close();
      } catch {}
    };
  }, [isOpen]);

  // Keep local state synced when external changes arrive
  useEffect(() => {
    if (!isOpen) return;

    const incomingLive = remoteState.liveNumber || '';
    const incomingAmt = remoteState.liveAmount || '';
    const incomingSent = (remoteState.sentNumbers || []).slice(0, MAX_REMOTE_HISTORY_ITEMS);

    if (!incomingLive && liveNumberRef.current && !remoteState.ownerCopied) {
      liveNumberRef.current = '';
      liveAmountRef.current = '';
      setLocalLiveNumber('');
      setLocalLiveAmount('');
      autoSavedIdRef.current = null;
      setActiveField('number');
      return;
    }

    const elapsedSinceLocalKeystroke = Date.now() - lastLocalTypingTimeRef.current;
    if (elapsedSinceLocalKeystroke > 600) {
      if (incomingLive !== liveNumberRef.current) {
        liveNumberRef.current = incomingLive;
        setLocalLiveNumber(incomingLive);
        if (!incomingLive) {
          autoSavedIdRef.current = null;
        }
      }
      if (incomingAmt !== liveAmountRef.current) {
        liveAmountRef.current = incomingAmt;
        setLocalLiveAmount(incomingAmt);
      }
      if (
        incomingSent.length !== sentNumbersRef.current.length ||
        incomingSent[0]?.id !== sentNumbersRef.current[0]?.id
      ) {
        sentNumbersRef.current = incomingSent;
        setLocalSentNumbers(incomingSent);
      }
    }
  }, [isOpen, remoteState]);

  // Stable callbacks for Dialpad
  const handleDigitPress = useCallback(
    (digit: string) => {
      // Dismiss thank-you greeting if active so customer can type next number immediately
      setThankYouGreeting((prev) => {
        if (prev.show) {
          if (greetingTimerRef.current) {
            clearTimeout(greetingTimerRef.current);
            greetingTimerRef.current = null;
          }
          if (greetingIntervalRef.current) {
            clearInterval(greetingIntervalRef.current);
            greetingIntervalRef.current = null;
          }
          setGreetingCountdownSec(0);
          return { show: false, number: '', amount: '', operator: '' };
        }
        return prev;
      });

      if (activeFieldRef.current === 'amount') {
        const curAmt = liveAmountRef.current;
        if (!curAmt && digit === '0') return; // no leading 0
        if (curAmt.length >= 6) return; // max 6 digits

        const nextAmt = curAmt + digit;
        liveAmountRef.current = nextAmt;
        setLocalLiveAmount(nextAmt);
        soundEngine.playDialpadTone(digit, nextAmt.length);

        // Update amount on the auto-saved history item if already recorded!
        let nextSent = sentNumbersRef.current;
        if (autoSavedIdRef.current) {
          nextSent = nextSent.map((item) =>
            item.id === autoSavedIdRef.current ? { ...item, amount: nextAmt } : item
          );
          sentNumbersRef.current = nextSent;
          setLocalSentNumbers(nextSent);
        }
        commitStateChange(liveNumberRef.current, nextAmt, nextSent, false);
        return;
      }

      // activeField === 'number'
      const current = liveNumberRef.current;

      // If 11 digits were already completed and auto-saved, typing a new digit starts a fresh number
      if (current.length >= 11) {
        if (Date.now() - last11CompletedAtRef.current < 350) {
          return;
        }
        autoSavedIdRef.current = null;
        const freshNum = digit;
        liveNumberRef.current = freshNum;
        liveAmountRef.current = '';
        setLocalLiveNumber(freshNum);
        setLocalLiveAmount('');
        setActiveField('number');
        soundEngine.playDialpadTone(digit, 1);
        commitStateChange(freshNum, '', sentNumbersRef.current, false);
        return;
      }

      const nextNum = current + digit;
      liveNumberRef.current = nextNum;
      setLocalLiveNumber(nextNum);
      if (isInvalidOperatorNumber(nextNum)) {
        soundEngine.playPinErrorSound();
      } else {
        soundEngine.playDialpadTone(digit, nextNum.length);
      }

      // When customer completes 11 digits:
      if (nextNum.length === 11) {
        last11CompletedAtRef.current = Date.now();
        const newItem: RemoteTypedNumberItem = {
          id: 'rt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          number: nextNum,
          amount: liveAmountRef.current || '',
          createdAt: new Date().toISOString()
        };
        autoSavedIdRef.current = newItem.id;
        const nextSent = [newItem, ...sentNumbersRef.current].slice(0, MAX_REMOTE_HISTORY_ITEMS);
        sentNumbersRef.current = nextSent;
        setLocalSentNumbers(nextSent);

        // Check if number is in Permanent History -> show top popup!
        const isPerm = (remoteState.permanentNumbers || []).some((p) => p.number === nextNum);
        if (isPerm) {
          setPermanentAlertInfo({ show: true, number: nextNum });
          soundEngine.playSuccessSound();
          setTimeout(() => {
            setPermanentAlertInfo((prev) => ({ ...prev, show: false }));
          }, 4500);
        }

        // Record typed count and auto-promote if typed > 5 & copied > 5
        const { nextState: stateWithStats } = checkAndPromotePermanentNumber(
          nextNum,
          liveAmountRef.current,
          remoteState,
          'typed'
        );

        commitStateChange(
          nextNum,
          liveAmountRef.current,
          nextSent,
          true,
          stateWithStats.permanentNumbers,
          stateWithStats.numberStats
        );
        soundEngine.playIPhoneVerificationSound();

        // Switch to amount card so customer can optionally type the amount
        setActiveField('amount');
      } else {
        commitStateChange(nextNum, liveAmountRef.current, sentNumbersRef.current, false);
      }
    },
    [commitStateChange, remoteState]
  );

  const handleBackspace = useCallback(() => {
    if (activeFieldRef.current === 'amount') {
      const curAmt = liveAmountRef.current;
      if (!curAmt) {
        // If amount is empty, switch back to number
        setActiveField('number');
        return;
      }
      const nextAmt = curAmt.slice(0, -1);
      liveAmountRef.current = nextAmt;
      setLocalLiveAmount(nextAmt);
      soundEngine.playBackspaceSound();

      let nextSent = sentNumbersRef.current;
      if (autoSavedIdRef.current) {
        nextSent = nextSent.map((item) =>
          item.id === autoSavedIdRef.current ? { ...item, amount: nextAmt } : item
        );
        sentNumbersRef.current = nextSent;
        setLocalSentNumbers(nextSent);
      }
      commitStateChange(liveNumberRef.current, nextAmt, nextSent, false);
      return;
    }

    // Number backspace
    const current = liveNumberRef.current;
    if (!current) return;
    const nextNum = current.slice(0, -1);
    liveNumberRef.current = nextNum;
    setLocalLiveNumber(nextNum);
    soundEngine.playBackspaceSound();

    let nextSent = sentNumbersRef.current;
    if (current.length === 11 && autoSavedIdRef.current) {
      const idToRemove = autoSavedIdRef.current;
      autoSavedIdRef.current = null;
      nextSent = sentNumbersRef.current.filter((item) => item.id !== idToRemove);
      sentNumbersRef.current = nextSent;
      setLocalSentNumbers(nextSent);
    }

    commitStateChange(
      nextNum,
      liveAmountRef.current,
      nextSent,
      nextNum.length === 0 || current.length === 11
    );
  }, [commitStateChange]);

  const handleClearNumber = useCallback(() => {
    const current = liveNumberRef.current;
    if (!current) return;
    autoSavedIdRef.current = null;
    liveNumberRef.current = '';
    setLocalLiveNumber('');
    soundEngine.playDeleteSound();
    commitStateChange('', liveAmountRef.current, sentNumbersRef.current, true);
  }, [commitStateChange]);

  const handleClearAmount = useCallback(() => {
    const curAmt = liveAmountRef.current;
    if (!curAmt) return;
    liveAmountRef.current = '';
    setLocalLiveAmount('');
    soundEngine.playDeleteSound();

    let nextSent = sentNumbersRef.current;
    if (autoSavedIdRef.current) {
      nextSent = nextSent.map((item) =>
        item.id === autoSavedIdRef.current ? { ...item, amount: '' } : item
      );
      sentNumbersRef.current = nextSent;
      setLocalSentNumbers(nextSent);
    }
    commitStateChange(liveNumberRef.current, '', nextSent, true);
  }, [commitStateChange]);


  const handleClear = useCallback(() => {
    if (activeFieldRef.current === 'amount' && liveAmountRef.current) {
      handleClearAmount();
    } else {
      handleClearNumber();
    }
  }, [handleClearAmount, handleClearNumber]);

  const handleSendNumber = useCallback(() => {
    const cleanNum = liveNumberRef.current.trim();
    const cleanAmt = liveAmountRef.current.trim();
    if (!cleanNum) return;
    soundEngine.playSuccessSound();

    let nextSent = sentNumbersRef.current;
    // Always preserve in history, with or without amount
    if (!autoSavedIdRef.current && nextSent[0]?.number !== cleanNum) {
      const newItem: RemoteTypedNumberItem = {
        id: 'rt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        number: cleanNum,
        amount: cleanAmt || '',
        createdAt: new Date().toISOString()
      };
      nextSent = [newItem, ...nextSent].slice(0, MAX_REMOTE_HISTORY_ITEMS);
    } else if (autoSavedIdRef.current && cleanAmt) {
      nextSent = nextSent.map((item) =>
        item.id === autoSavedIdRef.current ? { ...item, amount: cleanAmt } : item
      );
    }

    if (cleanNum.length === 11) {
      const isPerm = (remoteState.permanentNumbers || []).some((p) => p.number === cleanNum);
      if (isPerm) {
        setPermanentAlertInfo({ show: true, number: cleanNum });
        setTimeout(() => {
          setPermanentAlertInfo((prev) => ({ ...prev, show: false }));
        }, 4500);
      }
    }

    const { nextState: stateWithStats } = checkAndPromotePermanentNumber(
      cleanNum,
      cleanAmt,
      remoteState,
      'typed'
    );

    autoSavedIdRef.current = null;
    liveNumberRef.current = '';
    liveAmountRef.current = '';
    sentNumbersRef.current = nextSent;
    setLocalLiveNumber('');
    setLocalLiveAmount('');
    setLocalSentNumbers(nextSent);
    setActiveField('number');

    commitStateChange('', '', nextSent, true, stateWithStats.permanentNumbers, stateWithStats.numberStats);
    setJustSentToast(true);
    setTimeout(() => setJustSentToast(false), 1500);

    // Show in-page appreciation & thank you greeting for 10 seconds
    // User requested:
    // "শুভেচ্ছা আলাদা পপ আপে শো না হয়ে,একই পেইজে উপরে খালি জায়গায় টুকু কাজে লাগাও প্রয়োজনে চার কোনা বর্ডার বড় করো।"
    // "লক্ষ রাখবে সেন্ড বাটনে ক্লিক করার পর শুভেচ্ছা জানাবে, লিখা গুলি 10s স্ক্রিনে থাকবে, 10s পর স্ক্রিন আবার ক্লিন হয়ে যাবে।"
    // "ধন্যবাদ আবার আসবেন, হবে।"
    const opBadge = getOperatorBadge(cleanNum, lang);
    setThankYouGreeting({
      show: true,
      number: cleanNum,
      amount: cleanAmt,
      operator: opBadge?.name
    });
    setGreetingCountdownSec(10);

    if (greetingTimerRef.current) {
      clearTimeout(greetingTimerRef.current);
    }
    if (greetingIntervalRef.current) {
      clearInterval(greetingIntervalRef.current);
    }

    greetingIntervalRef.current = setInterval(() => {
      setGreetingCountdownSec((prev) => {
        if (prev <= 1) {
          if (greetingIntervalRef.current) {
            clearInterval(greetingIntervalRef.current);
            greetingIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    greetingTimerRef.current = setTimeout(() => {
      setThankYouGreeting({ show: false, number: '', amount: '', operator: '' });
      setGreetingCountdownSec(0);
      if (greetingIntervalRef.current) {
        clearInterval(greetingIntervalRef.current);
        greetingIntervalRef.current = null;
      }
    }, 10000);
  }, [commitStateChange, remoteState, lang]);

  const handleCloseModal = useCallback(() => {
    if (parentSyncTimerRef.current) {
      clearTimeout(parentSyncTimerRef.current);
      parentSyncTimerRef.current = null;
    }
    if (greetingTimerRef.current) {
      clearTimeout(greetingTimerRef.current);
      greetingTimerRef.current = null;
    }
    if (greetingIntervalRef.current) {
      clearInterval(greetingIntervalRef.current);
      greetingIntervalRef.current = null;
    }
    const finalState: RemoteTypeState = {
      liveNumber: liveNumberRef.current,
      liveAmount: liveAmountRef.current,
      isTyping: liveNumberRef.current.length > 0 || liveAmountRef.current.length > 0,
      isRotated: Boolean(remoteState.isRotated),
      sentNumbers: sentNumbersRef.current.slice(0, MAX_REMOTE_HISTORY_ITEMS),
      permanentNumbers: (remoteState.permanentNumbers || []).slice(0, MAX_PERMANENT_HISTORY_ITEMS),
      numberStats: remoteState.numberStats || {},
      updatedAt: new Date().toISOString()
    };
    syncRemoteTypeStateInstant(finalState, true);
    onUpdateRemoteStateRef.current(finalState);
    onClose();
  }, [onClose, remoteState]);

  // Physical keyboard support
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (liveNumberRef.current.trim().length > 0) {
          handleSendNumber();
        }
      } else if (e.key === 'Escape') {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigitPress, handleBackspace, handleSendNumber, handleCloseModal]);

  if (!isOpen) return null;

  const isElevenDigits = localLiveNumber.length === 11;
  const isInvalidOperator = isInvalidOperatorNumber(localLiveNumber);
  const isRotated = Boolean(remoteState.isRotated);
  const liveOpBadge = getOperatorBadge(localLiveNumber, lang);

  return (
    <div
      className={`fixed inset-0 z-[10002] w-full h-[100dvh] bg-[#0B0F1A] text-white flex flex-col justify-between overflow-hidden font-sans select-none touch-manipulation transition-transform duration-500 ease-in-out ${
        isRotated ? 'rotate-180' : 'rotate-0'
      }`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 10% 10%, rgba(147, 51, 234, 0.18), transparent 45%), radial-gradient(circle at 90% 35%, rgba(79, 70, 229, 0.15), transparent 45%), radial-gradient(circle at 30% 95%, rgba(16, 185, 129, 0.12), transparent 45%)'
      }}
    >


      {/* PERMANENT NUMBER TOP POPUP (একদম উপরে পপ আপ) */}
      {permanentAlertInfo.show && (
        <div className="fixed top-2.5 inset-x-3 z-[10005] max-w-md mx-auto bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-3 rounded-2xl shadow-2xl border-2 border-emerald-300 animate-in slide-in-from-top-4 duration-300 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-black text-white leading-tight">
                {lang === 'bn' ? 'নাম্বারটি আমাদের কাছে আগে থেকে আছে, ধন্যবাদ।' : 'This number is already saved with us, thank you.'}
              </p>
              <p className="text-[10.5px] font-mono text-emerald-100 font-bold truncate mt-0.5">
                {permanentAlertInfo.number}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPermanentAlertInfo({ show: false, number: '' })}
            className="w-7 h-7 rounded-xl bg-black/20 hover:bg-black/30 flex items-center justify-center text-white shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Responsive Fullscreen Container */}
      <div className="relative z-10 w-full max-w-md mx-auto h-full flex flex-col justify-between px-3 pt-2 pb-3 sm:py-4">
        
        {/* TOP HEADER: Back Button + Operator Badge */}
        <div className="shrink-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161E31] hover:bg-[#1E2942] active:scale-95 border border-white/15 text-white text-xs font-bold transition-transform duration-75 cursor-pointer touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 text-purple-300" />
              <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
            </button>

            {/* OPERATOR BADGE (কার্ডের উপরে সুন্দরভাবে সাজানো) */}
            <div>
              {thankYouGreeting.show ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-400/80 bg-amber-500/25 text-amber-200 text-[11px] font-black tracking-wide animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.35)]">
                  <Heart className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>{lang === 'bn' ? 'ধন্যবাদ, আবার আসবেন' : 'Thank You!'}</span>
                </div>
              ) : liveOpBadge ? (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-black tracking-wide animate-in fade-in zoom-in-95 duration-150 ${liveOpBadge.darkColor}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  <span>{liveOpBadge.name}</span>
                </div>
              ) : isInvalidOperator ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-rose-500/70 bg-rose-500/20 text-rose-300 text-[11px] font-black tracking-wide animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.35)]">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />
                  <span>{lang === 'bn' ? 'সঠিক অপারেটর নয়' : 'Invalid Operator'}</span>
                </div>
              ) : (
                <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Radio className="w-3 h-3 text-purple-400" />
                  <span>{lang === 'bn' ? 'অপারেটর নির্ধারণ' : 'Operator'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Minimal Toast Status Notifications */}
          {ownerCopiedToast ? (
            <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-emerald-500/25 border border-emerald-400/60 text-emerald-200 text-xs font-bold animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {lang === 'bn' ? 'উইনার নম্বরটি গ্রহণ করেছেন ✓' : 'Number received by winner ✓'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-400/40">
                {lang === 'bn' ? `${formatDigits(copyRemainingSec, lang)} সে.` : `${copyRemainingSec}s`}
              </span>
            </div>
          ) : justSentToast ? (
            <div className="flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[11px] font-black animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {lang === 'bn' ? 'নম্বর পাঠানো হয়েছে!' : 'Number sent successfully!'}
              </span>
            </div>
          ) : null}
        </div>

        {/* BUTTON PHONE MAIN DISPLAY FRAME (চার কোনা বর্ডার - চার কোণায় নিখুঁত ফ্রেম ও স্কয়ার কার্ড; প্রয়োজনে বড় করা হয়েছে) */}
        <div className={`relative flex-1 my-1.5 rounded-lg border-2 p-2.5 sm:p-3 flex flex-col justify-between min-h-[210px] xs:min-h-[230px] sm:min-h-[250px] max-h-[295px] transition-all duration-200 ${
          thankYouGreeting.show
            ? 'border-amber-400 ring-2 ring-amber-400/50 bg-[#120F08] shadow-[0_0_28px_rgba(245,158,11,0.35),inset_0_2px_12px_rgba(0,0,0,0.9)]'
            : isInvalidOperator
            ? 'border-rose-500 ring-2 ring-rose-500/50 bg-[#160608] shadow-[0_0_25px_rgba(244,63,94,0.45),inset_0_2px_12px_rgba(0,0,0,0.9)]'
            : isElevenDigits
            ? 'border-emerald-400/90 ring-2 ring-emerald-400/40 bg-[#041510] shadow-[0_0_20px_rgba(16,185,129,0.3),inset_0_2px_12px_rgba(0,0,0,0.9)]'
            : 'border-cyan-400/80 bg-[#070C16] shadow-[0_0_20px_rgba(6,182,212,0.22),inset_0_2px_12px_rgba(0,0,0,0.9)]'
        }`}>
          {/* Decorative Sharp Four-Corner L-Accents (চার কোনা বর্ডার হাইলাইট) */}
          <span className={`absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 pointer-events-none transition-colors duration-200 ${
            thankYouGreeting.show ? 'border-amber-300 animate-pulse' : isInvalidOperator ? 'border-rose-400 animate-pulse' : isElevenDigits ? 'border-emerald-300' : 'border-cyan-300'
          }`} />
          <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 pointer-events-none transition-colors duration-200 ${
            thankYouGreeting.show ? 'border-amber-300 animate-pulse' : isInvalidOperator ? 'border-rose-400 animate-pulse' : isElevenDigits ? 'border-emerald-300' : 'border-cyan-300'
          }`} />
          <span className={`absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 pointer-events-none transition-colors duration-200 ${
            thankYouGreeting.show ? 'border-amber-300 animate-pulse' : isInvalidOperator ? 'border-rose-400 animate-pulse' : isElevenDigits ? 'border-emerald-300' : 'border-cyan-300'
          }`} />
          <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 pointer-events-none transition-colors duration-200 ${
            thankYouGreeting.show ? 'border-amber-300 animate-pulse' : isInvalidOperator ? 'border-rose-400 animate-pulse' : isElevenDigits ? 'border-emerald-300' : 'border-cyan-300'
          }`} />

          {/* ১. চার কোনা বর্ডারের শীর্ষে: সেন্ড বাটনে ক্লিক করার পর শুভেচ্ছা (১০ সেকেন্ড থাকবে), অপারেটর ওয়ার্নিং অথবা ১১ ডিজিট প্রিভিউ */}
          <div className="min-h-[52px] flex items-center justify-center w-full">
            {thankYouGreeting.show ? (
              <div className="w-full py-2 px-3 rounded-md bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border-2 border-amber-400/90 shadow-[0_0_25px_rgba(245,158,11,0.35)] flex flex-col items-center justify-center text-center animate-in zoom-in-95 fade-in duration-200">
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center shadow-md">
                      <Heart className="w-3 h-3 text-slate-950 fill-slate-950" />
                    </span>
                    <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider">
                      {lang === 'bn' ? 'হ্যালো পয়েন্ট' : 'Hello Point'}
                    </span>
                  </div>
                  {/* 10s countdown indicator badge */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/25 border border-amber-400/50 text-amber-200 text-[10px] font-mono font-bold animate-pulse">
                    <span>⏱️</span>
                    <span>
                      {lang === 'bn' ? `${formatDigits(greetingCountdownSec, lang)} সেকেন্ড` : `${greetingCountdownSec}s`}
                    </span>
                  </div>
                </div>

                {/* User requested greeting text: ধন্যবাদ আবার আসবেন / হ্যালো পয়েন্ট এর সাথে থাকার জন্য ধন্যবাদ, আবার আসবেন। */}
                <p className="text-xs sm:text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 leading-snug">
                  {lang === 'bn'
                    ? 'হ্যালো পয়েন্ট এর সাথে থাকার জন্য ধন্যবাদ, আবার আসবেন।'
                    : 'Thank you for being with Hello Point, please visit again.'}
                </p>

                {/* Sent Number & Operator Badges */}
                <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="font-mono text-xs font-black text-emerald-300 bg-emerald-950/80 border border-emerald-400/50 px-2 py-0.5 rounded tracking-wider">
                    {thankYouGreeting.number}
                  </span>
                  {thankYouGreeting.operator && (
                    <span className="text-[9.5px] font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-400/40 px-1.5 py-0.5 rounded">
                      {thankYouGreeting.operator}
                    </span>
                  )}
                  {thankYouGreeting.amount && (
                    <span className="text-[9.5px] font-bold text-amber-300 bg-amber-950/70 border border-amber-400/40 px-1.5 py-0.5 rounded">
                      ৳{formatDigits(thankYouGreeting.amount, lang)}
                    </span>
                  )}
                </div>
              </div>
            ) : isInvalidOperator ? (
              <div className="w-full py-1.5 px-3 rounded-md bg-[#2B0A0E] border-2 border-rose-500/90 shadow-[0_0_18px_rgba(244,63,94,0.4)] flex items-center justify-center gap-2 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 stroke-[2.5]" />
                <div className="text-center min-w-0">
                  <span className="font-black text-xs sm:text-sm text-rose-200 block leading-tight">
                    {lang === 'bn' ? 'সঠিক অপারেটরের নম্বর দিন!' : 'Enter valid operator number!'}
                  </span>
                  <span className="text-[10px] font-mono text-rose-300/90 block mt-0.5 font-bold">
                    {lang === 'bn' ? 'সঠিক কোড: ০১৩, ০১৭, ০১৮, ০১৬, ০১৯, ০১৫' : 'Valid codes: 013, 017, 018, 016, 019, 015'}
                  </span>
                </div>
              </div>
            ) : isElevenDigits ? (
              <div className="w-full py-1.5 px-3 rounded-md bg-[#062419] border-2 border-emerald-400/90 shadow-[0_0_18px_rgba(16,185,129,0.35)] flex flex-col items-center justify-center animate-in zoom-in-95 duration-150">
                <div className="flex items-center gap-1 text-emerald-300 text-[10px] font-black tracking-wider uppercase mb-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{lang === 'bn' ? 'নম্বরটি এক নজরে মিলিয়ে নিন' : 'Verify Number'}</span>
                </div>
                <div className="font-mono text-2xl xs:text-3xl font-black text-emerald-300 tracking-wider select-all">
                  {localLiveNumber}
                </div>
              </div>
            ) : null}
          </div>

          {/* ২. চার কোনা বর্ডারের মাঝে: নম্বর এবং টাকার পরিমাণ তোলার কার্ড + সেন্ড বাটন */}
          <div className="w-full my-auto">
            <div className="flex items-stretch gap-1.5 sm:gap-2">
              {/* NUMBER CARD - চার কোনা কার্ড + সম্পূর্ণ নম্বর দৃশ্যমান + কালার গ্রেডিং */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setActiveField('number')}
                className={`flex-1 min-w-0 rounded-md border-2 px-2.5 sm:px-3 py-2 sm:py-2.5 flex items-center justify-between transition-all duration-150 cursor-pointer select-none shadow-[inset_0_2px_6px_rgba(0,0,0,0.85)] ${
                  isInvalidOperator
                    ? 'border-rose-500 ring-2 ring-rose-500/70 bg-[#22070A] shadow-[inset_0_2px_6px_rgba(0,0,0,0.85),0_0_15px_rgba(244,63,94,0.45)]'
                    : activeField === 'number' && !isElevenDigits
                    ? 'border-cyan-400 ring-2 ring-cyan-400/60 shadow-[inset_0_2px_6px_rgba(0,0,0,0.85),0_0_15px_rgba(6,182,212,0.4)] bg-[#04151F]'
                    : isElevenDigits
                    ? 'border-emerald-400 ring-2 ring-emerald-400/70 shadow-[inset_0_2px_6px_rgba(0,0,0,0.85),0_0_16px_rgba(16,185,129,0.5)] bg-[#051C14]'
                    : 'border-slate-700 hover:border-slate-600 bg-[#070C14]'
                }`}
              >
                <div className="font-mono text-[16px] xs:text-[18px] sm:text-xl font-bold tracking-tight text-white flex items-center min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap">
                  {localLiveNumber ? (
                    <>
                      <span className={
                        isInvalidOperator
                          ? 'text-rose-300 font-black'
                          : isElevenDigits
                          ? 'text-emerald-300 font-black'
                          : activeField === 'number'
                          ? 'text-cyan-200 font-black'
                          : 'text-slate-100 font-bold'
                      }>
                        {localLiveNumber}
                      </span>
                      {activeField === 'number' && !isElevenDigits && (
                        <span className={`inline-block font-mono font-black ml-0.5 animate-pulse leading-none ${
                          isInvalidOperator ? 'text-rose-400' : 'text-cyan-400'
                        }`}>
                          _
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-600 text-xs sm:text-sm font-mono font-bold flex items-center">
                      {lang === 'bn' ? 'নম্বর লিখুন' : 'Enter Number'}
                      {activeField === 'number' && (
                        <span className="inline-block text-cyan-400 font-mono font-bold ml-1 animate-pulse leading-none">
                          _
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {isInvalidOperator && (
                    <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-400/80 flex items-center justify-center text-rose-300 animate-pulse shrink-0" title={lang === 'bn' ? 'ভুল অপারেটর' : 'Invalid operator'}>
                      <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  )}

                  {!isInvalidOperator && isElevenDigits && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 animate-in zoom-in-75 shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  {localLiveNumber && (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        handleClearNumber();
                      }}
                      className="w-5 h-5 rounded-none bg-slate-800/90 hover:bg-rose-500/50 text-slate-300 hover:text-rose-200 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                      title={lang === 'bn' ? 'মুছে ফেলুন' : 'Clear'}
                    >
                      <X className="w-3.5 h-3.5 pointer-events-none" />
                    </button>
                  )}
                </div>
              </div>

              {/* AMOUNT CARD - চার কোনা কার্ড + কালার গ্রেডিং */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setActiveField('amount')}
                className={`w-24 sm:w-32 rounded-md border-2 px-2 sm:px-2.5 py-2 sm:py-2.5 flex items-center justify-between transition-all duration-150 cursor-pointer select-none shrink-0 bg-[#070C14] shadow-[inset_0_2px_6px_rgba(0,0,0,0.85)] ${
                  activeField === 'amount'
                    ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-[inset_0_2px_6px_rgba(0,0,0,0.85),0_0_15px_rgba(245,158,11,0.4)] bg-[#1A1204]'
                    : localLiveAmount
                    ? 'border-amber-500/70 bg-[#140F06]'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="font-mono text-sm sm:text-lg font-black tracking-tight text-amber-300 flex items-center min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap">
                  {localLiveAmount ? (
                    <>
                      <span className="truncate">৳{formatDigits(localLiveAmount, lang)}</span>
                      {activeField === 'amount' && (
                        <span className="inline-block text-amber-400 font-mono font-black ml-0.5 animate-pulse leading-none">
                          _
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-600 text-xs sm:text-sm font-mono font-bold flex items-center">
                      ৳ {lang === 'bn' ? 'টাকা' : 'Tk'}
                      {activeField === 'amount' && (
                        <span className="inline-block text-amber-400 font-mono font-bold ml-0.5 animate-pulse leading-none">
                          _
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {localLiveAmount && (
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleClearAmount();
                    }}
                    className="w-5 h-5 rounded-none bg-slate-800/90 hover:bg-rose-500/50 text-slate-300 hover:text-rose-200 flex items-center justify-center shrink-0 ml-1 transition-colors cursor-pointer"
                    title={lang === 'bn' ? 'বাদ দিন' : 'Clear'}
                  >
                    <X className="w-3.5 h-3.5 pointer-events-none" />
                  </button>
                )}
              </div>

              {/* SEND BUTTON - চার কোনা বাটন */}
              <button
                type="button"
                onPointerDown={(e) => {
                  if (!localLiveNumber.trim() || isInvalidOperator) return;
                  e.preventDefault();
                  handleSendNumber();
                }}
                disabled={!localLiveNumber.trim() || isInvalidOperator}
                className={`w-12 sm:w-14 rounded-md border-2 flex items-center justify-center transition-all duration-75 transform-gpu shrink-0 active:scale-95 touch-manipulation shadow-md ${
                  isInvalidOperator
                    ? 'bg-[#25080B] border-rose-500/70 text-rose-400 cursor-not-allowed opacity-80'
                    : isElevenDigits
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-300 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] ring-1 ring-emerald-300 cursor-pointer'
                    : localLiveNumber.trim().length > 0
                    ? 'bg-[#151C2F] hover:bg-cyan-600 border-cyan-400 text-cyan-200 shadow-md cursor-pointer'
                    : 'bg-[#070C14] text-slate-700 border-slate-800 cursor-not-allowed'
                }`}
                title={isInvalidOperator ? (lang === 'bn' ? 'অপারেটর সঠিক নয়' : 'Invalid operator') : (lang === 'bn' ? 'পাঠিয়ে দিন' : 'Send')}
              >
                {isInvalidOperator ? (
                  <AlertTriangle className="w-5 h-5 text-rose-400 pointer-events-none" />
                ) : (
                  <Send className="w-5 h-5 pointer-events-none" />
                )}
              </button>
            </div>
          </div>

          {/* ৩. চার কোনা বর্ডারের নিচে: কীবোর্ডের ঠিক উপরে ১১টি ডট ("১১ ডট কীবোর্ডের টিক উপরে থাকবে") */}
          <div className="flex items-center justify-center pt-1 shrink-0">
            <ElevenRoundDotsIndicator
              count={localLiveNumber.length}
              isElevenDigits={isElevenDigits}
              isInvalidOperator={isInvalidOperator}
            />
          </div>
        </div>

        {/* ৪. কিবোর্ড আরও একটু বড় ("কিবোর্ড আরও একটু বড় করতে হবে") */}
        <div className="w-full shrink-0">
          <TactileDialpadGrid
            lang={lang}
            onDigit={handleDigitPress}
            onClear={handleClear}
            onBackspace={handleBackspace}
          />
        </div>
      </div>
    </div>
  );
}

interface OwnerRemoteTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'bn' | 'en';
  remoteState: RemoteTypeState;
  onClearLiveNumber: () => void;
  onDeleteSentNumber: (id: string) => void;
  onClearAllSentNumbers: () => void;
  onToggleRotate?: () => void;
}

export function OwnerRemoteTypeModal({
  isOpen,
  onClose,
  lang,
  remoteState,
  onClearLiveNumber,
  onDeleteSentNumber,
  onClearAllSentNumbers,
  onToggleRotate
}: OwnerRemoteTypeModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyAutoClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyAutoClearTimerRef.current) {
        clearTimeout(copyAutoClearTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const liveNumber = remoteState.liveNumber || '';
  const liveAmount = remoteState.liveAmount || '';
  const sentNumbers = (remoteState.sentNumbers || []).slice(0, MAX_REMOTE_HISTORY_ITEMS);
  const permanentNumbers = (remoteState.permanentNumbers || []).slice(0, MAX_PERMANENT_HISTORY_ITEMS);
  const isElevenDigits = liveNumber.length === 11;
  const isInvalidOperator = isInvalidOperatorNumber(liveNumber);
  const liveOpBadge = getOperatorBadge(liveNumber, lang);
  const isRotated = Boolean(remoteState.isRotated);

  const handleToggleRotate = () => {
    soundEngine.playSuccessSound();
    if (onToggleRotate) {
      onToggleRotate();
    } else {
      const nextState: RemoteTypeState = {
        ...remoteState,
        isRotated: !isRotated,
        updatedAt: new Date().toISOString()
      };
      syncRemoteTypeStateInstant(nextState, true);
    }
  };

  const handleCopy = async (text: string, idKey: string, cleanNum?: string, amount?: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      soundEngine.playSuccessSound();
      setCopiedId(idKey);

      let stateToSync: RemoteTypeState = { ...remoteState };

      // User requested: "উইনার নাম্বার কপি করলে ভিউয়ার কার্ড থেকে সাথে সাথে নাম্বার চলে যায়, সেটি ১মিনিট পর অটোমেটিক ভাবে চলে যাবে।"
      // Do NOT clear immediately! Send ownerCopied notification and schedule clear after 1 minute (60,000ms).
      const isLiveNumberCopy = idKey === 'live' || idKey === 'live-num' || (Boolean(cleanNum) && cleanNum === liveNumber);
      if (isLiveNumberCopy) {
        stateToSync = {
          ...stateToSync,
          ownerCopied: true,
          ownerCopiedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (copyAutoClearTimerRef.current) {
          clearTimeout(copyAutoClearTimerRef.current);
        }
        copyAutoClearTimerRef.current = setTimeout(() => {
          onClearLiveNumber();
        }, 60000);
      }

      setTimeout(() => {
        setCopiedId((prev) => (prev === idKey ? null : prev));
      }, 1500);

      // Record 'copied' stat for winner copying an 11-digit number
      const targetDigits = (cleanNum || text).replace(/\D/g, '');
      if (targetDigits.length === 11) {
        const { nextState } = checkAndPromotePermanentNumber(
          targetDigits,
          amount || liveAmount,
          stateToSync,
          'copied'
        );
        stateToSync = nextState;
      }

      syncRemoteTypeStateInstant(stateToSync, true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10002] w-full h-[100dvh] bg-[#0B0F1A] text-white flex flex-col justify-between overflow-hidden font-sans select-none"
      style={{
        backgroundImage:
          'radial-gradient(circle at 10% 10%, rgba(147, 51, 234, 0.18), transparent 45%), radial-gradient(circle at 90% 35%, rgba(79, 70, 229, 0.15), transparent 45%), radial-gradient(circle at 30% 95%, rgba(16, 185, 129, 0.12), transparent 45%)'
      }}
    >
      {/* Main Full-Page Container with vertical scroll support */}
      <div className="relative z-10 w-full max-w-md mx-auto h-full flex flex-col px-3 pt-3 pb-5 overflow-y-auto no-scrollbar space-y-2.5">
        
        {/* 1. Top Navigation Header - Rotate Button */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#161E31] hover:bg-[#1E2942] active:scale-95 border border-white/15 text-white text-xs font-bold transition-transform duration-75 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-purple-300" />
            <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* ROTATE VIEWER BUTTON (উল্টান / সুজা করুন) */}
            <button
              type="button"
              onClick={handleToggleRotate}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-2xl text-xs font-black transition-all duration-150 cursor-pointer active:scale-95 shadow-md ${
                isRotated
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.45)]'
                  : 'bg-[#161E31] hover:bg-[#1E2942] border border-white/20 text-purple-200 hover:text-white'
              }`}
              title={
                isRotated
                  ? (lang === 'bn' ? 'ভিউয়ার ডিসপ্লে সুজা করুন (০°)' : 'Straighten Viewer Display (0°)')
                  : (lang === 'bn' ? 'ভিউয়ার ডিসপ্লে উল্টান (১৮০°)' : 'Invert/Rotate Viewer Display (180°)')
              }
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRotated ? 'rotate-180 text-slate-950' : 'text-amber-400'}`} />
              <span>
                {isRotated
                  ? (lang === 'bn' ? 'স্ক্রিন সুজা করুন' : 'Straighten (0°)')
                  : (lang === 'bn' ? 'স্ক্রিন উল্টান' : 'Rotate (180°)')}
              </span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[10px] font-black tracking-wider text-emerald-300 uppercase">
                {lang === 'bn' ? 'মনিটর' : 'MONITOR'}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-xl bg-[#161E31] hover:bg-[#1E2942] border border-white/15 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ROTATED VIEWER ACTIVE STATUS BANNER */}
        {isRotated && (
          <div className="px-3 py-1.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-between text-amber-200 text-xs font-bold shrink-0 animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {lang === 'bn'
                  ? '🔄 ভিউয়ার ডিসপ্লে বর্তমানে ১৮০° উল্টানো আছে'
                  : '🔄 Viewer display is inverted (180°)'}
              </span>
            </span>
            <button
              type="button"
              onClick={handleToggleRotate}
              className="px-2 py-0.5 rounded-xl bg-amber-400 text-slate-950 font-black text-[10px] hover:bg-amber-300 cursor-pointer shadow-sm active:scale-95"
            >
              {lang === 'bn' ? 'সুজা করুন' : 'Straighten'}
            </button>
          </div>
        )}

        {/* 2. LIVE TYPING DISPLAY SECTION */}
        <div className="space-y-2 shrink-0 bg-[#121829] border border-white/10 rounded-3xl p-3 shadow-xl">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio
                  className={`w-3.5 h-3.5 ${
                    liveNumber ? 'text-emerald-400 animate-pulse' : 'text-purple-400'
                  }`}
                />
                {lang === 'bn' ? 'কাস্টমার Air Typing লাইভ' : 'CUSTOMER AIR TYPING LIVE'}
              </span>
              {liveOpBadge ? (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${liveOpBadge.darkColor}`}>
                  {liveOpBadge.name}
                </span>
              ) : isInvalidOperator ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full border border-rose-500/70 bg-rose-500/20 text-rose-300 animate-pulse flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {lang === 'bn' ? 'ভুল অপারেটর' : 'Invalid Operator'}
                </span>
              ) : null}
            </div>

            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border transition-colors ${
                isInvalidOperator
                  ? 'bg-rose-500/25 text-rose-300 border-rose-400/50'
                  : isElevenDigits
                  ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : liveNumber.length > 11
                  ? 'bg-amber-500/25 text-amber-300 border-amber-400/50'
                  : 'bg-white/10 text-slate-300 border-white/15'
              }`}
            >
              {formatDigits(liveNumber.length, lang)}/{formatDigits(11, lang)}{' '}
              {lang === 'bn' ? 'ডিজিট' : 'Digits'}
              {isElevenDigits && !isInvalidOperator && ' ✓'}
            </span>
          </div>

          {/* 11 Round Glowing Circles Indicator */}
          <ElevenRoundDotsIndicator
            count={liveNumber.length}
            isElevenDigits={isElevenDigits}
            isInvalidOperator={isInvalidOperator}
          />

          {/* Live Number & Amount Boxes + Copy Buttons */}
          <div className="flex items-stretch gap-2 pt-0.5">
            {/* Number Box */}
            <div
              className={`flex-1 min-w-0 rounded-2xl border-2 px-3 py-2 min-h-[46px] flex items-center justify-between transition-colors ${
                isInvalidOperator
                  ? 'bg-[#22070A] border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                  : isElevenDigits
                  ? 'bg-[#0D2824] border-emerald-400/85 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : liveNumber
                  ? 'bg-[#171E33] border-purple-400/70 shadow-[0_0_16px_rgba(168,85,247,0.15)]'
                  : 'bg-[#0E1422] border-white/15'
              }`}
            >
              <div className="min-w-0 flex-1 flex items-center overflow-hidden">
                {liveNumber ? (
                  <div className="font-mono text-base sm:text-lg font-black tracking-wide text-white flex items-center min-w-0">
                    <span className="whitespace-nowrap">{liveNumber}</span>
                    <span className="inline-block text-base sm:text-lg font-sans font-black text-amber-400 ml-0.5 animate-bounce leading-none shrink-0 select-none">
                      ।
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center py-0.5">
                    <span className="text-slate-500 text-xs font-semibold mr-1">
                      {lang === 'bn' ? 'অপেক্ষা করছে' : 'Waiting...'}
                    </span>
                    <span className="inline-block text-lg sm:text-xl font-black text-emerald-400 animate-bounce leading-none select-none">
                      ।
                    </span>
                  </div>
                )}
              </div>

              {liveNumber && (
                <button
                  type="button"
                  onClick={onClearLiveNumber}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-rose-500/30 text-slate-300 hover:text-rose-200 flex items-center justify-center shrink-0 ml-1.5 transition-colors cursor-pointer"
                  title={lang === 'bn' ? 'মুছুন' : 'Clear'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Amount Box (if customer typed amount) */}
            {liveAmount && (
              <div className="w-24 sm:w-28 rounded-2xl border-2 border-emerald-400/70 bg-[#0D2824] px-2.5 py-1.5 flex flex-col justify-center shrink-0">
                <span className="text-[8.5px] font-black uppercase text-emerald-300/80">
                  {lang === 'bn' ? 'টাকার পরিমাণ' : 'Amount'}
                </span>
                <span className="font-mono text-sm sm:text-base font-black text-emerald-300 truncate">
                  ৳{formatDigits(liveAmount, lang)}
                </span>
              </div>
            )}

            {/* COPY BUTTONS */}
            <div className="flex flex-col gap-1 shrink-0">
              <button
                type="button"
                disabled={!liveNumber}
                onClick={() => handleCopy(liveNumber, 'live-num', liveNumber, liveAmount)}
                className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-transform duration-75 cursor-pointer active:scale-95 ${
                  copiedId === 'live-num'
                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950'
                    : isElevenDigits
                    ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-slate-950 shadow-md ring-1 ring-emerald-300'
                    : liveNumber
                    ? 'bg-purple-600 text-white hover:bg-purple-500'
                    : 'bg-[#13192B] text-slate-500 border border-white/10 cursor-not-allowed'
                }`}
                title={lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy Number'}
              >
                {copiedId === 'live-num' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-black">
                  {copiedId === 'live-num' ? (lang === 'bn' ? 'কপিড' : 'Copied') : (lang === 'bn' ? 'নম্বর কপি' : 'Copy')}
                </span>
              </button>

              {liveAmount && (
                <button
                  type="button"
                  onClick={() => handleCopy(liveAmount, 'live-amt')}
                  className="px-2.5 py-1 rounded-lg font-black text-[10px] bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 flex items-center justify-center gap-0.5 cursor-pointer"
                  title={lang === 'bn' ? 'টাকা কপি করুন' : 'Copy Amount'}
                >
                  {copiedId === 'live-amt' ? <Check className="w-3 h-3" /> : <span>৳</span>}
                  <span>{copiedId === 'live-amt' ? 'কপিড' : `${lang === 'bn' ? 'টাকা কপি' : 'Copy ৳'}`}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. RECEIVED SENT NUMBERS HISTORY SECTION (১৫টি রিসেন্ট হিস্ট্রি) */}
        <div className="shrink-0 bg-[#121829] border border-white/10 rounded-3xl p-3 shadow-lg">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 shrink-0">
            <span className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-purple-400" />
              {lang === 'bn'
                ? `রিসেন্ট হিস্ট্রি (${formatDigits(sentNumbers.length, lang)}/${formatDigits(MAX_REMOTE_HISTORY_ITEMS, lang)}টি)`
                : `Recent History (${sentNumbers.length}/${MAX_REMOTE_HISTORY_ITEMS})`}
            </span>

            {sentNumbers.length > 0 && (
              <button
                type="button"
                onClick={onClearAllSentNumbers}
                className="text-[10px] font-black text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/35 px-2.5 py-1 rounded-xl border border-rose-400/30 flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3 h-3" />
                <span>{lang === 'bn' ? 'সব মুছুন' : 'Clear All'}</span>
              </button>
            )}
          </div>

          {sentNumbers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 p-4 text-center">
              <div className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 text-purple-400">
                <Smartphone className="w-4 h-4 opacity-70" />
              </div>
              <p className="text-xs font-bold text-slate-400 max-w-xs leading-relaxed">
                {lang === 'bn'
                  ? 'কাস্টমার নম্বর তুললেই এখানে রিসেন্ট হিস্ট্রিতে জমা হবে (সর্বোচ্চ ১৫টি)'
                  : 'Numbers typed by customers will appear in recent history (up to 15)'}
              </p>
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
              {sentNumbers.map((item) => {
                const isNumCopied = copiedId === `num-${item.id}`;
                const isAmtCopied = copiedId === `amt-${item.id}`;
                const is11 = item.number.length === 11;
                const opBadge = getOperatorBadge(item.number, lang);

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-3 py-1.5 flex items-center justify-between gap-2 ${
                      is11
                        ? 'bg-[#0D2824]/80 border-emerald-400/35'
                        : 'bg-[#171F34] border-white/15'
                    }`}
                  >
                    {/* Number and Amount Badge */}
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <span className="font-mono text-xs sm:text-sm font-black text-white tracking-wider truncate">
                        {item.number}
                      </span>
                      {opBadge && (
                        <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded border shrink-0 ${opBadge.darkColor}`}>
                          {opBadge.name}
                        </span>
                      )}
                      {item.amount ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shrink-0">
                          ৳{formatDigits(item.amount, lang)}
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-500 shrink-0">
                          {lang === 'bn' ? '(টাকা ছাড়া)' : '(No amt)'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Copy Number */}
                      <button
                        type="button"
                        onClick={() => handleCopy(item.number, `num-${item.id}`, item.number, item.amount)}
                        className={`px-2.5 py-1 rounded-lg font-black text-[10px] flex items-center gap-1 transition-transform duration-75 cursor-pointer active:scale-95 ${
                          isNumCopied
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white border border-purple-400/30'
                        }`}
                        title={lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy Number'}
                      >
                        {isNumCopied ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>{lang === 'bn' ? 'কপিড' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                          </>
                        )}
                      </button>

                      {/* Copy Amount if present */}
                      {item.amount && (
                        <button
                          type="button"
                          onClick={() => handleCopy(item.amount!, `amt-${item.id}`)}
                          className="px-2 py-1 rounded-lg font-black text-[10px] bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/30 flex items-center gap-0.5 cursor-pointer"
                          title={lang === 'bn' ? 'টাকা কপি করুন' : 'Copy Amount'}
                        >
                          {isAmtCopied ? <Check className="w-3 h-3" /> : <span>৳</span>}
                          <span>{isAmtCopied ? (lang === 'bn' ? 'কপিড' : 'Copied') : (lang === 'bn' ? 'টাকা' : 'Amt')}</span>
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => onDeleteSentNumber(item.id)}
                        className="w-6 h-6 rounded-lg bg-white/10 hover:bg-rose-500/30 text-slate-300 hover:text-rose-200 flex items-center justify-center transition-colors cursor-pointer"
                        title={lang === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. PERMANENT NUMBERS HISTORY (১৫টি হিস্ট্রির নিচে ১০০টি পার্মানেন্ট হিস্ট্রি - উইনার ডিলিট করতে পারবে না) */}
        <div className="shrink-0 bg-[#121829] border border-amber-500/30 rounded-3xl p-3 shadow-lg">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-500/20 shrink-0">
            <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              {lang === 'bn'
                ? `পার্মানেন্ট হিস্ট্রি (${formatDigits(permanentNumbers.length, lang)}/${formatDigits(MAX_PERMANENT_HISTORY_ITEMS, lang)}টি)`
                : `Permanent History (${permanentNumbers.length}/${MAX_PERMANENT_HISTORY_ITEMS})`}
            </span>

            <span className="text-[9.5px] font-bold text-amber-300/90 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-amber-400" />
              <span>{lang === 'bn' ? 'সংরক্ষিত (ডিলিট হবে না)' : 'Permanent (No Delete)'}</span>
            </span>
          </div>

          {permanentNumbers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-500/25 bg-amber-500/[0.04] p-3.5 text-center">
              <p className="text-xs font-bold text-amber-200/90 leading-relaxed">
                {lang === 'bn'
                  ? 'যে নম্বর ভিউয়ার ৫ বারের বেশি টাইপ করবেন এবং উইনার ৫ বারের বেশি কপি করবেন, তা স্বয়ংক্রিয়ভাবে এখানে পার্মানেন্ট হয়ে যাবে (সর্বোচ্চ ১০০টি) এবং ডিলিট করা যাবে না।'
                  : 'Numbers typed > 5 times and copied > 5 times will automatically be saved here permanently (up to 100) and cannot be deleted.'}
              </p>
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
              {permanentNumbers.map((item) => {
                const isNumCopied = copiedId === `perm-num-${item.id}`;
                const isAmtCopied = copiedId === `perm-amt-${item.id}`;
                const opBadge = getOperatorBadge(item.number, lang);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-amber-500/35 bg-[#171A29] px-3 py-2 flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-mono text-xs sm:text-sm font-black text-amber-100 tracking-wider truncate">
                        {item.number}
                      </span>
                      {opBadge && (
                        <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded border shrink-0 ${opBadge.darkColor}`}>
                          {opBadge.name}
                        </span>
                      )}
                      {item.amount && (
                        <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shrink-0">
                          ৳{formatDigits(item.amount, lang)}
                        </span>
                      )}
                      <span className="text-[9px] font-semibold text-amber-300/80 bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                        {lang === 'bn'
                          ? `টাইপ: ${formatDigits(item.typedCount, lang)} • কপি: ${formatDigits(item.copiedCount, lang)}`
                          : `Type: ${item.typedCount} • Copy: ${item.copiedCount}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Copy Number */}
                      <button
                        type="button"
                        onClick={() => handleCopy(item.number, `perm-num-${item.id}`, item.number, item.amount)}
                        className={`px-2.5 py-1 rounded-lg font-black text-[10px] flex items-center gap-1 transition-transform duration-75 cursor-pointer active:scale-95 ${
                          isNumCopied
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm'
                        }`}
                        title={lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy Number'}
                      >
                        {isNumCopied ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>{lang === 'bn' ? 'কপিড' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                          </>
                        )}
                      </button>

                      {/* Copy Amount if present */}
                      {item.amount && (
                        <button
                          type="button"
                          onClick={() => handleCopy(item.amount!, `perm-amt-${item.id}`)}
                          className="px-2 py-1 rounded-lg font-black text-[10px] bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/30 flex items-center gap-0.5 cursor-pointer"
                          title={lang === 'bn' ? 'টাকা কপি করুন' : 'Copy Amount'}
                        >
                          {isAmtCopied ? <Check className="w-3 h-3" /> : <span>৳</span>}
                          <span>{isAmtCopied ? (lang === 'bn' ? 'কপিড' : 'Copied') : (lang === 'bn' ? 'টাকা' : 'Amt')}</span>
                        </button>
                      )}

                      {/* Lock indicator: NO DELETE BUTTON ALLOWED */}
                      <div
                        className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[9.5px] font-bold flex items-center gap-1 select-none"
                        title={lang === 'bn' ? 'উইনার এই পার্মানেন্ট নম্বর ডিলিট করতে পারবেন না' : 'Permanent numbers cannot be deleted'}
                      >
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span className="hidden xs:inline">{lang === 'bn' ? 'স্থায়ী' : 'Permanent'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface OwnerRemoteTypeInlineBannerProps {
  lang: 'bn' | 'en';
  remoteState: RemoteTypeState;
  onOpenModal: () => void;
  onClearLiveNumber: () => void;
  onDeleteSentNumber: (id: string) => void;
  onClearAllSentNumbers: () => void;
  onToggleRotate?: () => void;
}

export function OwnerRemoteTypeInlineBanner({
  lang,
  remoteState,
  onOpenModal,
  onClearLiveNumber,
  onDeleteSentNumber,
  onClearAllSentNumbers,
  onToggleRotate
}: OwnerRemoteTypeInlineBannerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const liveNumber = remoteState.liveNumber || '';
  const sentNumbers = (remoteState.sentNumbers || []).slice(0, MAX_REMOTE_HISTORY_ITEMS);
  const isRotated = Boolean(remoteState.isRotated);

  if (!liveNumber && sentNumbers.length === 0) return null;

  const isElevenDigits = liveNumber.length === 11;
  const isInvalidOperator = isInvalidOperatorNumber(liveNumber);

  const handleToggleRotate = () => {
    soundEngine.playSuccessSound();
    if (onToggleRotate) {
      onToggleRotate();
    } else {
      const nextState: RemoteTypeState = {
        ...remoteState,
        isRotated: !isRotated,
        updatedAt: new Date().toISOString()
      };
      syncRemoteTypeStateInstant(nextState, true);
    }
  };

  const handleCopy = async (text: string, idKey: string, cleanNum?: string, amount?: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      soundEngine.playSuccessSound();
      setCopiedId(idKey);
      setTimeout(() => {
        setCopiedId((prev) => (prev === idKey ? null : prev));
      }, 1800);

      const targetDigits = (cleanNum || text).replace(/\D/g, '');
      if (targetDigits.length === 11) {
        const { nextState } = checkAndPromotePermanentNumber(
          targetDigits,
          amount || remoteState.liveAmount || '',
          remoteState,
          'copied'
        );
        syncRemoteTypeStateInstant(nextState, true);
      }
    }
  };

  return (
    <div className="mb-2.5 bg-[#0B0F1A] text-white rounded-2xl border border-purple-500/40 p-2.5 sm:p-3 shadow-md space-y-2">
      {/* Top Bar - Updated with Rotate Button */}
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={onOpenModal}
          className="flex items-center gap-1.5 text-left cursor-pointer group min-w-0"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="text-[11px] font-black text-purple-200 uppercase tracking-wide group-hover:underline truncate">
            {lang === 'bn' ? 'Air Typing লাইভ রিসিভার' : 'Air Typing Live Receiver'}
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleRotate}
            className={`text-[9.5px] font-black px-2 py-0.5 rounded-lg border flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
              isRotated
                ? 'bg-amber-500 text-slate-950 border-amber-300 ring-1 ring-amber-300'
                : 'bg-white/10 hover:bg-white/20 text-purple-200 border-white/20'
            }`}
            title={lang === 'bn' ? 'কাস্টমার ডিসপ্লে উল্টান/সুজা করুন' : 'Rotate/Straighten Customer Display'}
          >
            <RotateCw className={`w-3 h-3 ${isRotated ? 'rotate-180' : ''}`} />
            <span>{isRotated ? (lang === 'bn' ? 'সুজা করুন' : 'Reset') : (lang === 'bn' ? 'রোটেট' : 'Rotate')}</span>
          </button>

          {sentNumbers.length > 0 && (
            <button
              type="button"
              onClick={onClearAllSentNumbers}
              className="text-[9.5px] font-black text-rose-300 hover:text-white bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-400/30 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>{lang === 'bn' ? 'সব মুছুন' : 'Clear All'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Typing Row */}
      {liveNumber && (
        <div
          className={`rounded-xl border px-2.5 py-1.5 flex items-center justify-between gap-2 ${
            isInvalidOperator
              ? 'bg-[#22070A] border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
              : isElevenDigits
              ? 'bg-emerald-950/50 border-emerald-400/70'
              : 'bg-white/[0.07] border-purple-400/50'
          }`}
        >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded text-white shrink-0 ${
                isInvalidOperator ? 'bg-rose-600 animate-pulse' : 'bg-purple-600'
              }`}>
                {isInvalidOperator ? (lang === 'bn' ? 'ভুল নম্বর' : 'INVALID') : (lang === 'bn' ? 'লাইভ' : 'LIVE')}
              </span>
              <span className={`font-mono text-sm sm:text-base font-black tracking-wide truncate ${
                isInvalidOperator ? 'text-rose-200' : 'text-white'
              }`}>
                {liveNumber}
              </span>
              {remoteState.liveAmount && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shrink-0">
                  ৳{formatDigits(remoteState.liveAmount, lang)}
                </span>
              )}
              <span className="text-[9px] font-bold text-slate-300 shrink-0">
                ({formatDigits(liveNumber.length, lang)}/11)
              </span>
            </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleCopy(liveNumber, 'inline-live', liveNumber, remoteState.liveAmount)}
              className={`px-2.5 py-1 rounded-lg font-black text-[10px] flex items-center gap-1 cursor-pointer active:scale-95 transition-transform ${
                copiedId === 'inline-live'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {copiedId === 'inline-live' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedId === 'inline-live' ? (lang === 'bn' ? 'কপিড' : 'Copied') : (lang === 'bn' ? 'কপি' : 'Copy')}</span>
            </button>
            {remoteState.liveAmount && (
              <button
                type="button"
                onClick={() => handleCopy(remoteState.liveAmount!, 'inline-live-amt')}
                className="px-2 py-1 rounded-lg font-black text-[10px] bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/30 flex items-center gap-0.5 cursor-pointer"
              >
                {copiedId === 'inline-live-amt' ? <Check className="w-3 h-3" /> : <span>৳</span>}
                <span>{copiedId === 'inline-live-amt' ? 'কপিড' : 'টাকা'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClearLiveNumber}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Sent Numbers Compact History on Main Page */}
      {sentNumbers.length > 0 && (
        <div className="space-y-1 max-h-44 overflow-y-auto pr-0.5">
          {sentNumbers.map((item) => {
            const isCopied = copiedId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl bg-white/[0.06] border border-white/15 px-2.5 py-1 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <span className="font-mono text-xs sm:text-sm font-black text-white tracking-wider truncate">
                    {item.number}
                  </span>
                  {item.amount && (
                    <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 shrink-0">
                      ৳{formatDigits(item.amount, lang)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(item.number, item.id, item.number, item.amount)}
                    className={`px-2 py-0.5 rounded-lg font-black text-[10px] flex items-center gap-1 cursor-pointer active:scale-95 transition-transform ${
                      isCopied
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? (lang === 'bn' ? 'কপিড' : 'Copied') : (lang === 'bn' ? 'কপি' : 'Copy')}</span>
                  </button>
                  {item.amount && (
                    <button
                      type="button"
                      onClick={() => handleCopy(item.amount!, `inline-amt-${item.id}`)}
                      className="px-1.5 py-0.5 rounded-lg font-black text-[9.5px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                    >
                      {copiedId === `inline-amt-${item.id}` ? '✓' : '৳'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteSentNumber(item.id)}
                    className="p-0.5 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                    title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
