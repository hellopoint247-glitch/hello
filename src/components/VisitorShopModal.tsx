/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Search, X, Check, ArrowLeft, ArrowRight, 
  Phone, User, MessageSquare, Tag, Eye, ChevronLeft, ChevronRight,
  Sparkles, CheckCircle2, ShieldCheck, ShoppingCart
} from 'lucide-react';
import { Product } from '../types';

interface VisitorShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currency?: string;
  lang: 'bn' | 'en';
  themeColor?: string;
  onOrderInquiry: (product: Product, customerName: string, customerPhone: string, note?: string) => void;
}

// Product Card Auto-Rotating Multi-Image Carousel
function ProductCardImage({
  images,
  imageUrl,
  name,
  onClick
}: {
  images?: string[];
  imageUrl?: string;
  name: string;
  onClick: () => void;
}) {
  const allImages = useMemo(() => {
    if (images && images.length > 0) return images.filter(Boolean);
    if (imageUrl) return [imageUrl];
    return [];
  }, [images, imageUrl]);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (allImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % allImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [allImages.length]);

  return (
    <div 
      className="relative w-full aspect-square bg-slate-100 overflow-hidden cursor-pointer flex items-center justify-center select-none"
      onClick={onClick}
    >
      {allImages.length > 0 ? (
        <img
          src={allImages[currentIndex]}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out"
          referrerPolicy="no-referrer"
        />
      ) : (
        <ShoppingBag className="w-7 h-7 text-slate-300" />
      )}

      {/* Multi-image indicators */}
      {allImages.length > 1 && (
        <div className="absolute bottom-1.5 inset-x-0 flex justify-center gap-1 z-10 pointer-events-none">
          {allImages.map((_, idx) => (
            <span
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-3 bg-purple-600 shadow-sm' : 'w-1 bg-white/75'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function VisitorShopModal({
  isOpen,
  onClose,
  products,
  currency = '৳',
  lang,
  themeColor = '#6244a6',
  onOrderInquiry
}: VisitorShopModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState<number>(0);

  // Inquiry 2-step form state: 1 = Name/Mobile, 2 = Inquiry question / note
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [inquiryStep, setInquiryStep] = useState<1 | 2>(1);
  const [inquiryName, setInquiryName] = useState(() => localStorage.getItem('hellopoint_visitor_name') || '');
  const [inquiryPhone, setInquiryPhone] = useState(() => localStorage.getItem('hellopoint_visitor_phone') || '');
  const [inquiryNote, setInquiryNote] = useState('');
  const [inquiryError, setInquiryError] = useState('');

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim()) {
        cats.add(p.category.trim());
      }
    });
    return Array.from(cats);
  }, [products]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleOpenInquiry = (product: Product) => {
    setSelectedProduct(product);
    setShowInquiryForm(true);
    setInquiryError('');
    setInquiryNote(lang === 'bn' ? 'আমি এই প্রডাক্টটি নিতে চাই, বিস্তারিত তথ্য জানতে চাই।' : 'I am interested in this product and would like details.');
    // If visitor already has saved name and phone, default to step 2, else step 1
    const savedName = localStorage.getItem('hellopoint_visitor_name');
    const savedPhone = localStorage.getItem('hellopoint_visitor_phone');
    if (savedName && savedPhone && savedPhone.length === 11) {
      setInquiryName(savedName);
      setInquiryPhone(savedPhone);
      setInquiryStep(2);
    } else {
      setInquiryStep(1);
    }
  };

  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryError('');

    const cleanName = inquiryName.trim();
    const cleanPhone = inquiryPhone.replace(/\D/g, '');

    if (!cleanName) {
      setInquiryError(lang === 'bn' ? 'অনুগ্রহ করে আপনার নাম দিন।' : 'Please enter your name.');
      return;
    }

    if (cleanPhone.length !== 11) {
      setInquiryError(lang === 'bn' ? 'অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid 11-digit mobile number.');
      return;
    }

    // Save
    localStorage.setItem('hellopoint_visitor_name', cleanName);
    localStorage.setItem('hellopoint_visitor_phone', cleanPhone);

    setInquiryStep(2);
  };

  const handleSubmitFinalInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryError('');

    const cleanName = inquiryName.trim();
    const cleanPhone = inquiryPhone.replace(/\D/g, '');

    if (!cleanName || cleanPhone.length !== 11) {
      setInquiryStep(1);
      setInquiryError(lang === 'bn' ? 'নাম ও মোবাইল নম্বর সঠিকভাবে পূরণ করুন।' : 'Please enter valid name & phone number.');
      return;
    }

    const note = inquiryNote.trim() || (lang === 'bn' ? 'আমি এই প্রডাক্টটি নিতে চাই।' : 'I am interested in this product.');

    if (selectedProduct) {
      onOrderInquiry(selectedProduct, cleanName, cleanPhone, note);
      setShowInquiryForm(false);
      setSelectedProduct(null);
      onClose(); // Close full-page shop to reveal live chat
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="visitor-shop-fullscreen-page"
      className="fixed inset-0 bg-[#f8fafc] z-[99998] flex flex-col overflow-hidden animate-fade-in font-sans"
    >
      {/* Top Header Bar */}
      <header 
        className="text-white shrink-0 shadow-md transition-colors z-20"
        style={{ backgroundColor: themeColor }}
      >
        <div className="max-w-7xl mx-auto px-3.5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
              title={lang === 'bn' ? 'ফিরে যান' : 'Back'}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black truncate leading-tight tracking-wide">
                  {lang === 'bn' ? 'HelloPoint অনলাইন শপ' : 'HelloPoint Online Shop'}
                </h1>
                <span className="bg-yellow-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                  {filteredProducts.length} {lang === 'bn' ? 'পণ্য' : 'Items'}
                </span>
              </div>
              <p className="text-[10.5px] font-bold text-white/80 truncate hidden sm:block">
                {lang === 'bn' ? 'পছন্দের পণ্যটি নির্বাচন করে সরাসরি চ্যাটে অর্ডার করুন' : 'Select products and inquire or order directly via chat'}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sticky Search & Category Bar */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs shrink-0 z-10">
        <div className="max-w-7xl mx-auto p-3 space-y-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'পণ্য বা ক্যাটাগরি অনুসন্ধান করুন...' : 'Search products or categories...'}
              className="w-full bg-slate-50 border border-slate-200/90 rounded-2xl pl-10 pr-9 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-600 focus:bg-white transition-all shadow-inner"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-xl text-[10.5px] font-black shrink-0 transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-650 hover:bg-slate-200/80'
              }`}
            >
              {lang === 'bn' ? 'সকল পণ্য' : 'All Products'} ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-[10.5px] font-black shrink-0 transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-650 hover:bg-slate-200/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Products Grid Area (Displaying 4 products per row on desktop/tablet, compact on mobile) */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 scrollbar-thin">
        <div className="max-w-7xl mx-auto">
          {filteredProducts.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
              <div className="p-4 rounded-3xl bg-purple-50 text-purple-600">
                <ShoppingBag className="w-12 h-12 opacity-60" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-700">
                  {lang === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি!' : 'No products found!'}
                </p>
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  {lang === 'bn' ? 'অন্য ক্যাটাগরি অথবা সার্চ দিয়ে চেষ্টা করুন।' : 'Try searching with different keywords.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
              {filteredProducts.map((product) => {
                const discountPercent = product.originalPrice && product.originalPrice > product.price 
                  ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                  : 0;

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-purple-300"
                  >
                    {/* Multi-Image Rotating Carousel Area */}
                    <div className="relative">
                      <ProductCardImage
                        images={product.images}
                        imageUrl={product.imageUrl}
                        name={product.name}
                        onClick={() => {
                          setSelectedProduct(product);
                          setDetailImageIndex(0);
                        }}
                      />

                      {/* Badges */}
                      <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10 pointer-events-none">
                        {discountPercent > 0 && (
                          <span className="bg-rose-500 text-white font-black text-[7.5px] sm:text-[8px] px-1.5 py-0.5 rounded-md shadow-xs uppercase tracking-wider">
                            -{discountPercent}% ছাড়
                          </span>
                        )}
                        {product.category && (
                          <span className="bg-slate-900/75 backdrop-blur-xs text-white font-bold text-[7px] sm:text-[7.5px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            {product.category}
                          </span>
                        )}
                      </div>

                      <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                        {product.inStock ? (
                          <span className="bg-emerald-500/90 backdrop-blur-xs text-white font-black text-[7px] sm:text-[7.5px] px-1.5 py-0.5 rounded-md shadow-xs">
                            {lang === 'bn' ? 'স্টকে আছে' : 'In Stock'}
                          </span>
                        ) : (
                          <span className="bg-slate-600/90 backdrop-blur-xs text-white font-black text-[7px] sm:text-[7.5px] px-1.5 py-0.5 rounded-md shadow-xs">
                            {lang === 'bn' ? 'স্টক শেষ' : 'Out of Stock'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content Info */}
                    <div className="p-2 sm:p-2.5 flex flex-col flex-1 justify-between gap-1.5">
                      <div>
                        <h4 
                          onClick={() => {
                            setSelectedProduct(product);
                            setDetailImageIndex(0);
                          }}
                          className="text-[10.5px] sm:text-[11.5px] font-black text-slate-850 line-clamp-2 leading-snug cursor-pointer hover:text-purple-700 transition-colors text-left"
                          title={product.name}
                        >
                          {product.name}
                        </h4>
                      </div>

                      {/* Price row */}
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-[13px] font-black text-purple-700 font-mono">
                          {currency}{product.price.toLocaleString()}
                        </span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 line-through font-mono">
                            {currency}{product.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Order / Inquiry Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenInquiry(product)}
                        className="w-full mt-1 py-1.5 px-2 bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white border border-purple-200 hover:border-purple-600 rounded-xl text-[9px] sm:text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-2xs"
                      >
                        <MessageSquare className="w-3 h-3 shrink-0" />
                        <span className="truncate">{lang === 'bn' ? 'অর্ডার / বিস্তারিত' : 'Order / Details'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="p-2 bg-white border-t border-slate-200 text-center shrink-0 text-[9.5px] font-bold text-slate-400">
        {lang === 'bn' ? 'যেকোনো পণ্য ক্রয়ের জন্য অথবা তথ্য জানতে "অর্ডার / বিস্তারিত" বাটনে ট্যাপ করুন।' : 'Tap "Order / Details" to chat directly for product inquiry or order.'}
      </footer>

      {/* PRODUCT DETAILS FULL-PAGE VIEW */}
      {selectedProduct && !showInquiryForm && (
        <div 
          id="product-details-fullscreen-page"
          className="fixed inset-0 bg-[#f8fafc] z-[100000] overflow-y-auto animate-fade-in flex flex-col font-sans select-none"
        >
          {/* Top Sticky Header */}
          <header 
            className="text-white shrink-0 shadow-md sticky top-0 z-30 transition-colors"
            style={{ backgroundColor: themeColor }}
          >
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <button 
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer border border-white/20 shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'bn' ? 'শপে ফিরে যান' : 'Back to Shop'}</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-200 bg-black/20 px-3 py-1 rounded-full hidden sm:inline-flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-yellow-300" />
                  <span>{selectedProduct.category || (lang === 'bn' ? 'পণ্য বিবরণ' : 'Product Details')}</span>
                </span>
                <button 
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Main Full-Page Product Showcase */}
          <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-start">
              
              {/* Left Column: Image Gallery */}
              <div className="md:col-span-6 flex flex-col gap-3">
                {(() => {
                  const allImages = (selectedProduct.images && selectedProduct.images.length > 0) 
                    ? selectedProduct.images.filter(Boolean) 
                    : (selectedProduct.imageUrl ? [selectedProduct.imageUrl] : []);
                  const activeImg = allImages[detailImageIndex] || allImages[0];
                  const discountPercent = selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price 
                    ? Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)
                    : 0;

                  return (
                    <div className="space-y-3">
                      {/* Main Featured Image Container */}
                      <div className="relative w-full aspect-square bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex items-center justify-center group">
                        {activeImg ? (
                          <img
                            src={activeImg}
                            alt={selectedProduct.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ShoppingBag className="w-16 h-16 text-slate-300" />
                        )}

                        {/* Prev / Next controls if multiple images */}
                        {allImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
                              }}
                              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white transition-all cursor-pointer shadow-md opacity-80 hover:opacity-100"
                              title={lang === 'bn' ? 'আগের ছবি' : 'Previous image'}
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailImageIndex((prev) => (prev + 1) % allImages.length);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white transition-all cursor-pointer shadow-md opacity-80 hover:opacity-100"
                              title={lang === 'bn' ? 'পরের ছবি' : 'Next image'}
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
                          {discountPercent > 0 && (
                            <span className="bg-rose-600 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-md uppercase tracking-wider">
                              -{discountPercent}% ছাড়
                            </span>
                          )}
                          {selectedProduct.category && (
                            <span className="bg-slate-900/80 backdrop-blur-xs text-white font-bold text-[10px] px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                              {selectedProduct.category}
                            </span>
                          )}
                        </div>

                        <div className="absolute top-3 right-3 z-10 pointer-events-none">
                          {selectedProduct.inStock ? (
                            <span className="bg-emerald-500 text-white font-black text-xs px-3 py-1 rounded-xl shadow-md flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                              {lang === 'bn' ? 'স্টকে আছে' : 'In Stock'}
                            </span>
                          ) : (
                            <span className="bg-slate-700 text-white font-black text-xs px-3 py-1 rounded-xl shadow-md">
                              {lang === 'bn' ? 'স্টক শেষ' : 'Out of Stock'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Multi-Image Thumbnails */}
                      {allImages.length > 1 && (
                        <div className="grid grid-cols-4 gap-2.5">
                          {allImages.map((img, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setDetailImageIndex(idx)}
                              className={`aspect-square rounded-2xl bg-white border-2 overflow-hidden shadow-2xs transition-all cursor-pointer ${
                                (detailImageIndex % allImages.length) === idx
                                  ? 'border-purple-600 ring-2 ring-purple-600/30'
                                  : 'border-slate-200 hover:border-slate-300 opacity-75 hover:opacity-100'
                              }`}
                            >
                              <img 
                                src={img} 
                                alt={`${selectedProduct.name} ${idx + 1}`} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Open Product Info & Action */}
              <div className="md:col-span-6 flex flex-col text-left space-y-5">
                
                {/* Category & Status Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedProduct.category && (
                    <span className="bg-purple-100 text-purple-800 font-black text-[11px] px-3 py-1 rounded-full uppercase tracking-wider">
                      {selectedProduct.category}
                    </span>
                  )}
                  {selectedProduct.inStock ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {lang === 'bn' ? 'স্টকে উপলব্ধ' : 'Available in Stock'}
                    </span>
                  ) : (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px] px-3 py-1 rounded-full">
                      {lang === 'bn' ? 'সাময়িকভাবে স্টক শেষ' : 'Out of Stock'}
                    </span>
                  )}
                </div>

                {/* Product Title */}
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                    {selectedProduct.name}
                  </h1>
                </div>

                {/* Price Display */}
                <div className="flex items-baseline gap-3 pb-4 border-b border-slate-200/80">
                  <span className="text-2xl sm:text-3xl font-black text-purple-700 font-mono">
                    {currency}{selectedProduct.price.toLocaleString()}
                  </span>
                  {selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price && (
                    <span className="text-base sm:text-lg font-bold text-slate-400 line-through font-mono">
                      {currency}{selectedProduct.originalPrice.toLocaleString()}
                    </span>
                  )}
                  {selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price && (
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% ছাড়
                    </span>
                  )}
                </div>

                {/* Open Product Description (খুলা বিবরণ - Not inside a boxed card) */}
                <div className="space-y-2 py-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {lang === 'bn' ? 'পণ্যের বিবরণ' : 'Product Description'}
                  </h3>
                  <div className="text-sm sm:text-[15px] font-normal text-slate-700 leading-relaxed whitespace-pre-line">
                    {selectedProduct.description || (lang === 'bn' ? 'এই পণ্যটির কোনো বিবরণ দেওয়া হয়নি।' : 'No description provided for this product.')}
                  </div>
                </div>

                {/* Order & Inquiry CTA Button */}
                <div className="pt-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleOpenInquiry(selectedProduct)}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-98 flex items-center justify-center gap-2.5 cursor-pointer uppercase tracking-wider"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>{lang === 'bn' ? 'অর্ডার বা বিস্তারিত জানতে চ্যাট করুন' : 'Inquire / Order Via Chat'}</span>
                  </button>

                  <p className="text-[11px] font-bold text-slate-400 text-center flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>{lang === 'bn' ? 'সরাসরি দোকানদারের সাথে লাইভ চ্যাটে অর্ডার বা প্রশ্ন করুন' : 'Chat directly with shop owner for ordering or queries'}</span>
                  </p>
                </div>

              </div>

            </div>
          </main>
        </div>
      )}

      {/* 2-STEP INQUIRY / ORDER FORM MODAL */}
      {showInquiryForm && selectedProduct && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-[100001] animate-fade-in font-sans">
          <div className="bg-white rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-150 p-5 flex flex-col text-left">
            
            {/* Header with Step Indicator */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    {lang === 'bn' ? 'পণ্য অর্ডার ও অনুসন্ধান' : 'Product Inquiry / Order'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full ${inquiryStep === 1 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {lang === 'bn' ? '১. পরিচয়' : '1. Info'}
                    </span>
                    <span className="text-[8px] text-slate-300">→</span>
                    <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full ${inquiryStep === 2 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {lang === 'bn' ? '২. বার্তা' : '2. Message'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInquiryForm(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product summary chip */}
            <div className="p-2 rounded-xl bg-purple-50/80 border border-purple-100 flex items-center justify-between text-xs font-bold mt-3">
              <span className="text-slate-850 truncate mr-2 font-black">{selectedProduct.name}</span>
              <span className="text-purple-700 font-mono font-black shrink-0">{currency}{selectedProduct.price}</span>
            </div>

            {/* STEP 1: Name and Mobile Number */}
            {inquiryStep === 1 && (
              <form onSubmit={handleProceedToStep2} className="space-y-3 mt-3">
                <div>
                  <label className="block text-[9.5px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'আপনার নাম' : 'Your Name'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={inquiryName}
                      onChange={(e) => {
                        setInquiryName(e.target.value);
                        setInquiryError('');
                      }}
                      placeholder={lang === 'bn' ? 'আপনার পুরো নাম লিখুন' : 'Enter full name'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 focus:bg-white transition-all shadow-inner"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9.5px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর (১১ ডিজিট)' : 'Mobile Number (11 digits)'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      maxLength={11}
                      value={inquiryPhone}
                      onChange={(e) => {
                        setInquiryPhone(e.target.value.replace(/\D/g, ''));
                        setInquiryError('');
                      }}
                      placeholder="01XXXXXXXXX"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 focus:bg-white transition-all shadow-inner font-mono"
                    />
                  </div>
                </div>

                {inquiryError && (
                  <p className="text-[9.5px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-xl text-center leading-none">
                    {inquiryError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider"
                >
                  <span>{lang === 'bn' ? 'পরবর্তী ধাপে যান' : 'Next Step'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* STEP 2: Product inquiry query / message */}
            {inquiryStep === 2 && (
              <form onSubmit={handleSubmitFinalInquiry} className="space-y-3 mt-3">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">{inquiryName} ({inquiryPhone})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInquiryStep(1)}
                    className="text-purple-600 hover:text-purple-800 font-extrabold text-[9px] underline shrink-0 cursor-pointer"
                  >
                    {lang === 'bn' ? 'পরিবর্তন' : 'Edit'}
                  </button>
                </div>

                <div>
                  <label className="block text-[9.5px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'প্রডাক্ট সম্পর্কে কি জানতে চান এখানে লিখুন:' : 'What do you want to know about this product?'} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={inquiryNote}
                    onChange={(e) => {
                      setInquiryNote(e.target.value);
                      setInquiryError('');
                    }}
                    placeholder={lang === 'bn' ? 'যেমন: আমি এই প্রোডাক্টটি কিনতে চাই, ডেলিভারি চার্জ কত অথবা বিস্তারিত তথ্য...' : 'Write what you want to know about this product...'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 focus:bg-white transition-all shadow-inner resize-none"
                    autoFocus
                  />
                </div>

                {inquiryError && (
                  <p className="text-[9.5px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-xl text-center leading-none">
                    {inquiryError}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInquiryStep(1)}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {lang === 'bn' ? 'আগে' : 'Back'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'চ্যাটে বার্তা পাঠান' : 'Send to Live Chat'}</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
