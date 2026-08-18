import React, { useState, useMemo } from 'react';
import { Trash2, RotateCcw, X, Sparkles, Clock, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { TrashTransaction, Contact } from '../types';

interface TrashBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  trashItems: TrashTransaction[];
  contacts: Contact[];
  onRestoreItem: (item: TrashTransaction) => void;
  onPermanentDeleteItem: (itemId: string) => void;
  onEmptyTrash: () => void;
  currency: string;
}

export const TrashBinModal: React.FC<TrashBinModalProps> = ({
  isOpen,
  onClose,
  trashItems = [],
  contacts = [],
  onRestoreItem,
  onPermanentDeleteItem,
  onEmptyTrash,
  currency,
}) => {
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create a fast map for customer lookup
  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    (contacts || []).forEach(c => map.set(c.id, c));
    return map;
  }, [contacts]);

  if (!isOpen) return null;

  // Calculate days remaining before 30-day auto-purge
  const getDaysRemaining = (deletedAtStr: string) => {
    const deletedAt = new Date(deletedAtStr).getTime();
    if (isNaN(deletedAt)) return 30;
    const now = Date.now();
    const ageInMs = now - deletedAt;
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
    const remainingDays = Math.ceil(30 - ageInDays);
    return Math.max(0, remainingDays);
  };

  const showToast = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => {
      setActionFeedback(null);
    }, 3000);
  };

  const handleRestore = (item: TrashTransaction) => {
    const contact = contactMap.get(item.originalTx.contactId);
    onRestoreItem(item);
    showToast(`✅ "${contact?.name || 'লেনদেন'}" রিস্টোর করা হয়েছে`);
  };

  const handlePermanentDelete = (item: TrashTransaction) => {
    onPermanentDeleteItem(item.id);
    showToast(`🗑️ স্থায়ীভাবে মুছে ফেলা হয়েছে`);
  };

  const handleConfirmEmpty = () => {
    onEmptyTrash();
    setConfirmEmpty(false);
    showToast(`✨ ট্র্যাশ খালি করা হয়েছে`);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div id="trash-bin-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100">
        
        {/* Clean, Compact Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white">
                ট্র্যাশ
              </h2>
              <span className="bg-rose-500/20 text-rose-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-500/30">
                {trashItems.length}
              </span>

              {/* Empty Trash Button in Header next to Title */}
              {trashItems.length > 0 && (
                <div className="ml-1 sm:ml-2">
                  {confirmEmpty ? (
                    <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded-lg">
                      <span className="text-[10px] font-bold text-rose-300">সব মুছবেন?</span>
                      <button
                        type="button"
                        onClick={handleConfirmEmpty}
                        className="px-2 py-0.5 bg-rose-600 text-white text-[9.5px] font-black rounded hover:bg-rose-700 transition-colors"
                      >
                        হ্যাঁ
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmEmpty(false)}
                        className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[9.5px] font-bold rounded hover:bg-slate-700 transition-colors"
                      >
                        না
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmEmpty(true)}
                      className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                      <span className="text-[10.5px]">খালি করুন</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div className="bg-purple-600 text-white text-xs font-bold py-1.5 px-3 text-center shadow-inner flex items-center justify-center gap-1.5 shrink-0 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* High-Density Compact Trash List */}
        <div className="p-2 overflow-y-auto flex-1 space-y-1 max-h-[65vh]">
          {trashItems.length === 0 ? (
            <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-2">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-slate-700">
                ট্র্যাশ খালি
              </h3>
            </div>
          ) : (
            trashItems.map((item) => {
              const contact = contactMap.get(item.originalTx.contactId);
              const daysLeft = getDaysRemaining(item.deletedAt);
              const isGave = item.originalTx.type === 'GAVE';
              const isExpanded = expandedId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200/90 rounded-lg p-1.5 transition-all hover:border-purple-300"
                >
                  {/* Ultra-Compact Main Row */}
                  <div className="flex items-center justify-between gap-1.5">
                    {/* Left side: Type + Name + Amount + Days Left */}
                    <div 
                      className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer select-none"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] font-black shrink-0 border ${
                          isGave
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {isGave ? 'দিলাম' : 'পেলাম'}
                      </span>

                      <span className="text-xs font-bold text-slate-800 truncate max-w-[110px] sm:max-w-[170px]">
                        {contact?.name || 'অজানা কাস্টমার'}
                      </span>

                      <span
                        className={`text-xs font-black shrink-0 ${
                          isGave ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {currency}{item.originalTx.amount}
                      </span>

                      <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200/80 px-1 py-0.2 rounded shrink-0">
                        <Clock className="w-2.5 h-2.5 text-amber-600" />
                        <span>{daysLeft > 0 ? `${daysLeft}দিন` : 'আজই'}</span>
                      </span>

                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0"
                        title="ডিটেইলস দেখুন"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Right side: Quick Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestore(item)}
                        className="px-2 py-0.5 bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white border border-purple-200 hover:border-purple-600 rounded text-[10px] font-black transition-all flex items-center gap-0.5 cursor-pointer active:scale-95"
                        title="রিস্টোর করুন"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden sm:inline">রিস্টোর</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(item)}
                        className="p-1 sm:px-2 sm:py-0.5 bg-slate-50 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-200 hover:border-rose-600 rounded text-[10px] font-bold transition-all flex items-center gap-0.5 cursor-pointer active:scale-95"
                        title="স্থায়ী ডিলিট"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Inner Details */}
                  {isExpanded && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 bg-slate-50/80 p-2 rounded text-[10px] space-y-1 text-slate-600 animate-fade-in">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span>
                          <strong>কাস্টমার:</strong> {contact?.name || 'অজানা'} ({contact?.phone || 'ফোন নেই'})
                        </span>
                        <span>
                          <strong>তারিখ:</strong> {new Date(item.originalTx.date).toLocaleDateString('bn-BD', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      {item.originalTx.note && (
                        <div>
                          <strong>নোট:</strong> {item.originalTx.note}
                        </div>
                      )}
                      <div className="text-amber-700 font-bold flex items-center gap-1 pt-0.5">
                        <Info className="w-3 h-3 text-amber-600" />
                        <span>মুছে ফেলা হয়েছে {new Date(item.deletedAt).toLocaleDateString('bn-BD')} | {daysLeft > 0 ? `আর ${daysLeft} দিন পর পার্মানেন্টলি ডিলিট হবে` : 'আজই স্বয়ংক্রিয়ভাবে পার্মানেন্ট ডিলিট হবে'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Minimal Footer */}
        <div className="bg-slate-50 border-t border-slate-100 py-2 px-3 text-center text-[10px] font-bold text-slate-500 shrink-0 flex items-center justify-between">
          <span>৩০ দিন পর অটোমেশন মুছবে</span>
          <span>মোট: {trashItems.length}টি</span>
        </div>

      </div>
    </div>
  );
};

