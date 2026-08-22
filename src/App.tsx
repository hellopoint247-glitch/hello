/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { safeLocalStorage as localStorage } from './utils/safeStorage';
import { motion, AnimatePresence } from 'motion/react';
import { Contact, Transaction, CashbookEntry, PayBillEntry, ScreenState, SignUpRequest, RechargeRequest, ChatMessage, PayBillRequest, TrashTransaction, Product, ChatQuickFAQ } from './types';
import { 
  loadContacts, 
  saveContacts, 
  loadTransactions, 
  saveTransactions, 
  loadCashbook, 
  saveCashbook,
  loadPayBills,
  savePayBills,
  loadTrashTransactions,
  saveTrashTransactions,
  loadProducts,
  saveProducts,
  loadQuickFaqs,
  saveQuickFaqs,
  getCurrency,
  saveCurrency
} from './utils/storage';
import { MainDashboard } from './components/MainDashboard';
import { CustomerDetail } from './components/CustomerDetail';
import { TransactionForm } from './components/TransactionForm';
import { CashbookForm } from './components/CashbookForm';
import { PinLockScreen } from './components/PinLockScreen';
import { CustomerPortal } from './components/CustomerPortal';
import { TrashBinModal } from './components/TrashBinModal';
import { ThemeMode, getSavedThemeMode, saveThemeMode, applyTheme } from './utils/theme';

// Firebase core integration imports
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logoutFromGoogle, 
  handleFirestoreError, 
  OperationType 
} from './utils/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  query,
  where,
  addDoc
} from 'firebase/firestore';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const isWithin7Days = (createdAtStr?: string) => {
  if (!createdAtStr) return false;
  const time = new Date(createdAtStr).getTime();
  if (isNaN(time)) return false;
  return (Date.now() - time) <= SEVEN_DAYS_MS;
};

const cleanForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanForFirestore(val);
      }
    });
    return cleaned;
  }
  return obj;
};

export default function App() {
  // Authentication & Sync metadata states
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadingCloud, setLoadingCloud] = useState(false);

  // Application database hooks
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trashTransactions, setTrashTransactions] = useState<TrashTransaction[]>([]);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [trashToast, setTrashToast] = useState<{ message: string; trashItem: TrashTransaction } | null>(null);
  const [cashbook, setCashbook] = useState<CashbookEntry[]>([]);
  const [paybills, setPayBills] = useState<PayBillEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [products, setProducts] = useState<Product[]>(() => loadProducts());
  const [quickFaqs, setQuickFaqs] = useState<ChatQuickFAQ[]>(() => loadQuickFaqs());
  const [currency, setCurrencyState] = useState('৳');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<string[]>([]);
  const [themeColor, setThemeColor] = useState<string>(() => localStorage.getItem('hellopoint_theme_color') || '#6244a6');
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getSavedThemeMode());

  // Dynamic theme support
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', themeColor);
    root.style.setProperty('--brand-hover', `color-mix(in srgb, ${themeColor} 85%, black)`);
    root.style.setProperty('--brand-light', `color-mix(in srgb, ${themeColor} 10%, white)`);
    root.style.setProperty('--brand-dark-header', `color-mix(in srgb, ${themeColor} 38%, #1c222a)`);
    root.style.setProperty('--brand-dark-border', `color-mix(in srgb, ${themeColor} 50%, #46515e)`);
  }, [themeColor]);

  // Dark / Light / System Mode management
  useEffect(() => {
    applyTheme(themeMode);

    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const handleSystemThemeChange = () => {
      if (getSavedThemeMode() === 'system') {
        applyTheme('system');
      }
    };

    if (mediaQuery && mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, [themeMode]);

  const handleUpdateThemeMode = (newMode: ThemeMode) => {
    setThemeModeState(newMode);
    saveThemeMode(newMode);
  };

  const handleUpdateThemeColor = async (color: string) => {
    setThemeColor(color);
    localStorage.setItem('hellopoint_theme_color', color);
    window.dispatchEvent(new Event('storage'));
    
    const activeUid = user?.uid || ownerUid;
    if (activeUid && auth.currentUser && auth.currentUser.uid === activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid), { themeColor: color }, { merge: true });
      } catch (err) {
        console.error('Failed to update themeColor in Firestore:', err);
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}`);
      }
    }
  };
  
  // Navigation routing state
  const [screen, setScreen] = useState<ScreenState>({ type: 'dashboard' });
  const [isCashbookOpen, setIsCashbookOpen] = useState(false);

  // Synchronized Bilingual status
  const [lang, setLang] = useState<'bn' | 'en'>(() => (localStorage.getItem('hellopoint_lang') as 'bn' | 'en') || 'bn');

  // Interactive 4-digit PIN lock security
  const [isLocked, setIsLocked] = useState(true);
  const [sessionRole, setSessionRole] = useState<'owner' | 'customer' | null>(null);
  const [loggedInCustomerId, setLoggedInCustomerId] = useState<string | null>(null);

  // Frosted saving overlay transition state
  const [saveLoading, setSaveLoading] = useState(false);

  // Signup requests state
  const [signupRequests, setSignupRequests] = useState<SignUpRequest[]>([]);

  // Recharge requests state
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);

  // Paybill requests state
  const [paybillRequests, setPaybillRequests] = useState<PayBillRequest[]>([]);

  // Synchronized security and shop configuration states
  const [ownerPin, setOwnerPin] = useState<string>(() => localStorage.getItem('hellopoint_pin') || '1234');
  const [shopStatus, setShopStatus] = useState<'open' | 'closed'>(() => (localStorage.getItem('hellopoint_shop_status') as 'open' | 'closed') || 'open');

  const handleSaveCategory = async (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    if (trimmed.includes(',') || trimmed.includes('।')) return;

    setCustomCategories(prev => {
      let updated = [...prev];
      if (!updated.includes(trimmed)) {
        updated = [trimmed, ...updated];
      }
      localStorage.setItem('hellopoint_custom_categories', JSON.stringify(updated));

      // Sync to Firestore if authenticated as activeUid
      const activeUid = user?.uid || ownerUid;
      if (activeUid && auth.currentUser && auth.currentUser.uid === activeUid) {
        setDoc(doc(db, 'users', activeUid), { customCategories: updated }, { merge: true })
          .catch(err => {
            console.error('Failed to sync saved category:', err);
            handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}`);
          });
        
        // Also remove from deleted categories list in Firestore/local if it was deleted
        if (deletedCategories.includes(trimmed)) {
          const cleanDeleted = deletedCategories.filter(d => d !== trimmed);
          setDeletedCategories(cleanDeleted);
          localStorage.setItem('hellopoint_deleted_notes', JSON.stringify(cleanDeleted));
          setDoc(doc(db, 'users', activeUid), { deletedCategories: cleanDeleted }, { merge: true })
            .catch(err => {
              console.error('Failed to sync updated deletedCategories:', err);
              handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}`);
            });
        }
      }

      return updated;
    });
  };

  const handleDeleteCategory = async (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;

    // Remove from customCategories and add to deletedCategories
    setCustomCategories(prev => {
      const updatedCustom = prev.filter(c => c !== trimmed);
      localStorage.setItem('hellopoint_custom_categories', JSON.stringify(updatedCustom));

      setDeletedCategories(prevDeleted => {
        let updatedDeleted = [...prevDeleted];
        if (!updatedDeleted.includes(trimmed)) {
          updatedDeleted = [...updatedDeleted, trimmed];
        }
        localStorage.setItem('hellopoint_deleted_notes', JSON.stringify(updatedDeleted));

        const activeUid = user?.uid || ownerUid;
        if (activeUid && auth.currentUser && auth.currentUser.uid === activeUid) {
          setDoc(doc(db, 'users', activeUid), { 
            customCategories: updatedCustom,
            deletedCategories: updatedDeleted 
          }, { merge: true }).catch(err => {
            console.error('Failed to sync deleted category:', err);
            handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}`);
          });
        }

        return updatedDeleted;
      });

      return updatedCustom;
    });
  };

  const [ownerUid, setOwnerUid] = useState<string | null>(() => localStorage.getItem('hellopoint_synced_owner_uid'));
  const [customerOfflineObj, setCustomerOfflineObj] = useState<Contact | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<Transaction[]>([]);

  const handleUpdatePin = async (newPin: string) => {
    setOwnerPin(newPin);
    localStorage.setItem('hellopoint_pin', newPin);
    window.dispatchEvent(new Event('storage'));
    
    if (user?.uid) {
      try {
        await setDoc(doc(db, 'users', user.uid), { pin: newPin, shopStatus }, { merge: true });
      } catch (err) {
        console.error('Failed to sync updated PIN to Firestore:', err);
      }
    }
  };

  const handleUpdateShopStatus = async (newStatus: 'open' | 'closed') => {
    setShopStatus(newStatus);
    localStorage.setItem('hellopoint_shop_status', newStatus);
    window.dispatchEvent(new Event('storage'));

    if (user?.uid) {
      try {
        await setDoc(doc(db, 'users', user.uid), { pin: ownerPin, shopStatus: newStatus }, { merge: true });
      } catch (err) {
        console.error('Failed to sync updated shop status to Firestore:', err);
      }
    }
  };

  // Helper definition for Customer phone authentication validation
  const handleVerifyCustomerPhone = async (phone: string): Promise<Contact | null> => {
    const cleanNum = (s: string): string => {
      if (!s) return '';
      const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      let res = s.trim();
      for (let i = 0; i < 10; i++) {
        res = res.replaceAll(bnNums[i], String(i));
      }
      return res.replace(/\D/g, '');
    };
    const cleanCompleted = cleanNum(phone);
    const isPhoneMatch = (p1: string, p2: string): boolean => {
      const c1 = cleanNum(p1);
      const c2 = cleanNum(p2);
      if (!c1 || !c2) return false;
      return c1 === c2 || c1.slice(-10) === c2.slice(-10);
    };

    // 1. Try local list first
    const foundLocal = contacts.find(c => c.type === 'customer' && isPhoneMatch(c.phone, cleanCompleted));
    if (foundLocal) {
      setCustomerOfflineObj(foundLocal);
      return foundLocal;
    }

    // 2. Try Firestore lookup using the synced ownerUid
    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        const contactsRef = collection(db, 'users', activeUid, 'contacts');
        const querySnapshot = await getDocs(contactsRef);
        const list: Contact[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Contact);
        });

        if (list.length > 0) {
          setContacts(list);
          const found = list.find(c => c.type === 'customer' && isPhoneMatch(c.phone, cleanCompleted));
          if (found) {
            setCustomerOfflineObj(found);
            return found;
          }
        }
      } catch (err) {
        console.error('Failed to run public query for customer phone:', err);
      }
    }
    return null;
  };

  // Session-persistence setup or verify check
  useEffect(() => {
    const savedPin = localStorage.getItem('hellopoint_pin');
    const sessionTimeStr = localStorage.getItem('hellopoint_pin_session_time');
    const savedRole = localStorage.getItem('hellopoint_session_role') as 'owner' | 'customer' | null;
    const savedCustId = localStorage.getItem('hellopoint_session_customer_id');
    
    if (!savedPin) {
      setIsLocked(true);
    } else {
      if (sessionTimeStr) {
        const elapsed = Date.now() - parseInt(sessionTimeStr, 10);
        if (elapsed < 3600000) { // 1 Hour session lifetime
          setIsLocked(false);
          setSessionRole(savedRole || 'owner');
          setLoggedInCustomerId(savedCustId);
        } else {
          setIsLocked(true);
          setSessionRole(null);
          setLoggedInCustomerId(null);
        }
      } else {
        setIsLocked(true);
      }
    }
  }, []);

  // Initial load of currency from localStorage (offline/always accessible)
  useEffect(() => {
    setCurrencyState(getCurrency());
  }, []);

  // Listen for Google Auth changes and register public store config
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        // Run background migration of local storage ledger records to cloud on first login
        await migrateLocalToCloud(currentUser.uid);

        // Save Owner configuration to find ownerUid across all devices seamlessly
        try {
          await setDoc(doc(db, 'public', 'owner_config'), { 
            ownerUid: currentUser.uid, 
            ownerEmail: currentUser.email 
          }, { merge: true });
        } catch (err) {
          console.error('Failed to save public owner config:', err);
        }
      }
    });

    // Listen to the public owner config to sync owner's UID in real-time
    const unsubPublic = onSnapshot(doc(db, 'public', 'owner_config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.ownerUid) {
          setOwnerUid(data.ownerUid);
          localStorage.setItem('hellopoint_synced_owner_uid', data.ownerUid);
        }
      }
    });

    return () => {
      unsubscribe();
      unsubPublic();
    };
  }, []);

  // Sync state loading & real-time updates based on account state (Offline fallback or Unified Cloud synchronization)
  useEffect(() => {
    if (authLoading) return;

    const activeUid = user?.uid || ownerUid;

    if (!activeUid) {
      // Offline/Signed-Out Mode: Load from localStorage
      const offlineContacts = loadContacts();
      setContacts(offlineContacts);
      setTransactions(loadTransactions());
      setTrashTransactions(loadTrashTransactions());
      setCashbook(loadCashbook());
      setPayBills(loadPayBills());
      try {
        const savedRecharges = localStorage.getItem('hellopoint_recharge_requests');
        if (savedRecharges) setRechargeRequests(JSON.parse(savedRecharges));
      } catch (e) {
        console.error(e);
      }
      try {
        const savedPaybillsReq = localStorage.getItem('hellopoint_paybill_requests');
        if (savedPaybillsReq) setPaybillRequests(JSON.parse(savedPaybillsReq));
      } catch (e) {
        console.error(e);
      }
      try {
        const savedChats = localStorage.getItem('hellopoint_chat_messages');
        if (savedChats) {
          const parsed: ChatMessage[] = JSON.parse(savedChats);
          const valid = parsed.filter(m => isWithin7Days(m.createdAt));
          setChatMessages(valid);
          localStorage.setItem('hellopoint_chat_messages', JSON.stringify(valid));
        }
      } catch (e) {
        console.error(e);
      }
      return;
    }

    // Centrally unified Synced Mode: Setup Real-Time Subscriptions
    setLoadingCloud(true);

    const qContacts = collection(db, 'users', activeUid, 'contacts');
    const unsubContacts = onSnapshot(qContacts, (snapshot) => {
      const list: Contact[] = [];
      snapshot.forEach((snapDoc) => {
        list.push(snapDoc.data() as Contact);
      });
      // Sort by last update
      setContacts(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setLoadingCloud(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/contacts`);
    });

    const qTransactions = collection(db, 'users', activeUid, 'transactions');
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((snapDoc) => {
        list.push(snapDoc.data() as Transaction);
      });
      setTransactions(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/transactions`);
    });

    const qCashbook = collection(db, 'users', activeUid, 'cashbook');
    const unsubCashbook = onSnapshot(qCashbook, (snapshot) => {
      const list: CashbookEntry[] = [];
      snapshot.forEach((snapDoc) => {
        list.push(snapDoc.data() as CashbookEntry);
      });
      // Sort cashbook chronologically descending (newest first)
      setCashbook(list.sort((a, b) => b.date.localeCompare(a.date)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/cashbook`);
    });

    const qPayBills = collection(db, 'users', activeUid, 'paybills');
    const unsubPayBills = onSnapshot(qPayBills, (snapshot) => {
      const list: PayBillEntry[] = [];
      snapshot.forEach((snapDoc) => {
        list.push(snapDoc.data() as PayBillEntry);
      });
      // Sort paybills chronologically descending (newest first)
      setPayBills(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/paybills`);
    });

    const qReminders = collection(db, 'users', activeUid, 'reminders');
    const unsubReminders = onSnapshot(qReminders, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((snapDoc) => {
        list.push(snapDoc.data());
      });
      try {
        const localSaved = localStorage.getItem('hellopoint_reminders');
        const localList = localSaved ? JSON.parse(localSaved) : [];
        const mergedMap = new Map();
        
        // Put Firestore values in first
        list.forEach((r: any) => mergedMap.set(r.id, r));
        
        // Let local list override / merge wisely
        localList.forEach((r: any) => {
          const existing = mergedMap.get(r.id);
          if (existing) {
            const isCompleted = existing.isCompleted || r.isCompleted;
            const isTriggered = isCompleted ? false : (existing.isTriggered || r.isTriggered);
            mergedMap.set(r.id, {
              ...existing,
              ...r,
              isCompleted,
              isTriggered
            });
          } else {
            mergedMap.set(r.id, r);
          }
        });

        const mergedArray = Array.from(mergedMap.values());
        mergedArray.sort((a, b) => b.id.localeCompare(a.id));
        localStorage.setItem('hellopoint_reminders', JSON.stringify(mergedArray));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Failed to merge reminders:', err);
      }
    }, (error) => {
      console.error('Failed to subscribe to reminders:', error);
    });

    const qRecharges = (sessionRole === 'customer' && loggedInCustomerId)
      ? query(collection(db, 'users', activeUid, 'recharge_requests'), where('contactId', '==', loggedInCustomerId))
      : collection(db, 'users', activeUid, 'recharge_requests');

    const unsubRecharges = onSnapshot(qRecharges, (snapshot) => {
      const list: RechargeRequest[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as any;
        list.push({
          ...data,
          id: data.id || snapDoc.id
        } as RechargeRequest);
      });
      setRechargeRequests(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      localStorage.setItem('hellopoint_recharge_requests', JSON.stringify(list));
      window.dispatchEvent(new Event('storage'));
    }, (error) => {
      console.error('Failed to subscribe to recharge requests:', error);
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/recharge_requests`);
    });

    const qPaybillRequests = (sessionRole === 'customer' && loggedInCustomerId)
      ? query(collection(db, 'users', activeUid, 'paybill_requests'), where('contactId', '==', loggedInCustomerId))
      : collection(db, 'users', activeUid, 'paybill_requests');

    const unsubPaybillRequests = onSnapshot(qPaybillRequests, (snapshot) => {
      const list: PayBillRequest[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as any;
        list.push({
          ...data,
          id: data.id || snapDoc.id
        } as PayBillRequest);
      });
      setPaybillRequests(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      localStorage.setItem('hellopoint_paybill_requests', JSON.stringify(list));
      window.dispatchEvent(new Event('storage'));
    }, (error) => {
      console.error('Failed to subscribe to paybill requests:', error);
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/paybill_requests`);
    });

    const qChats = (sessionRole === 'customer' && loggedInCustomerId)
      ? query(collection(db, 'users', activeUid, 'chats'), where('contactId', '==', loggedInCustomerId))
      : collection(db, 'users', activeUid, 'chats');

    const unsubChats = onSnapshot(qChats, (snapshot) => {
      const list: ChatMessage[] = [];
      const expiredMsgs: ChatMessage[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as ChatMessage;
        const msgId = data.id || snapDoc.id;
        const msgWithId = { ...data, id: msgId };
        if (isWithin7Days(data.createdAt)) {
          list.push(msgWithId);
        } else {
          expiredMsgs.push(msgWithId);
        }
      });
      const sorted = list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setChatMessages(sorted);
      localStorage.setItem('hellopoint_chat_messages', JSON.stringify(sorted));

      // Auto-delete expired chat messages (> 7 days) from Firestore
      if (expiredMsgs.length > 0 && activeUid) {
        expiredMsgs.forEach((m) => {
          deleteDoc(doc(db, 'users', activeUid, 'chats', m.id)).catch((err) => {
            console.error('Failed to auto-delete expired chat message:', err);
          });
        });
      }
    }, (error) => {
      console.error('Failed to subscribe to chats:', error);
    });

    const qTrash = collection(db, 'users', activeUid, 'trash_transactions');
    const unsubTrash = onSnapshot(qTrash, (snapshot) => {
      const list: TrashTransaction[] = [];
      const expiredItems: TrashTransaction[] = [];
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as TrashTransaction;
        const itemId = data.id || snapDoc.id;
        const item = { ...data, id: itemId };
        const deletedTime = new Date(data.deletedAt).getTime();

        if (!isNaN(deletedTime) && (now - deletedTime) > THIRTY_DAYS_MS) {
          expiredItems.push(item);
        } else {
          list.push(item);
        }
      });

      setTrashTransactions(list.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)));
      saveTrashTransactions(list);

      // Auto-purge items older than 30 days
      if (expiredItems.length > 0 && activeUid) {
        expiredItems.forEach((item) => {
          deleteDoc(doc(db, 'users', activeUid, 'trash_transactions', item.id)).catch(() => {});
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${activeUid}/trash_transactions`);
    });

    const qProducts = collection(db, 'users', activeUid, 'products');
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as Product;
        list.push({ ...data, id: data.id || snapDoc.id });
      });
      list.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setProducts(list);
      saveProducts(list);
    }, (error) => {
      console.error('Failed to subscribe to products:', error);
    });

    const qQuickFaqs = collection(db, 'users', activeUid, 'quick_faqs');
    const unsubQuickFaqs = onSnapshot(qQuickFaqs, (snapshot) => {
      const list: ChatQuickFAQ[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as ChatQuickFAQ;
        list.push({ ...data, id: data.id || snapDoc.id });
      });
      setQuickFaqs(list);
      saveQuickFaqs(list);
    }, (error) => {
      console.error('Failed to subscribe to quick_faqs:', error);
    });

    return () => {
      unsubContacts();
      unsubTransactions();
      unsubCashbook();
      unsubPayBills();
      unsubReminders();
      unsubRecharges();
      unsubPaybillRequests();
      unsubChats();
      unsubTrash();
      unsubProducts();
      unsubQuickFaqs();
    };
  }, [user, ownerUid, authLoading, sessionRole, loggedInCustomerId]);

  // Auto cleanup interval for chat messages older than 7 days
  useEffect(() => {
    const cleanupExpiredChats = () => {
      setChatMessages((prev) => {
        const valid = prev.filter((m) => isWithin7Days(m.createdAt));
        if (valid.length !== prev.length) {
          localStorage.setItem('hellopoint_chat_messages', JSON.stringify(valid));
          const activeUid = user?.uid || ownerUid;
          if (activeUid) {
            const expired = prev.filter((m) => !isWithin7Days(m.createdAt));
            expired.forEach((m) => {
              deleteDoc(doc(db, 'users', activeUid, 'chats', m.id)).catch(() => {});
            });
          }
        }
        return valid;
      });
    };

    cleanupExpiredChats();
    const interval = setInterval(cleanupExpiredChats, 60000);
    return () => clearInterval(interval);
  }, [user, ownerUid]);

  // Real-time cross-tab synchronization listener
  useEffect(() => {
    const handleStorageChange = () => {
      setProducts(loadProducts());
      setQuickFaqs(loadQuickFaqs());
      const savedChats = localStorage.getItem('hellopoint_chat_messages');
      if (savedChats) {
        try {
          const parsed = JSON.parse(savedChats);
          if (Array.isArray(parsed)) {
            setChatMessages(parsed);
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Offline fallback loader for categories when first loading or offline
  useEffect(() => {
    const activeUid = user?.uid || ownerUid;
    if (!activeUid) {
      try {
        const localTheme = localStorage.getItem('hellopoint_theme_color');
        if (localTheme) {
          setThemeColor(localTheme);
        }
        const localSaved = localStorage.getItem('hellopoint_custom_categories');
        if (localSaved) {
          setCustomCategories(JSON.parse(localSaved));
        } else {
          const defaultNotes = [
            'মালামাল কেনা বাবদ',
            'বকেয়া পরিশোধ',
            'প্রথম কিস্তি জমা',
            'নগদ ক্যাশ গ্রহণ',
            'বাকিতে ক্রয়',
            'বাকিতে বিক্রয়',
            'পরিবহন খরচ',
            'অগ্রিম প্রদান'
          ];
          setCustomCategories(defaultNotes);
          localStorage.setItem('hellopoint_custom_categories', JSON.stringify(defaultNotes));
        }
        const localDeleted = localStorage.getItem('hellopoint_deleted_notes');
        if (localDeleted) {
          setDeletedCategories(JSON.parse(localDeleted));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [user, ownerUid]);

  // Real-Time settings sync from owner account (even for unauthenticated customer devices)
  useEffect(() => {
    const activeUid = user?.uid || ownerUid;
    if (!activeUid) return;

    const docUser = doc(db, 'users', activeUid);
    const unsubUser = onSnapshot(docUser, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data) {
          if (data.pin && data.pin !== localStorage.getItem('hellopoint_pin')) {
            setOwnerPin(data.pin);
            localStorage.setItem('hellopoint_pin', data.pin);
            window.dispatchEvent(new Event('storage'));
          }
          if (data.shopStatus && data.shopStatus !== localStorage.getItem('hellopoint_shop_status')) {
            setShopStatus(data.shopStatus);
            localStorage.setItem('hellopoint_shop_status', data.shopStatus);
            window.dispatchEvent(new Event('storage'));
          }
          if (data.themeColor && data.themeColor !== localStorage.getItem('hellopoint_theme_color')) {
            setThemeColor(data.themeColor);
            localStorage.setItem('hellopoint_theme_color', data.themeColor);
            window.dispatchEvent(new Event('storage'));
          } else {
            try {
              const localTheme = localStorage.getItem('hellopoint_theme_color');
              if (localTheme && user?.uid && user.uid === activeUid) {
                setDoc(docUser, { themeColor: localTheme }, { merge: true }).catch(err => {
                  console.error('Failed to initialize themeColor in Firestore:', err);
                });
              }
            } catch (e) {
              console.error(e);
            }
          }
          if (data.customCategories) {
            setCustomCategories(data.customCategories);
            localStorage.setItem('hellopoint_custom_categories', JSON.stringify(data.customCategories));
            window.dispatchEvent(new Event('storage'));
          } else {
            try {
              const localSaved = localStorage.getItem('hellopoint_custom_categories');
              if (localSaved) {
                const parsed = JSON.parse(localSaved);
                setCustomCategories(parsed);
                if (user?.uid && user.uid === activeUid) {
                  setDoc(docUser, { customCategories: parsed }, { merge: true }).catch(err => {
                    console.error('Failed to initialize customCategories in Firestore:', err);
                  });
                }
              }
            } catch (e) {
              console.error(e);
            }
          }
          if (data.deletedCategories) {
            setDeletedCategories(data.deletedCategories);
            localStorage.setItem('hellopoint_deleted_notes', JSON.stringify(data.deletedCategories));
            window.dispatchEvent(new Event('storage'));
          } else {
            try {
              const localSaved = localStorage.getItem('hellopoint_deleted_notes');
              if (localSaved) {
                const parsed = JSON.parse(localSaved);
                setDeletedCategories(parsed);
                if (user?.uid && user.uid === activeUid) {
                  setDoc(docUser, { deletedCategories: parsed }, { merge: true }).catch(err => {
                    console.error('Failed to initialize deletedCategories in Firestore:', err);
                  });
                }
              }
            } catch (e) {
              console.error(e);
            }
          }

          if (data.favoriteTags) {
            localStorage.setItem('hellopoint_favorite_tags', JSON.stringify(data.favoriteTags));
            window.dispatchEvent(new Event('storage'));
          } else {
            try {
              const localFavs = localStorage.getItem('hellopoint_favorite_tags');
              if (localFavs && (user?.uid || activeUid)) {
                setDoc(docUser, { favoriteTags: JSON.parse(localFavs) }, { merge: true }).catch(console.error);
              }
            } catch (e) {
              console.error(e);
            }
          }

          if (data.tagCategoryOverrides) {
            localStorage.setItem('hellopoint_tag_category_overrides', JSON.stringify(data.tagCategoryOverrides));
            window.dispatchEvent(new Event('storage'));
          } else {
            try {
              const localOverrides = localStorage.getItem('hellopoint_tag_category_overrides');
              if (localOverrides && (user?.uid || activeUid)) {
                setDoc(docUser, { tagCategoryOverrides: JSON.parse(localOverrides) }, { merge: true }).catch(console.error);
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      } else {
        if (user) {
          const currentPin = localStorage.getItem('hellopoint_pin') || '1234';
          const currentShopStatus = localStorage.getItem('hellopoint_shop_status') || 'open';
          const currentTheme = localStorage.getItem('hellopoint_theme_color') || '#6244a6';
          
          let initialCustom: string[] = [];
          let initialDeleted: string[] = [];
          let initialFavs: string[] = [];
          let initialOverrides: Record<string, string> = {};
          try {
            const cached = localStorage.getItem('hellopoint_custom_categories');
            if (cached) initialCustom = JSON.parse(cached);
            const cachedDeleted = localStorage.getItem('hellopoint_deleted_notes');
            if (cachedDeleted) initialDeleted = JSON.parse(cachedDeleted);
            const cachedFavs = localStorage.getItem('hellopoint_favorite_tags');
            if (cachedFavs) initialFavs = JSON.parse(cachedFavs);
            const cachedOverrides = localStorage.getItem('hellopoint_tag_category_overrides');
            if (cachedOverrides) initialOverrides = JSON.parse(cachedOverrides);
          } catch(e) {}

          setDoc(docUser, { 
            pin: currentPin, 
            shopStatus: currentShopStatus,
            customCategories: initialCustom,
            deletedCategories: initialDeleted,
            favoriteTags: initialFavs,
            tagCategoryOverrides: initialOverrides,
            themeColor: currentTheme
          }).catch(err => {
            console.error('Failed to initialize settings document in Firestore:', err);
          });
        }
      }
    }, (error) => {
      console.error('Failed to sync settings from cloud:', error);
    });

    return () => unsubUser();
  }, [user, ownerUid]);

  // Real-time listener for SignUp Requests
  useEffect(() => {
    if (!user) {
      setSignupRequests([]);
      return;
    }
    const q = collection(db, 'signup_requests');
    const unsub = onSnapshot(q, (snapshot) => {
      const list: SignUpRequest[] = [];
      snapshot.forEach((snapDoc) => {
        list.push({ id: snapDoc.id, ...snapDoc.data() } as SignUpRequest);
      });
      setSignupRequests(list);
    }, (error) => {
      console.error("Failed to subscribe to signup requests:", error);
    });
    return () => unsub();
  }, [user]);

  const handleRegisterRequest = async (name: string, phone: string, photoUrl?: string): Promise<{ success: boolean; isAlreadyPending?: boolean; message: string }> => {
    try {
      if (!photoUrl || !photoUrl.trim()) {
        return {
          success: false,
          message: lang === 'bn' 
            ? 'নতুন অ্যাকাউন্ট খোলার জন্য ছবি যুক্ত করা বাধ্যতামূলক।' 
            : 'Photo is mandatory for creating a new account.'
        };
      }

      const cleanNum = (s: string): string => {
        if (!s) return '';
        const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        let res = s.trim();
        for (let i = 0; i < 10; i++) {
          res = res.replaceAll(bnNums[i], String(i));
        }
        return res.replace(/\D/g, '');
      };
      const cleanPhone = cleanNum(phone);

      // 1. Check if they are already a registered contact in the owner's contacts
      const activeUid = user?.uid || ownerUid;
      if (activeUid) {
        const contactsRef = collection(db, 'users', activeUid, 'contacts');
        const qContacts = query(contactsRef);
        const contactsSnap = await getDocs(qContacts);
        let foundExisting = false;
        contactsSnap.forEach((docSnap) => {
          const c = docSnap.data() as Contact;
          if (cleanNum(c.phone) === cleanPhone) {
            foundExisting = true;
          }
        });
        if (foundExisting) {
          return {
            success: false,
            message: lang === 'bn' 
              ? 'আপনার নম্বরটি ইতিমধ্যে নিবন্ধিত রয়েছে! দয়া করে সরাসরি লগইন করুন।' 
              : 'Your number is already registered! Please login directly.'
          };
        }
      }

      // 2. Check if a request already exists in 'signup_requests' collection
      const reqRef = collection(db, 'signup_requests');
      const qSignup = query(reqRef);
      const signupSnap = await getDocs(qSignup);
      let existingReq: SignUpRequest | null = null;
      signupSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (cleanNum(data.phone || '') === cleanPhone) {
          existingReq = { id: docSnap.id, ...data } as SignUpRequest;
        }
      });

      if (existingReq) {
        if ((existingReq as SignUpRequest).status === 'accepted') {
          return {
            success: false,
            message: lang === 'bn' 
              ? 'আপনার অ্যাকাউন্ট ইতিমধ্যে অনুমোদিত হয়েছে! অনুগ্রহ করে সরাসরি লগইন করুন।' 
              : 'Your account is already approved! Please login directly.'
          };
        }
        return {
          success: true,
          isAlreadyPending: true,
          message: lang === 'bn' 
            ? 'আপনার রিকুয়েষ্ট পেন্ডিংএ আছে অনুগ্রহ করে অপেক্ষা করুন' 
            : 'Your request is pending, please wait'
        };
      }

      // 3. Otherwise addDoc
      await addDoc(reqRef, {
        name: name.trim(),
        phone: cleanPhone,
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...(photoUrl ? { photoUrl } : {})
      });

      return {
        success: true,
        message: lang === 'bn' 
          ? 'আপনার রিকুয়েষ্ট পেন্ডিংএ আছে অনুগ্রহ করে অপেক্ষা করুন' 
          : 'Your request is pending, please wait'
      };
    } catch (error: any) {
      console.error("Signup error:", error);
      return {
        success: false,
        message: lang === 'bn' 
          ? `অনুরোধ পাঠাতে সমস্যা হয়েছে: ${error.message}` 
          : `Failed to submit request: ${error.message}`
      };
    }
  };

  const handleAcceptSignUpRequest = async (req: SignUpRequest) => {
    triggerSaveAnimation();
    if (!user) return;
    try {
      // 1. Create a new contact
      const contactId = 'contact-' + Date.now();
      const newContact: Contact = {
        id: contactId,
        name: req.name.trim(),
        phone: req.phone.trim(),
        type: 'customer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(req.photoUrl ? { photoUrl: req.photoUrl } : {})
      };
      await setDoc(doc(db, 'users', user.uid, 'contacts', contactId), cleanForFirestore(newContact));

      // 2. Delete the signup request so it leaves the notification bar
      await deleteDoc(doc(db, 'signup_requests', req.id));
    } catch (err) {
      console.error("Failed to accept signup request:", err);
    }
  };

  const handleRejectSignUpRequest = async (req: SignUpRequest) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'signup_requests', req.id));
    } catch (err) {
      console.error("Failed to reject signup request:", err);
    }
  };

  const handleCreateRechargeRequest = async (rechargePhone: string, amount: number, method: 'bkash' | 'nagad' | 'flexiload') => {
    if (!loggedInCustomerId) return;
    const customerName = loggedInCustomerObj?.name || 'Customer';
    const newRequest: RechargeRequest = {
      id: 'rech_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      contactId: loggedInCustomerId,
      customerName,
      rechargePhone,
      amount,
      method,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Optimistic local state update
    const updated = [newRequest, ...rechargeRequests];
    setRechargeRequests(updated);
    localStorage.setItem('hellopoint_recharge_requests', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'recharge_requests', newRequest.id), cleanForFirestore(newRequest));
      } catch (err) {
        console.error('Failed to save recharge request to Firestore:', err);
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/recharge_requests/${newRequest.id}`);
      }
    }
  };

  const handleClearRechargeRequest = async (requestId: string) => {
    // Optimistic local state update
    const updated = rechargeRequests.filter(req => req.id !== requestId);
    setRechargeRequests(updated);
    localStorage.setItem('hellopoint_recharge_requests', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'recharge_requests', requestId));
      } catch (err) {
        console.error('Failed to delete recharge request:', err);
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/recharge_requests/${requestId}`);
      }
    }
  };

  const handleCompleteRechargeRequest = async (req: RechargeRequest) => {
    triggerSaveAnimation();
    
    const methodLabels: Record<string, string> = {
      bkash: 'বিকাশ রিচার্জ',
      nagad: 'নগদ রিচার্জ',
      flexiload: 'ফ্লেক্সিলোড রিচার্জ'
    };
    const note = `${methodLabels[req.method] || 'রিচার্জ'} (${req.rechargePhone})`;
    
    const newTx: Transaction = {
      id: 'tx_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      contactId: req.contactId,
      amount: req.amount,
      type: 'GAVE', // বাকির খাতা
      note,
      billNo: req.rechargePhone.slice(-4),
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    // Optimistic local state update
    const offlineTransactions = [...transactions, newTx];
    setTransactions(offlineTransactions);
    localStorage.setItem('hellopoint_transactions', JSON.stringify(offlineTransactions));
    
    const updatedRecharges = rechargeRequests.map(r => r.id === req.id ? { ...r, status: 'completed' as const } : r);
    setRechargeRequests(updatedRecharges);
    localStorage.setItem('hellopoint_recharge_requests', JSON.stringify(updatedRecharges));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'transactions', newTx.id), cleanForFirestore(newTx));
        await setDoc(doc(db, 'users', activeUid, 'recharge_requests', req.id), { status: 'completed' }, { merge: true });
        await setDoc(doc(db, 'users', activeUid, 'contacts', req.contactId), { updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.error('Failed to complete recharge request in Firestore:', err);
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/recharge_requests/${req.id}`);
      }
    }
  };

  const handleCancelRechargeRequest = async (req: RechargeRequest) => {
    // Optimistic local state update
    const updatedRecharges = rechargeRequests.map(r => r.id === req.id ? { ...r, status: 'cancelled' as const } : r);
    setRechargeRequests(updatedRecharges);
    localStorage.setItem('hellopoint_recharge_requests', JSON.stringify(updatedRecharges));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'recharge_requests', req.id), { status: 'cancelled' }, { merge: true });
      } catch (err) {
        console.error('Failed to cancel recharge request:', err);
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/recharge_requests/${req.id}`);
      }
    }
  };

  const handleCreatePayBillRequest = async (
    billerNumber: string,
    amount: number,
    billerDetails: string,
    secondDate: string,
    phone: string
  ) => {
    if (!loggedInCustomerId) return;
    const customerName = loggedInCustomerObj?.name || 'Customer';

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const currentMonthPaybillsCount = (paybills || []).filter(pb => {
      const rawDate = pb.date && pb.date.trim() ? pb.date.trim() : (pb.createdAt || '');
      const d = new Date(rawDate);
      const mk = !isNaN(d.getTime()) 
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : currentMonthKey;
      return mk === currentMonthKey;
    }).length;

    const currentMonthRequestsCount = (paybillRequests || []).filter(req => {
      const d = new Date(req.createdAt || '');
      const mk = !isNaN(d.getTime()) 
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : currentMonthKey;
      return mk === currentMonthKey;
    }).length;

    const serialNum = currentMonthPaybillsCount + currentMonthRequestsCount + 1;
    const paddedSerial = String(serialNum).padStart(4, '0');

    const newRequest: PayBillRequest = {
      id: 'pb_req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      contactId: loggedInCustomerId,
      customerName,
      billerNumber,
      amount,
      billerDetails,
      secondDate,
      phone,
      status: 'pending',
      createdAt: new Date().toISOString(),
      serialNumber: paddedSerial
    };

    // Optimistic local state update
    const updated = [newRequest, ...paybillRequests];
    setPaybillRequests(updated);
    localStorage.setItem('hellopoint_paybill_requests', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'paybill_requests', newRequest.id), cleanForFirestore(newRequest));
      } catch (err) {
        console.error('Failed to save paybill request to Firestore:', err);
      }
    }
  };

  const handleCompletePayBillRequest = async (req: PayBillRequest) => {
    triggerSaveAnimation();

    const newPayBill: PayBillEntry = {
      id: 'pb-' + Date.now(),
      billerNumber: req.billerNumber,
      amount: req.amount,
      date: new Date().toISOString().split('T')[0],
      billerDetails: req.billerDetails,
      secondDate: req.secondDate,
      note: req.phone,
      isPaid: false,
      createdAt: new Date().toISOString(),
      contactId: req.contactId
    };

    await handleSavePayBill(newPayBill);

    const updatedRequests = paybillRequests.filter(r => r.id !== req.id);
    setPaybillRequests(updatedRequests);
    localStorage.setItem('hellopoint_paybill_requests', JSON.stringify(updatedRequests));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'paybill_requests', req.id));
      } catch (err) {
        console.error('Failed to complete paybill request from Firestore:', err);
      }
    }
  };

  const handleCancelPayBillRequest = async (req: PayBillRequest) => {
    const updatedRequests = paybillRequests.filter(r => r.id !== req.id);
    setPaybillRequests(updatedRequests);
    localStorage.setItem('hellopoint_paybill_requests', JSON.stringify(updatedRequests));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'paybill_requests', req.id));
      } catch (err) {
        console.error('Failed to delete paybill request:', err);
      }
    }
  };

  // Fetching customer's outstanding ledger entries live from Firestore
  useEffect(() => {
    const activeUid = user?.uid || ownerUid;
    if (sessionRole === 'customer' && loggedInCustomerId && activeUid) {
      const qTxs = query(
        collection(db, 'users', activeUid, 'transactions'),
        where('contactId', '==', loggedInCustomerId)
      );
      const unsubCustTxs = onSnapshot(qTxs, (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Transaction);
        });
        setCustomerTransactions(list);
      }, (err) => {
        console.error('Failed to sync customer transactions:', err);
      });
      return unsubCustTxs;
    }
  }, [sessionRole, loggedInCustomerId, user, ownerUid]);

  // Migrate local details to cloud securely upon sign-in
  const migrateLocalToCloud = async (uid: string) => {
    try {
      const offlineContacts = loadContacts();
      const offlineTransactions = loadTransactions();
      const offlineCashbook = loadCashbook();
      const offlinePayBills = loadPayBills();
      const offlineProducts = loadProducts();
      const offlineQuickFaqs = loadQuickFaqs();

      const hasOfflineData = 
        offlineContacts.length > 0 || 
        offlineTransactions.length > 0 || 
        offlineCashbook.length > 0 ||
        offlinePayBills.length > 0 ||
        offlineProducts.length > 0 ||
        offlineQuickFaqs.length > 0;
      if (!hasOfflineData) return;

      const migrationToken = `hellopoint_synced_${uid}`;
      if (localStorage.getItem(migrationToken) === 'true') return;

      console.log('Initiating automatic Google Account sync to prevent data loss...');
      
      // Perform batch writes for each entity
      for (const cont of offlineContacts) {
        await setDoc(doc(db, 'users', uid, 'contacts', cont.id), cleanForFirestore(cont));
      }
      for (const tx of offlineTransactions) {
        await setDoc(doc(db, 'users', uid, 'transactions', tx.id), cleanForFirestore(tx));
      }
      for (const cb of offlineCashbook) {
        await setDoc(doc(db, 'users', uid, 'cashbook', cb.id), cleanForFirestore(cb));
      }
      for (const pb of offlinePayBills) {
        await setDoc(doc(db, 'users', uid, 'paybills', pb.id), cleanForFirestore(pb));
      }
      for (const prod of offlineProducts) {
        await setDoc(doc(db, 'users', uid, 'products', prod.id), cleanForFirestore(prod));
      }
      for (const faq of offlineQuickFaqs) {
        await setDoc(doc(db, 'users', uid, 'quick_faqs', faq.id), cleanForFirestore(faq));
      }

      // Mark migration as successful to prevent double syncs
      localStorage.setItem(migrationToken, 'true');
      console.log('Synchronized off-grid transactions and products to Hello Point database cloud.');
    } catch (err) {
      console.error('Account ledger migration warning:', err);
    }
  };

  const handleCurrencyChange = (c: string) => {
    setCurrencyState(c);
    saveCurrency(c);
  };

  const triggerSaveAnimation = () => {
    setSaveLoading(true);
    setTimeout(() => {
      setSaveLoading(false);
    }, 700);
  };

  // Auth logins
  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
    } catch (e) {
      console.warn('Google login failed or was blocked by iframe container:', e);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logoutFromGoogle();
      // Clear local states triggers reload
      setContacts([]);
      setTransactions([]);
      setCashbook([]);
    } catch (e) {
      console.error('Signout failed:', e);
    }
  };

  // Contacts handlers
  const handleAddContact = async (name: string, phone: string) => {
    triggerSaveAnimation();
    const contactId = 'contact-' + Date.now();

    const newContact: Contact = {
      id: contactId,
      name: name.trim(),
      phone: phone.trim(),
      type: 'customer', // Force customer type as supplier is removed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (user) {
      const path = `users/${user.uid}/contacts/${contactId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'contacts', contactId), cleanForFirestore(newContact));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } else {
      const updated = [newContact, ...contacts];
      setContacts(updated);
      saveContacts(updated);
    }
  };

  const handleDeleteContact = async (id: string) => {
    // Instantaneous local UI updates & local persistent backup update
    const updatedContacts = contacts.filter(c => c.id !== id);
    const updatedTxs = transactions.filter(t => t.contactId !== id);
    setContacts(updatedContacts);
    setTransactions(updatedTxs);
    saveContacts(updatedContacts);
    saveTransactions(updatedTxs);

    if (user) {
      try {
        // Cascade delete on Firestore - delete contact
        await deleteDoc(doc(db, 'users', user.uid, 'contacts', id));
        
        // Delete child transactions
        const relatedTxs = transactions.filter(t => t.contactId === id);
        for (const tx of relatedTxs) {
          await deleteDoc(doc(db, 'users', user.uid, 'transactions', tx.id));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/contacts/${id}`);
      }
    }

    if (screen.type === 'contact_detail' && screen.contactId === id) {
      setScreen({ type: 'dashboard' });
    }
  };

  const handleClearCustomerTransactions = async (contactId: string) => {
    const relatedTxs = transactions.filter(t => t.contactId === contactId);
    const relatedCbIds = new Set(relatedTxs.map(t => t.cashbookEntryId).filter(Boolean));
    
    // Instantaneous local UI updates & persistent backup
    const updatedTxs = transactions.filter(t => t.contactId !== contactId);
    setTransactions(updatedTxs);
    saveTransactions(updatedTxs);

    if (relatedCbIds.size > 0) {
      const updatedCb = cashbook.filter(c => !relatedCbIds.has(c.id));
      setCashbook(updatedCb);
      saveCashbook(updatedCb);
    }

    // Direct deletion without sending to trash bin as requested
    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        for (const tx of relatedTxs) {
          await deleteDoc(doc(db, 'users', activeUid, 'transactions', tx.id));
          if (tx.cashbookEntryId) {
            await deleteDoc(doc(db, 'users', activeUid, 'cashbook', tx.cashbookEntryId));
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/transactions`);
      }
    }
  };

  const handleUpdateContactPhoto = async (contactId: string, photoBase64: string) => {
    triggerSaveAnimation();
    const updatedContacts = contacts.map(c => {
      if (c.id === contactId) {
        return { ...c, photoUrl: photoBase64, updatedAt: new Date().toISOString() };
      }
      return c;
    });
    setContacts(updatedContacts);
    saveContacts(updatedContacts);

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'contacts', contactId), { 
          photoUrl: photoBase64, 
          updatedAt: new Date().toISOString() 
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update contact photoUrl in Firestore:', err);
      }
    }
  };

  const handleUpdateContactInfo = async (contactId: string, name: string, phone: string) => {
    triggerSaveAnimation();
    const updatedContacts = contacts.map(c => {
      if (c.id === contactId) {
        return { ...c, name, phone, updatedAt: new Date().toISOString() };
      }
      return c;
    });
    setContacts(updatedContacts);
    saveContacts(updatedContacts);

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'contacts', contactId), { 
          name, 
          phone, 
          updatedAt: new Date().toISOString() 
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update contact info in Firestore:', err);
      }
    }
  };

  const handleSendChatMessage = async (
    contactId: string, 
    text: string, 
    senderRole: 'owner' | 'customer' = 'customer', 
    senderName: string = 'Customer',
    senderPhone?: string
  ) => {
    const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const newMessage: ChatMessage = {
      id: messageId,
      contactId,
      senderRole,
      senderName,
      ...(senderPhone ? { senderPhone } : {}),
      text: text.trim(),
      readByOwner: senderRole === 'owner',
      readByCustomer: senderRole === 'customer',
      createdAt: new Date().toISOString()
    };

    const updatedMessages = [...chatMessages, newMessage];
    setChatMessages(updatedMessages);
    localStorage.setItem('hellopoint_chat_messages', JSON.stringify(updatedMessages));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'chats', messageId), cleanForFirestore(newMessage));
      } catch (err) {
        console.error('Failed to send chat message:', err);
      }
    }
  };

  const handleDeleteChatMessage = async (messageId: string) => {
    const updatedMessages = chatMessages.filter(m => m.id !== messageId);
    setChatMessages(updatedMessages);
    localStorage.setItem('hellopoint_chat_messages', JSON.stringify(updatedMessages));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'chats', messageId));
      } catch (err) {
        console.error('Failed to delete chat message:', err);
      }
    }
  };

  const handleDeleteChatThread = async (contactId: string) => {
    const messagesToDelete = chatMessages.filter(m => m.contactId === contactId);
    const updatedMessages = chatMessages.filter(m => m.contactId !== contactId);
    setChatMessages(updatedMessages);
    localStorage.setItem('hellopoint_chat_messages', JSON.stringify(updatedMessages));
    window.dispatchEvent(new Event('storage'));

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        for (const msg of messagesToDelete) {
          await deleteDoc(doc(db, 'users', activeUid, 'chats', msg.id));
        }
      } catch (err) {
        console.error('Failed to delete chat thread:', err);
      }
    }
  };

  const handleSaveProduct = async (product: Product) => {
    const formattedProduct: Product = {
      ...product,
      updatedAt: new Date().toISOString(),
      createdAt: product.createdAt || new Date().toISOString()
    };

    setProducts(prev => {
      const existingIndex = prev.findIndex(p => p.id === formattedProduct.id);
      let updated: Product[];
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = formattedProduct;
      } else {
        updated = [formattedProduct, ...prev];
      }
      saveProducts(updated);
      return updated;
    });

    const activeUid = user?.uid || ownerUid || localStorage.getItem('hellopoint_synced_owner_uid');
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'products', formattedProduct.id), cleanForFirestore(formattedProduct));
      } catch (err) {
        console.error('Failed to sync product to Firestore:', err);
      }
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setProducts(prev => {
      const updated = prev.filter(p => p.id !== productId);
      saveProducts(updated);
      return updated;
    });

    const activeUid = user?.uid || ownerUid || localStorage.getItem('hellopoint_synced_owner_uid');
    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'products', productId));
      } catch (err) {
        console.error('Failed to delete product from Firestore:', err);
      }
    }
  };

  const handleSaveQuickFaqs = async (faqs: ChatQuickFAQ[]) => {
    setQuickFaqs(faqs);
    saveQuickFaqs(faqs);

    const activeUid = user?.uid || ownerUid || localStorage.getItem('hellopoint_synced_owner_uid');
    if (activeUid) {
      try {
        for (const faq of faqs) {
          await setDoc(doc(db, 'users', activeUid, 'quick_faqs', faq.id), cleanForFirestore(faq), { merge: true });
        }
      } catch (err) {
        console.error('Failed to sync quick faqs to Firestore:', err);
      }
    }
  };

  const handleMarkChatsAsRead = async (contactId: string, role: 'owner' | 'customer') => {
    const activeUid = user?.uid || ownerUid;
    if (!activeUid) return;

    const unreads = chatMessages.filter(m => 
      m.contactId === contactId && 
      ((role === 'owner' && !m.readByOwner) || (role === 'customer' && !m.readByCustomer))
    );

    if (unreads.length === 0) return;

    const updatedMessages = chatMessages.map(m => {
      if (m.contactId === contactId) {
        return {
          ...m,
          readByOwner: role === 'owner' ? true : m.readByOwner,
          readByCustomer: role === 'customer' ? true : m.readByCustomer
        };
      }
      return m;
    });
    setChatMessages(updatedMessages);

    try {
      for (const m of unreads) {
        await setDoc(doc(db, 'users', activeUid, 'chats', m.id), {
          readByOwner: role === 'owner' ? true : m.readByOwner,
          readByCustomer: role === 'customer' ? true : m.readByCustomer
        }, { merge: true });
      }
    } catch (err) {
      console.error('Failed to mark chats as read:', err);
    }
  };

  // Transaction handlers
  const handleSaveTransaction = async (data: {
    amount: number;
    type: 'GAVE' | 'GOT';
    note: string;
    billNo: string;
    date: string;
    attachFile?: string;
    signature?: string;
  }) => {
    triggerSaveAnimation();
    if (screen.type !== 'transaction_form') return;
    const { contactId, transactionId } = screen;
    const isEditing = !!transactionId;

    const txId = transactionId || 'tx-' + Date.now();
    const formattedTx: Transaction = {
      id: txId,
      contactId,
      amount: data.amount,
      type: data.type,
      note: data.note.trim(),
      billNo: data.billNo.trim(),
      date: data.date,
      attachFile: data.attachFile,
      signature: data.signature,
      createdAt: isEditing && selectedTransaction ? selectedTransaction.createdAt : new Date().toISOString()
    };

    const targetContact = contacts.find(c => c.id === contactId);
    if (!targetContact) return;

    const updatedContact = {
      ...targetContact,
      updatedAt: new Date().toISOString()
    };

    if (user) {
      try {
        // Save transaction document
        await setDoc(doc(db, 'users', user.uid, 'transactions', txId), cleanForFirestore(formattedTx));
        // Refresh contact update timer
        await setDoc(doc(db, 'users', user.uid, 'contacts', contactId), cleanForFirestore(updatedContact));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/transactions/${txId}`);
      }
    } else {
      let finalTxs = [];
      if (isEditing) {
        finalTxs = transactions.map(t => t.id === txId ? formattedTx : t);
      } else {
        finalTxs = [...transactions, formattedTx];
      }
      setTransactions(finalTxs);
      saveTransactions(finalTxs);

      const finalContacts = contacts.map(c => c.id === contactId ? updatedContact : c);
      setContacts(finalContacts);
      saveContacts(finalContacts);
    }

    // Return to Customer ledger folder
    setScreen({ type: 'contact_detail', contactId });
  };

  const handleDeleteTransaction = async (targetTxId?: string) => {
    let transactionId = targetTxId;
    let contactId = (screen.type === 'transaction_form' || screen.type === 'contact_detail') ? screen.contactId : '';

    if (!transactionId) {
      if (screen.type !== 'transaction_form' || !screen.transactionId) return;
      transactionId = screen.transactionId;
      contactId = screen.contactId;
    }

    if (!contactId && transactionId) {
      const tx = transactions.find(t => t.id === transactionId);
      if (tx) contactId = tx.contactId;
    }

    const txToDelete = transactions.find(t => t.id === transactionId);
    if (!txToDelete) return;

    const linkedCbId = txToDelete.cashbookEntryId;
    const linkedCb = cashbook.find(c => c.id === linkedCbId);

    const trashItem: TrashTransaction = {
      id: 'trash-' + txToDelete.id,
      originalTx: txToDelete,
      deletedAt: new Date().toISOString(),
      linkedCashbookEntry: linkedCb
    };

    const activeUid = user?.uid || ownerUid;

    if (user && activeUid && transactionId) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'trash_transactions', trashItem.id), cleanForFirestore(trashItem));
        await deleteDoc(doc(db, 'users', activeUid, 'transactions', transactionId));
        if (linkedCbId) {
          await deleteDoc(doc(db, 'users', activeUid, 'cashbook', linkedCbId));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/transactions/${transactionId}`);
      }
    } else if (transactionId) {
      const updatedTrash = [trashItem, ...trashTransactions];
      setTrashTransactions(updatedTrash);
      saveTrashTransactions(updatedTrash);

      const updatedTxs = transactions.filter(t => t.id !== transactionId);
      setTransactions(updatedTxs);
      saveTransactions(updatedTxs);

      if (linkedCbId) {
        const updatedCb = cashbook.filter(e => e.id !== linkedCbId);
        setCashbook(updatedCb);
        saveCashbook(updatedCb);
      }
    }

    setTrashToast({
      message: '🗑️ লেনদেনটি ট্র্যাশ বিনে সরানো হয়েছে (৩০ দিন পর অটো ডিলিট হবে)',
      trashItem
    });
    setTimeout(() => {
      setTrashToast(null);
    }, 6000);

    if (contactId) {
      setScreen({ type: 'contact_detail', contactId });
    } else {
      setScreen({ type: 'dashboard' });
    }
  };

  const handleRestoreFromTrash = async (trashItem: TrashTransaction) => {
    const activeUid = user?.uid || ownerUid;
    if (user && activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'transactions', trashItem.originalTx.id), cleanForFirestore(trashItem.originalTx));
        if (trashItem.linkedCashbookEntry) {
          await setDoc(doc(db, 'users', activeUid, 'cashbook', trashItem.linkedCashbookEntry.id), cleanForFirestore(trashItem.linkedCashbookEntry));
        }
        await deleteDoc(doc(db, 'users', activeUid, 'trash_transactions', trashItem.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/transactions/${trashItem.originalTx.id}`);
      }
    } else {
      const updatedTxs = [trashItem.originalTx, ...transactions];
      setTransactions(updatedTxs);
      saveTransactions(updatedTxs);

      if (trashItem.linkedCashbookEntry) {
        const updatedCb = [trashItem.linkedCashbookEntry, ...cashbook];
        setCashbook(updatedCb);
        saveCashbook(updatedCb);
      }

      const updatedTrash = trashTransactions.filter(t => t.id !== trashItem.id);
      setTrashTransactions(updatedTrash);
      saveTrashTransactions(updatedTrash);
    }
  };

  const handlePermanentDeleteFromTrash = async (trashId: string) => {
    const activeUid = user?.uid || ownerUid;
    if (user && activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'trash_transactions', trashId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/trash_transactions/${trashId}`);
      }
    } else {
      const updated = trashTransactions.filter(t => t.id !== trashId);
      setTrashTransactions(updated);
      saveTrashTransactions(updated);
    }
  };

  const handleEmptyTrash = async () => {
    const activeUid = user?.uid || ownerUid;
    if (user && activeUid) {
      try {
        for (const item of trashTransactions) {
          await deleteDoc(doc(db, 'users', activeUid, 'trash_transactions', item.id));
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setTrashTransactions([]);
      saveTrashTransactions([]);
    }
  };

  // Cashbook journal handlers
  const handleSaveCashbookEntry = async (data: {
    amount: number;
    type: 'IN' | 'OUT';
    note: string;
    date: string;
    contactId?: string;
  }) => {
    triggerSaveAnimation();
    const entryId = 'cb-' + Date.now();

    const entry: CashbookEntry = {
      id: entryId,
      amount: data.amount,
      type: data.type,
      note: data.note,
      date: data.date,
      createdAt: new Date().toISOString(),
      contactId: data.contactId
    };

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'cashbook', entryId), cleanForFirestore(entry));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/cashbook/${entryId}`);
      }
    } else {
      const updatedCb = [entry, ...cashbook];
      setCashbook(updatedCb);
      saveCashbook(updatedCb);
    }
    setIsCashbookOpen(false);
  };

  const handleDeleteCashbookEntry = async (id: string) => {
    // Instantaneous local UI updates & local persistent backup update
    const updatedCb = cashbook.filter(e => e.id !== id);
    setCashbook(updatedCb);
    saveCashbook(updatedCb);

    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'cashbook', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/cashbook/${id}`);
      }
    }
  };

  const handleSavePayBill = async (paybill: PayBillEntry) => {
    triggerSaveAnimation();
    
    // Check if transitioning to PAID
    const previousBill = paybills.find(p => p.id === paybill.id);
    const becamePaid = paybill.isPaid && (!previousBill || !previousBill.isPaid);

    const activeUid = user?.uid || ownerUid;

    if (becamePaid) {
      // Find matching contact
      let targetContactId = paybill.contactId;
      if (!targetContactId && paybill.note) {
        const cleanPaybillPhone = paybill.note.trim().replace(/\D/g, '');
        if (cleanPaybillPhone) {
          const matchedContact = contacts.find(c => {
            const cleanContactPhone = c.phone.trim().replace(/\D/g, '');
            return cleanContactPhone && (cleanContactPhone.endsWith(cleanPaybillPhone) || cleanPaybillPhone.endsWith(cleanContactPhone));
          });
          if (matchedContact) {
            targetContactId = matchedContact.id;
          }
        }
      }

      // If we found a contact, automatically create a GAVE ledger entry for them
      if (targetContactId) {
        const txId = 'tx-auto-pb-' + Date.now();
        const formattedTx: Transaction = {
          id: txId,
          contactId: targetContactId,
          amount: paybill.amount,
          type: 'GAVE',
          note: lang === 'bn' 
            ? `পে-বিল পরিশোধ (বিলার: ${paybill.billerDetails || ''}, বিল নং: ${paybill.billerNumber})` 
            : `Pay-Bill Paid (Biller: ${paybill.billerDetails || ''}, Bill No: ${paybill.billerNumber})`,
          billNo: paybill.billerNumber,
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        };

        const targetContact = contacts.find(c => c.id === targetContactId);
        const updatedContact = targetContact ? {
          ...targetContact,
          updatedAt: new Date().toISOString()
        } : null;

        if (activeUid) {
          try {
            await setDoc(doc(db, 'users', activeUid, 'transactions', txId), cleanForFirestore(formattedTx));
            if (updatedContact) {
              await setDoc(doc(db, 'users', activeUid, 'contacts', targetContactId), cleanForFirestore(updatedContact));
            }
          } catch (err) {
            console.error('Failed to auto-save paybill transaction/contact update to Firestore:', err);
          }
        } else {
          const updatedTxs = [...transactions, formattedTx];
          setTransactions(updatedTxs);
          saveTransactions(updatedTxs);

          if (updatedContact) {
            const finalContacts = contacts.map(c => c.id === targetContactId ? updatedContact : c);
            setContacts(finalContacts);
            saveContacts(finalContacts);
          }
        }
      }
    }

    const exists = paybills.some(p => p.id === paybill.id);
    let updated = [];
    if (exists) {
      updated = paybills.map(p => p.id === paybill.id ? paybill : p);
    } else {
      updated = [paybill, ...paybills];
    }
    setPayBills(updated);
    savePayBills(updated);

    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'paybills', paybill.id), cleanForFirestore(paybill));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/paybills/${paybill.id}`);
      }
    }
  };

  const handleDeletePayBill = async (id: string) => {
    // Instantaneous local UI updates & local persistent backup update
    const updated = paybills.filter(p => p.id !== id);
    setPayBills(updated);
    savePayBills(updated);

    const activeUid = user?.uid || ownerUid;

    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'paybills', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/paybills/${id}`);
      }
    }
  };

  const resolvedCashbook = useMemo(() => {
    // Pre-compute contact balances
    const contactBalances = new Map<string, number>();
    contacts.forEach(c => {
      contactBalances.set(c.id, 0);
    });

    const txLen = transactions.length;
    for (let i = 0; i < txLen; i++) {
      const t = transactions[i];
      const current = contactBalances.get(t.contactId) || 0;
      if (t.type === 'GAVE') {
        contactBalances.set(t.contactId, current + t.amount);
      } else if (t.type === 'GOT') {
        contactBalances.set(t.contactId, current - t.amount);
      }
    }

    return cashbook.map(entry => {
      if (entry.contactId) {
        const liveBal = contactBalances.get(entry.contactId) ?? 0;
        return {
          ...entry,
          amount: Math.abs(liveBal)
        };
      }
      return entry;
    });
  }, [cashbook, contacts, transactions]);

  const cashbookCalculations = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    const len = resolvedCashbook.length;
    for (let i = 0; i < len; i++) {
      const entry = resolvedCashbook[i];
      if (entry.type === 'IN') {
        totalIn += entry.amount;
      } else if (entry.type === 'OUT') {
        totalOut += entry.amount;
      }
    }
    return {
      totalIn,
      totalOut,
      balance: totalIn - totalOut
    };
  }, [resolvedCashbook]);

  // Fetching dynamic active elements
  const selectedContact = useMemo(() => {
    if (screen.type === 'contact_detail' || screen.type === 'transaction_form') {
      return contacts.find(c => c.id === screen.contactId);
    }
    return undefined;
  }, [screen, contacts]);

  const selectedTransaction = useMemo(() => {
    if (screen.type === 'transaction_form' && screen.transactionId) {
      return transactions.find(t => t.id === screen.transactionId);
    }
    return undefined;
  }, [screen, transactions]);

  const recordCustomerVisitNotification = async (customer: Contact) => {
    const activeUid = user?.uid || ownerUid;
    const remId = 'rem_' + Date.now();
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISO = (new Date(now.getTime() - tzoffset)).toISOString().slice(0, 16);
    
    const textBn = `গ্রাহক '${customer.name}' (${customer.phone}) তার হিসাব খাতা ভিজিট করেছেন`;
    const textEn = `Customer '${customer.name}' (${customer.phone}) visited their statement book`;
    
    const visitReminder = {
      id: remId,
      text: lang === 'bn' ? textBn : textEn,
      datetime: localISO,
      isCompleted: false,
      isTriggered: true
    };

    try {
      const saved = localStorage.getItem('hellopoint_reminders');
      const list = saved ? JSON.parse(saved) : [];
      
      const isDuplicate = list.some((r: any) => 
        r.text === visitReminder.text && 
        (Date.now() - parseInt(r.id.split('_')[1] || '0') < 60000)
      );
      
      if (!isDuplicate) {
        const updated = [visitReminder, ...list];
        localStorage.setItem('hellopoint_reminders', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        
        if (activeUid) {
          await setDoc(doc(db, 'users', activeUid, 'reminders', remId), visitReminder);
        }
      }
    } catch (e) {
      console.error('Failed to record customer visit:', e);
    }
  };

  const handleSaveReminder = async (reminder: any) => {
    const activeUid = user?.uid || ownerUid;
    if (!activeUid) return;
    try {
      await setDoc(doc(db, 'users', activeUid, 'reminders', reminder.id), cleanForFirestore(reminder));
    } catch (err) {
      console.error('Failed to sync reminder to Firestore:', err);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    const activeUid = user?.uid || ownerUid;
    if (!activeUid) return;
    try {
      await deleteDoc(doc(db, 'users', activeUid, 'reminders', id));
    } catch (err) {
      console.error('Failed to delete reminder from Firestore:', err);
    }
  };

  const handleUnlock = (role: 'owner' | 'customer', contactId?: string) => {
    setIsLocked(false);
    setSessionRole(role);
    setLoggedInCustomerId(contactId || null);
    
    localStorage.setItem('hellopoint_session_role', role);
    if (contactId) {
      localStorage.setItem('hellopoint_session_customer_id', contactId);
      const custObj = contacts.find(c => c.id === contactId) || customerOfflineObj;
      if (custObj) {
        recordCustomerVisitNotification(custObj);
      }
    } else {
      localStorage.removeItem('hellopoint_session_customer_id');
    }
  };

  const handleCustomerLogout = () => {
    setIsLocked(true);
    setSessionRole(null);
    setLoggedInCustomerId(null);
    localStorage.removeItem('hellopoint_pin_session_time');
    localStorage.removeItem('hellopoint_session_role');
    localStorage.removeItem('hellopoint_session_customer_id');
  };

  const loggedInCustomerObj = useMemo(() => {
    if (sessionRole === 'customer' && loggedInCustomerId) {
      return contacts.find(c => c.id === loggedInCustomerId) || customerOfflineObj;
    }
    return null;
  }, [sessionRole, loggedInCustomerId, contacts, customerOfflineObj]);

  if (!isLocked && sessionRole === 'customer' && loggedInCustomerObj) {
    return (
      <CustomerPortal 
        customer={loggedInCustomerObj}
        allTransactions={user ? transactions : customerTransactions}
        lang={lang}
        currency={currency}
        onLogout={handleCustomerLogout}
        setLang={setLang}
        themeColor={themeColor}
        onUpdatePhoto={handleUpdateContactPhoto}
        rechargeRequests={rechargeRequests}
        onCreateRechargeRequest={handleCreateRechargeRequest}
        onClearRechargeRequest={handleClearRechargeRequest}
        chatMessages={chatMessages}
        onSendChatMessage={handleSendChatMessage}
        onMarkChatsAsRead={handleMarkChatsAsRead}
        paybills={paybills}
        onSavePayBill={handleSavePayBill}
        onCreatePayBillRequest={handleCreatePayBillRequest}
        paybillRequests={paybillRequests}
      />
    );
  }

  return (
    <div className="relative min-h-screen select-none selection:bg-purple-100 antialiased overflow-x-hidden transition-colors duration-300 bg-[#eaeff5] dark:bg-[#252B33] text-slate-800 dark:text-[#F1F3F5]">
      
      <AnimatePresence mode="wait">
        {/* SCREEN ONE: MAIN DASHBOARD ROUTING */}
        {!isLocked && screen.type === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 12, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeInOut' }}
          >
            <MainDashboard 
              contacts={contacts}
              transactions={transactions}
              onSelectContact={(contactId) => setScreen({ type: 'contact_detail', contactId })}
              onAddContact={handleAddContact}
              onDeleteContact={handleDeleteContact}
              onNavigateToForm={(contactId, isGaveMode) => setScreen({ type: 'transaction_form', contactId, isGaveMode })}
              currency={currency}
              setCurrency={handleCurrencyChange}
              onOpenCashbookForm={() => setIsCashbookOpen(true)}
              cashbookBalance={cashbookCalculations}
              cashbookEntries={resolvedCashbook}
              onDeleteCashbookEntry={handleDeleteCashbookEntry}
              user={user}
              loadingCloud={loadingCloud}
              onSignIn={handleGoogleSignIn}
              onSignOut={handleGoogleSignOut}
              paybills={paybills}
              onSavePayBill={handleSavePayBill}
              onDeletePayBill={handleDeletePayBill}
              lang={lang}
              setLang={setLang}
              onLogout={handleCustomerLogout}
              shopStatus={shopStatus}
              onToggleShopStatus={handleUpdateShopStatus}
              onPinChange={handleUpdatePin}
              onSaveReminder={handleSaveReminder}
              onDeleteReminder={handleDeleteReminder}
              signupRequests={signupRequests}
              onAcceptSignUpRequest={handleAcceptSignUpRequest}
              onRejectSignUpRequest={handleRejectSignUpRequest}
              themeColor={themeColor}
              onChangeThemeColor={handleUpdateThemeColor}
              rechargeRequests={rechargeRequests}
              onCompleteRechargeRequest={handleCompleteRechargeRequest}
              onCancelRechargeRequest={handleCancelRechargeRequest}
              paybillRequests={paybillRequests}
              onCompletePayBillRequest={handleCompletePayBillRequest}
              onCancelPayBillRequest={handleCancelPayBillRequest}
              chatMessages={chatMessages}
              onSendChatMessage={handleSendChatMessage}
              onDeleteChatMessage={handleDeleteChatMessage}
              onDeleteChatThread={handleDeleteChatThread}
              onMarkChatsAsRead={handleMarkChatsAsRead}
              trashCount={trashTransactions.length}
              onOpenTrashModal={() => setIsTrashModalOpen(true)}
              themeMode={themeMode}
              onChangeThemeMode={handleUpdateThemeMode}
              products={products}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              quickFaqs={quickFaqs}
              onSaveQuickFaqs={handleSaveQuickFaqs}
            />
          </motion.div>
        )}

        {/* SCREEN TWO: CUSTOMER DETAILED LEDGERS RECORD VIEW */}
        {!isLocked && screen.type === 'contact_detail' && selectedContact && (
          <motion.div
            key={`contact_detail-${selectedContact.id}`}
            initial={{ x: 12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -12, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeInOut' }}
          >
            <CustomerDetail 
              contact={selectedContact}
              transactions={transactions}
              onBack={() => setScreen({ type: 'dashboard' })}
              onNavigateToForm={(contactId, isGaveMode, transactionId) => 
                setScreen({ type: 'transaction_form', contactId, transactionId, isGaveMode })
              }
              onDeleteTransaction={handleDeleteTransaction}
              onDeleteContact={handleDeleteContact}
              onClearAllEntries={handleClearCustomerTransactions}
              currency={currency}
              onUpdatePhoto={handleUpdateContactPhoto}
              onUpdateContactInfo={handleUpdateContactInfo}
              chatMessages={chatMessages}
              onSendChatMessage={handleSendChatMessage}
              onDeleteChatMessage={handleDeleteChatMessage}
              onMarkChatsAsRead={handleMarkChatsAsRead}
            />
          </motion.div>
        )}

        {/* SCREEN THREE: DETAILED LEDGER ENTRY CREATION MODAL/SCREEN */}
        {!isLocked && screen.type === 'transaction_form' && selectedContact && (
          <motion.div
            key={`transaction_form-${selectedContact.id}-${screen.transactionId || 'new'}`}
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 15, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeInOut' }}
          >
            <TransactionForm 
              contact={selectedContact}
              transaction={selectedTransaction}
              isGaveMode={screen.type === 'transaction_form' ? screen.isGaveMode : true}
              onBack={() => setScreen({ type: 'contact_detail', contactId: selectedContact.id })}
              onSave={handleSaveTransaction}
              onDelete={handleDeleteTransaction}
              currency={currency}
              customCategories={customCategories}
              deletedCategories={deletedCategories}
              onSaveCategory={handleSaveCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* DIALOG POPUP: REGISTER CASH IN/OUT ENTRY IN GENERAL ACCOUNTING */}
      {isCashbookOpen && (
        <CashbookForm 
          onClose={() => setIsCashbookOpen(false)}
          onSave={handleSaveCashbookEntry}
          currency={currency}
          contacts={contacts}
          transactions={transactions}
        />
      )}

      {/* GLOBAL TRANSIENT FROSTED ENTRY LOADER OVERLAY */}
      {saveLoading && (
        <div id="save-loader-overlay" className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center z-[99999] transition-all duration-300">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-2xl flex flex-col items-center gap-3.5 text-center max-w-[200px] transform scale-100 duration-200">
            {/* Dynamic Orbit Ring with circulating dots */}
            <div className="relative w-16 h-16 flex items-center justify-center select-none mb-1">
              {/* Central Nucleus with a heartbeat pulse */}
              <div className="absolute w-2.5 h-2.5 bg-purple-750/90 rounded-full shadow-sm animate-pulse" />
              
              {/* Orbital ring track */}
              <div className="absolute inset-1 rounded-full border border-dashed border-[#6244a6]/20" />
              
              {/* Dot 1 - Fast orbit (Purple) */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.2s' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-650 rounded-full shadow-md shadow-purple-200" />
              </div>
              
              {/* Dot 2 - Medium orbit (Amber/Yellow) */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.9s' }}>
                <div className="absolute bottom-1 right-1/2 translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-md shadow-yellow-100" />
              </div>
              
              {/* Dot 3 - Slower orbit (Emerald Green) */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2.7s' }}>
                <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-md shadow-emerald-250" />
              </div>
            </div>
            
            <p className="text-[11px] font-black text-purple-700 tracking-wide uppercase">
              {lang === 'bn' ? 'সংরক্ষণ করা হচ্ছে...' : 'Saving Entry...'}
            </p>
          </div>
        </div>
      )}

      {/* GLOBAL SECURITY KEYBOARD PIN SCREEN */}
      {isLocked && (
        <PinLockScreen 
          onUnlock={handleUnlock}
          contacts={contacts}
          lang={lang}
          onGoogleSignIn={handleGoogleSignIn}
          onVerifyPhone={handleVerifyCustomerPhone}
          user={user}
          onRegisterRequest={handleRegisterRequest}
          setLang={setLang}
          products={products}
          chatMessages={chatMessages}
          onSendChatMessage={handleSendChatMessage}
          onDeleteChatMessage={handleDeleteChatMessage}
          currency={currency}
          themeColor={themeColor}
          shopStatus={shopStatus}
          quickFaqs={quickFaqs}
          onMarkChatsAsRead={handleMarkChatsAsRead}
        />
      )}

      {/* TRASH / RECYCLE BIN MODAL */}
      <TrashBinModal 
        isOpen={isTrashModalOpen}
        onClose={() => setIsTrashModalOpen(false)}
        trashItems={trashTransactions}
        contacts={contacts}
        onRestoreItem={handleRestoreFromTrash}
        onPermanentDeleteItem={handlePermanentDeleteFromTrash}
        onEmptyTrash={handleEmptyTrash}
        currency={currency}
      />

      {/* TRASH DELETION FEEDBACK TOAST WITH UNDO BUTTON */}
      <AnimatePresence>
        {trashToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/80 max-w-sm w-[90%]"
          >
            <div className="text-xs font-bold flex-1">
              {trashToast.message}
            </div>
            <button 
              onClick={() => {
                handleRestoreFromTrash(trashToast.trashItem);
                setTrashToast(null);
              }}
              className="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
            >
              আনডু (Undo)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
