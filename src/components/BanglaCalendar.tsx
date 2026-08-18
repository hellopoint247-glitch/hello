import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info, Award } from 'lucide-react';

interface BanglaCalendarProps {
  onClose: () => void;
  lang?: 'bn' | 'en';
  themeColor?: string;
  currency?: string;
}

// Convert numbers to Bengali digits
export const toBengaliDigits = (num: number | string): string => {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num
    .toString()
    .split('')
    .map((digit) => (/[0-9]/.test(digit) ? bengaliDigits[parseInt(digit, 10)] : digit))
    .join('');
};

// Bengali Months & Weekdays
const BENGALI_WEEKDAYS_SHORT = ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র'];
const BENGALI_WEEKDAYS_LONG = [
  'শনিবার',
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
  'শুক্রবার'
];

const BENGALI_MONTHS_MAP = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর'
];

// Traditional Bengali Season & Month names
const TRADITIONAL_BENGALI_MONTHS = [
  { name: 'বৈশাখ', season: 'গ্রীষ্ম' },
  { name: 'জ্যৈষ্ঠ', season: 'গ্রীষ্ম' },
  { name: 'আষাঢ়', season: 'বর্ষা' },
  { name: 'শ্রাবণ', season: 'বর্ষা' },
  { name: 'ভাদ্র', season: 'শরৎ' },
  { name: 'আশ্বিন', season: 'শরৎ' },
  { name: 'কার্তিক', season: 'হেমন্ত' },
  { name: 'অগ্রহায়ণ', season: 'হেমন্ত' },
  { name: 'পৌষ', season: 'শীত' },
  { name: 'মাঘ', season: 'শীত' },
  { name: 'ফাল্গুন', season: 'বসন্ত' },
  { name: 'চৈত্র', season: 'বসন্ত' }
];

// Map Gregorian date to Traditional Bengali Date
// Standard calendar updated since 2019 in Bangladesh (Bangla Academy version):
// Boishakh to Bhadro (April 14 to Sep 15) = 1st 6 months are 31 days.
// Ashwin to Magh (Sep 16 to Feb 12) = Next 5 months are 30 days.
// Falgun (Feb 13 to Mar 13) is 29 days (30 days in leap year).
// Choitro (Mar 14 to Apr 13) is 30 days.
interface TradBanglaDate {
  day: number;
  month: string;
  season: string;
  year: number;
}

export function getTraditionalBanglaDate(date: Date): TradBanglaDate {
  const d = date.getDate();
  const m = date.getMonth(); // 0-indexed
  const y = date.getFullYear();

  let banglaYear = y - 593;
  // Year transitions on April 14 (Boishakh 1)
  if (m < 3 || (m === 3 && d < 14)) {
    banglaYear = y - 594;
  }

  // Days elapsed in Gregorian calendar starting from April 14
  // We can calculate exactly or use a date comparisons map.
  // Let's implement dynamic calculation.
  const isLeapYear = (year: number) => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  };

  // Build the list of traditional monthly starts and their lengths
  // Bangladesh revised calendar schema:
  // Boishakh (31 days, April 14)
  // Joishtho (31 days, May 15)
  // Ashar (31 days, June 15)
  // Srabon (31 days, July 16)
  // Bhadro (31 days, August 16)
  // Ashwin (30 days, September 16)
  // Kartik (30 days, October 16)
  // Ograhayon (30 days, November 15)
  // Poush (30 days, December 15)
  // Magh (30 days, January 14)
  // Falgun (29 days, 30 in leap year, February 13)
  // Choitro (30 days, March 14)

  // Quick fallback calculator for simplicity and high performance
  // June: June 1 to June 14 = Joishtho (18 to 31), June 15 to June 30 = Ashar (1 to 16)
  // Let's do a reliable lookup table based on Gregorian date.
  let banglaDay = 1;
  let monthIdx = 0;

  // Let's use a very clean conditional structure
  if (m === 0) { // Jan
    if (d < 14) {
      monthIdx = 8; // Poush
      banglaDay = d + 17;
    } else {
      monthIdx = 9; // Magh
      banglaDay = d - 13;
    }
  } else if (m === 1) { // Feb
    if (d < 13) {
      monthIdx = 9; // Magh
      banglaDay = d + 18;
    } else {
      monthIdx = 10; // Falgun
      banglaDay = d - 12;
    }
  } else if (m === 2) { // Mar
    const febLeap = isLeapYear(y);
    const splitDay = febLeap ? 14 : 14; 
    if (d < splitDay) {
      monthIdx = 10; // Falgun
      banglaDay = d + (febLeap ? 17 : 16);
    } else {
      monthIdx = 11; // Choitro
      banglaDay = d - 13;
    }
  } else if (m === 3) { // Apr
    if (d < 14) {
      monthIdx = 11; // Choitro
      banglaDay = d + 18;
    } else {
      monthIdx = 0; // Boishakh
      banglaDay = d - 13;
    }
  } else if (m === 4) { // May
    if (d < 15) {
      monthIdx = 0; // Boishakh
      banglaDay = d + 17;
    } else {
      monthIdx = 1; // Joishtho
      banglaDay = d - 14;
    }
  } else if (m === 5) { // Jun
    if (d < 15) {
      monthIdx = 1; // Joishtho
      banglaDay = d + 17;
    } else {
      monthIdx = 2; // Ashar
      banglaDay = d - 14;
    }
  } else if (m === 6) { // Jul
    if (d < 16) {
      monthIdx = 2; // Ashar
      banglaDay = d + 16;
    } else {
      monthIdx = 3; // Srabon
      banglaDay = d - 15;
    }
  } else if (m === 7) { // Aug
    if (d < 16) {
      monthIdx = 3; // Srabon
      banglaDay = d + 16;
    } else {
      monthIdx = 4; // Bhadro
      banglaDay = d - 15;
    }
  } else if (m === 8) { // Sep
    if (d < 16) {
      monthIdx = 4; // Bhadro
      banglaDay = d + 16;
    } else {
      monthIdx = 5; // Ashwin
      banglaDay = d - 15;
    }
  } else if (m === 9) { // Oct
    if (d < 16) {
      monthIdx = 5; // Ashwin
      banglaDay = d + 15;
    } else {
      monthIdx = 6; // Kartik
      banglaDay = d - 15;
    }
  } else if (m === 10) { // Nov
    if (d < 15) {
      monthIdx = 6; // Kartik
      banglaDay = d + 16;
    } else {
      monthIdx = 7; // Ograhayon
      banglaDay = d - 14;
    }
  } else if (m === 11) { // Dec
    if (d < 15) {
      monthIdx = 7; // Ograhayon
      banglaDay = d + 16;
    } else {
      monthIdx = 8; // Poush
      banglaDay = d - 14;
    }
  }

  const mInfo = TRADITIONAL_BENGALI_MONTHS[monthIdx];
  return {
    day: banglaDay,
    month: mInfo.name,
    season: mInfo.season,
    year: banglaYear
  };
}

export default function BanglaCalendar({ onClose, lang = 'bn', themeColor = '#6244a6' }: BanglaCalendarProps) {
  // Always render the current standard date & allow full month grid display
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed

  // For the grid layout: first day of current month & total days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Day of week for the first day of the month: 0 (Sun) to 6 (Sat)
  // Bangla weekdays ordered: Saturday (0) to Friday (6) in BENGALI_WEEKDAYS_SHORT
  // Gregorian: 0 is Sun, 1 is Mon, 2 is Tue, 3 is Wed, 4 is Thu, 5 is Fri, 6 is Sat.
  // Let's create a map to translate standard JS day to Saturday-based day:
  // Sun(0) -> 1, Mon(1) -> 2, Tue(2) -> 3, Wed(3) -> 4, Thu(4) -> 5, Fri(5) -> 6, Sat(6) -> 0.
  const getBanglaWeekPosition = (gregorianDay: number) => {
    return (gregorianDay + 1) % 7;
  };

  const firstDayOffset = getBanglaWeekPosition(firstDayOfMonth.getDay());

  // Generate blank gaps for Saturday alignment
  const blankDays = Array.from({ length: firstDayOffset }, (_, h) => null);
  
  // Fill grid with current month dates
  const monthDays = Array.from({ length: totalDaysInMonth }, (_, index) => {
    const dayDate = new Date(currentYear, currentMonth, index + 1);
    const tradInfo = getTraditionalBanglaDate(dayDate);
    const dayOfWeek = dayDate.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    // Map standard gregorian index to Bangla weekday name
    const bWeekDay = BENGALI_WEEKDAYS_SHORT[(dayOfWeek + 1) % 7];
    return {
      date: dayDate,
      dayNum: index + 1,
      weekDayBangla: bWeekDay,
      tradInfo
    };
  });

  const gridCells = [...blankDays, ...monthDays];

  // Currently selected date traditional information
  const selectedTradInfo = getTraditionalBanglaDate(selectedDate);
  const selectedDayOfWeek = selectedDate.getDay();
  const selectedWeekDayLong = BENGALI_WEEKDAYS_LONG[(selectedDayOfWeek + 1) % 7];

  return (
    <div id="bangla-calendar-modal" className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-[999999] animate-fade-in print:hidden select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', duration: 0.35 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[340px] overflow-hidden flex flex-col font-sans"
      >
        {/* Simple Header */}
        <div 
          className="p-4 text-white relative"
          style={{ backgroundColor: themeColor }}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white/95">
              <CalendarIcon className="w-3.5 h-3.5 text-yellow-300" />
              {lang === 'bn' ? 'বাংলা ক্যালেন্ডার' : 'Bangla Calendar'}
            </span>
            <button 
              onClick={onClose}
              className="bg-black/15 hover:bg-black/25 text-white/95 p-1 rounded-full transition-all cursor-pointer outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-left flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold font-bengali leading-none">
                {BENGALI_MONTHS_MAP[currentMonth]} {toBengaliDigits(currentYear)}
              </h2>
            </div>
            
            {/* Traditional date badge */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl px-2.5 py-1.5 border border-white/10 text-right">
              <p className="text-[10.5px] font-black text-yellow-300 font-bengali leading-none">
                {selectedTradInfo.day}ই {selectedTradInfo.month}
              </p>
              <p className="text-[8px] font-bold text-white/80 mt-0.5 leading-none">
                {selectedWeekDayLong}
              </p>
            </div>
          </div>
        </div>

        {/* Simplified Calendar Monthly Grid Body */}
        <div className="p-3">
          {/* Weekday Labels Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 mb-1.5">
            {BENGALI_WEEKDAYS_SHORT.map((day, idx) => (
              <div 
                key={day} 
                className={`py-0.5 rounded ${idx === 6 ? 'text-rose-500 bg-rose-50/70 font-black' : 'bg-slate-50 text-slate-500'}`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((cell, idx) => {
              if (cell === null) {
                return (
                  <div 
                    key={`blank-${idx}`} 
                    className="aspect-square bg-slate-50/30 rounded-lg"
                  />
                );
              }

              const isCurrentDay = today.getDate() === cell.dayNum;
              const isSelected = selectedDate.getDate() === cell.dayNum;
              const isFriday = cell.date.getDay() === 5; // Friday is 5
              
              return (
                <button
                  key={`day-${cell.dayNum}`}
                  onClick={() => setSelectedDate(cell.date)}
                  className={`aspect-square relative rounded-lg flex flex-col justify-between p-1 border transition-all cursor-pointer focus:outline-none ${
                    isSelected 
                      ? 'shadow-sm border-transparent text-white' 
                      : isCurrentDay
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200/50'
                  }`}
                  style={{
                    backgroundColor: isSelected ? themeColor : undefined,
                  }}
                >
                  {/* Gregorian Date Digit inside day cell */}
                  <div className="flex justify-between w-full items-start leading-none mb-0.5">
                    <span className={`text-[7px] font-mono leading-none ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                      {cell.dayNum}
                    </span>
                    {isCurrentDay && (
                      <span className="w-1 h-1 bg-yellow-400 rounded-full" />
                    )}
                  </div>

                  {/* Bengali Date Digit */}
                  <div className={`text-center font-bold text-xs leading-none font-bengali ${
                    isSelected 
                      ? 'text-white' 
                      : isFriday 
                        ? 'text-rose-600' 
                        : 'text-slate-800'
                  }`}>
                    {toBengaliDigits(cell.dayNum)}
                  </div>

                  {/* Bangla Weekday alongside the date */}
                  <div className={`text-[6.5px] font-medium text-center leading-none mt-0.5 ${
                    isSelected 
                      ? 'text-white/70' 
                      : isFriday 
                        ? 'text-rose-450' 
                        : 'text-slate-450'
                  }`}>
                    {cell.weekDayBangla}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Bottom Close control */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-white text-[11px] font-black transition-all cursor-pointer shadow-sm hover:shadow active:scale-98 outline-none"
            style={{ backgroundColor: themeColor }}
          >
            {lang === 'bn' ? 'ঠিক আছে' : 'Close'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
