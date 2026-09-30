/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Minus,
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Camera, 
  Search, 
  AlertTriangle,
  ArrowLeft,
  Package,
  ClipboardList,
  Users,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  User,
  Download,
  Printer,
  Copy,
  FileText
} from 'lucide-react';
import { Product, ShopOrder, ShopCustomerAccount } from '../types';
import { downloadParcelLabelImage } from '../utils/parcelLabelGenerator';

interface ShopManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  shopOrders?: ShopOrder[];
  onUpdateShopOrderStatus?: (orderId: string, status: ShopOrder['status']) => void;
  onDeleteShopOrder?: (orderId: string) => void;
  shopCustomers?: ShopCustomerAccount[];
  onDeleteShopCustomer?: (customerId: string) => void;
  currency?: string;
  lang: 'bn' | 'en';
  themeColor?: string;
  initialTab?: 'products' | 'orders' | 'customers';
}

export function ShopManagementModal({
  isOpen,
  onClose,
  products,
  onSaveProduct,
  onDeleteProduct,
  shopOrders = [],
  onUpdateShopOrderStatus,
  onDeleteShopOrder,
  shopCustomers = [],
  onDeleteShopCustomer,
  currency = '৳',
  lang,
  themeColor = '#6244a6',
  initialTab
}: ShopManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'customers'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | ShopOrder['status']>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedParcelOrder, setSelectedParcelOrder] = useState<ShopOrder | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [inStock, setInStock] = useState(true);
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<ShopOrder | null>(null);

  const pendingOrdersCount = useMemo(
    () => shopOrders.filter(o => o.status === 'pending').length,
    [shopOrders]
  );

  // Automatically open to 'orders' tab if there are pending orders or if initialTab is specified
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      } else if (pendingOrdersCount > 0) {
        setActiveTab('orders');
      }
    }
  }, [isOpen, initialTab, pendingOrdersCount]);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1800);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setPrice('');
    setOriginalPrice('');
    setStockQuantity('10');
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
    const qty = typeof prod.stockQuantity === 'number' ? prod.stockQuantity : (prod.inStock ? 10 : 0);
    setStockQuantity(qty.toString());
    setCategory(prod.category || 'অ্যাক্সেসরিজ');
    setDescription(prod.description || '');
    const productImages = (prod.images && prod.images.length > 0) 
      ? prod.images 
      : (prod.imageUrl ? [prod.imageUrl] : []);
    setImages(productImages.slice(0, 4));
    setInStock(prod.inStock && qty > 0);
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
    const parsedStock = parseInt(stockQuantity, 10);
    const finalStockQty = isNaN(parsedStock) || parsedStock < 0 ? 0 : parsedStock;

    if (!trimmedName) {
      setFormError(lang === 'bn' ? 'পণ্যের নাম লিখুন।' : 'Please enter product name.');
      return;
    }

    if (isNaN(numPrice) || numPrice < 0) {
      setFormError(lang === 'bn' ? 'সঠিক মূল্য দিন।' : 'Please enter a valid price.');
      return;
    }

    const validImages = images.filter(Boolean).slice(0, 4);
    const finalInStock = inStock && finalStockQty > 0;

    const productData: Product = {
      id: editingProduct ? editingProduct.id : 'prod-' + Date.now(),
      name: trimmedName,
      price: numPrice,
      originalPrice: numOriginal && numOriginal > 0 ? numOriginal : undefined,
      category: category.trim() || 'অন্যান্য',
      description: description.trim(),
      imageUrl: validImages[0] || undefined,
      images: validImages.length > 0 ? validImages : undefined,
      inStock: finalInStock,
      stockQuantity: finalInStock ? finalStockQty : 0,
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveProduct(productData);
    setIsAddingNew(false);
    setEditingProduct(null);
  };

  const handleQuickStockAdjust = (prod: Product, delta: number) => {
    const currentQty = typeof prod.stockQuantity === 'number' ? prod.stockQuantity : (prod.inStock ? 10 : 0);
    const nextQty = Math.max(0, currentQty + delta);
    onSaveProduct({
      ...prod,
      stockQuantity: nextQty,
      inStock: nextQty > 0
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredOrders = useMemo(() => {
    return shopOrders.filter(o => {
      const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesStatus;
      const matchesSearch =
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.customerAddress.toLowerCase().includes(q) ||
        o.items.some(i => i.name.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [shopOrders, orderStatusFilter, searchQuery]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shopCustomers;
    return shopCustomers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  }, [shopCustomers, searchQuery]);

  if (!isOpen) return null;

  return (
    <div 
      id="shop-management-page"
      className="fixed inset-0 bg-slate-950/90 z-[99999] overflow-y-auto font-sans select-none flex flex-col p-2 sm:p-4 md:p-6 animate-fade-in"
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col flex-1 bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800 my-auto min-h-[88vh] max-h-[94vh]">
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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black truncate leading-tight">
                  {lang === 'bn' ? 'অনলাইন শপ ও অর্ডার ম্যানেজমেন্ট' : 'Online Shop & Order Management'}
                </h3>
                <span className="bg-yellow-400 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full">
                  {products.length} {lang === 'bn' ? 'টি পণ্য' : 'Items'}
                </span>
              </div>
              <p className="text-[10px] font-bold text-white/80 truncate mt-0.5">
                {lang === 'bn' ? 'পণ্যের স্টক (পিস), অর্ডার কনফার্মেশন ও কাস্টমার একাউন্ট নিয়ন্ত্রণ করুন' : 'Manage product stock pieces, customer orders & accounts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-white/90 transition-all font-black text-xs cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-md"
            >
              <Plus className="w-4 h-4 text-purple-700" />
              <span>{lang === 'bn' ? 'নতুন পণ্য যোগ করুন' : 'Add Product'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs: Products | Orders | Customers */}
        <div className="bg-slate-100 px-3 pt-2.5 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-t-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'products'
                ? 'bg-white text-slate-900 border-purple-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Package className="w-4 h-4 text-purple-600" />
            <span>{lang === 'bn' ? 'পণ্য ও স্টক' : 'Products & Stock'}</span>
            <span className="text-[10px] font-mono bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-md">
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-t-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-white text-slate-900 border-purple-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'bn' ? 'অর্ডার সমূহ' : 'Customer Orders'}</span>
            {pendingOrdersCount > 0 ? (
              <span className="text-[10px] font-mono bg-rose-600 text-white px-2 py-0.2 rounded-full animate-pulse">
                {pendingOrdersCount} {lang === 'bn' ? 'নতুন' : 'New'}
              </span>
            ) : (
              <span className="text-[10px] font-mono bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-md">
                {shopOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 rounded-t-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-white text-slate-900 border-purple-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Users className="w-4 h-4 text-blue-600" />
            <span>{lang === 'bn' ? 'শপ কাস্টমার একাউন্ট' : 'Shop Customers'}</span>
            <span className="text-[10px] font-mono bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-md">
              {shopCustomers.length}
            </span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'products'
                  ? (lang === 'bn' ? 'পণ্য বা ক্যাটাগরি খুঁজুন...' : 'Search products...')
                  : activeTab === 'orders'
                  ? (lang === 'bn' ? 'অর্ডার আইডি, নাম বা মোবাইল নাম্বার দিয়ে খুঁজুন...' : 'Search order ID, name or phone...')
                  : (lang === 'bn' ? 'কাস্টমারের নাম, মোবাইল বা ঠিকানা খুঁজুন...' : 'Search customer name, phone or address...')
              }
              className="w-full bg-white border border-slate-200/90 rounded-2xl pl-9 pr-8 py-1.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeTab === 'orders' && (
            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: 'all', labelBn: 'সকল', labelEn: 'All' },
                { id: 'pending', labelBn: 'পেন্ডিং', labelEn: 'Pending' },
                { id: 'confirmed', labelBn: 'কনফার্মড', labelEn: 'Confirmed' },
                { id: 'delivered', labelBn: 'ডেলিভারি সম্পন্ন', labelEn: 'Delivered' },
                { id: 'cancelled', labelBn: 'বাতিল', labelEn: 'Cancelled' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOrderStatusFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                    orderStatusFilter === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {lang === 'bn' ? tab.labelBn : tab.labelEn}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TAB 1: PRODUCTS LIST */}
        {activeTab === 'products' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-100/50 scrollbar-thin">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                <ShoppingBag className="w-12 h-12 opacity-30 text-purple-600" />
                <p className="text-xs font-black text-slate-600">
                  {lang === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি।' : 'No products found.'}
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
              filteredProducts.map((prod) => {
                const stockCount = typeof prod.stockQuantity === 'number' ? prod.stockQuantity : (prod.inStock ? 10 : 0);
                const isAvailable = prod.inStock && stockCount > 0;

                return (
                  <div 
                    key={prod.id}
                    className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            {prod.name}
                          </h4>
                          {prod.category && (
                            <span className="text-[10px] font-bold text-slate-500">
                              · {prod.category}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-purple-700 font-mono tabular-nums">
                            {currency}{prod.price.toLocaleString()}
                          </span>
                          {prod.originalPrice && prod.originalPrice > prod.price && (
                            <span className="text-[11px] font-bold text-slate-400 line-through font-mono tabular-nums">
                              {currency}{prod.originalPrice.toLocaleString()}
                            </span>
                          )}

                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                              isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isAvailable
                              ? (lang === 'bn' ? `স্টকে আছে: ${stockCount} পিস` : `In Stock: ${stockCount} pcs`)
                              : (lang === 'bn' ? 'স্টক শেষ (০ পিস)' : 'Out of Stock (0 pcs)')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Stock Adjust & Edit/Delete Actions */}
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      {/* Quick Stock Stepper */}
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(prod, -1)}
                          className="w-7 h-7 rounded-lg hover:bg-white text-slate-600 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                          title={lang === 'bn' ? '১ পিস কমান' : 'Decrease stock'}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 text-xs font-black font-mono tabular-nums text-slate-800 min-w-[36px] text-center">
                          {stockCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuickStockAdjust(prod, 1)}
                          className="w-7 h-7 rounded-lg hover:bg-white text-slate-600 hover:text-emerald-600 flex items-center justify-center transition-colors cursor-pointer"
                          title={lang === 'bn' ? '১ পিস বাড়ান' : 'Increase stock'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(prod)}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200/80 transition-all cursor-pointer"
                        title={lang === 'bn' ? 'এডিট করুন' : 'Edit'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setProductToDelete(prod)}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 transition-all cursor-pointer"
                        title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: CUSTOMER ORDERS */}
        {activeTab === 'orders' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-100/50 scrollbar-thin">
            {filteredOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                <ClipboardList className="w-12 h-12 opacity-30 text-emerald-600" />
                <p className="text-xs font-black text-slate-600">
                  {lang === 'bn' ? 'কোনো অর্ডার পাওয়া যায়নি।' : 'No orders found.'}
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const statusBadge = {
                  pending: {
                    label: lang === 'bn' ? '⏳ পেন্ডিং অর্ডার (নতুন)' : '⏳ Pending Order',
                    cls: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                  },
                  confirmed: {
                    label: lang === 'bn' ? '✓ কনফার্মড' : '✓ Confirmed',
                    cls: 'bg-blue-50 text-blue-800 border-blue-200'
                  },
                  shipped: {
                    label: lang === 'bn' ? 'ডেলিভারিতে আছে' : 'Shipped',
                    cls: 'bg-indigo-50 text-indigo-800 border-indigo-200'
                  },
                  delivered: {
                    label: lang === 'bn' ? '✓ ডেলিভারি সম্পন্ন' : '✓ Delivered',
                    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  },
                  cancelled: {
                    label: lang === 'bn' ? '✕ বাতিল' : '✕ Cancelled',
                    cls: 'bg-rose-50 text-rose-800 border-rose-200'
                  }
                }[order.status] || { label: order.status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };

                const deliveryFee = order.deliveryCharge ?? 150;
                const dueOnDelivery = order.dueOnDeliveryAmount ?? order.subtotal;

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl p-4 border-2 shadow-2xs space-y-3 text-left transition-all ${
                      order.status === 'pending' ? 'border-amber-400' : 'border-slate-200/90'
                    }`}
                  >
                    {/* Top Row: Order Number, Date, Parcel Label Download & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                          #{order.orderNumber}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(order.createdAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-lg border ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Parcel Slip Preview & Download Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedParcelOrder(order)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                          title={lang === 'bn' ? 'পার্সেল রিপোর্ট ও প্রিন্ট প্রিভিউ' : 'Parcel Slip Preview'}
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>{lang === 'bn' ? 'পার্সেল স্লিপ প্রিভিউ' : 'Parcel Slip'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadParcelLabelImage(order, currency)}
                          className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                          title={lang === 'bn' ? 'পার্সেলের সাথে লাগানোর জন্য রিপোর্ট ডাউনলোড করুন' : 'Download Parcel Report'}
                        >
                          <Download className="w-3.5 h-3.5 text-yellow-300" />
                          <span>{lang === 'bn' ? 'রিপোর্ট ডাউনলোড' : 'Download Report'}</span>
                        </button>

                        {onDeleteShopOrder && (
                          <button
                            type="button"
                            onClick={() => setOrderToDelete(order)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={lang === 'bn' ? 'অর্ডার মুছে ফেলুন' : 'Delete Order'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Customer Name, Mobile & Advance 150 Tk Send Money TrxID */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                      <div className="flex items-start gap-2">
                        <User className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-400">{lang === 'bn' ? 'কাস্টমারের নাম' : 'Customer Name'}</p>
                          <p className="font-black text-slate-900 text-sm">{order.customerName}</p>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-2 bg-white p-2 rounded-lg border border-slate-200">
                        <div className="flex items-start gap-2">
                          <Phone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-bold text-slate-400">{lang === 'bn' ? 'মোবাইল নাম্বার' : 'Mobile Number'}</p>
                            <p className="font-mono font-black text-slate-900 text-sm select-all">{order.customerPhone}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(order.customerPhone, `phone_${order.id}`)}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === `phone_${order.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === `phone_${order.id}` ? 'কপি!' : 'কপি'}</span>
                        </button>
                      </div>

                      {/* Advance 150 Tk Send Money Transaction ID Card */}
                      <div className="flex items-start justify-between gap-2 bg-emerald-50/90 p-2 rounded-lg border border-emerald-300">
                        <div>
                          <p className="text-[10px] font-black text-emerald-800">
                            {lang === 'bn' ? `অগ্রিম ${currency}${deliveryFee} সেন্ড মানি (01783586858)` : `Advance ৳${deliveryFee} TrxID`}
                          </p>
                          <p className="font-mono font-black text-emerald-950 text-sm select-all">
                            TrxID: {order.transactionId || 'উল্লেখ নেই'}
                          </p>
                        </div>
                        {order.transactionId && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(order.transactionId!, `trx_${order.id}`)}
                            className="px-2 py-1 rounded-md bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === `trx_${order.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === `trx_${order.id}` ? 'কপি!' : 'কপি'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 3 Separate Cards for Division, District, Thana + Full Address */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-2.5">
                          <span className="block text-[10px] font-black text-purple-700 uppercase">
                            {lang === 'bn' ? '১. বিভাগ' : '1. Division'}
                          </span>
                          <span className="font-black text-slate-900 text-xs sm:text-sm">
                            {order.division || '—'}
                          </span>
                        </div>
                        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5">
                          <span className="block text-[10px] font-black text-blue-700 uppercase">
                            {lang === 'bn' ? '২. জেলা' : '2. District'}
                          </span>
                          <span className="font-black text-slate-900 text-xs sm:text-sm">
                            {order.district || '—'}
                          </span>
                        </div>
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5">
                          <span className="block text-[10px] font-black text-emerald-700 uppercase">
                            {lang === 'bn' ? '৩. থানা / উপজেলা' : '3. Thana'}
                          </span>
                          <span className="font-black text-slate-900 text-xs sm:text-sm">
                            {order.thana || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-start gap-2 text-xs">
                        <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            {lang === 'bn' ? 'বিস্তারিত ডেলিভারি ঠিকানা:' : 'Detailed Delivery Address:'}
                          </span>
                          <span className="font-bold text-slate-800">{order.customerAddress}</span>
                        </div>
                      </div>
                    </div>

                    {order.note && (
                      <div className="text-xs bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2 text-amber-900 font-semibold">
                        <span className="font-black">{lang === 'bn' ? 'অর্ডার নোট: ' : 'Order Note: '}</span>
                        {order.note}
                      </div>
                    )}

                    {/* Ordered Products Table */}
                    <div className="space-y-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/70">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-white border border-slate-100 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                <ShoppingBag className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-black text-slate-800 truncate">{item.name}</p>
                              <p className="text-[10.5px] font-bold text-slate-500 font-mono tabular-nums">
                                {currency}{item.price.toLocaleString()} × {item.quantity} {lang === 'bn' ? 'পিস' : 'pcs'}
                              </p>
                            </div>
                          </div>
                          <span className="font-mono font-black text-slate-900 tabular-nums shrink-0">
                            {currency}{(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Footer Total, Due on Delivery & Status Update Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-xs">
                          <span className="text-slate-500 font-bold">{lang === 'bn' ? 'পণ্যের মূল্য: ' : 'Subtotal: '}</span>
                          <span className="font-mono font-black text-slate-800">{currency}{order.subtotal.toLocaleString()}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-emerald-700 font-bold">{lang === 'bn' ? 'অগ্রিম ডেলিভারি পেইড: ' : 'Advance Paid: '}</span>
                          <span className="font-mono font-black text-emerald-700">{currency}{deliveryFee}</span>
                        </div>
                        <div className="bg-slate-900 text-white px-3 py-1 rounded-xl text-xs font-black">
                          <span>{lang === 'bn' ? 'ডেলিভারির সময় প্রদেয় (COD): ' : 'Due on Delivery: '}</span>
                          <span className="font-mono text-amber-400 text-sm">{currency}{dueOnDelivery.toLocaleString()}</span>
                        </div>
                      </div>

                      {onUpdateShopOrderStatus && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {order.status !== 'confirmed' && order.status !== 'delivered' && (
                            <button
                              type="button"
                              onClick={() => onUpdateShopOrderStatus(order.id, 'confirmed')}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'অর্ডার কনফার্ম করুন' : 'Confirm Order'}</span>
                            </button>
                          )}
                          {order.status !== 'delivered' && (
                            <button
                              type="button"
                              onClick={() => onUpdateShopOrderStatus(order.id, 'delivered')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'ডেলিভারি সম্পন্ন' : 'Delivered'}</span>
                            </button>
                          )}
                          {order.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => onUpdateShopOrderStatus(order.id, 'cancelled')}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'বাতিল' : 'Cancel'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: REGISTERED SHOP CUSTOMERS */}
        {activeTab === 'customers' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-100/50 scrollbar-thin">
            {filteredCustomers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                <Users className="w-12 h-12 opacity-30 text-blue-600" />
                <p className="text-xs font-black text-slate-600">
                  {lang === 'bn' ? 'কোনো নিবন্ধিত শপ কাস্টমার নেই।' : 'No registered shop customers yet.'}
                </p>
              </div>
            ) : (
              filteredCustomers.map((cust) => (
                <div
                  key={cust.id}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
                      {cust.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900">{cust.name}</h4>
                        <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                          {cust.phone}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{cust.address}</span>
                      </p>
                    </div>
                  </div>

                  {onDeleteShopCustomer && (
                    <button
                      type="button"
                      onClick={() => onDeleteShopCustomer(cust.id)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                      title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
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

              {/* Stock Quantity (কত পিস স্টক আছে) & Category */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9.5px] font-black text-purple-700 uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'কত পিস স্টক আছে?' : 'Stock Quantity (Pcs)'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center bg-slate-50 border border-purple-200 rounded-xl overflow-hidden focus-within:border-purple-500 focus-within:bg-white">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseInt(stockQuantity, 10) || 0;
                        const next = Math.max(0, cur - 1);
                        setStockQuantity(String(next));
                        setInStock(next > 0);
                      }}
                      className="px-2.5 py-2 text-slate-600 hover:bg-slate-200/70 font-black text-xs cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={stockQuantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStockQuantity(val);
                        const num = parseInt(val, 10);
                        if (!isNaN(num)) {
                          setInStock(num > 0);
                        }
                      }}
                      placeholder="10"
                      className="w-full bg-transparent text-center py-2 text-xs font-black text-slate-900 outline-none font-mono tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseInt(stockQuantity, 10) || 0;
                        const next = cur + 1;
                        setStockQuantity(String(next));
                        setInStock(true);
                      }}
                      className="px-2.5 py-2 text-slate-600 hover:bg-slate-200/70 font-black text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[9.5px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: অ্যাক্সেসরিজ, গ্যাজেট...' : 'e.g. Accessories, Gadgets'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-500 focus:bg-white shadow-inner"
                  />
                </div>
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
                <div>
                  <span className="text-xs font-bold text-slate-700 block">
                    {lang === 'bn' ? 'পণ্যটি স্টকে উপলব্ধ?' : 'Is product available in stock?'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {lang === 'bn'
                      ? `বর্তমান স্টক: ${parseInt(stockQuantity, 10) || 0} পিস`
                      : `Current stock: ${parseInt(stockQuantity, 10) || 0} pcs`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextInStock = !inStock;
                    setInStock(nextInStock);
                    if (nextInStock && (!stockQuantity || parseInt(stockQuantity, 10) <= 0)) {
                      setStockQuantity('10');
                    } else if (!nextInStock) {
                      setStockQuantity('0');
                    }
                  }}
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

      {/* DELETE PRODUCT CONFIRMATION MODAL */}
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

      {/* DELETE ORDER CONFIRMATION MODAL */}
      {orderToDelete && onDeleteShopOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[100001] animate-fade-in font-sans">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 text-center shadow-2xl border border-slate-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-800 mb-1">
              {lang === 'bn' ? 'অর্ডারটি মুছে ফেলতে চান?' : 'Delete Order?'}
            </h3>
            <p className="text-xs font-bold text-slate-500 mb-4">
              #{orderToDelete.orderNumber} ({orderToDelete.customerName}) {lang === 'bn' ? 'তালিকা থেকে মুছে যাবে।' : 'will be removed.'}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteShopOrder(orderToDelete.id);
                  setOrderToDelete(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer shadow-sm"
              >
                {lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COURIER PARCEL LABEL / INVOICE REPORT PREVIEW & DOWNLOAD MODAL */}
      {selectedParcelOrder && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-[100010] animate-fade-in font-sans">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-slate-300 text-left">
            {/* Top Action Bar */}
            <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span className="text-xs sm:text-sm font-black">
                  {lang === 'bn' ? 'কুরিয়ার পার্সেল লেবেল / রিপোর্ট' : 'Courier Parcel Slip Report'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadParcelLabelImage(selectedParcelOrder, currency)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'ইমেজ ডাউনলোড (PNG)' : 'Download PNG'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedParcelOrder(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Parcel Slip Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
              <div className="bg-white border-2 border-dashed border-slate-400 p-3 rounded-2xl">
                <div className="border-2 border-slate-900 rounded-xl overflow-hidden bg-white">
                  {/* Sender / Merchant Header */}
                  <div className="bg-slate-900 text-white p-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-amber-400 tracking-tight">
                        HELLOPOINT ONLINE SHOP
                      </h2>
                      <p className="text-[11px] font-bold text-slate-200 mt-0.5">
                        প্রেরক: মাহবুব হাসান | হেল্পলাইন: <span className="font-mono">01783586858</span>
                      </p>
                      <p className="text-[10px] font-black text-sky-300 uppercase mt-0.5">
                        PARCEL SHIPPING LABEL & COD INVOICE
                      </p>
                    </div>
                    <div className="bg-white text-slate-900 px-3 py-2 rounded-xl text-center shrink-0">
                      <span className="block text-[9px] font-black text-slate-500 uppercase">ORDER ID</span>
                      <span className="font-mono font-black text-sm text-purple-700">#{selectedParcelOrder.orderNumber}</span>
                      <span className="block text-[9.5px] font-bold text-slate-500">
                        {new Date(selectedParcelOrder.createdAt).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>

                  {/* Advance Delivery Fee & TrxID Strip */}
                  <div className="bg-emerald-50 border-b-2 border-slate-900 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-black text-emerald-900">
                      ✓ অগ্রিম ডেলিভারি চার্জ: {currency}{selectedParcelOrder.deliveryCharge ?? 150} পেইড (Send Money: 01783586858)
                    </span>
                    <span className="font-mono font-black text-emerald-950 bg-white px-2.5 py-0.5 rounded border border-emerald-300">
                      TrxID: {selectedParcelOrder.transactionId || 'N/A'}
                    </span>
                  </div>

                  {/* Receiver / Customer Info */}
                  <div className="p-4 space-y-3">
                    <div className="bg-amber-50/90 border-2 border-amber-400 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black text-amber-900 uppercase block">
                          প্রাপক / কাস্টমার (DELIVER TO):
                        </span>
                        <p className="text-base sm:text-lg font-black text-slate-900">
                          {selectedParcelOrder.customerName}
                        </p>
                        <p className="font-mono text-base sm:text-lg font-black text-rose-700">
                          📞 {selectedParcelOrder.customerPhone}
                        </p>
                      </div>
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-center">
                        <span className="block text-[9px] font-bold text-amber-300 uppercase">স্ট্যাটাস</span>
                        <span className="text-xs font-black uppercase">{selectedParcelOrder.status}</span>
                      </div>
                    </div>

                    {/* 3 Cards: Division, District, Thana */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-2.5">
                        <span className="block text-[9.5px] font-black text-slate-500 uppercase">১. বিভাগ</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900">{selectedParcelOrder.division || '—'}</span>
                      </div>
                      <div className="bg-indigo-50/60 border-2 border-indigo-300 rounded-xl p-2.5">
                        <span className="block text-[9.5px] font-black text-indigo-700 uppercase">২. জেলা</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900">{selectedParcelOrder.district || '—'}</span>
                      </div>
                      <div className="bg-emerald-50/60 border-2 border-emerald-300 rounded-xl p-2.5">
                        <span className="block text-[9.5px] font-black text-emerald-700 uppercase">৩. থানা / উপজেলা</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900">{selectedParcelOrder.thana || '—'}</span>
                      </div>
                    </div>

                    {/* Full Street/Village Address */}
                    <div className="bg-slate-50 border border-slate-300 rounded-xl p-3">
                      <span className="block text-[10px] font-black text-slate-500 uppercase">
                        বিস্তারিত ডেলিভারি ঠিকানা (FULL ADDRESS):
                      </span>
                      <p className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                        {selectedParcelOrder.customerAddress}
                      </p>
                    </div>

                    {selectedParcelOrder.note && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs font-bold text-rose-900">
                        <span className="font-black">নির্দেশনা / নোট: </span>
                        {selectedParcelOrder.note}
                      </div>
                    )}

                    {/* Products Table */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden">
                      <div className="bg-slate-900 text-white px-3 py-2 text-[11px] font-black grid grid-cols-12">
                        <span className="col-span-6">পণ্যের বিবরণ</span>
                        <span className="col-span-2 text-center">পরিমাণ</span>
                        <span className="col-span-2 text-center">দর</span>
                        <span className="col-span-2 text-right">মোট</span>
                      </div>
                      {selectedParcelOrder.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 text-xs font-bold border-t border-slate-200 grid grid-cols-12 items-center"
                        >
                          <span className="col-span-6 font-black text-slate-900 truncate pr-2">
                            {idx + 1}. {item.name}
                          </span>
                          <span className="col-span-2 text-center font-mono font-black">{item.quantity} পিস</span>
                          <span className="col-span-2 text-center font-mono">{currency}{item.price}</span>
                          <span className="col-span-2 text-right font-mono font-black">
                            {currency}{(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* COD Collection Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-600">পণ্যের মোট মূল্য:</span>
                          <span className="font-mono font-black">{currency}{selectedParcelOrder.subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-600">ডেলিভারি চার্জ:</span>
                          <span className="font-mono font-black">{currency}{selectedParcelOrder.deliveryCharge ?? 150}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-black">
                          <span>অগ্রিম পরিশোধ (Send Money):</span>
                          <span className="font-mono">- {currency}{selectedParcelOrder.advancePaidAmount ?? 150}</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 text-white rounded-xl p-3 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-black text-amber-400 uppercase">
                          ডেলিভারির সময় প্রদেয় (COD COLLECT)
                        </span>
                        <span className="font-mono text-2xl font-black text-white mt-0.5">
                          {currency}{(selectedParcelOrder.dueOnDeliveryAmount ?? selectedParcelOrder.subtotal).toLocaleString()}/-
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400">
                          (১৫০ টাকা ডেলিভারি চার্জ অগ্রিম পরিশোধিত)
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] font-bold text-slate-500 text-center pt-1">
                      ⚠️ পার্সেল রিসিভ করার সময় অবশ্যই আনবক্সিং ভিডিও ধারণ করবেন। ধন্যবাদান্তে — HelloPoint Online Shop
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
