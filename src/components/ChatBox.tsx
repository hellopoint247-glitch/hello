import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, User, Check, CheckCheck, Copy, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage } from '../types';

interface ChatBoxProps {
  currentContactId: string;
  chatMessages: ChatMessage[];
  senderRole: 'owner' | 'customer';
  senderName: string;
  onSendMessage: (contactId: string, text: string, senderRole: 'owner' | 'customer', senderName: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onDeleteThread?: (contactId: string) => void;
  onMarkAsRead: (contactId: string, role: 'owner' | 'customer') => void;
  onClose: () => void;
  lang?: 'bn' | 'en';
  contactName: string;
  themeColor?: string;
}

export function ChatBox({
  currentContactId,
  chatMessages,
  senderRole,
  senderName,
  onSendMessage,
  onDeleteMessage,
  onDeleteThread,
  onMarkAsRead,
  onClose,
  lang = 'bn',
  contactName,
  themeColor = '#6244a6'
}: ChatBoxProps) {
  const [inputText, setInputText] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter messages for this specific customer
  const filteredMessages = chatMessages.filter(m => m.contactId === currentContactId);

  // Mark chats as read when opening the box or when new messages arrive
  useEffect(() => {
    onMarkAsRead(currentContactId, senderRole);
  }, [currentContactId, filteredMessages.length, senderRole, onMarkAsRead]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredMessages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(currentContactId, inputText.trim(), senderRole, senderName);
    setInputText('');
  };

  const copyToClipboard = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!val) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val).then(() => {
        setCopiedText(val);
        setTimeout(() => {
          setCopiedText(null);
        }, 2000);
      }).catch(() => {
        fallbackCopyToClipboard(val);
      });
    } else {
      fallbackCopyToClipboard(val);
    }
  };

  const fallbackCopyToClipboard = (val: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = val;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      if (successful) {
        setCopiedText(val);
        setTimeout(() => {
          setCopiedText(null);
        }, 2000);
      }
      document.body.removeChild(textArea);
    } catch (err) {
      console.error("Fallback chat text copy failed", err);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // conversion of 0 to 12
      const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

      const timeStr = `${hours}:${formattedMinutes} ${ampm}`;

      if (lang === 'bn') {
        const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        let result = timeStr;
        for (let i = 0; i < 10; i++) {
          result = result.replaceAll(String(i), bnNums[i]);
        }
        result = result.replace('AM', 'পূর্বাহ্ন').replace('PM', 'অপরাহ্ন');
        return result;
      }
      return timeStr;
    } catch {
      return '';
    }
  };

  const renderMessageText = (text: string, myMessage: boolean) => {
    // Matches sequences of 6 to 15 digits (handling english and bangla numbers, spaces and hyphens)
    const tokenRegex = /(\+?[0-9০-৯\s\-]{6,15})/g;
    
    if (!tokenRegex.test(text)) {
      return <p className="break-words font-medium select-text">{text}</p>;
    }

    tokenRegex.lastIndex = 0;
    const parts = text.split(tokenRegex);
    
    return (
      <p className="break-words font-medium select-text">
        {parts.map((part, index) => {
          const cleanPart = part.replace(/[\s\-]/g, '');
          const isNumber = /^\+?[0-9০-৯]{6,15}$/.test(cleanPart);
          
          if (isNumber && cleanPart.length >= 6) {
            const isCurrentlyCopied = copiedText === cleanPart;
            return (
              <span 
                key={index} 
                className={`inline-flex items-center gap-1 mx-0.5 px-1 rounded font-mono font-bold text-[11px] align-middle select-text ${
                  myMessage 
                    ? 'bg-black/20 text-white' 
                    : 'bg-stone-100 text-slate-800 border border-slate-200'
                }`}
              >
                <span className="select-text">{part}</span>
                <button
                  type="button"
                  onClick={(e) => copyToClipboard(cleanPart, e)}
                  className={`p-0.5 rounded cursor-pointer select-none ${
                    isCurrentlyCopied ? 'text-emerald-400' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={lang === 'bn' ? 'কপি করুন' : 'Copy'}
                >
                  {isCurrentlyCopied ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                </button>
              </span>
            );
          }
          return <span key={index} className="select-text">{part}</span>;
        })}
      </p>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center sm:items-center sm:justify-end sm:p-5 z-[100] animate-fadeIn select-none">
      <motion.div
        initial={{ y: 80, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 80, scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
        className="bg-white w-full max-w-md h-[88vh] sm:h-[480px] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100"
      >
        {/* Header bar */}
        <div 
          style={{ backgroundColor: themeColor }}
          className="text-white p-3.5 flex items-center justify-between shadow-sm select-none shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner shrink-0">
              <User className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[10px] font-bold leading-tight uppercase tracking-wider text-slate-100/90">
                {senderRole === 'owner' ? (lang === 'bn' ? 'গ্রাহক ইনবক্স' : 'CUSTOMER INBOX') : (lang === 'bn' ? 'মালিক ইনবক্স' : 'OWNER INBOX')}
              </h4>
              <h3 className="text-xs font-black text-white leading-tight truncate">
                {senderRole === 'owner' ? contactName : (lang === 'bn' ? 'মাহবুব হাসান পাভেল' : 'Mahbub Hasan Pavel')}
              </h3>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            {onDeleteThread && filteredMessages.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-full hover:bg-white/15 active:scale-90 transition-all text-white/80 hover:text-rose-200 cursor-pointer"
                title={lang === 'bn' ? 'সম্পূর্ণ চ্যাট মুছুন' : 'Clear Chat History'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 active:scale-90 transition-all text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Message feed stream */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#ebeef5] relative">
          {/* Custom In-App Confirmation Modal for Thread Clear */}
          {showClearConfirm && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-2xl border border-slate-200 text-center animate-fade-in">
                <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mx-auto mb-2.5">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-black text-slate-800">
                  {lang === 'bn' ? 'চ্যাট হিস্ট্রি মুছে ফেলবেন?' : 'Delete Chat History?'}
                </h4>
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  {lang === 'bn' 
                    ? 'এই কাস্টমারের সকল বার্তা স্থায়ীভাবে মুছে যাবে।' 
                    : 'All messages with this customer will be permanently deleted.'}
                </p>
                <div className="flex gap-2 mt-3.5">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all cursor-pointer"
                  >
                    {lang === 'bn' ? 'না' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onDeleteThread) {
                        onDeleteThread(currentContactId);
                      }
                      setShowClearConfirm(false);
                    }}
                    className="flex-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center my-1 select-none">
            <span className="text-[9px] font-bold text-slate-500 bg-white/80 border border-slate-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
              ⏱️ {lang === 'bn' ? 'বার্তাগুলি ৭ দিন পর স্বয়ংক্রিয়ভাবে মুছে যাবে' : 'Messages auto-delete after 7 days'}
            </span>
          </div>
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 select-none">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                style={{ backgroundColor: `${themeColor}12` }}
              >
                <MessageSquare className="w-5 h-5" style={{ color: themeColor }} />
              </div>
              <p className="text-[11px] font-bold text-slate-500">
                {lang === 'bn' ? 'কোন মেসেজ পাওয়া যায়নি।' : 'No messages yet.'}
              </p>
              <p className="text-[9.5px] font-semibold text-slate-400 mt-1 max-w-[200px]">
                {lang === 'bn' 
                  ? 'নিচে আপনার মেসেজটি টাইপ করে পাঠানো শুরু করতে পারেন।' 
                  : 'Start the conversation by sending a message below.'}
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const myMessage = msg.senderRole === senderRole;
              const isRead = msg.senderRole === 'owner' ? msg.readByCustomer : msg.readByOwner;

              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${myMessage ? 'items-end' : 'items-start'} mb-1.5`}
                >
                  {!myMessage && (
                    <div className="flex items-center gap-1.5 px-1 mb-0.5 text-[9.5px] font-extrabold text-slate-600 select-text">
                      <span>{msg.senderName || (lang === 'bn' ? 'গ্রাহক' : 'Customer')}</span>
                      {msg.senderPhone && (
                        <span className="font-mono text-purple-700 bg-purple-100/70 border border-purple-200/80 px-1 py-0.2 rounded text-[9px]">
                          {msg.senderPhone}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="relative group/msg flex items-center gap-1">
                    {onDeleteMessage && myMessage && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(msg.id)}
                        className="opacity-70 sm:opacity-0 group-hover/msg:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-white/80 transition-all cursor-pointer select-none"
                        title={lang === 'bn' ? 'মেসেজ মুছুন' : 'Delete Message'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    <div className={`max-w-[85%] rounded-xl px-3 py-1.5 shadow-tiny text-[11.5px] leading-relaxed font-semibold transition-all ${
                      myMessage 
                        ? 'text-white rounded-tr-xs' 
                        : 'bg-white text-slate-800 border border-slate-100 rounded-tl-xs'
                      }`}
                      style={myMessage ? { backgroundColor: themeColor } : undefined}
                    >
                      {renderMessageText(msg.text, myMessage)}
                      
                      <div className="flex items-center justify-end gap-1.5 mt-0.5 select-none">
                        <span className={`text-[8px] font-bold ${myMessage ? 'text-white/65' : 'text-slate-400'}`}>
                          {formatTime(msg.createdAt)}
                        </span>
                        {myMessage && (
                          <span className="text-white/80">
                            {isRead ? (
                              <CheckCheck className="w-3 h-3 text-yellow-300" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {onDeleteMessage && !myMessage && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(msg.id)}
                        className="opacity-70 sm:opacity-0 group-hover/msg:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-white/80 transition-all cursor-pointer select-none"
                        title={lang === 'bn' ? 'মেসেজ মুছুন' : 'Delete Message'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Controls */}
        <form 
          onSubmit={handleSend}
          className="p-2 border-t border-slate-150 bg-white flex items-center gap-1.5 shrink-0 select-none"
        >
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={lang === 'bn' ? 'মেসেজ লিখুন...' : 'Type a message...'}
            className="flex-1 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 rounded-full py-1.5 px-3.5 text-[11px] font-bold border border-slate-150 focus:border-slate-300 focus:ring-0 outline-none transition-all placeholder:text-slate-400"
          />
          <button 
            type="submit"
            disabled={!inputText.trim()}
            style={inputText.trim() ? { backgroundColor: themeColor } : { backgroundColor: '#cbd5e1', cursor: 'not-allowed' }}
            className="p-2 rounded-full text-white active:scale-95 hover:brightness-105 transition-all shadow-md shrink-0 flex items-center justify-center cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
