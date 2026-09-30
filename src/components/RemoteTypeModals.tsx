/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { motion, AnimatePresence } from 'motion/react';
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
  Volume2
} from 'lucide-react';
import { RemoteTypeState, RemoteTypedNumberItem } from '../types';
import { db } from '../utils/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { soundEngine } from '../utils/audio';

export const REMOTE_TYPE_STORAGE_KEY = 'hellopoint_remote_type_state';
const BROADCAST_CHANNEL_NAME = 'hellopoint_remote_type_channel';

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
        isTyping: Boolean(parsed.isTyping),
        sentNumbers: Array.isArray(parsed.sentNumbers) ? parsed.sentNumbers : [],
        updatedAt: parsed.updatedAt || new Date(0).toISOString()
      };
    }
  } catch {
    // ignore
  }
  return {
    liveNumber: '',
    isTyping: false,
    sentNumbers: [],
    updatedAt: new Date(0).toISOString()
  };
};

export const syncRemoteTypeStateInstant = (nextState: RemoteTypeState) => {
  try {
    const serialized = JSON.stringify(nextState);
    localStorage.setItem(REMOTE_TYPE_STORAGE_KEY, serialized);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(REMOTE_TYPE_STORAGE_KEY, serialized);
      } catch {
        // ignore
      }
    }
    window.dispatchEvent(new CustomEvent('hellopoint_remote_type_local', { detail: nextState }));
    window.dispatchEvent(new Event('storage'));
    if (broadcastChannel) {
      broadcastChannel.postMessage(nextState);
    }
  } catch (e) {
    console.error('Local remote type sync error:', e);
  }

  // Ultra-fast non-blocking Firestore write to public/remote_type
  setDoc(doc(db, 'public', 'remote_type'), {
    liveNumber: nextState.liveNumber,
    isTyping: nextState.isTyping,
    sentNumbers: nextState.sentNumbers.slice(0, 30),
    updatedAt: nextState.updatedAt
  }).catch((err) => {
    console.warn('Firestore remote_type sync notice:', err);
  });
};

export const getOperatorBadge = (num: string, lang: 'bn' | 'en') => {
  const clean = num.replace(/\D/g, '');
  if (clean.startsWith('017') || clean.startsWith('013')) {
    return {
      name: lang === 'bn' ? 'গ্রামীণফোন' : 'GP',
      color: 'bg-sky-100 text-sky-800 border-sky-200',
      darkColor: 'bg-sky-500/20 text-sky-300 border-sky-400/40'
    };
  }
  if (clean.startsWith('018')) {
    return {
      name: lang === 'bn' ? 'রবি' : 'Robi',
      color: 'bg-rose-100 text-rose-800 border-rose-200',
      darkColor: 'bg-rose-500/20 text-rose-300 border-rose-400/40'
    };
  }
  if (clean.startsWith('019') || clean.startsWith('014')) {
    return {
      name: lang === 'bn' ? 'বাংলালিংক' : 'BL',
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      darkColor: 'bg-orange-500/20 text-orange-300 border-orange-400/40'
    };
  }
  if (clean.startsWith('016')) {
    return {
      name: lang === 'bn' ? 'এয়ারটেল' : 'Airtel',
      color: 'bg-red-100 text-red-800 border-red-200',
      darkColor: 'bg-red-500/20 text-red-300 border-red-400/40'
    };
  }
  if (clean.startsWith('015')) {
    return {
      name: lang === 'bn' ? 'টেলিটক' : 'Teletalk',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      darkColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
    };
  }
  return null;
};

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;
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

/**
 * 11 Round Glowing Circles Progress Indicator ("গুল গুল ফিলাপ ডট")
 */
function ElevenRoundDotsIndicator({
  count,
  isElevenDigits
}: {
  count: number;
  isElevenDigits: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5 py-1.5 px-2">
      {Array.from({ length: 11 }).map((_, i) => {
        const filled = i < count;
        const isCurrent = i === count - 1;
        return (
          <div
            key={i}
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-all duration-200 flex items-center justify-center ${
              isElevenDigits
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-300 border border-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.9)] scale-110'
                : filled
                ? `bg-gradient-to-tr from-purple-500 to-indigo-400 border border-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.8)] ${
                    isCurrent ? 'scale-125 ring-2 ring-purple-300/50' : 'scale-105'
                  }`
                : 'bg-white/[0.07] border border-white/20 scale-95'
            }`}
          >
            {filled && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isElevenDigits ? 'bg-white' : 'bg-white/90'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const [justSentToast, setJustSentToast] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const liveNumber = remoteState.liveNumber || '';
  const sentNumbers = remoteState.sentNumbers || [];

  const toBnDigits = (n: number | string) => {
    if (lang !== 'bn') return String(n);
    const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(n).replace(/\d/g, (d) => bn[Number(d)]);
  };

  const triggerKeyVisual = (key: string) => {
    setActiveKey(key);
    setTimeout(() => {
      setActiveKey((prev) => (prev === key ? null : prev));
    }, 140);
  };

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (liveNumber.length >= 15) return;
      const nextNum = liveNumber + digit;
      triggerKeyVisual(digit);
      soundEngine.playDialpadTone(digit, nextNum.length);
      const nextState: RemoteTypeState = {
        ...remoteState,
        liveNumber: nextNum,
        isTyping: nextNum.length > 0,
        updatedAt: new Date().toISOString()
      };
      onUpdateRemoteState(nextState);
    },
    [liveNumber, remoteState, onUpdateRemoteState]
  );

  const handleBackspace = useCallback(() => {
    if (!liveNumber) return;
    triggerKeyVisual('BACK');
    soundEngine.playBackspaceSound();
    const nextNum = liveNumber.slice(0, -1);
    const nextState: RemoteTypeState = {
      ...remoteState,
      liveNumber: nextNum,
      isTyping: nextNum.length > 0,
      updatedAt: new Date().toISOString()
    };
    onUpdateRemoteState(nextState);
  }, [liveNumber, remoteState, onUpdateRemoteState]);

  const handleClear = useCallback(() => {
    if (!liveNumber) return;
    triggerKeyVisual('CLEAR');
    soundEngine.playDeleteSound();
    const nextState: RemoteTypeState = {
      ...remoteState,
      liveNumber: '',
      isTyping: false,
      updatedAt: new Date().toISOString()
    };
    onUpdateRemoteState(nextState);
  }, [liveNumber, remoteState, onUpdateRemoteState]);

  const handleSendNumber = useCallback(() => {
    const clean = liveNumber.trim();
    if (!clean) return;
    soundEngine.playSuccessSound();

    const newItem: RemoteTypedNumberItem = {
      id: 'rt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      number: clean,
      createdAt: new Date().toISOString()
    };

    const nextState: RemoteTypeState = {
      liveNumber: '',
      isTyping: false,
      sentNumbers: [newItem, ...sentNumbers].slice(0, 30),
      updatedAt: new Date().toISOString()
    };
    onUpdateRemoteState(nextState);
    setJustSentToast(true);
    setTimeout(() => setJustSentToast(false), 1800);
  }, [liveNumber, sentNumbers, onUpdateRemoteState]);

  // Physical keyboard support for ultra-fast typing
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
        if (liveNumber.trim().length > 0) {
          handleSendNumber();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigitPress, handleBackspace, handleSendNumber, liveNumber, onClose]);

  if (!isOpen) return null;

  const isElevenDigits = liveNumber.length === 11;
  const opBadge = getOperatorBadge(liveNumber, lang);

  return (
    <div className="fixed inset-0 z-[10002] w-full h-[100dvh] bg-[#0B0F1A] text-white flex flex-col justify-between overflow-hidden font-sans select-none">
      {/* Ambient Background Glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-purple-600/25 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>

      {/* Main Responsive Fullscreen Container */}
      <div className="relative z-10 w-full max-w-md mx-auto h-full flex flex-col justify-between px-3.5 pt-3 pb-4 sm:py-5">
        
        {/* 1. Top Navigation Header */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 border border-white/15 text-white text-xs font-bold transition-all cursor-pointer backdrop-blur-md"
          >
            <ArrowLeft className="w-4 h-4 text-purple-300" />
            <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[10px] font-black tracking-wider text-emerald-300 uppercase">
                {lang === 'bn' ? 'রিমট টাইপ লাইভ' : 'REMOTE LIVE'}
              </span>
            </div>

            <div className="w-8 h-8 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <Volume2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 2. Digital Display Card + Send Button Right Beside It */}
        <div className="my-2 space-y-2 shrink-0">
          {/* Meta Info */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                {lang === 'bn' ? 'লাইভ নাম্বার' : 'LIVE NUMBER'}
              </span>
              {opBadge && (
                <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border ${opBadge.darkColor}`}>
                  {opBadge.name}
                </span>
              )}
            </div>

            <span
              className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-full border transition-all ${
                isElevenDigits
                  ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : liveNumber.length > 11
                  ? 'bg-amber-500/25 text-amber-300 border-amber-400/50'
                  : 'bg-white/10 text-slate-300 border-white/15'
              }`}
            >
              {toBnDigits(liveNumber.length)}/{toBnDigits(11)} {lang === 'bn' ? 'ডিজিট' : 'Digits'}
              {isElevenDigits && ' ✓'}
            </span>
          </div>

          {/* 11 Round Glowing Circles Indicator ("গুল গুল ফিলাপ ডট") */}
          <ElevenRoundDotsIndicator count={liveNumber.length} isElevenDigits={isElevenDigits} />

          {/* Live Display Box + Send Button Beside It */}
          <div className="flex items-stretch gap-2.5 pt-0.5">
            <div
              className={`flex-1 min-w-0 rounded-3xl border-2 px-4 py-3.5 flex items-center justify-between transition-all backdrop-blur-xl ${
                isElevenDigits
                  ? 'bg-emerald-950/40 border-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                  : liveNumber.length > 0
                  ? 'bg-white/[0.08] border-purple-400/70 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                  : 'bg-white/[0.05] border-white/15'
              }`}
            >
              <div className="flex-1 min-w-0 text-left flex items-center">
                {liveNumber ? (
                  <div className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-white truncate flex items-center">
                    <span>{liveNumber}</span>
                    <span className="inline-block w-0.5 h-6 sm:h-7 bg-amber-400 ml-1 animate-pulse rounded-full" />
                  </div>
                ) : (
                  <div className="text-sm sm:text-base font-bold text-slate-400 py-1 flex items-center gap-1.5">
                    <span>{lang === 'bn' ? 'নিচের কিবোর্ডে নাম্বার তুলুন...' : 'Tap numbers below...'}</span>
                  </div>
                )}
              </div>

              {liveNumber.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-rose-500/30 text-slate-300 hover:text-rose-200 flex items-center justify-center shrink-0 ml-2 transition-colors cursor-pointer"
                  title={lang === 'bn' ? 'মুছে ফেলুন' : 'Clear'}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* SEND BUTTON RIGHT BESIDE LIVE NUMBER */}
            <button
              type="button"
              onClick={handleSendNumber}
              disabled={!liveNumber.trim()}
              className={`px-4 sm:px-5 rounded-3xl font-black text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95 ${
                isElevenDigits
                  ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.5)] ring-2 ring-emerald-300 animate-pulse'
                  : liveNumber.trim().length > 0
                  ? 'bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600 text-white shadow-lg border border-purple-400/40'
                  : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
              <span className="text-[10.5px] font-black tracking-wider">
                {lang === 'bn' ? 'সেন্ড' : 'SEND'}
              </span>
            </button>
          </div>

          {/* Sent Toast or Sent Numbers Horizontal Chip Bar */}
          <AnimatePresence mode="wait">
            {justSentToast ? (
              <motion.div
                key="toast"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-black"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {lang === 'bn'
                    ? 'নাম্বারটি সেন্ড হয়েছে! পরের নাম্বারটি তুলতে পারেন।'
                    : 'Number sent! You can type the next number.'}
                </span>
              </motion.div>
            ) : sentNumbers.length > 0 ? (
              <motion.div
                key="sent-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 no-scrollbar"
              >
                <span className="text-[9.5px] font-black text-emerald-400 uppercase tracking-wider shrink-0 flex items-center gap-1 bg-emerald-500/15 border border-emerald-400/30 px-2 py-1 rounded-xl">
                  <Check className="w-3 h-3" />
                  {lang === 'bn' ? `সেন্ড (${toBnDigits(sentNumbers.length)})` : `Sent (${sentNumbers.length})`}
                </span>
                {sentNumbers.slice(0, 8).map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-xl px-2.5 py-1 text-xs shrink-0"
                  >
                    <span className="text-[9px] font-black text-purple-300">
                      #{toBnDigits(idx + 1)}
                    </span>
                    <span className="font-mono font-bold text-white tracking-wider">
                      {item.number}
                    </span>
                  </div>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* 3. Fullscreen Tactile Dialpad Grid */}
        <div className="flex-1 grid grid-cols-3 grid-rows-4 gap-2.5 sm:gap-3 min-h-0 pt-1">
          {DIALPAD_KEYS.map(({ digit, sub }) => {
            const isPressed = activeKey === digit;
            return (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitPress(digit)}
                className={`h-full min-h-[60px] rounded-3xl border flex flex-col items-center justify-center transition-all duration-100 cursor-pointer select-none active:scale-95 ${
                  isPressed
                    ? 'bg-gradient-to-br from-purple-500/40 to-indigo-500/40 border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.45)] scale-95'
                    : 'bg-white/[0.07] hover:bg-white/[0.12] border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'
                }`}
              >
                <span className="font-mono text-3xl sm:text-4xl font-black text-white leading-none tracking-tight">
                  {digit}
                </span>
                <span className="text-[9px] font-extrabold text-slate-400 tracking-[0.22em] mt-1">
                  {sub}
                </span>
              </button>
            );
          })}

          {/* Clear (C) Button */}
          <button
            type="button"
            onClick={handleClear}
            className={`h-full min-h-[60px] rounded-3xl border flex flex-col items-center justify-center transition-all duration-100 cursor-pointer select-none active:scale-95 ${
              activeKey === 'CLEAR'
                ? 'bg-rose-500/40 border-rose-400 scale-95'
                : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/30 text-rose-200'
            }`}
          >
            <span className="text-xl sm:text-2xl font-black text-rose-300 leading-none">C</span>
            <span className="text-[9.5px] font-black uppercase tracking-wider text-rose-300/90 mt-1">
              {lang === 'bn' ? 'সব মুছুন' : 'CLEAR'}
            </span>
          </button>

          {/* 0 Button */}
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className={`h-full min-h-[60px] rounded-3xl border flex flex-col items-center justify-center transition-all duration-100 cursor-pointer select-none active:scale-95 ${
              activeKey === '0'
                ? 'bg-gradient-to-br from-purple-500/40 to-indigo-500/40 border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.45)] scale-95'
                : 'bg-white/[0.07] hover:bg-white/[0.12] border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'
            }`}
          >
            <span className="font-mono text-3xl sm:text-4xl font-black text-white leading-none">
              0
            </span>
            <span className="text-[10px] font-extrabold text-slate-400 tracking-widest mt-1">
              +
            </span>
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            className={`h-full min-h-[60px] rounded-3xl border flex flex-col items-center justify-center transition-all duration-100 cursor-pointer select-none active:scale-95 ${
              activeKey === 'BACK'
                ? 'bg-amber-500/40 border-amber-400 scale-95'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/30 text-amber-200'
            }`}
          >
            <Delete className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300" />
            <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-300/90 mt-1">
              {lang === 'bn' ? 'কাটুন' : 'BACK'}
            </span>
          </button>
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
}

export function OwnerRemoteTypeModal({
  isOpen,
  onClose,
  lang,
  remoteState,
  onClearLiveNumber,
  onDeleteSentNumber,
  onClearAllSentNumbers
}: OwnerRemoteTypeModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const liveNumber = remoteState.liveNumber || '';
  const sentNumbers = remoteState.sentNumbers || [];
  const isElevenDigits = liveNumber.length === 11;
  const liveOpBadge = getOperatorBadge(liveNumber, lang);

  const toBnDigits = (n: number | string) => {
    if (lang !== 'bn') return String(n);
    const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(n).replace(/\d/g, (d) => bn[Number(d)]);
  };

  const handleCopy = async (text: string, idKey: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      soundEngine.playSuccessSound();
      setCopiedId(idKey);
      setTimeout(() => {
        setCopiedId((prev) => (prev === idKey ? null : prev));
      }, 1800);
    }
  };

  return (
    <div className="fixed inset-0 z-[10002] w-full h-[100dvh] bg-[#0B0F1A] text-white flex flex-col justify-between overflow-hidden font-sans select-none">
      {/* Matching Ambient Background Glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-purple-600/25 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>

      {/* Main Full-Page Container */}
      <div className="relative z-10 w-full max-w-md mx-auto h-full flex flex-col px-3.5 pt-3 pb-4 sm:py-5">
        
        {/* 1. Top Navigation Header (Matching Visitor Remote Page) */}
        <div className="flex items-center justify-between gap-2 shrink-0 mb-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 border border-white/15 text-white text-xs font-bold transition-all cursor-pointer backdrop-blur-md"
          >
            <ArrowLeft className="w-4 h-4 text-purple-300" />
            <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[10px] font-black tracking-wider text-emerald-300 uppercase">
                {lang === 'bn' ? 'ওউনার রিমট মনিটর' : 'OWNER LIVE MONITOR'}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. LIVE TYPING DISPLAY SECTION (Matching Dark Glass Design + Round Dots) */}
        <div className="space-y-2.5 shrink-0 bg-white/[0.04] border border-white/10 rounded-3xl p-3.5 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio
                  className={`w-3.5 h-3.5 ${
                    liveNumber ? 'text-emerald-400 animate-pulse' : 'text-purple-400'
                  }`}
                />
                {lang === 'bn' ? 'কাস্টমার লাইভ টাইপিং' : 'CUSTOMER LIVE TYPING'}
              </span>
              {liveOpBadge && (
                <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border ${liveOpBadge.darkColor}`}>
                  {liveOpBadge.name}
                </span>
              )}
            </div>

            <span
              className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-full border transition-all ${
                isElevenDigits
                  ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : liveNumber.length > 11
                  ? 'bg-amber-500/25 text-amber-300 border-amber-400/50'
                  : 'bg-white/10 text-slate-300 border-white/15'
              }`}
            >
              {toBnDigits(liveNumber.length)}/{toBnDigits(11)} {lang === 'bn' ? 'ডিজিট' : 'Digits'}
              {isElevenDigits && ' ✓'}
            </span>
          </div>

          {/* 11 Round Glowing Circles Indicator ("গুল গুল ফিলাপ ডট") */}
          <ElevenRoundDotsIndicator count={liveNumber.length} isElevenDigits={isElevenDigits} />

          {/* Live Number Box + Copy Button Right Beside It */}
          <div className="flex items-stretch gap-2.5 pt-0.5">
            <div
              className={`flex-1 min-w-0 rounded-2xl border-2 px-4 py-3.5 flex items-center justify-between transition-all ${
                isElevenDigits
                  ? 'bg-emerald-950/45 border-emerald-400/85 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                  : liveNumber
                  ? 'bg-white/[0.08] border-purple-400/70 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                  : 'bg-white/[0.04] border-white/15'
              }`}
            >
              <div className="min-w-0 flex-1">
                {liveNumber ? (
                  <div className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-white truncate flex items-center">
                    <span>{liveNumber}</span>
                    <span className="inline-block w-0.5 h-6 sm:h-7 bg-amber-400 ml-1 animate-pulse rounded-full" />
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm font-bold text-slate-400 py-1">
                    {lang === 'bn' ? 'অপেক্ষা করা হচ্ছে... কাস্টমার এখনো টাইপ করেনি' : 'Waiting for customer to type...'}
                  </p>
                )}
              </div>

              {liveNumber && (
                <button
                  type="button"
                  onClick={onClearLiveNumber}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-rose-500/30 text-slate-300 hover:text-rose-200 flex items-center justify-center shrink-0 ml-2 transition-colors cursor-pointer"
                  title={lang === 'bn' ? 'মুছুন' : 'Clear'}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* COPY BUTTON BESIDE LIVE NUMBER */}
            <button
              type="button"
              disabled={!liveNumber}
              onClick={() => handleCopy(liveNumber, 'live')}
              className={`px-4 sm:px-5 rounded-2xl font-black text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95 ${
                copiedId === 'live'
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                  : isElevenDigits
                  ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.5)] ring-2 ring-emerald-300 animate-pulse'
                  : liveNumber
                  ? 'bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600 text-white shadow-lg border border-purple-400/40'
                  : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
              }`}
            >
              {copiedId === 'live' ? (
                <>
                  <Check className="w-5 h-5" />
                  <span className="text-[10px] font-black">{lang === 'bn' ? 'কপি হয়েছে' : 'COPIED'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  <span className="text-[10.5px] font-black">{lang === 'bn' ? 'কপি' : 'COPY'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. RECEIVED SENT NUMBERS FULL-HEIGHT SCROLLABLE SECTION */}
        <div className="flex-1 min-h-0 flex flex-col mt-4 bg-white/[0.04] border border-white/10 rounded-3xl p-3.5 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 shrink-0">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-400" />
              {lang === 'bn'
                ? `রিসিভ হওয়া নাম্বার তালিকা (${toBnDigits(sentNumbers.length)}টি)`
                : `Received Numbers (${sentNumbers.length})`}
            </span>

            {sentNumbers.length > 0 && (
              <button
                type="button"
                onClick={onClearAllSentNumbers}
                className="text-[10.5px] font-black text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/35 px-3 py-1 rounded-xl border border-rose-400/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'সব মুছুন' : 'Clear All'}</span>
              </button>
            )}
          </div>

          {sentNumbers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-purple-400">
                <Smartphone className="w-6 h-6 opacity-70" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-400 max-w-xs leading-relaxed">
                {lang === 'bn'
                  ? 'কাস্টমার নাম্বার টাইপ করে সেন্ড করলে এখানে একের পর এক জমা হবে এবং পাশে কপি বাটন দেখাবে'
                  : 'Numbers sent by the customer will appear here with individual copy buttons'}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {sentNumbers.map((item, idx) => {
                const op = getOperatorBadge(item.number, lang);
                const isCopied = copiedId === item.id;
                const is11 = item.number.replace(/\D/g, '').length === 11;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3 flex items-center justify-between gap-2.5 transition-all ${
                      is11
                        ? 'bg-emerald-950/30 border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                        : 'bg-white/[0.06] border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                        {toBnDigits(idx + 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-lg sm:text-xl font-black text-white tracking-wider">
                            {item.number}
                          </span>
                          {op && (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${op.darkColor}`}>
                              {op.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(item.number, item.id)}
                        className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 ${
                          isCopied
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white border border-purple-400/30'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>{lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteSentNumber(item.id)}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-rose-500/30 text-slate-300 hover:text-rose-200 flex items-center justify-center transition-colors cursor-pointer"
                        title={lang === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
                      >
                        <X className="w-4 h-4" />
                      </button>
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
}

export function OwnerRemoteTypeInlineBanner({
  lang,
  remoteState,
  onOpenModal,
  onClearLiveNumber,
  onDeleteSentNumber,
  onClearAllSentNumbers
}: OwnerRemoteTypeInlineBannerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const liveNumber = remoteState.liveNumber || '';
  const sentNumbers = remoteState.sentNumbers || [];

  if (!liveNumber && sentNumbers.length === 0) return null;

  const isElevenDigits = liveNumber.length === 11;
  const liveOp = getOperatorBadge(liveNumber, lang);

  const toBnDigits = (n: number | string) => {
    if (lang !== 'bn') return String(n);
    const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(n).replace(/\d/g, (d) => bn[Number(d)]);
  };

  const handleCopy = async (text: string, idKey: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      soundEngine.playSuccessSound();
      setCopiedId(idKey);
      setTimeout(() => {
        setCopiedId((prev) => (prev === idKey ? null : prev));
      }, 1800);
    }
  };

  return (
    <div className="mb-2.5 bg-[#0B0F1A] text-white rounded-2xl border border-purple-500/40 p-2.5 sm:p-3 shadow-md space-y-2 animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenModal}
          className="flex items-center gap-1.5 text-left cursor-pointer group"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-black text-purple-200 uppercase tracking-wide group-hover:underline">
            {lang === 'bn' ? 'রিমট টাইপ লাইভ রিসিভার (ফুল পেইজ দেখতে ক্লিক করুন)' : 'Remote Type Live Receiver'}
          </span>
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

      {/* Live Typing Row */}
      {liveNumber && (
        <div
          className={`rounded-xl border px-2.5 py-2 flex items-center justify-between gap-2 ${
            isElevenDigits
              ? 'bg-emerald-950/50 border-emerald-400/70'
              : 'bg-white/[0.07] border-purple-400/50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-600 text-white shrink-0 animate-pulse">
              {lang === 'bn' ? 'লাইভ' : 'LIVE'}
            </span>
            <span className="font-mono text-base sm:text-lg font-black text-white tracking-wider truncate">
              {liveNumber}
            </span>
            {liveOp && (
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border shrink-0 ${liveOp.darkColor}`}>
                {liveOp.name}
              </span>
            )}
            <span className="text-[9px] font-bold text-slate-300 shrink-0">
              ({toBnDigits(liveNumber.length)}/{toBnDigits(11)})
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleCopy(liveNumber, 'inline-live')}
              className={`px-2.5 py-1 rounded-lg font-black text-[10px] flex items-center gap-1 cursor-pointer active:scale-95 transition-all ${
                copiedId === 'inline-live'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {copiedId === 'inline-live' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedId === 'inline-live' ? (lang === 'bn' ? 'কপিড' : 'Copied') : (lang === 'bn' ? 'কপি' : 'Copy')}</span>
            </button>
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

      {/* Sent Numbers List on Main Page (Every number has its own Copy button) */}
      {sentNumbers.length > 0 && (
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
          {sentNumbers.map((item, idx) => {
            const op = getOperatorBadge(item.number, lang);
            const isCopied = copiedId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl bg-white/[0.06] border border-white/15 px-2.5 py-1.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-purple-600 text-white font-black text-[9.5px] flex items-center justify-center shrink-0">
                    {toBnDigits(idx + 1)}
                  </span>
                  <span className="font-mono text-sm sm:text-base font-black text-white tracking-wider truncate">
                    {item.number}
                  </span>
                  {op && (
                    <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${op.darkColor}`}>
                      {op.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(item.number, item.id)}
                    className={`px-2.5 py-1 rounded-lg font-black text-[10px] flex items-center gap-1 cursor-pointer active:scale-95 transition-all ${
                      isCopied
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : (lang === 'bn' ? 'কপি' : 'Copy')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSentNumber(item.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
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
