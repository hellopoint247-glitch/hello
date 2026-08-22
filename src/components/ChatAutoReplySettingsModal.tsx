import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Bot, 
  MessageSquare, 
  RotateCcw, 
  Sparkles,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatQuickFAQ } from '../types';
import { DEFAULT_QUICK_FAQS } from '../utils/storage';

interface ChatAutoReplySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'bn' | 'en';
  quickFaqs: ChatQuickFAQ[];
  onSaveQuickFaqs: (faqs: ChatQuickFAQ[]) => void;
  themeColor?: string;
}

export default function ChatAutoReplySettingsModal({
  isOpen,
  onClose,
  lang,
  quickFaqs,
  onSaveQuickFaqs,
  themeColor = 'purple'
}: ChatAutoReplySettingsModalProps) {
  const [faqsList, setFaqsList] = useState<ChatQuickFAQ[]>(quickFaqs || DEFAULT_QUICK_FAQS);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New / Edit Form States
  const [formQuestion, setFormQuestion] = useState('');
  const [formAnswer, setFormAnswer] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingId(null);
    setFormQuestion('');
    setFormAnswer('');
    setShowAddForm(true);
  };

  const handleStartEdit = (faq: ChatQuickFAQ) => {
    setEditingId(faq.id);
    setFormQuestion(faq.question);
    setFormAnswer(faq.answer);
    setShowAddForm(true);
  };

  const handleCancelForm = () => {
    setEditingId(null);
    setFormQuestion('');
    setFormAnswer('');
    setShowAddForm(false);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestion.trim() || !formAnswer.trim()) return;

    let updated: ChatQuickFAQ[];
    if (editingId) {
      updated = faqsList.map(item => 
        item.id === editingId 
          ? { ...item, question: formQuestion.trim(), answer: formAnswer.trim() }
          : item
      );
    } else {
      const newFaq: ChatQuickFAQ = {
        id: `faq-${Date.now()}`,
        question: formQuestion.trim(),
        answer: formAnswer.trim(),
        active: true,
        icon: '💬',
        createdAt: new Date().toISOString()
      };
      updated = [newFaq, ...faqsList];
    }

    setFaqsList(updated);
    onSaveQuickFaqs(updated);
    handleCancelForm();
    triggerSaveSuccess();
  };

  const handleToggleActive = (id: string) => {
    const updated = faqsList.map(item => 
      item.id === id ? { ...item, active: !item.active } : item
    );
    setFaqsList(updated);
    onSaveQuickFaqs(updated);
  };

  const handleDelete = (id: string) => {
    const confirmMsg = lang === 'bn' 
      ? 'আপনি কি এই রেডিমেড চ্যাট ও অটো-রিপ্লাই প্রশ্নটি মুছে ফেলতে চান?' 
      : 'Are you sure you want to delete this auto-reply message?';
    if (window.confirm(confirmMsg)) {
      const updated = faqsList.filter(item => item.id !== id);
      setFaqsList(updated);
      onSaveQuickFaqs(updated);
      triggerSaveSuccess();
    }
  };

  const handleResetDefaults = () => {
    const confirmMsg = lang === 'bn' 
      ? 'সকল রেডিমেড চ্যাট ডিফল্ট অবস্থায় ফিরিয়ে আনতে চান?' 
      : 'Reset all quick FAQs and auto-replies to defaults?';
    if (window.confirm(confirmMsg)) {
      setFaqsList(DEFAULT_QUICK_FAQS);
      onSaveQuickFaqs(DEFAULT_QUICK_FAQS);
      triggerSaveSuccess();
    }
  };

  const triggerSaveSuccess = () => {
    setSaveSuccessNotice(true);
    setTimeout(() => {
      setSaveSuccessNotice(false);
    }, 2000);
  };

  // Quick Preset suggestions for owner to tap and fill
  const suggestions = [
    {
      q: 'বিকাশ ও নগদ ক্যাশ-আউট চার্জ কত?',
      a: 'আমাদের দোকানে সব ক্যাশ-আউট চার্জ সরকারি নির্ধারিত সাশ্রয়ী রেটে প্রদান করা হয়।'
    },
    {
      q: 'দোকান খোলা বা বন্ধের সময়সূচী?',
      a: 'প্রতিদিন সকাল ৮:০০টা থেকে রাত ১০:০০টা পর্যন্ত আমাদের দোকান খোলা থাকে।'
    },
    {
      q: 'হোম ডেলিভারি সার্ভিস কি পাওয়া যাবে?',
      a: 'হ্যাঁ, আমাদের শপের যেকোনো অর্ডারে আমরা দ্রুত হ্যান্ড-টু-হ্যান্ড হোম ডেলিভারি সেবা দিয়ে থাকি।'
    },
    {
      q: 'জরুরি যোগাযোগের কোনো নম্বর আছে কি?',
      a: 'যেকোনো জরুরি প্রয়োজনে আমাদের হটলাইন নম্বরে সরাসরি কল করতে পারেন।'
    }
  ];

  return (
    <div id="chat-autoreply-settings-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-fade-in select-text font-sans">
      <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200/90 transform transition-all flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-150 flex items-center justify-between shrink-0 bg-gradient-to-r from-purple-50/70 via-indigo-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight flex items-center gap-1.5">
                <span>{lang === 'bn' ? 'রেডিমেড চ্যাট ও অটো-রিপ্লাই' : 'Quick Chat & Auto-Replies'}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
                  {lang === 'bn' ? 'কাস্টমাইজ' : 'Custom'}
                </span>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">
                {lang === 'bn' 
                  ? 'কাস্টমার রেডিমেড চ্যাটে ক্লিক করলে স্বয়ংক্রিয়ভাবে উত্তর চলে যাবে' 
                  : 'Automatic instant reply when visitor clicks a ready question'}
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Action Bar (Add New & Reset Defaults) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleStartAdd}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{lang === 'bn' ? 'নতুন মেসেজ যোগ করুন' : 'Add New Auto-Reply'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title={lang === 'bn' ? 'ডিফল্ট মেসেজ রিসেট করুন' : 'Reset defaults'}
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>{lang === 'bn' ? 'ডিফল্ট রিসেট' : 'Reset Defaults'}</span>
            </button>
          </div>

          {/* Add / Edit Form Modal/Drawer */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form 
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                onSubmit={handleSaveForm}
                className="bg-purple-50/70 border-2 border-purple-200 rounded-2xl p-4 space-y-3.5 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-purple-200/80 pb-2">
                  <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    {editingId 
                      ? (lang === 'bn' ? 'মেসেজ ও উত্তর এডিট করুন' : 'Edit Question & Reply')
                      : (lang === 'bn' ? 'নতুন রেডিমেড চ্যাট ও অটো-উত্তর তৈরি করুন' : 'Create Quick Question & Auto Reply')
                    }
                  </span>
                  <button 
                    type="button" 
                    onClick={handleCancelForm}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>

                {/* Preset Suggestions */}
                {!editingId && (
                  <div>
                    <span className="text-[9.5px] font-bold text-slate-500 block mb-1.5">
                      {lang === 'bn' ? '💡 দ্রুত সাজেশনের যেকোনোটিতে ক্লিক করুন:' : '💡 Or pick a quick template:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormQuestion(item.q);
                            setFormAnswer(item.a);
                          }}
                          className="text-[10px] font-semibold bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 px-2 py-1 rounded-lg transition-all text-left"
                        >
                          + {item.q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Question Input */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                    {lang === 'bn' ? 'কাস্টমার যে প্রশ্নটি দেখবে (রেডিমেড প্রশ্ন):' : 'Question shown to visitor:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formQuestion}
                    onChange={(e) => setFormQuestion(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: দোকান কখন খোলা থাকে?' : 'e.g. What are shop open hours?'}
                    className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Answer Input */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                    {lang === 'bn' ? 'স্বয়ংক্রিয় উত্তর (অটো-রিপ্লাই):' : 'Automatic Reply Message:'}
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formAnswer}
                    onChange={(e) => setFormAnswer(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: আমাদের দোকান প্রতিদিন সকাল ৮টা থেকে রাত ১০টা পর্যন্ত খোলা থাকে।' : 'e.g. Our shop is open daily from 8 AM to 10 PM.'}
                    className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none leading-relaxed"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{editingId ? (lang === 'bn' ? 'আপডেট করুন' : 'Update') : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save')}</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List of FAQs & Auto-Replies */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wide">
                {lang === 'bn' ? `সক্রিয় রেডিমেড চ্যাট তালিকা (${faqsList.length})` : `Active Quick Replies (${faqsList.length})`}
              </span>
              {saveSuccessNotice && (
                <span className="text-[10px] text-emerald-600 font-black flex items-center gap-1 animate-fade-in">
                  <Check className="w-3 h-3 stroke-[3]" />
                  {lang === 'bn' ? 'সফলভাবে সংরক্ষিত!' : 'Saved successfully!'}
                </span>
              )}
            </div>

            {faqsList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 space-y-2">
                <HelpCircle className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">{lang === 'bn' ? 'কোন রেডিমেড চ্যাট নেই' : 'No quick replies added yet'}</p>
                <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {lang === 'bn' 
                    ? 'উপরে "নতুন মেসেজ যোগ করুন" বাটনে ক্লিক করে প্রশ্ন ও অটো উত্তর তৈরি করুন।' 
                    : 'Click "Add New Auto-Reply" above to configure instant questions & replies.'}
                </p>
              </div>
            ) : (
              faqsList.map((faq, index) => (
                <div 
                  key={faq.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    faq.active 
                      ? 'bg-white border-slate-200 hover:border-purple-300 shadow-xs' 
                      : 'bg-slate-50/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      
                      {/* Question */}
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 leading-tight">
                          {faq.question}
                        </h4>
                      </div>

                      {/* Auto-Reply Answer */}
                      <div className="pl-7">
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-2 text-[11px] text-slate-700 leading-relaxed flex items-start gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                          <span className="font-normal text-slate-800">{faq.answer}</span>
                        </div>
                      </div>

                    </div>

                    {/* Actions & Switch */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      
                      {/* Active / Inactive Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(faq.id)}
                        className={`text-xs flex items-center gap-1 font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                          faq.active 
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                        title={faq.active ? (lang === 'bn' ? 'সক্রিয় আছে (ক্লিক করে নিষ্ক্রিয় করুন)' : 'Active') : (lang === 'bn' ? 'নিষ্ক্রিয় আছে (ক্লিক করে সক্রিয় করুন)' : 'Inactive')}
                      >
                        {faq.active ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span className="text-[9px]">{lang === 'bn' ? 'সক্রিয়' : 'Active'}</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="text-[9px]">{lang === 'bn' ? 'বন্ধ' : 'Off'}</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(faq)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-500 hover:text-purple-600 transition-all cursor-pointer"
                          title={lang === 'bn' ? 'এডিট করুন' : 'Edit'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(faq.id)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-all cursor-pointer"
                          title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-150 bg-slate-50 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-500 font-medium">
            {lang === 'bn' ? '✓ পরিবর্তনসমূহ স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।' : '✓ Changes auto-save in real-time.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
          </button>
        </div>

      </div>
    </div>
  );
}
