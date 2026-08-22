/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Camera, 
  Tag, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  UploadCloud,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { Product } from '../types';

interface ShopManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  currency?: string;
  lang: 'bn' | 'en';
  themeColor?: string;
}

export function ShopManagementModal({
  isOpen,
  onClose,
  products,
  onSaveProduct,
  onDeleteProduct,
  currency = '৳',
  lang,
  themeColor = '#6244a6'
}: ShopManagementModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [inStock, setInStock] = useState(true);
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setPrice('');
    setOriginalPrice('');
    setCategory('অ্যাক্সেসরিজ');
    setDescription('');
    setImages([]);
    setInStock(true);
    setFormError('');
    setIsAddingNew(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setPrice(prod.price.toString());
    setOriginalPrice(prod.originalPrice ? prod.originalPrice.toString() : '');
    setCategory(prod.category || 'অ্যাক্সেসরিজ');
    setDescription(prod.description || '');
    const productImages = (prod.images && prod.images.length > 0) 
      ? prod.images 
      : (prod.imageUrl ? [prod.imageUrl] : []);
    setImages(productImages.slice(0, 4));
    setInStock(prod.inStock);
    setFormError('');
    setIsAddingNew(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (images.length >= 4) {
      setFormError(lang === 'bn' ? 'সর্বোচ্চ ৪টি ছবি যোগ করা যাবে।' : 'You can add up to 4 images.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round(width * (MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setImages(prev => [...prev.slice(0, 3), compressed]);
        }
      } catch (err) {
        console.error('Image compression error:', err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.src = objectUrl;
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetMainImage = (indexToMain: number) => {
    setImages(prev => {
      const selected = prev[indexToMain];
      const rest = prev.filter((_, idx) => idx !== indexToMain);
      return [selected, ...rest];
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = name.trim();
    const numPrice = parseFloat(price);
    const numOriginal = originalPrice ? parseFloat(originalPrice) : undefined;

    if (!trimmedName) {
      setFormError(lang === 'bn' ? 'পণ্যের নাম লিখুন।' : 'Please enter product name.');
      return;
    }

    if (isNaN(numPrice) || numPrice < 0) {
      setFormError(lang === 'bn' ? 'সঠিক মূল্য দিন।' : 'Please enter a valid price.');
      return;
    }

    const validImages = images.filter(Boolean).slice(0, 4);

    const productData: Product = {
      id: editingProduct ? editingProduct.id : 'prod-' + Date.now(),
      name: trimmedName,
      price: numPrice,
      originalPrice: numOriginal && numOriginal > 0 ? numOriginal : undefined,
      category: category.trim() || 'অন্যান্য',
      description: description.trim(),
      imageUrl: validImages[0] || undefined,
      images: validImages.length > 0 ? validImages : undefined,
      inStock,
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveProduct(productData);
    setIsAddingNew(false);
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div 
      id="shop-management-page"
      className="fixed inset-0 bg-slate-950 z-[99999] overflow-y-auto font-sans select-none flex flex-col p-2 sm:p-4 md:p-6 animate-fade-in"
    >
      <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800 my-auto min-h-[86vh] max-h-[92vh]">
        {/* Header */}
        <div 
          className="p-4 sm:p-5 text-white flex flex-wrap gap-3 justify-between items-center shadow-sm shrink-0"
          style={{ backgroundColor: themeColor }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all text-xs font-bold active:scale-95 cursor-pointer border border-white/20"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
            </button>

            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/25 shadow-inner">
              <ShoppingBag className="w-5 h-5 text-yellow-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black truncate leading-tight">
                  {lang === 'bn' ? 'অনলাইন শপ ম্যানেজমেন্ট' : 'Online Shop Management'}
                </h3>
                <span className="bg-yellow-400 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full">
                  {products.length} {lang === 'bn' ? 'টি পণ্য' : 'Items'}
                </span>
              </div>
              <p className="text-[10px] font-bold text-white/80 truncate mt-0.5">
                {lang === 'bn' ? 'পণ্য যোগ করুন, এডিট করুন বা স্টক নিয়ন্ত্রণ করুন' : 'Manage products, pricing & stock'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-white text-purple-900 hover:bg-white/90 transition-all font-black text-xs cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-md"
            >
              <Plus className="w-4 h-4 text-purple-700" />
              <span>{lang === 'bn' ? 'নতুন পণ্য যোগ করুন' : 'Add Item'}</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'পণ্য খুঁজুন...' : 'Search products...'}
              className="w-full bg-white border border-slate-200/90 rounded-2xl pl-9 pr-3 py-1.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 shadow-inner"
            />
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2 bg-slate-100/50 scrollbar-thin">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
              <ShoppingBag className="w-12 h-12 opacity-30 text-purple-600" />
              <p className="text-xs font-black text-slate-600">
                {lang === 'bn' ? 'কোনো পণ্য নেই।' : 'No products found.'}
              </p>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'bn' ? 'প্রথম পণ্যটি যোগ করুন' : 'Add First Product'}</span>
              </button>
            </div>
          ) : (
            filteredProducts.map((prod) => (
              <div 
                key={prod.id}
                className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
              >
                {/* Image */}
                <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center">
                  {prod.imageUrl ? (
                    <img 
                      src={prod.imageUrl} 
                      alt={prod.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ShoppingBag className="w-6 h-6 text-slate-300" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-black text-slate-900 truncate">
                      {prod.name}
                    </h4>
                    {prod.category && (
                      <span className="bg-slate-100 text-slate-600 font-bold text-[8px] px-1.5 py-0.2 rounded shrink-0">
                        {prod.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-black text-purple-750 font-mono">
                      {currency}{prod.price.toLocaleString()}
                    </span>
                    {prod.originalPrice && prod.originalPrice > prod.price && (
                      <span className="text-[10px] font-bold text-slate-400 line-through font-mono">
                        {currency}{prod.originalPrice.toLocaleString()}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onSaveProduct({ ...prod, inStock: !prod.inStock });
                      }}
                      className={`text-[8.5px] font-black px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                        prod.inStock 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {prod.inStock ? (lang === 'bn' ? '✓ ইন স্টক' : '✓ In Stock') : (lang === 'bn' ? '✗ স্টক শেষ' : '✗ Out of Stock')}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(prod)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-500 hover:text-purple-700 transition-all cursor-pointer"
                    title={lang === 'bn' ? 'এডিট করুন' : 'Edit'}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductToDelete(prod)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                    title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ADD / EDIT PRODUCT FORM MODAL */}
      {isAddingNew && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-[100000] animate-fade-in font-sans">
          <div className="bg-white rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl border border-slate-150 p-5 flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  {editingProduct 
                    ? (lang === 'bn' ? 'পণ্য এডিট করুন' : 'Edit Product') 
                    : (lang === 'bn' ? 'নতুন পণ্য যোগ করুন' : 'Add New Product')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 mt-3 overflow-y-auto flex-1 pr-1 scrollbar-thin text-left">
              {/* Multi-Image Picker (Up to 4 images) */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-purple-600" />
                    <span>{lang === 'bn' ? 'পণ্যের ছবিসমূহ (সর্বোচ্চ ৪টি)' : 'Product Images (Max 4)'}</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                    {images.length}/৪
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl bg-white border border-slate-200 overflow-hidden group shadow-2xs">
                      <img 
                        src={img} 
                        alt={`Product ${idx + 1}`} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {idx === 0 ? (
                        <span className="absolute top-1 left-1 bg-purple-600 text-white text-[7px] font-black px-1 py-0.2 rounded shadow">
                          {lang === 'bn' ? 'প্রধান' : 'Main'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetMainImage(idx)}
                          className="absolute top-1 left-1 bg-slate-900/70 hover:bg-purple-600 text-white text-[7px] font-bold px-1 py-0.2 rounded shadow cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {lang === 'bn' ? 'প্রধান করুন' : 'Make Main'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-all cursor-pointer shadow"
                        title={lang === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {images.length < 4 && (
                    <label className="aspect-square rounded-xl bg-white border-2 border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50/50 flex flex-col items-center justify-center cursor-pointer transition-all gap-1 text-purple-600 shadow-2xs">
                      <Camera className="w-5 h-5" />
                      <span className="text-[8.5px] font-black text-center px-1 leading-tight">
                        {lang === 'bn' ? '+ ছবি যোগ' : '+ Add'}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageFileChange}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  {lang === 'bn' ? 'পণ্যের নাম (বাধ্যতামূলক)' : 'Product Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: ফাস্ট চার্জার ক্যাবল' : 'e.g. Fast Charger Cable'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 focus:bg-white shadow-inner"
                  autoFocus
                />
              </div>

              {/* Price & Original Price */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'বিক্রয় মূল্য (টাকা)' : 'Selling Price (৳)'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="180"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 focus:bg-white shadow-inner font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'আগের মূল্য (ছাড় দেখাতে)' : 'Original Price (Optional)'}
                  </label>
                  <input
                    type="number"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="250"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 focus:bg-white shadow-inner font-mono"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: অ্যাক্সেসরিজ, গ্যাজেট, অডিও...' : 'e.g. Accessories, Gadgets'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 focus:bg-white shadow-inner"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  {lang === 'bn' ? 'বিবরণ ও ফিচার' : 'Description'}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={lang === 'bn' ? 'পণ্যের ফিচার এবং বিশেষ সুবিধা লিখুন...' : 'Product features and specs...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 focus:bg-white shadow-inner resize-none"
                />
              </div>

              {/* Stock Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">
                  {lang === 'bn' ? 'পণ্যটি স্টকে আছে?' : 'Is product in stock?'}
                </span>
                <button
                  type="button"
                  onClick={() => setInStock(!inStock)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    inStock ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      inStock ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {formError && (
                <p className="text-[9.5px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-xl text-center">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
              >
                {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Product'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[100001] animate-fade-in font-sans">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 text-center shadow-2xl border border-slate-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-800 mb-1">
              {lang === 'bn' ? 'পণ্যটি মুছে ফেলতে চান?' : 'Delete Product?'}
            </h3>
            <p className="text-xs font-bold text-slate-500 mb-4">
              "{productToDelete.name}" {lang === 'bn' ? 'তালিকা থেকে স্থায়ীভাবে মুছে যাবে।' : 'will be removed.'}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer shadow-sm"
              >
                {lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
