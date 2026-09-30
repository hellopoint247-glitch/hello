/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Search, X, Check, ArrowLeft, 
  Phone, User, ChevronLeft, ChevronRight,
  CheckCircle2, ShieldCheck, ShoppingCart, Plus, Minus, Trash2,
  MapPin, LogOut, UserPlus, LogIn, Package, Truck, RotateCcw,
  FileText, Lock, CreditCard, Clock, Copy
} from 'lucide-react';
import { Product, ShopCustomerAccount, ShopOrder, ShopOrderItem } from '../types';
import { ShopPoliciesModal, PolicyTabType } from './ShopPoliciesModal';
import { soundEngine } from '../utils/audio';

interface VisitorShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currency?: string;
  lang: 'bn' | 'en';
  themeColor?: string;
  shopOrders?: ShopOrder[];
  shopCustomers?: ShopCustomerAccount[];
  onCreateShopOrder?: (order: ShopOrder) => void;
  onSaveShopCustomer?: (customer: ShopCustomerAccount) => void;
  onOrderInquiry?: (product: Product, customerName: string, customerPhone: string, note?: string) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const CART_STORAGE_KEY = 'hellopoint_shop_cart';
const ACTIVE_CUSTOMER_KEY = 'hellopoint_shop_active_customer';
const RECENT_ORDER_IDS_KEY = 'hellopoint_customer_recent_order_ids';
const ADVANCE_DELIVERY_CHARGE = 150;
const SEND_MONEY_NUMBER = '01783586858';

const BD_DIVISIONS = [
  'ঢাকা',
  'চট্টগ্রাম',
  'রাজশাহী',
  'খুলনা',
  'বরিশাল',
  'সিলেট',
  'রংপুর',
  'ময়মনসিংহ'
];

function ProductCardImage({
  images,
  imageUrl,
  name,
  productId,
  onClick
}: {
  images?: string[];
  imageUrl?: string;
  name: string;
  productId?: string;
  onClick: () => void;
}) {
  const allImages = useMemo(() => {
    if (images && images.length > 0) return images.filter(Boolean);
    if (imageUrl) return [imageUrl];
    return [];
  }, [images, imageUrl]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const initialDelay = useMemo(() => {
    if (!productId) return 0;
    let hash = 0;
    for (let i = 0; i < productId.length; i++) {
      hash = (hash * 31 + productId.charCodeAt(i)) % 3000;
    }
    return hash;
  }, [productId]);

  useEffect(() => {
    if (allImages.length <= 1) return;
    let intervalId: any;
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % allImages.length);
      }, 5500);
    }, initialDelay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [allImages.length, initialDelay]);

  return (
    <div 
      className="relative w-full aspect-square bg-[#F9F9F8] overflow-hidden cursor-pointer flex items-center justify-center select-none"
      onClick={onClick}
    >
      {allImages.length > 0 ? (
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={`${currentIndex}-${allImages[currentIndex]}`}
            src={allImages[currentIndex]}
            alt={name}
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.85 }}
            transition={{ duration: 0.25 }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>
      ) : (
        <ShoppingBag className="w-8 h-8 text-slate-300" />
      )}

      {allImages.length > 1 && (
        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 z-10 pointer-events-none">
          {allImages.map((_, idx) => (
            <span
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-3.5 bg-slate-900 shadow-xs' : 'w-1.5 bg-white/80'
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
  shopOrders = [],
  shopCustomers = [],
  onCreateShopOrder,
  onSaveShopCustomer
}: VisitorShopModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc'>('default');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState<number>(0);
  const [detailQty, setDetailQty] = useState<number>(1);

  // Logged-in E-Commerce Customer Account State
  const [loggedInCustomer, setLoggedInCustomer] = useState<ShopCustomerAccount | null>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_CUSTOMER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Top Account Modal / Drawer State (Register & Login)
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountTab, setAccountTab] = useState<'login' | 'register'>('register');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDivision, setRegDivision] = useState('ঢাকা');
  const [regDistrict, setRegDistrict] = useState('');
  const [regThana, setRegThana] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Shopping Cart State
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCartModal, setShowCartModal] = useState(false);
  const [cartToast, setCartToast] = useState<string | null>(null);

  // Order Checkout Form State (3 separate cards for Division, District, Thana + Address + Advance 150 Tk TrxID)
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderDivision, setOrderDivision] = useState('ঢাকা');
  const [orderDistrict, setOrderDistrict] = useState('');
  const [orderThana, setOrderThana] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderTransactionId, setOrderTransactionId] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [createAccountOnOrder, setCreateAccountOnOrder] = useState(true);
  const [orderError, setOrderError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<ShopOrder | null>(null);
  const [copiedSendMoney, setCopiedSendMoney] = useState(false);

  // Locally tracked order IDs placed on this device so pending orders always show at top
  const [recentOrderIds, setRecentOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_ORDER_IDS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // My Orders Modal State
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);

  // Policies Modal State
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [activePolicyTab, setActivePolicyTab] = useState<PolicyTabType>('privacy');

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Pre-fill checkout fields when loggedInCustomer changes or cart opens
  useEffect(() => {
    if (loggedInCustomer) {
      setOrderName(loggedInCustomer.name);
      setOrderPhone(loggedInCustomer.phone);
      if (loggedInCustomer.division) setOrderDivision(loggedInCustomer.division);
      if (loggedInCustomer.district) setOrderDistrict(loggedInCustomer.district);
      if (loggedInCustomer.thana) setOrderThana(loggedInCustomer.thana);
      setOrderAddress(loggedInCustomer.address);
    }
  }, [loggedInCustomer, showCartModal]);

  const triggerToast = (msg: string) => {
    setCartToast(msg);
    setTimeout(() => {
      setCartToast(prev => (prev === msg ? null : prev));
    }, 2200);
  };

  const getProductStock = (prod: Product): number => {
    if (!prod.inStock) return 0;
    return typeof prod.stockQuantity === 'number' ? prod.stockQuantity : 10;
  };

  // Resolved cart items with live product references
  const resolvedCart: CartItem[] = useMemo(() => {
    return cart
      .map(item => {
        const prod = products.find(p => p.id === item.productId);
        if (!prod) return null;
        const maxStock = getProductStock(prod);
        if (maxStock <= 0) return null;
        return {
          product: prod,
          quantity: Math.min(item.quantity, maxStock)
        };
      })
      .filter((x): x is CartItem => x !== null);
  }, [cart, products]);

  const totalCartItems = useMemo(
    () => resolvedCart.reduce((sum, item) => sum + item.quantity, 0),
    [resolvedCart]
  );

  const cartSubtotal = useMemo(
    () => resolvedCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [resolvedCart]
  );

  const handleAddToCart = (prod: Product, qtyToAdd: number = 1, openCheckoutImmediately: boolean = false) => {
    const maxStock = getProductStock(prod);
    if (maxStock <= 0) {
      triggerToast(lang === 'bn' ? 'দুঃখিত, এই পণ্যটি স্টকে নেই!' : 'Sorry, this item is out of stock!');
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === prod.id);
      if (existing) {
        const nextQty = Math.min(maxStock, existing.quantity + qtyToAdd);
        return prev.map(i => (i.productId === prod.id ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { productId: prod.id, quantity: Math.min(maxStock, qtyToAdd) }];
    });

    soundEngine.playSuccessSound();

    if (openCheckoutImmediately) {
      setSelectedProduct(null);
      setOrderError('');
      setShowCartModal(true);
    } else {
      triggerToast(
        lang === 'bn'
          ? `✓ "${prod.name}" কার্টে যোগ করা হয়েছে`
          : `✓ Added "${prod.name}" to cart`
      );
    }
  };

  const handleUpdateCartQuantity = (productId: string, delta: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const maxStock = getProductStock(prod);

    setCart(prev =>
      prev
        .map(item => {
          if (item.productId !== productId) return item;
          const next = item.quantity + delta;
          if (next <= 0) return null;
          return { ...item, quantity: Math.min(maxStock, next) };
        })
        .filter((x): x is { productId: string; quantity: number } => x !== null)
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  // Customer Account Registration Handler
  const handleRegisterAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const cleanName = regName.trim();
    const cleanPhone = regPhone.replace(/\D/g, '');
    const cleanDiv = regDivision.trim();
    const cleanDist = regDistrict.trim();
    const cleanThana = regThana.trim();
    const cleanAddress = regAddress.trim();

    if (!cleanName) {
      setAuthError(lang === 'bn' ? 'অনুগ্রহ করে আপনার নাম লিখুন।' : 'Please enter your name.');
      return;
    }
    if (cleanPhone.length !== 11) {
      setAuthError(lang === 'bn' ? 'অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নাম্বার দিন।' : 'Please enter a valid 11-digit mobile number.');
      return;
    }
    if (!cleanDiv || !cleanDist || !cleanThana) {
      setAuthError(lang === 'bn' ? 'অনুগ্রহ করে বিভাগ, জেলা এবং থানা পূরণ করুন।' : 'Please fill in Division, District and Thana.');
      return;
    }
    if (!cleanAddress) {
      setAuthError(lang === 'bn' ? 'অনুগ্রহ করে আপনার বিস্তারিত ডেলিভারি ঠিকানা লিখুন।' : 'Please enter your detailed address.');
      return;
    }

    const existing = shopCustomers.find(
      c => c.phone.replace(/\D/g, '') === cleanPhone
    );

    const newCustomer: ShopCustomerAccount = {
      id: existing ? existing.id : 'shop_cust_' + Date.now(),
      name: cleanName,
      phone: cleanPhone,
      division: cleanDiv,
      district: cleanDist,
      thana: cleanThana,
      address: cleanAddress,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (onSaveShopCustomer) {
      onSaveShopCustomer(newCustomer);
    }
    setLoggedInCustomer(newCustomer);
    localStorage.setItem(ACTIVE_CUSTOMER_KEY, JSON.stringify(newCustomer));
    setOrderName(newCustomer.name);
    setOrderPhone(newCustomer.phone);
    setOrderDivision(cleanDiv);
    setOrderDistrict(cleanDist);
    setOrderThana(cleanThana);
    setOrderAddress(newCustomer.address);

    soundEngine.playSuccessSound();
    setShowAccountModal(false);
    setRegName('');
    setRegPhone('');
    setRegDistrict('');
    setRegThana('');
    setRegAddress('');
    triggerToast(lang === 'bn' ? `স্বাগতম ${newCustomer.name}! আপনার একাউন্ট চালু হয়েছে।` : `Welcome ${newCustomer.name}!`);
  };

  // Customer Login Handler
  const handleLoginAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const userClean = loginUsername.trim().toLowerCase();
    const passClean = loginPassword.trim().toLowerCase();
    const passDigits = loginPassword.replace(/\D/g, '');

    if (!userClean || !passClean) {
      setAuthError(
        lang === 'bn'
          ? 'ইউজারনেম (নাম) এবং পাসওয়ার্ড দিন।'
          : 'Please enter your username (name) and password.'
      );
      return;
    }

    const matched = shopCustomers.find(c => {
      const cName = c.name.trim().toLowerCase();
      const cPhone = c.phone.replace(/\D/g, '');
      const usernameMatches = cName === userClean || (cPhone && cPhone === loginUsername.replace(/\D/g, ''));
      const passwordMatches =
        cName === passClean ||
        (cPhone && passDigits && cPhone === passDigits) ||
        c.phone.trim().toLowerCase() === passClean;
      return usernameMatches && passwordMatches;
    });

    if (!matched) {
      setAuthError(
        lang === 'bn'
          ? 'একাউন্ট পাওয়া যায়নি! সঠিক নাম (ইউজারনেম) ও পাসওয়ার্ড (মোবাইল নাম্বার বা নাম) দিন অথবা নতুন একাউন্ট খুলুন।'
          : 'Account not found! Check your Name (Username) & Password, or create a new account.'
      );
      return;
    }

    setLoggedInCustomer(matched);
    localStorage.setItem(ACTIVE_CUSTOMER_KEY, JSON.stringify(matched));
    setOrderName(matched.name);
    setOrderPhone(matched.phone);
    if (matched.division) setOrderDivision(matched.division);
    if (matched.district) setOrderDistrict(matched.district);
    if (matched.thana) setOrderThana(matched.thana);
    setOrderAddress(matched.address);
    soundEngine.playSuccessSound();
    setShowAccountModal(false);
    setLoginUsername('');
    setLoginPassword('');
    triggerToast(lang === 'bn' ? `স্বাগতম ${matched.name}! সফলভাবে লগইন হয়েছে।` : `Logged in as ${matched.name}!`);
  };

  const handleLogoutCustomer = () => {
    setLoggedInCustomer(null);
    localStorage.removeItem(ACTIVE_CUSTOMER_KEY);
    triggerToast(lang === 'bn' ? 'আপনি সফলভাবে লগ আউট করেছেন।' : 'Logged out successfully.');
  };

  // Confirm Order Handler
  const handleConfirmOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');

    if (resolvedCart.length === 0) {
      setOrderError(lang === 'bn' ? 'আপনার কার্টে কোনো পণ্য নেই!' : 'Your cart is empty!');
      return;
    }

    const cleanName = orderName.trim();
    const cleanPhone = orderPhone.replace(/\D/g, '');
    const cleanDivision = orderDivision.trim();
    const cleanDistrict = orderDistrict.trim();
    const cleanThana = orderThana.trim();
    const cleanAddress = orderAddress.trim();
    const cleanTrxId = orderTransactionId.trim();

    if (!cleanName) {
      setOrderError(lang === 'bn' ? 'অনুগ্রহ করে আপনার নাম লিখুন।' : 'Please enter your full name.');
      return;
    }
    if (cleanPhone.length !== 11) {
      setOrderError(lang === 'bn' ? 'অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নাম্বার দিন।' : 'Please enter a valid 11-digit mobile number.');
      return;
    }
    if (!cleanDivision) {
      setOrderError(lang === 'bn' ? 'অনুগ্রহ করে ১নং কার্ডে আপনার বিভাগ নির্বাচন বা লিখুন।' : 'Please enter your Division.');
      return;
    }
    if (!cleanDistrict) {
      setOrderError(lang === 'bn' ? 'অনুগ্রহ করে ২নং কার্ডে আপনার জেলার নাম লিখুন।' : 'Please enter your District.');
      return;
    }
    if (!cleanThana) {
      setOrderError(lang === 'bn' ? 'অনুগ্রহ করে ৩নং কার্ডে আপনার থানা/উপজেলার নাম লিখুন।' : 'Please enter your Thana/Upazila.');
      return;
    }
    if (!cleanAddress) {
      setOrderError(lang === 'bn' ? 'অনুগ্রহ করে আপনার বিস্তারিত ডেলিভারি ঠিকানা (গ্রাম/রোড/বাসা) লিখুন।' : 'Please enter your detailed delivery address.');
      return;
    }
    if (!cleanTrxId || cleanTrxId.length < 4) {
      setOrderError(
        lang === 'bn'
          ? `অগ্রিম ${ADVANCE_DELIVERY_CHARGE} টাকা ডেলিভারি চার্জ ${SEND_MONEY_NUMBER} নাম্বারে সেন্ড মানি করে সঠিক ট্রানজেকশন আইডি (Transaction ID) লিখুন।`
          : `Please send ৳${ADVANCE_DELIVERY_CHARGE} delivery charge to ${SEND_MONEY_NUMBER} and enter the Transaction ID.`
      );
      return;
    }

    // Auto-create or update customer account if logged in or checked
    let customerId = loggedInCustomer?.id;
    if (loggedInCustomer || createAccountOnOrder) {
      const existingAcc = shopCustomers.find(c => c.phone.replace(/\D/g, '') === cleanPhone);
      const custObj: ShopCustomerAccount = {
        id: loggedInCustomer?.id || existingAcc?.id || 'shop_cust_' + Date.now(),
        name: cleanName,
        phone: cleanPhone,
        division: cleanDivision,
        district: cleanDistrict,
        thana: cleanThana,
        address: cleanAddress,
        createdAt: loggedInCustomer?.createdAt || existingAcc?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      customerId = custObj.id;
      if (onSaveShopCustomer) {
        onSaveShopCustomer(custObj);
      }
      setLoggedInCustomer(custObj);
      localStorage.setItem(ACTIVE_CUSTOMER_KEY, JSON.stringify(custObj));
    }

    const orderItems: ShopOrderItem[] = resolvedCart.map(c => ({
      productId: c.product.id,
      name: c.product.name,
      price: c.product.price,
      quantity: c.quantity,
      imageUrl: (c.product.images && c.product.images[0]) || c.product.imageUrl,
      category: c.product.category
    }));

    const orderNum = 'ORD-' + String(Math.floor(100000 + Math.random() * 900000));
    const fullFormattedAddress = `${cleanAddress}, থানা: ${cleanThana}, জেলা: ${cleanDistrict}, বিভাগ: ${cleanDivision}`;

    const newOrder: ShopOrder = {
      id: 'order_' + Date.now(),
      orderNumber: orderNum,
      customerId,
      customerName: cleanName,
      customerPhone: cleanPhone,
      division: cleanDivision,
      district: cleanDistrict,
      thana: cleanThana,
      customerAddress: fullFormattedAddress,
      items: orderItems,
      subtotal: cartSubtotal,
      deliveryCharge: ADVANCE_DELIVERY_CHARGE,
      advancePaidAmount: ADVANCE_DELIVERY_CHARGE,
      dueOnDeliveryAmount: cartSubtotal,
      totalAmount: cartSubtotal + ADVANCE_DELIVERY_CHARGE,
      transactionId: cleanTrxId.toUpperCase(),
      paymentMethod: 'advance_delivery',
      paymentStatus: 'advance_paid',
      status: 'pending',
      note: orderNote.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (onCreateShopOrder) {
      onCreateShopOrder(newOrder);
    }

    // Track this order ID locally so customer sees pending status at the top immediately
    const updatedRecentIds = [newOrder.id, ...recentOrderIds.filter(id => id !== newOrder.id)];
    setRecentOrderIds(updatedRecentIds);
    try {
      localStorage.setItem(RECENT_ORDER_IDS_KEY, JSON.stringify(updatedRecentIds));
    } catch {}

    soundEngine.playIPhoneVerificationSound();
    setCart([]);
    localStorage.removeItem(CART_STORAGE_KEY);
    setOrderTransactionId('');
    setOrderNote('');
    setConfirmedOrder(newOrder);
  };

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

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const list = products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (sortBy === 'price_asc') {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price_desc') {
      return [...list].sort((a, b) => b.price - a.price);
    }
    return list;
  }, [products, searchQuery, selectedCategory, sortBy]);

  // Customer's own orders (matched by account, phone, or locally placed order IDs)
  const myOrders = useMemo(() => {
    const targetPhone = (loggedInCustomer?.phone || orderPhone).replace(/\D/g, '');
    return shopOrders.filter(o => {
      if (recentOrderIds.includes(o.id)) return true;
      if (loggedInCustomer && o.customerId === loggedInCustomer.id) return true;
      if (targetPhone && o.customerPhone.replace(/\D/g, '') === targetPhone) return true;
      if (loggedInCustomer && o.customerName.trim().toLowerCase() === loggedInCustomer.name.trim().toLowerCase()) return true;
      return false;
    });
  }, [shopOrders, loggedInCustomer, orderPhone, recentOrderIds]);

  // Customer's pending orders (shown at the top until confirmed by owner)
  const myPendingOrders = useMemo(
    () => myOrders.filter(o => o.status === 'pending'),
    [myOrders]
  );

  const openPolicy = (tab: PolicyTabType) => {
    setActivePolicyTab(tab);
    setShowPolicyModal(true);
  };

  if (!isOpen) return null;

  return (
    <div 
      id="visitor-shop-fullscreen-page"
      className="fixed inset-0 bg-[#F8FAFC] z-[99998] flex flex-col overflow-hidden animate-fade-in font-sans select-none text-slate-900"
    >
      {/* Top Announcement & Customer Account Bar */}
      <div className="bg-slate-900 text-white text-[11px] px-3 sm:px-6 py-1.5 shrink-0 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
            <span className="flex items-center gap-1 font-semibold text-slate-200 whitespace-nowrap">
              <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{lang === 'bn' ? `অগ্রিম ${ADVANCE_DELIVERY_CHARGE}৳ ডেলিভারি চার্জ সেন্ড মানি (${SEND_MONEY_NUMBER}) ও দ্রুত হোম ডেলিভারি` : `Advance ৳${ADVANCE_DELIVERY_CHARGE} Delivery Charge (${SEND_MONEY_NUMBER}) & Fast Home Delivery`}</span>
            </span>
            <span className="hidden md:inline text-slate-600">·</span>
            <span className="hidden md:flex items-center gap-1 font-semibold text-slate-300 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{lang === 'bn' ? '১০০% অরিজিনাল পণ্যের নিশ্চয়তা' : '100% Authentic Products'}</span>
            </span>
          </div>

          {/* Top Customer Account Status / Login / Create Account / Logout */}
          <div className="flex items-center gap-2 ml-auto">
            {loggedInCustomer ? (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-xl">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-black text-white truncate max-w-[110px] sm:max-w-[160px]">
                    {loggedInCustomer.name}
                  </span>
                  <span className="text-slate-400 hidden sm:inline">({loggedInCustomer.phone})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRegName(loggedInCustomer.name);
                    setRegPhone(loggedInCustomer.phone);
                    if (loggedInCustomer.division) setRegDivision(loggedInCustomer.division);
                    if (loggedInCustomer.district) setRegDistrict(loggedInCustomer.district);
                    if (loggedInCustomer.thana) setRegThana(loggedInCustomer.thana);
                    setRegAddress(loggedInCustomer.address);
                    setAccountTab('register');
                    setShowAccountModal(true);
                  }}
                  className="text-[10px] font-bold text-amber-300 hover:underline cursor-pointer"
                >
                  {lang === 'bn' ? 'ঠিকানা' : 'Profile'}
                </button>
                <button
                  type="button"
                  onClick={handleLogoutCustomer}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] transition-colors cursor-pointer"
                  title={lang === 'bn' ? 'লগ আউট করুন' : 'Logout'}
                >
                  <LogOut className="w-3 h-3" />
                  <span>{lang === 'bn' ? 'লগ আউট' : 'Logout'}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError('');
                    setAccountTab('register');
                    setShowAccountModal(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>{lang === 'bn' ? 'একাউন্ট খুলুন' : 'Create Account'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError('');
                    setAccountTab('login');
                    setShowAccountModal(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-black text-[10.5px] transition-colors cursor-pointer"
                >
                  <LogIn className="w-3 h-3" />
                  <span>{lang === 'bn' ? 'লগইন' : 'Login'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Storefront Navigation Header */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-20 shadow-2xs shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Brand Zone */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
              title={lang === 'bn' ? 'ফিরে যান' : 'Back'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div 
              onClick={() => {
                setSelectedProduct(null);
                setSelectedCategory('all');
              }}
              className="flex items-center gap-2 cursor-pointer min-w-0"
            >
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                style={{ backgroundColor: themeColor }}
              >
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 block leading-none truncate">
                  HelloPoint <span className="text-purple-700">Shop</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 block mt-0.5 truncate">
                  {lang === 'bn' ? 'প্রফেশনাল অনলাইন শপ' : 'Official Online Store'}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'bn' ? 'পণ্য বা ক্যাটাগরি অনুসন্ধান করুন...' : 'Search products or categories...'}
                className="w-full bg-slate-100/90 border border-slate-200/90 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right Primary Actions: My Orders & Cart */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMyOrdersModal(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Package className="w-4 h-4 text-purple-700 shrink-0" />
              <span className="hidden sm:inline">{lang === 'bn' ? 'আমার অর্ডার' : 'My Orders'}</span>
              {myOrders.length > 0 && (
                <span className="bg-purple-600 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                  {myOrders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setOrderError('');
                setShowCartModal(true);
              }}
              className="px-3.5 py-2 rounded-xl text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
              style={{ backgroundColor: themeColor }}
            >
              <div className="relative">
                <ShoppingCart className="w-4 h-4" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 font-mono font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow">
                    {totalCartItems}
                  </span>
                )}
              </div>
              <span>{lang === 'bn' ? 'কার্ট' : 'Cart'}</span>
              {cartSubtotal > 0 && (
                <span className="hidden sm:inline font-mono text-[11px] bg-black/20 px-2 py-0.5 rounded-lg tabular-nums">
                  {currency}{cartSubtotal.toLocaleString()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search & Category Filter Bar */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-2.5 space-y-2">
          <div className="md:hidden relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'পণ্য বা ক্যাটাগরি অনুসন্ধান করুন...' : 'Search products or categories...'}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            {/* Category Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {lang === 'bn' ? 'সকল পণ্য' : 'All Products'} ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Price Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-700 outline-none cursor-pointer shrink-0"
            >
              <option value="default">{lang === 'bn' ? 'সাজান: ডিফল্ট' : 'Sort: Featured'}</option>
              <option value="price_asc">{lang === 'bn' ? 'দাম: কম থেকে বেশি' : 'Price: Low to High'}</option>
              <option value="price_desc">{lang === 'bn' ? 'দাম: বেশি থেকে কম' : 'Price: High to Low'}</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Scrollable E-Commerce Storefront */}
      <main className="flex-1 overflow-y-auto scrollbar-thin flex flex-col justify-between">
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-5">
          {/* TOP PENDING ORDERS LIVE BANNER (অর্ডার কনফার্ম হবার আগ পর্যন্ত উপরে পেন্ডিং অবস্থায় কাস্টমারকে দেখাবে) */}
          {myPendingOrders.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-amber-950">
                        {lang === 'bn'
                          ? `আপনার ${myPendingOrders.length}টি অর্ডার পেন্ডিং (Pending) অবস্থায় আছে`
                          : `You have ${myPendingOrders.length} Order(s) in Pending Status`}
                      </span>
                      <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                        {lang === 'bn' ? 'কনফার্মেশনের অপেক্ষায়' : 'Awaiting Confirmation'}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-amber-800 mt-0.5">
                      {lang === 'bn'
                        ? 'অ্যাডমিন আপনার ১৫০ টাকা ডেলিভারি চার্জের ট্রানজেকশন আইডি যাচাই করে অর্ডারটি কনফার্ম করার আগ পর্যন্ত এখানে পেন্ডিং দেখাবে।'
                        : 'Your order is shown as Pending here until verified and confirmed by the store admin.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMyOrdersModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-[11px] font-black cursor-pointer transition-all shrink-0"
                >
                  {lang === 'bn' ? 'বিস্তারিত দেখুন' : 'View Details'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {myPendingOrders.map(pOrder => {
                  const dueAmt = pOrder.dueOnDeliveryAmount ?? pOrder.subtotal;
                  return (
                    <div
                      key={pOrder.id}
                      className="bg-white rounded-xl p-3 border border-amber-300/90 flex flex-col justify-between gap-2 text-left shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            #{pOrder.orderNumber}
                          </span>
                          {pOrder.transactionId && (
                            <span className="font-mono font-black text-[10.5px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              TrxID: {pOrder.transactionId}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                          ⏳ {lang === 'bn' ? 'পেন্ডিং' : 'Pending'}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-800">
                        {pOrder.items.map((it, idx) => (
                          <span key={idx}>
                            {idx > 0 ? ', ' : ''}
                            {it.name} × {it.quantity}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px]">
                        <span className="text-slate-600 font-bold truncate max-w-[65%]">
                          📍 {pOrder.division ? `${pOrder.division} > ${pOrder.district} > ${pOrder.thana}` : pOrder.customerAddress}
                        </span>
                        <span className="font-mono font-black text-slate-900">
                          {lang === 'bn' ? 'ডেলিভারিতে প্রদেয়: ' : 'Due: '}
                          {currency}{dueAmt.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer Quick Account Strip if not logged in */}
          {!loggedInCustomer ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h2 className="text-xs sm:text-sm font-black text-slate-900">
                    {lang === 'bn'
                      ? 'দ্রুত অর্ডার করতে কাস্টমার একাউন্ট খুলুন অথবা লগইন করুন'
                      : 'Create a Customer Account or Login for 1-Click Ordering'}
                  </h2>
                  <p className="text-[11px] font-medium text-slate-500">
                    {lang === 'bn'
                      ? 'নাম, মোবাইল নাম্বার ও ঠিকানা দিয়ে একাউন্ট খুলুন। পরবর্তীতে আপনার নাম ইউজারনেম এবং মোবাইল নাম্বার/নাম পাসওয়ার্ড হিসেবে কাজ করবে।'
                      : 'Register with Name, Mobile & Address. Your Name works as Username and Mobile/Name as Password.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError('');
                    setAccountTab('register');
                    setShowAccountModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'নতুন একাউন্ট খুলুন' : 'Create Account'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError('');
                    setAccountTab('login');
                    setShowAccountModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'লগইন করুন' : 'Login'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-emerald-200/90 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                  {loggedInCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-slate-900">{loggedInCustomer.name}</span>
                    <span className="text-xs font-mono font-bold text-emerald-700">{loggedInCustomer.phone}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>
                      {loggedInCustomer.division
                        ? `${loggedInCustomer.division} · ${loggedInCustomer.district} · ${loggedInCustomer.thana} — ${loggedInCustomer.address}`
                        : loggedInCustomer.address}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMyOrdersModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                >
                  {lang === 'bn' ? `আমার অর্ডার (${myOrders.length})` : `My Orders (${myOrders.length})`}
                </button>
                <button
                  type="button"
                  onClick={handleLogoutCustomer}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'লগ আউট' : 'Logout'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="py-16 bg-white rounded-3xl border border-slate-200/80 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="p-4 rounded-2xl bg-slate-100 text-slate-500">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">
                  {lang === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি!' : 'No products found!'}
                </p>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  {lang === 'bn' ? 'অন্য ক্যাটাগরি অথবা সার্চ কি-ওয়ার্ড দিয়ে চেষ্টা করুন।' : 'Try searching with different keywords.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {filteredProducts.map((product) => {
                const discountPercent = product.originalPrice && product.originalPrice > product.price 
                  ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                  : 0;
                const stockCount = getProductStock(product);
                const isAvailable = product.inStock && stockCount > 0;
                const inCartItem = resolvedCart.find(c => c.product.id === product.id);

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Product Image Area */}
                    <div className="relative">
                      <ProductCardImage
                        images={product.images}
                        imageUrl={product.imageUrl}
                        name={product.name}
                        productId={product.id}
                        onClick={() => {
                          setSelectedProduct(product);
                          setDetailImageIndex(0);
                          setDetailQty(1);
                        }}
                      />

                      {/* Discount Tag */}
                      {discountPercent > 0 && (
                        <span className="absolute top-2.5 left-2.5 bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md shadow-2xs z-10 pointer-events-none">
                          -{discountPercent}%
                        </span>
                      )}

                      {/* Stock Count Tag */}
                      <span
                        className={`absolute top-2.5 right-2.5 font-black text-[10px] px-2 py-0.5 rounded-md shadow-2xs z-10 pointer-events-none ${
                          isAvailable
                            ? 'bg-slate-900/85 text-white backdrop-blur-xs'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {isAvailable
                          ? (lang === 'bn' ? `স্টক: ${stockCount} পিস` : `Stock: ${stockCount} pcs`)
                          : (lang === 'bn' ? 'স্টক শেষ' : 'Out of Stock')}
                      </span>
                    </div>

                    {/* Product Metadata & Actions */}
                    <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2.5 text-left">
                      <div className="space-y-1">
                        {product.category && (
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                            {product.category}
                          </p>
                        )}
                        <h3 
                          onClick={() => {
                            setSelectedProduct(product);
                            setDetailImageIndex(0);
                            setDetailQty(1);
                          }}
                          className="text-xs sm:text-[15px] font-semibold text-slate-900 line-clamp-2 leading-snug cursor-pointer hover:text-purple-700 transition-colors"
                          title={product.name}
                        >
                          {product.name}
                        </h3>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        {/* Price & Stock status line */}
                        <div className="flex items-baseline justify-between gap-1 flex-wrap">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm sm:text-base font-black text-slate-900 font-mono tabular-nums">
                              {currency}{product.price.toLocaleString()}
                            </span>
                            {product.originalPrice && product.originalPrice > product.price && (
                              <span className="text-[11px] font-bold text-slate-400 line-through font-mono tabular-nums">
                                {currency}{product.originalPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* E-Commerce Cart & Order Buttons */}
                        {isAvailable ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {inCartItem ? (
                              <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-xl px-1.5 py-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQuantity(product.id, -1)}
                                  className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center font-black text-xs cursor-pointer shadow-2xs"
                                >
                                  -
                                </button>
                                <span className="text-xs font-mono font-black tabular-nums text-slate-900">
                                  {inCartItem.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCartQuantity(product.id, 1)}
                                  disabled={inCartItem.quantity >= stockCount}
                                  className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center font-black text-xs cursor-pointer shadow-2xs disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddToCart(product, 1, false)}
                                className="w-full py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 whitespace-nowrap"
                              >
                                <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                                <span>{lang === 'bn' ? 'কার্টে যোগ' : 'Add to Cart'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleAddToCart(product, 1, true)}
                              className="w-full py-2 px-2.5 text-white rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-2xs whitespace-nowrap"
                              style={{ backgroundColor: themeColor }}
                            >
                              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                              <span>{lang === 'bn' ? 'অর্ডার করুন' : 'Order Now'}</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="w-full py-2 px-3 bg-slate-100 text-slate-400 rounded-xl text-[11px] font-black cursor-not-allowed"
                          >
                            {lang === 'bn' ? 'স্টক শেষ (Out of Stock)' : 'Out of Stock'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Professional E-Commerce Footer with Policies & Payment Gateway Compliance */}
        <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-10 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Column 1: Brand & About */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white">
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-base font-black text-white tracking-tight">
                  HelloPoint Online Shop
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'আমাদের অনলাইন শপে পাচ্ছেন শতভাগ অরিজিনাল মোবাইল অ্যাক্সেসরিজ, স্মার্ট গ্যাজেট ও ইলেকট্রনিক্স পণ্য। সারাদেশে দ্রুত ডেলিভারি ও ক্যাশ অন ডেলিভারি সুবিধা।'
                  : 'Your trusted online destination for authentic mobile accessories, smart gadgets, and electronics with fast nationwide delivery.'}
              </p>
              <p className="text-[11px] font-semibold text-slate-400">
                📞 Helpline / WhatsApp: <span className="font-mono text-white">01783586858</span>
              </p>
            </div>

            {/* Column 2: Legal Policies (Required for Payment Gateway Integration) */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                {lang === 'bn' ? 'গুরুত্বপূর্ণ নীতিমালা (Legal Policies)' : 'Legal & Store Policies'}
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => openPolicy('privacy')}
                    className="text-slate-300 hover:text-white hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'bn' ? 'প্রাইভেসি পলিসি (Privacy Policy)' : 'Privacy Policy'}</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openPolicy('terms')}
                    className="text-slate-300 hover:text-white hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>{lang === 'bn' ? 'টার্মস অ্যান্ড কন্ডিশনস (Terms & Conditions)' : 'Terms & Conditions'}</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openPolicy('refund')}
                    className="text-slate-300 hover:text-white hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                    <span>{lang === 'bn' ? 'রিফান্ড ও রিটার্ন পলিসি (Refund & Return Policy)' : 'Refund & Return Policy'}</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Payment & Security Assurance */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                {lang === 'bn' ? 'পেমেন্ট ও ডেলিভারি মাধ্যম' : 'Payment & Delivery Methods'}
              </h4>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span className="bg-slate-800 border border-slate-700 text-emerald-300 px-2.5 py-1 rounded-lg">
                  Cash on Delivery
                </span>
                <span className="bg-slate-800 border border-slate-700 text-pink-300 px-2.5 py-1 rounded-lg">
                  bKash
                </span>
                <span className="bg-slate-800 border border-slate-700 text-orange-300 px-2.5 py-1 rounded-lg">
                  Nagad
                </span>
                <span className="bg-slate-800 border border-slate-700 text-blue-300 px-2.5 py-1 rounded-lg">
                  SSL Secure Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? '৭ দিনের সহজ রিটার্ন সুবিধা এবং যেকোনো অনলাইন পেমেন্টের ক্ষেত্রে ৫-৭ কার্যদিবসের মধ্যে নিরাপদ রিফান্ড গ্যারান্টি।'
                  : '7-day easy return policy and guaranteed refund within 5–7 business days for digital payments.'}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800/90 py-3 px-4 text-center text-[11px] text-slate-500">
            © {new Date().getFullYear()} HelloPoint Online Shop · Proprietor: Mahbub Hasan · All Rights Reserved.
          </div>
        </footer>
      </main>

      {/* PRODUCT DETAIL PAGE (PDP) VIEW */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-[#F8FAFC] z-[100000] overflow-y-auto animate-fade-in flex flex-col font-sans select-none">
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <button 
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'bn' ? 'শপে ফিরে যান' : 'Back to Shop'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setShowCartModal(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: themeColor }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{lang === 'bn' ? `কার্ট (${totalCartItems})` : `Cart (${totalCartItems})`}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 md:p-8">
            {(() => {
              const allImages = (selectedProduct.images && selectedProduct.images.length > 0) 
                ? selectedProduct.images.filter(Boolean) 
                : (selectedProduct.imageUrl ? [selectedProduct.imageUrl] : []);
              const activeImg = allImages[detailImageIndex] || allImages[0];
              const discountPercent = selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price 
                ? Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)
                : 0;
              const stockCount = getProductStock(selectedProduct);
              const isAvailable = selectedProduct.inStock && stockCount > 0;

              return (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-start">
                  {/* Left Column: Image Gallery */}
                  <div className="md:col-span-6 space-y-3">
                    <div className="relative w-full aspect-square bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden flex items-center justify-center">
                      {activeImg ? (
                        <img
                          src={activeImg}
                          alt={selectedProduct.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <ShoppingBag className="w-16 h-16 text-slate-300" />
                      )}

                      {allImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setDetailImageIndex(prev => (prev > 0 ? prev - 1 : allImages.length - 1))}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white cursor-pointer"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetailImageIndex(prev => (prev + 1) % allImages.length)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white cursor-pointer"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>

                    {allImages.length > 1 && (
                      <div className="grid grid-cols-4 gap-2.5">
                        {allImages.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setDetailImageIndex(idx)}
                            className={`aspect-square rounded-2xl bg-white border-2 overflow-hidden cursor-pointer ${
                              detailImageIndex === idx ? 'border-slate-900' : 'border-slate-200 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Contiguous Purchase Module */}
                  <div className="md:col-span-6 flex flex-col text-left space-y-5 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      {selectedProduct.category && <span>{selectedProduct.category}</span>}
                      <span>·</span>
                      <span className={isAvailable ? 'text-emerald-700 font-black' : 'text-rose-600 font-black'}>
                        {isAvailable
                          ? (lang === 'bn' ? `স্টকে আছে: ${stockCount} পিস` : `In Stock: ${stockCount} pcs`)
                          : (lang === 'bn' ? 'স্টক শেষ' : 'Out of Stock')}
                      </span>
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                      {selectedProduct.name}
                    </h1>

                    <div className="flex items-baseline gap-3 pb-4 border-b border-slate-100">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
                        {currency}{selectedProduct.price.toLocaleString()}
                      </span>
                      {selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price && (
                        <>
                          <span className="text-base font-bold text-slate-400 line-through font-mono tabular-nums">
                            {currency}{selectedProduct.originalPrice.toLocaleString()}
                          </span>
                          <span className="text-xs font-black text-rose-600">
                            (-{discountPercent}%)
                          </span>
                        </>
                      )}
                    </div>

                    {/* Quantity Selector & Purchase Actions */}
                    {isAvailable && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-slate-700">
                            {lang === 'bn' ? 'পরিমাণ (পিস):' : 'Quantity:'}
                          </span>
                          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() => setDetailQty(q => Math.max(1, q - 1))}
                              className="w-8 h-8 rounded-lg bg-white text-slate-800 flex items-center justify-center font-black cursor-pointer shadow-2xs"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-4 text-sm font-mono font-black tabular-nums">
                              {detailQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDetailQty(q => Math.min(stockCount, q + 1))}
                              className="w-8 h-8 rounded-lg bg-white text-slate-800 flex items-center justify-center font-black cursor-pointer shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400">
                            ({lang === 'bn' ? `সর্বোচ্চ ${stockCount} পিস` : `Max ${stockCount} pcs`})
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => handleAddToCart(selectedProduct, detailQty, false)}
                            className="py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-2xl transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            <span>{lang === 'bn' ? 'কার্টে যোগ করুন' : 'Add to Cart'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddToCart(selectedProduct, detailQty, true)}
                            className="py-3.5 px-4 text-white font-black text-xs rounded-2xl shadow-md hover:opacity-95 transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                            style={{ backgroundColor: themeColor }}
                          >
                            <ShoppingBag className="w-4 h-4" />
                            <span>{lang === 'bn' ? 'এখনই অর্ডার করুন' : 'Order Now'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Product Description */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                        {lang === 'bn' ? 'পণ্যের বিবরণ' : 'Product Description'}
                      </h3>
                      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {selectedProduct.description || (lang === 'bn' ? 'এই পণ্যটির কোনো বিবরণ দেওয়া হয়নি।' : 'No description provided.')}
                      </div>
                    </div>

                    {/* Store Assurances */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{lang === 'bn' ? 'দ্রুত ডেলিভারি' : 'Fast Delivery'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>{lang === 'bn' ? 'ক্যাশ অন ডেলিভারি' : 'Cash on Delivery'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{lang === 'bn' ? '৭ দিনে রিটার্ন' : '7-Day Return'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </main>
        </div>
      )}

      {/* CUSTOMER ACCOUNT MODAL (CREATE ACCOUNT & LOGIN) */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[100010] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 p-5 sm:p-6 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {lang === 'bn' ? 'কাস্টমার একাউন্ট' : 'Customer Account'}
                  </h3>
                  <p className="text-[10.5px] font-semibold text-slate-500">
                    {lang === 'bn' ? 'HelloPoint অনলাইন শপ মেম্বারশিপ' : 'HelloPoint Online Shop Account'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mt-4">
              <button
                type="button"
                onClick={() => {
                  setAccountTab('register');
                  setAuthError('');
                }}
                className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  accountTab === 'register' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {lang === 'bn' ? 'নতুন একাউন্ট খুলুন' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountTab('login');
                  setAuthError('');
                }}
                className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  accountTab === 'login' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {lang === 'bn' ? 'লগইন করুন' : 'Login'}
              </button>
            </div>

            {accountTab === 'register' ? (
              <form onSubmit={handleRegisterAccount} className="space-y-3.5 mt-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    {lang === 'bn' ? 'আপনার নাম (ইউজারনেম হিসেবে কাজ করবে) *' : 'Your Name (Works as Username) *'}
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={lang === 'bn' ? 'আপনার পুরো নাম লিখুন' : 'Enter your full name'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    {lang === 'bn' ? 'মোবাইল নাম্বার (১১ ডিজিট - পাসওয়ার্ড হিসেবে কাজ করবে) *' : 'Mobile Number (11 Digits - Works as Password) *'}
                  </label>
                  <input
                    type="tel"
                    maxLength={11}
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>

                {/* 3 Separate Cards for Division, District, Thana in Registration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-2.5">
                    <label className="block text-[10px] font-black text-purple-900 mb-1">
                      {lang === 'bn' ? '১. বিভাগ *' : '1. Division *'}
                    </label>
                    <select
                      value={regDivision}
                      onChange={(e) => setRegDivision(e.target.value)}
                      className="w-full bg-white border border-purple-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 outline-none"
                    >
                      {BD_DIVISIONS.map(div => (
                        <option key={div} value={div}>{div}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5">
                    <label className="block text-[10px] font-black text-blue-900 mb-1">
                      {lang === 'bn' ? '২. জেলা *' : '2. District *'}
                    </label>
                    <input
                      type="text"
                      value={regDistrict}
                      onChange={(e) => setRegDistrict(e.target.value)}
                      placeholder={lang === 'bn' ? 'জেলার নাম' : 'District'}
                      className="w-full bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none"
                    />
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5">
                    <label className="block text-[10px] font-black text-emerald-900 mb-1">
                      {lang === 'bn' ? '৩. থানা / উপজেলা *' : '3. Thana *'}
                    </label>
                    <input
                      type="text"
                      value={regThana}
                      onChange={(e) => setRegThana(e.target.value)}
                      placeholder={lang === 'bn' ? 'থানার নাম' : 'Thana'}
                      className="w-full bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    {lang === 'bn' ? 'বিস্তারিত ডেলিভারি ঠিকানা (গ্রাম/রোড/বাসা) *' : 'Detailed Delivery Address *'}
                  </label>
                  <textarea
                    rows={2}
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder={lang === 'bn' ? 'গ্রাম/রোড, ইউনিয়ন/ওয়ার্ড, বাজার বা বাসা নাম্বার' : 'House/Road, Village/Area'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 focus:bg-white resize-none"
                  />
                </div>

                {authError && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl text-white text-xs font-black shadow-md transition-all cursor-pointer active:scale-98"
                  style={{ backgroundColor: themeColor }}
                >
                  {lang === 'bn' ? 'একাউন্ট তৈরি করুন' : 'Create Account'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginAccount} className="space-y-3.5 mt-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] font-semibold text-slate-600">
                  {lang === 'bn'
                    ? '💡 আপনার একাউন্টের "নাম" ইউজারনেম হিসেবে এবং "মোবাইল নাম্বার" (অথবা নাম) পাসওয়ার্ড হিসেবে দিন।'
                    : '💡 Enter your registered Name as Username and your Mobile Number (or Name) as Password.'}
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    {lang === 'bn' ? 'ইউজারনেম (আপনার নাম) *' : 'Username (Your Name) *'}
                  </label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder={lang === 'bn' ? 'আপনার নাম লিখুন' : 'Enter your registered name'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    {lang === 'bn' ? 'পাসওয়ার্ড (মোবাইল নাম্বার বা নাম) *' : 'Password (Mobile Number or Name) *'}
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={lang === 'bn' ? 'পাসওয়ার্ড দিন' : 'Enter password'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>

                {authError && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md transition-all cursor-pointer active:scale-98"
                >
                  {lang === 'bn' ? 'লগইন করুন' : 'Login Now'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SHOPPING CART & ORDER CONFIRMATION CHECKOUT MODAL */}
      {showCartModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[100005] flex items-center justify-center p-2 sm:p-5 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 text-left">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    {confirmedOrder
                      ? (lang === 'bn' ? 'অর্ডার সাবমিট হয়েছে (পেন্ডিং)!' : 'Order Submitted (Pending)!')
                      : (lang === 'bn' ? 'শপিং কার্ট এবং অর্ডার কনফার্মেশন' : 'Shopping Cart & Order Checkout')}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {lang === 'bn'
                      ? 'বিভাগ, জেলা, থানা ও অগ্রিম ১৫০ টাকা ডেলিভারি চার্জের ট্রানজেকশন আইডি দিয়ে অর্ডার সাবমিট করুন'
                      : 'Enter delivery address & ৳150 delivery charge Transaction ID to submit order'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCartModal(false);
                  setConfirmedOrder(null);
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            {confirmedOrder ? (
              <div className="p-6 sm:p-8 overflow-y-auto space-y-5 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <Clock className="w-10 h-10 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs font-mono font-black text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                      #{confirmedOrder.orderNumber}
                    </span>
                    <span className="text-xs font-black text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                      ⏳ {lang === 'bn' ? 'পেন্ডিং (Pending)' : 'Pending'}
                    </span>
                  </div>
                  <h4 className="text-lg sm:text-xl font-black text-slate-900 pt-2">
                    {lang === 'bn' ? 'ধন্যবাদ! আপনার অর্ডারটি পেন্ডিং অবস্থায় গ্রহণ করা হয়েছে' : 'Thank You! Your Order is Submitted & Pending Confirmation'}
                  </h4>
                  <p className="text-xs font-semibold text-slate-600 max-w-md mx-auto">
                    {lang === 'bn'
                      ? 'অ্যাডমিন আপনার ১৫০ টাকা সেন্ড মানি (TrxID) যাচাই করে অর্ডারটি কনফার্ম করার আগ পর্যন্ত শপের উপরে আপনার অর্ডারটি পেন্ডিং অবস্থায় দেখতে পাবেন।'
                      : 'Your order will remain visible as Pending at the top of the shop until verified and confirmed by admin.'}
                  </p>
                </div>

                <div className="max-w-lg mx-auto bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">{lang === 'bn' ? 'কাস্টমারের নাম:' : 'Customer:'}</span>
                    <span className="font-black text-slate-900">{confirmedOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">{lang === 'bn' ? 'মোবাইল নাম্বার:' : 'Mobile:'}</span>
                    <span className="font-mono font-black text-slate-900">{confirmedOrder.customerPhone}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="block text-[9.5px] font-bold text-slate-400">{lang === 'bn' ? 'বিভাগ' : 'Division'}</span>
                      <span className="font-black text-slate-800">{confirmedOrder.division}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="block text-[9.5px] font-bold text-slate-400">{lang === 'bn' ? 'জেলা' : 'District'}</span>
                      <span className="font-black text-slate-800">{confirmedOrder.district}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="block text-[9.5px] font-bold text-slate-400">{lang === 'bn' ? 'থানা' : 'Thana'}</span>
                      <span className="font-black text-slate-800">{confirmedOrder.thana}</span>
                    </div>
                  </div>
                  <div className="flex justify-between gap-4 pt-1">
                    <span className="text-slate-500 font-bold shrink-0">{lang === 'bn' ? 'বিস্তারিত ঠিকানা:' : 'Address:'}</span>
                    <span className="font-bold text-slate-800 text-right">{confirmedOrder.customerAddress}</span>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <span className="text-emerald-800 font-black">{lang === 'bn' ? 'অগ্রিম ১৫০৳ ডেলিভারি TrxID:' : 'Advance ৳150 TrxID:'}</span>
                    <span className="font-mono font-black text-emerald-900">{confirmedOrder.transactionId}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 mt-2 space-y-1">
                    {confirmedOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-slate-700 font-semibold">
                        <span>{item.name} × {item.quantity}</span>
                        <span className="font-mono font-bold">{currency}{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 pt-2 space-y-1">
                    <div className="flex justify-between text-slate-600 font-bold">
                      <span>{lang === 'bn' ? 'পণ্যের মূল্য:' : 'Product Subtotal:'}</span>
                      <span className="font-mono">{currency}{confirmedOrder.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>{lang === 'bn' ? 'ডেলিভারি চার্জ (অগ্রিম পেইড):' : 'Delivery Charge (Advance Paid):'}</span>
                      <span className="font-mono">{currency}{ADVANCE_DELIVERY_CHARGE} (পেইড)</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-purple-700 pt-1 border-t border-slate-200">
                      <span>{lang === 'bn' ? 'ডেলিভারির সময় প্রদেয় (পণ্য হাতে পেয়ে):' : 'Due on Delivery:'}</span>
                      <span className="font-mono">{currency}{(confirmedOrder.dueOnDeliveryAmount ?? confirmedOrder.subtotal).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedOrder(null);
                      setShowCartModal(false);
                      setShowMyOrdersModal(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black cursor-pointer"
                  >
                    {lang === 'bn' ? 'আমার অর্ডার দেখুন' : 'View My Orders'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedOrder(null);
                      setShowCartModal(false);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer"
                  >
                    {lang === 'bn' ? 'শপে ফিরে যান' : 'Back to Shop'}
                  </button>
                </div>
              </div>
            ) : resolvedCart.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-black text-slate-700">
                  {lang === 'bn' ? 'আপনার কার্টে কোনো পণ্য নেই!' : 'Your shopping cart is empty!'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowCartModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black cursor-pointer"
                >
                  {lang === 'bn' ? 'পণ্য পছন্দ করুন' : 'Browse Products'}
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Cart Items List & Bill Summary */}
                <div className="lg:col-span-5 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {lang === 'bn' ? `নির্বাচিত পণ্যসমূহ (${totalCartItems} পিস)` : `Cart Items (${totalCartItems} pcs)`}
                  </h4>

                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {resolvedCart.map(({ product, quantity }) => {
                      const maxStock = getProductStock(product);
                      return (
                        <div
                          key={product.id}
                          className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                <ShoppingBag className="w-5 h-5 text-slate-300" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h5 className="text-xs font-black text-slate-900 truncate">{product.name}</h5>
                              <p className="text-[11px] font-mono font-bold text-purple-700 tabular-nums">
                                {currency}{product.price.toLocaleString()} × {quantity} = {currency}{(product.price * quantity).toLocaleString()}
                              </p>
                              <p className="text-[10px] font-semibold text-slate-400">
                                {lang === 'bn' ? `স্টক: ${maxStock} পিস` : `Stock: ${maxStock} pcs`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQuantity(product.id, -1)}
                                className="w-6 h-6 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-2 text-xs font-mono font-black tabular-nums">{quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQuantity(product.id, 1)}
                                disabled={quantity >= maxStock}
                                className="w-6 h-6 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs cursor-pointer disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(product.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Subtotal & Advance 150 Tk Breakdown Box */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>{lang === 'bn' ? 'পণ্যের মোট মূল্য:' : 'Products Subtotal:'}</span>
                      <span className="font-mono font-bold tabular-nums">{currency}{cartSubtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-amber-300 font-bold">
                      <span>{lang === 'bn' ? 'ডেলিভারি চার্জ (অগ্রিম সেন্ড মানি):' : 'Delivery Charge (Advance):'}</span>
                      <span className="font-mono tabular-nums">+ {currency}{ADVANCE_DELIVERY_CHARGE}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-800">
                      <span>{lang === 'bn' ? 'সর্বমোট বিল:' : 'Grand Total:'}</span>
                      <span className="font-mono font-bold tabular-nums">{currency}{(cartSubtotal + ADVANCE_DELIVERY_CHARGE).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-400 font-bold">
                      <span>{lang === 'bn' ? 'অগ্রিম পরিশোধ (ডেলিভারি চার্জ):' : 'Advance Paid Now:'}</span>
                      <span className="font-mono tabular-nums">- {currency}{ADVANCE_DELIVERY_CHARGE}</span>
                    </div>
                    <div className="flex justify-between text-sm sm:text-base font-black pt-1.5 border-t border-slate-700 text-amber-400">
                      <span>{lang === 'bn' ? 'ডেলিভারির সময় প্রদেয়:' : 'Due on Delivery:'}</span>
                      <span className="font-mono tabular-nums">{currency}{cartSubtotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Customer Delivery (3 Cards for Division, District, Thana) & Advance 150 Tk TrxID Form */}
                <form onSubmit={handleConfirmOrder} className="lg:col-span-7 space-y-3.5 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/90">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      {lang === 'bn' ? 'ডেলিভারি ঠিকানা ও অর্ডার কনফার্মেশন' : 'Delivery Address & Order Confirmation'}
                    </h4>
                    {loggedInCustomer && (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        ✓ {lang === 'bn' ? 'একাউন্ট থেকে অটো-ফিলকৃত' : 'Auto-filled'}
                      </span>
                    )}
                  </div>

                  {/* Customer Name & Mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">
                        {lang === 'bn' ? 'আপনার নাম *' : 'Full Name *'}
                      </label>
                      <input
                        type="text"
                        value={orderName}
                        onChange={(e) => setOrderName(e.target.value)}
                        placeholder={lang === 'bn' ? 'আপনার পুরো নাম লিখুন' : 'Enter your full name'}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">
                        {lang === 'bn' ? 'মোবাইল নাম্বার (১১ ডিজিট) *' : 'Mobile Number (11 Digits) *'}
                      </label>
                      <input
                        type="tel"
                        maxLength={11}
                        value={orderPhone}
                        onChange={(e) => setOrderPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="01XXXXXXXXX"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold font-mono text-slate-900 outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  {/* ডেলিভারি ঠিকানা: বিভাগ, জেলা, থানা আলাদা ৩ কার্ডে */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-800">
                      {lang === 'bn'
                        ? '📍 ডেলিভারি এরিয়া (বিভাগ, জেলা ও থানা আলাদা ৩ কার্ডে পূরণ করুন) *'
                        : '📍 Delivery Area (Division, District & Thana in 3 Cards) *'}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Card 1: বিভাগ (Division) */}
                      <div className="bg-white rounded-2xl p-3 border-2 border-purple-200 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                            {lang === 'bn' ? 'কার্ড ১: বিভাগ' : 'Card 1: Division'}
                          </span>
                          <MapPin className="w-3.5 h-3.5 text-purple-600" />
                        </div>
                        <select
                          value={orderDivision}
                          onChange={(e) => setOrderDivision(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-black text-slate-900 outline-none focus:border-purple-600 focus:bg-white cursor-pointer"
                        >
                          {BD_DIVISIONS.map(div => (
                            <option key={div} value={div}>{div} বিভাগ</option>
                          ))}
                        </select>
                      </div>

                      {/* Card 2: জেলা (District) */}
                      <div className="bg-white rounded-2xl p-3 border-2 border-blue-200 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            {lang === 'bn' ? 'কার্ড ২: জেলা' : 'Card 2: District'}
                          </span>
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <input
                          type="text"
                          value={orderDistrict}
                          onChange={(e) => setOrderDistrict(e.target.value)}
                          placeholder={lang === 'bn' ? 'জেলার নাম লিখুন' : 'Enter District'}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-black text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                        />
                      </div>

                      {/* Card 3: থানা / উপজেলা (Thana) */}
                      <div className="bg-white rounded-2xl p-3 border-2 border-emerald-200 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {lang === 'bn' ? 'কার্ড ৩: থানা' : 'Card 3: Thana'}
                          </span>
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <input
                          type="text"
                          value={orderThana}
                          onChange={(e) => setOrderThana(e.target.value)}
                          placeholder={lang === 'bn' ? 'থানা/উপজেলা লিখুন' : 'Enter Thana'}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-black text-slate-900 outline-none focus:border-emerald-600 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Detailed Street / Village Address Card */}
                  <div className="bg-white rounded-2xl p-3 border border-slate-200/90 space-y-1.5">
                    <label className="block text-[11px] font-black text-slate-700">
                      {lang === 'bn' ? 'বিস্তারিত ডেলিভারি ঠিকানা (গ্রাম/রোড/বাসা/বাজার) *' : 'Detailed Delivery Address (Village/Road/House) *'}
                    </label>
                    <textarea
                      rows={2}
                      value={orderAddress}
                      onChange={(e) => setOrderAddress(e.target.value)}
                      placeholder={lang === 'bn' ? 'বাড়ি/রোড নং, গ্রাম/মহল্লা, ইউনিয়ন/ওয়ার্ড বা নিকটস্থ বাজারের নাম লিখুন' : 'House/Road, Village/Area, Landmark'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-900 focus:bg-white resize-none"
                    />
                  </div>

                  {/* ADVANCE 150 TK DELIVERY CHARGE SEND MONEY & TRANSACTION ID CARD */}
                  <div className="bg-amber-50/90 border-2 border-amber-400 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="inline-block bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase">
                          {lang === 'bn' ? 'অগ্রিম ডেলিভারি চার্জ পেমেন্ট' : 'Advance Delivery Charge'}
                        </span>
                        <h5 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                          {lang === 'bn'
                            ? `অগ্রিম ১৫০ টাকা ডেলিভারি চার্জ নিচের নাম্বারে সেন্ড মানি (Send Money) করে ট্রানজেকশন আইডি সাবমিট করুন:`
                            : `Send Money ৳150 advance delivery charge to the number below and submit Transaction ID:`}
                        </h5>
                      </div>
                    </div>

                    {/* Send Money Number Box with Copy Button */}
                    <div className="bg-white border-2 border-slate-900 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="block text-[10px] font-black text-slate-500 uppercase">
                          {lang === 'bn' ? 'সেন্ড মানি নাম্বার (পার্সোনাল):' : 'Send Money Number:'}
                        </span>
                        <span className="font-mono text-base sm:text-lg font-black text-slate-900 tracking-wider select-all">
                          {SEND_MONEY_NUMBER}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(SEND_MONEY_NUMBER).catch(() => {});
                          setCopiedSendMoney(true);
                          setTimeout(() => setCopiedSendMoney(false), 2000);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        {copiedSendMoney ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                        <span>{copiedSendMoney ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : (lang === 'bn' ? 'নাম্বার কপি' : 'Copy')}</span>
                      </button>
                    </div>

                    {/* Transaction ID Input */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-900 mb-1">
                        {lang === 'bn'
                          ? '১৫০ টাকা সেন্ড মানি করার পর ট্রানজেকশন আইডি (Transaction ID / TrxID) লিখুন *'
                          : 'Enter Transaction ID (TrxID) after sending ৳150 *'}
                      </label>
                      <input
                        type="text"
                        value={orderTransactionId}
                        onChange={(e) => setOrderTransactionId(e.target.value)}
                        placeholder={lang === 'bn' ? 'যেমন: BKA8492XYZ / সেন্ড মানি TrxID লিখুন' : 'Enter Send Money Transaction ID'}
                        className="w-full bg-white border-2 border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-mono font-black text-slate-900 uppercase placeholder:normal-case outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1">
                      {lang === 'bn' ? 'অর্ডার নোট (ঐচ্ছিক)' : 'Order Note (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      placeholder={lang === 'bn' ? 'কালার বা ডেলিভারি সংক্রান্ত কোনো নির্দেশনা থাকলে লিখুন...' : 'Any special instructions...'}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-900"
                    />
                  </div>

                  {!loggedInCustomer && (
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createAccountOnOrder}
                        onChange={(e) => setCreateAccountOnOrder(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>
                        {lang === 'bn'
                          ? 'এই নাম, মোবাইল ও ঠিকানা দিয়ে আমার কাস্টমার একাউন্টও তৈরি করে রাখুন'
                          : 'Save my Name, Mobile & Address as a Customer Account'}
                      </span>
                    </label>
                  )}

                  {/* Legal Consent Notice */}
                  <p className="text-[10.5px] font-medium text-slate-500 leading-relaxed">
                    {lang === 'bn' ? 'অর্ডার সাবমিট করার মাধ্যমে আপনি আমাদের ' : 'By submitting this order, you agree to our '}
                    <button type="button" onClick={() => openPolicy('terms')} className="text-purple-700 font-bold underline cursor-pointer">
                      {lang === 'bn' ? 'টার্মস অ্যান্ড কন্ডিশনস' : 'Terms & Conditions'}
                    </button>
                    ,{' '}
                    <button type="button" onClick={() => openPolicy('privacy')} className="text-purple-700 font-bold underline cursor-pointer">
                      {lang === 'bn' ? 'প্রাইভেসি পলিসি' : 'Privacy Policy'}
                    </button>{' '}
                    {lang === 'bn' ? 'এবং ' : 'and '}
                    <button type="button" onClick={() => openPolicy('refund')} className="text-purple-700 font-bold underline cursor-pointer">
                      {lang === 'bn' ? 'রিফান্ড পলিসি' : 'Refund Policy'}
                    </button>
                    {lang === 'bn' ? '-তে সম্মতি প্রদান করছেন।' : '.'}
                  </p>

                  {orderError && (
                    <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center">
                      {orderError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl text-white font-black text-xs sm:text-sm shadow-lg hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {lang === 'bn'
                        ? `ট্রানজেকশন আইডিসহ অর্ডার সাবমিট করুন`
                        : `Submit Order with Transaction ID`}
                    </span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MY ORDERS MODAL */}
      {showMyOrdersModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[100010] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 text-left">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm sm:text-base font-black">
                  {lang === 'bn' ? 'আমার অর্ডারসমূহ' : 'My Orders'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMyOrdersModal(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50">
              {myOrders.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-slate-500">
                  <Package className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-black">
                    {lang === 'bn' ? 'আপনার কোনো অর্ডার পাওয়া যায়নি।' : 'No orders found for your account.'}
                  </p>
                </div>
              ) : (
                myOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md">
                          #{order.orderNumber}
                        </span>
                        {order.transactionId && (
                          <span className="font-mono font-bold text-[10.5px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            TrxID: {order.transactionId}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-black px-2.5 py-0.5 rounded-md ${
                          order.status === 'pending'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                            : order.status === 'confirmed'
                            ? 'bg-blue-100 text-blue-900'
                            : order.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        {order.status === 'pending'
                          ? (lang === 'bn' ? '⏳ পেন্ডিং (কনফার্মেশনের অপেক্ষায়)' : '⏳ Pending')
                          : order.status === 'confirmed'
                          ? (lang === 'bn' ? '✓ কনফার্মড' : '✓ Confirmed')
                          : order.status === 'delivered'
                          ? (lang === 'bn' ? '✓ ডেলিভারি সম্পন্ন' : '✓ Delivered')
                          : (lang === 'bn' ? '✕ বাতিল' : '✕ Cancelled')}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between font-semibold text-slate-700">
                          <span>{item.name} × {item.quantity}</span>
                          <span className="font-mono font-bold">{currency}{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 font-semibold truncate max-w-[60%]">
                        📍 {order.division ? `${order.division}, ${order.district}, ${order.thana} — ` : ''}{order.customerAddress}
                      </span>
                      <span className="font-mono font-black text-sm text-slate-900">
                        {lang === 'bn' ? 'ডেলিভারিতে প্রদেয়: ' : 'Due: '}
                        {currency}{(order.dueOnDeliveryAmount ?? order.subtotal).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* POLICIES MODAL (PRIVACY, TERMS, REFUND) */}
      <ShopPoliciesModal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        activeTab={activePolicyTab}
        setActiveTab={setActivePolicyTab}
        lang={lang}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {cartToast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100030] bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap"
          >
            <span>{cartToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
