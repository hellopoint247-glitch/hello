/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { safeLocalStorage as localStorage } from './utils/safeStorage';
import { motion, AnimatePresence } from 'motion/react';
import { Contact, Transaction, CashbookEntry, PayBillEntry, ScreenState, SignUpRequest, RechargeRequest, ChatMessage, PayBillRequest, ChatQuickFAQ, CashInAccount, CashInTransaction } from './types';
import { 
  loadContacts, 
  saveContacts, 
  loadTransactions, 
  saveTransactions, 
  loadCashbook, 
  saveCashbook,
  loadPayBills,
  savePayBills,
  loadQuickFaqs,
  saveQuickFaqs,
  loadCashInAccounts,
  saveCashInAccounts,
  loadCashInTransactions,
  saveCashInTransactions,
  findMatchingCashInAccount,
  getCurrency,
  saveCurrency
} from './utils/storage';
import { MainDashboard } from './components/MainDashboard';
import { CustomerDetail } from './components/CustomerDetail';
import { TransactionForm } from './components/TransactionForm';
import { CashbookForm } from './components/CashbookForm';
import { PinLockScreen } from './components/PinLockScreen';
import { CheckCircle2 } from 'lucide-react';
import { CustomerPortal } from './components/CustomerPortal';
import { PremiumAppLoader } from './components/PremiumAppLoader';
import { NotificationPermissionPrompt } from './components/NotificationPermissionPrompt';
import { ThemeMode, getSavedThemeMode, saveThemeMode, applyTheme } from './utils/theme';
import { soundEngine } from './utils/audio';
import { notifyWithDeduplication } from './utils/notifications';
import { QuotaWarningBanner } from './components/QuotaWarningBanner';
import { isValidTagForSection, pruneTags, touchTagUsage } from './utils/tagManager';

// Firebase core integration imports
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logoutFromGoogle, 
  handleFirestoreError, 
  OperationType,
  isQuotaExceeded,
  isQuotaError,
  markQuotaExceeded
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
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts());
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions());
  const [cashbook, setCashbook] = useState<CashbookEntry[]>(() => loadCashbook());
  const [paybills, setPayBills] = useState<PayBillEntry[]>(() => loadPayBills());
  const [cashInAccounts, setCashInAccounts] = useState<CashInAccount[]>(() => loadCashInAccounts());
  const [cashInTransactions, setCashInTransactions] = useState<CashInTransaction[]>(() => loadCashInTransactions());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [quickFaqs, setQuickFaqs] = useState<ChatQuickFAQ[]>(() => loadQuickFaqs());
  const [currency, setCurrencyState] = useState('৳');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<string[]>([]);
  const [themeColor, setThemeColor] = useState<string>(() => localStorage.getItem('hellopoint_theme_color') || '#6244a6');
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getSavedThemeMode());
  const [ownerUid, setOwnerUid] = useState<string>(() => localStorage.getItem('hellopoint_synced_owner_uid') || 'lJRGRj5w92RxSUcGybklzs3cFho1');

  // Dynamic theme support
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', themeColor);
    root.style.setProperty('--brand-hover', `color-mix(in srgb, ${themeColor} 85%, black)`);
    root.style.setProperty('--brand-light', `color-mix(in srgb, ${themeColor} 10%, white)`);
    root.style.setProperty('--brand-dark-header', `color-mix(in srgb, ${themeColor} 38%, #1c222a)`);
    root.style.setProperty('--brand-dark-border', `color-mix(in srgb, ${themeColor} 50%, #46515e)`);
  }, [themeColor]);

  // Built-in soft dark theme enforcement (always active, zero eye strain)
  useEffect(() => {
    applyTheme();
  }, []);

  const handleUpdateThemeMode = () => {
    applyTheme();
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

  // Synchronized security passcode state
  const [ownerPin, setOwnerPin] = useState<string>(() => localStorage.getItem('hellopoint_pin') || '1234');

  const handleSaveCategory = async (category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    if (trimmed.includes(',') || trimmed.includes('।')) return;
    // Rule 1: English tags must not be accumulated/saved in the tag section
    if (!isValidTagForSection(trimmed)) return;
    touchTagUsage(trimmed);

    setCustomCategories(prev => {
      let updated = [...prev.filter(c => isValidTagForSection(c))];
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

  // Automated Tag Cleanup (Debounced to ensure ultra-smooth performance):
  // 1. Tags written in English are not accumulated/saved in the tag section
  // 2. Tags that are 1 month old and unused in the last 1 month are automatically deleted
  useEffect(() => {
    if (customCategories.length === 0) return;
    const timer = setTimeout(() => {
      const { prunedCategories, deletedTags } = pruneTags(customCategories, transactions);
      if (deletedTags.length > 0) {
        setCustomCategories(prunedCategories);
        const activeUid = user?.uid || ownerUid;
        if (activeUid && auth.currentUser && auth.currentUser.uid === activeUid) {
          setDoc(doc(db, 'users', activeUid), { customCategories: prunedCategories }, { merge: true })
            .catch(err => console.error('Failed to sync pruned categories:', err));
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [transactions.length, customCategories.length, user, ownerUid]);

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

  const [customerOfflineObj, setCustomerOfflineObj] = useState<Contact | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<Transaction[]>([]);

  const handleUpdatePin = async (newPin: string) => {
    setOwnerPin(newPin);
    localStorage.setItem('hellopoint_pin', newPin);
    window.dispatchEvent(new Event('storage'));
    
    if (user?.uid) {
      try {
        await setDoc(doc(db, 'users', user.uid), { pin: newPin }, { merge: true });
      } catch (err) {
        console.error('Failed to sync updated PIN to Firestore:', err);
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
      const localMatched = (transactions.length > 0 ? transactions : loadTransactions()).filter(t => t.contactId === foundLocal.id);
      if (localMatched.length > 0) {
        setCustomerTransactions(localMatched);
      }
      return foundLocal;
    }

    // 2. Try Firestore lookup using the synced ownerUid
    const activeUid = user?.uid || ownerUid || localStorage.getItem('hellopoint_synced_owner_uid') || 'lJRGRj5w92RxSUcGybklzs3cFho1';
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
          saveContacts(list);
          const found = list.find(c => c.type === 'customer' && isPhoneMatch(c.phone, cleanCompleted));
          if (found) {
            setCustomerOfflineObj(found);
            // Pre-fetch transactions concurrently so they appear immediately on login
            getDocs(query(collection(db, 'users', activeUid, 'transactions'), where('contactId', '==', found.id)))
              .then(txSnap => {
                const txList: Transaction[] = [];
                txSnap.forEach(d => txList.push({ ...d.data(), id: d.id } as Transaction));
                if (txList.length > 0) {
                  setCustomerTransactions(txList);
                  setTransactions(prev => {
                    const existingIds = new Set(txList.map(t => t.id));
                    return [...txList, ...prev.filter(p => !existingIds.has(p.id))];
                  });
                }
              }).catch(() => {});
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
        localStorage.setItem('hellopoint_has_owner_logged_in', 'true');
        localStorage.setItem('hellopoint_is_owner_device', 'true');
        // Run background migration of local storage ledger records to cloud on first login
        await migrateLocalToCloud(currentUser.uid);

        // Save Owner configuration to find ownerUid across all devices seamlessly
        if (!isQuotaExceeded()) {
          try {
            await setDoc(doc(db, 'public', 'owner_config'), { 
              ownerUid: currentUser.uid, 
              ownerEmail: currentUser.email 
            }, { merge: true });
          } catch (err) {
            if (isQuotaError(err)) {
              markQuotaExceeded();
            } else {
              console.error('Failed to save public owner config:', err);
            }
          }
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

  // Sync state loading & real-time updates based on account state (Unified Cloud synchronization with resilient local fallback)
  useEffect(() => {
    const activeUid = user?.uid || ownerUid || 'lJRGRj5w92RxSUcGybklzs3cFho1';

    // Centrally unified Synced Mode: Setup Real-Time Subscriptions
    setLoadingCloud(true);

    const qContacts = collection(db, 'users', activeUid, 'contacts');
    const unsubContacts = onSnapshot(qContacts, (snapshot) => {
      const list: Contact[] = [];
      snapshot.forEach((snapDoc) => {
        list.push(snapDoc.data() as Contact);
      });
      if (list.length > 0) {
        // Sort by last update
        const sorted = list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        setContacts(sorted);
        saveContacts(sorted);
      } else {
        const local = loadContacts();
        if (local.length > 0) {
          setContacts(local);
        }
      }
      setLoadingCloud(false);
    }, (error) => {
      const local = loadContacts();
      if (local.length > 0) {
        setContacts(local);
      }
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/contacts`);
    });

    let isTransInitial = true;
    const qTransactions = collection(db, 'users', activeUid, 'transactions');
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((snapDoc) => {
        list.push(snapDoc.data() as Transaction);
      });
      isTransInitial = false;

      if (list.length > 0) {
        setTransactions(list);
        saveTransactions(list);
      } else {
        const local = loadTransactions();
        if (local.length > 0) {
          setTransactions(local);
        }
      }
    }, (error) => {
      const local = loadTransactions();
      if (local.length > 0) {
        setTransactions(local);
      }
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/transactions`);
    });

    const qCashbook = collection(db, 'users', activeUid, 'cashbook');
    const unsubCashbook = onSnapshot(qCashbook, (snapshot) => {
      const list: CashbookEntry[] = [];
      snapshot.forEach((snapDoc) => {
        list.push(snapDoc.data() as CashbookEntry);
      });
      // Sort cashbook chronologically descending (newest first)
      const sorted = list.sort((a, b) => b.date.localeCompare(a.date));
      setCashbook(sorted);
      saveCashbook(sorted);
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
      const sorted = list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setPayBills(sorted);
      savePayBills(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/paybills`);
    });

    const qCashInAccounts = collection(db, 'users', activeUid, 'cashin_accounts');
    const unsubCashInAccounts = onSnapshot(qCashInAccounts, (snapshot) => {
      const list: CashInAccount[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as CashInAccount;
        list.push({ ...data, id: data.id || snapDoc.id });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setCashInAccounts(list);
      saveCashInAccounts(list);
    }, (error) => {
      console.error('Failed to subscribe to cashin_accounts:', error);
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/cashin_accounts`);
    });

    const qCashInTransactions = collection(db, 'users', activeUid, 'cashin_transactions');
    const unsubCashInTransactions = onSnapshot(qCashInTransactions, (snapshot) => {
      const list: CashInTransaction[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as CashInTransaction;
        list.push({ ...data, id: data.id || snapDoc.id });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setCashInTransactions(list);
      saveCashInTransactions(list);
    }, (error) => {
      console.error('Failed to subscribe to cashin_transactions:', error);
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/cashin_transactions`);
    });



    const isOwnerDevice = Boolean((user && user.email) || (auth.currentUser && auth.currentUser.email));
    const isCustDevice = !isOwnerDevice;
    const activeCustId = (sessionRole === 'customer' && loggedInCustomerId) 
      ? loggedInCustomerId 
      : (localStorage.getItem('hellopoint_session_customer_id') || localStorage.getItem('hellopoint_remembered_cust_id'));

    const qRecharges = (sessionRole === 'customer' && loggedInCustomerId)
      ? query(collection(db, 'users', activeUid, 'recharge_requests'), where('contactId', '==', loggedInCustomerId))
      : collection(db, 'users', activeUid, 'recharge_requests');

    let isRechargesInitial = true;
    const unsubRecharges = onSnapshot(qRecharges, (snapshot) => {
      const list: RechargeRequest[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as any;
        list.push({
          ...data,
          id: data.id || snapDoc.id
        } as RechargeRequest);
      });

      if (!isRechargesInitial) {
        snapshot.docChanges().forEach((change) => {
          if (isCustDevice && activeCustId) {
            // Customer receives alert when their recharge is completed or cancelled
            if (change.type === 'modified') {
              const req = change.doc.data() as RechargeRequest;
              if (req.contactId === activeCustId) {
                if (req.status === 'completed') {
                  const methodStr = req.method === 'bkash' ? 'বিকাশ' : req.method === 'nagad' ? 'নগদ' : 'ফ্লেক্সিলোড';
                  notifyWithDeduplication({
                    title: lang === 'bn' ? '⚡ মোবাইল রিচার্জ সফল! ✓' : '⚡ Recharge Completed! ✓',
                    body: lang === 'bn' 
                      ? `আপনার ৳${req.amount} টাকা (${methodStr}) রিচার্জ সফল হয়েছে।`
                      : `Your ৳${req.amount} recharge (${req.method}) has been successfully completed.`,
                    tag: `recharge-${change.doc.id}`,
                    dedupeKey: `recharge-${change.doc.id}-${req.status}`,
                    playSound: true
                  });
                } else if (req.status === 'cancelled') {
                  notifyWithDeduplication({
                    title: lang === 'bn' ? '❌ রিচার্জ অনুরোধ বাতিল' : '❌ Recharge Cancelled',
                    body: lang === 'bn' 
                      ? `আপনার ৳${req.amount} টাকার রিচার্জ অনুরোধটি বাতিল করা হয়েছে।`
                      : `Your ৳${req.amount} recharge request was cancelled.`,
                    tag: `recharge-${change.doc.id}`,
                    dedupeKey: `recharge-${change.doc.id}-${req.status}`,
                    playSound: true
                  });
                }
              }
            }
          } else if (!isCustDevice) {
            // Owner receives alert for incoming pending recharges
            if (change.type === 'added') {
              const data = change.doc.data() as any;
              if (data.status === 'pending') {
                notifyWithDeduplication({
                  title: '⚡ নতুন মোবাইল রিচার্জ অনুরোধ!',
                  body: `${data.customerName || 'কাস্টমার'} • ${data.rechargePhone} (৳${data.amount})`,
                  tag: `recharge-${change.doc.id}`,
                  dedupeKey: `recharge-${change.doc.id}`,
                  playSound: true
                });
              }
            }
          }
        });
      }
      isRechargesInitial = false;

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

    let isPaybillsInitial = true;
    const unsubPaybillRequests = onSnapshot(qPaybillRequests, (snapshot) => {
      const list: PayBillRequest[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data() as any;
        list.push({
          ...data,
          id: data.id || snapDoc.id
        } as PayBillRequest);
      });

      if (!isPaybillsInitial) {
        snapshot.docChanges().forEach((change) => {
          if (isCustDevice && activeCustId) {
            // Customer receives alert when their bill payment is completed or cancelled
            if (change.type === 'modified') {
              const req = change.doc.data() as PayBillRequest;
              if (req.contactId === activeCustId) {
                if (req.status === 'accepted') {
                  const billName = req.billerDetails || req.billerNumber || 'বিল';
                  notifyWithDeduplication({
                    title: lang === 'bn' ? '💡 বিল পরিশোধ সম্পন্ন! ✓' : '💡 Bill Payment Completed! ✓',
                    body: lang === 'bn' 
                      ? `আপনার ৳${req.amount} টাকা (${billName}) বিল সফলভাবে পরিশোধ হয়েছে।`
                      : `Your ৳${req.amount} bill (${billName}) was successfully paid.`,
                    tag: `paybill-${change.doc.id}`,
                    dedupeKey: `paybill-${change.doc.id}-${req.status}`,
                    playSound: true
                  });
                } else if (req.status === 'rejected') {
                  const billName = req.billerDetails || req.billerNumber || 'বিল';
                  notifyWithDeduplication({
                    title: lang === 'bn' ? '❌ বিল পরিশোধ বাতিল' : '❌ Bill Payment Rejected',
                    body: lang === 'bn' 
                      ? `আপনার ${billName} বিল পরিশোধের অনুরোধটি বাতিল করা হয়েছে।`
                      : `Your bill payment request (${billName}) was rejected.`,
                    tag: `paybill-${change.doc.id}`,
                    dedupeKey: `paybill-${change.doc.id}-${req.status}`,
                    playSound: true
                  });
                }
              }
            }
          } else if (!isCustDevice) {
            // Owner receives alert for incoming bill requests
            if (change.type === 'added') {
              const data = change.doc.data() as any;
              if (data.status === 'pending') {
                const billName = data.billerDetails || data.billerNumber || 'বিল';
                notifyWithDeduplication({
                  title: '💡 নতুন বিল পেমেন্ট অনুরোধ!',
                  body: `${data.customerName || 'কাস্টমার'} • ${billName} (৳${data.amount})`,
                  tag: `paybill-${change.doc.id}`,
                  dedupeKey: `paybill-${change.doc.id}`,
                  playSound: true
                });
              }
            }
          }
        });
      }
      isPaybillsInitial = false;

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

    let isChatsInitial = true;
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

      if (!isChatsInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as any;
            if (isCustDevice && activeCustId) {
              // Customer receives message sent by shop owner
              if (data.senderRole === 'owner' && data.contactId === activeCustId) {
                notifyWithDeduplication({
                  title: lang === 'bn' ? '💬 দোকান থেকে নতুন মেসেজ!' : '💬 New Message from Shop!',
                  body: data.text || 'নতুন বার্তা এসেছে',
                  tag: `chat-${change.doc.id}`,
                  dedupeKey: `chat-${change.doc.id}`,
                  playSound: true
                });
              }
            } else if (!isCustDevice) {
              // Owner receives message sent by customer
              if (data.senderRole === 'customer') {
                notifyWithDeduplication({
                  title: `💬 কাস্টমার মেসেজ: ${data.senderName || 'কাস্টমার'}`,
                  body: data.text || 'নতুন বার্তা এসেছে',
                  tag: `chat-${change.doc.id}`,
                  dedupeKey: `chat-${change.doc.id}`,
                  playSound: true
                });
              }
            }
          }
        });
      }
      isChatsInitial = false;

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
      unsubCashInAccounts();
      unsubCashInTransactions();
      unsubRecharges();
      unsubPaybillRequests();
      unsubChats();
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
          const parsed: string[] = JSON.parse(localSaved);
          setCustomCategories(parsed.filter(c => isValidTagForSection(c)));
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

          if (data.themeColor && data.themeColor !== localStorage.getItem('hellopoint_theme_color')) {
            setThemeColor(data.themeColor);
            localStorage.setItem('hellopoint_theme_color', data.themeColor);
            window.dispatchEvent(new Event('storage'));
          }
          if (data.customCategories) {
            const cleanList = (data.customCategories as string[]).filter(c => isValidTagForSection(c));
            setCustomCategories(cleanList);
            localStorage.setItem('hellopoint_custom_categories', JSON.stringify(cleanList));
            window.dispatchEvent(new Event('storage'));
          }
          if (data.deletedCategories) {
            setDeletedCategories(data.deletedCategories);
            localStorage.setItem('hellopoint_deleted_notes', JSON.stringify(data.deletedCategories));
            window.dispatchEvent(new Event('storage'));
          }
          if (data.favoriteTags) {
            localStorage.setItem('hellopoint_favorite_tags', JSON.stringify(data.favoriteTags));
            window.dispatchEvent(new Event('storage'));
          }
          if (data.tagCategoryOverrides) {
            localStorage.setItem('hellopoint_tag_category_overrides', JSON.stringify(data.tagCategoryOverrides));
            window.dispatchEvent(new Event('storage'));
          }
        }
      }
    }, (error) => {
      if (isQuotaError(error)) {
        markQuotaExceeded();
      } else {
        console.warn('Settings subscription notice:', error);
      }
    });

    return () => unsubUser();
  }, [user, ownerUid]);

  // Real-time listener for SignUp Requests
  useEffect(() => {
    if (!user) {
      setSignupRequests([]);
      return;
    }
    let isSignupInitial = true;
    const q = collection(db, 'signup_requests');
    const unsub = onSnapshot(q, (snapshot) => {
      const list: SignUpRequest[] = [];
      snapshot.forEach((snapDoc) => {
        list.push({ id: snapDoc.id, ...snapDoc.data() } as SignUpRequest);
      });

      if (!isSignupInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as any;
            if (data.status === 'pending') {
              notifyWithDeduplication({
                title: '👤 নতুন রেজিস্ট্রেশন অনুরোধ!',
                body: `${data.name || 'কাস্টমার'} (${data.phone || ''}) অ্যাকাউন্ট খোলার অনুরোধ করেছেন`,
                tag: `signup-${change.doc.id}`,
                dedupeKey: `signup-${change.doc.id}`,
                playSound: true
              });
            }
          }
        });
      }
      isSignupInitial = false;

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

      // Optimistic update
      setContacts(prev => {
        const updated = [newContact, ...prev.filter(c => c.id !== contactId)];
        saveContacts(updated);
        return updated;
      });

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
      contactId: req.contactId,
      isOnline: true
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
  // STRICT RULE: Only the specific customer whose entry was added receives the notification!
  // The owner device NEVER receives notifications for entries they create.
  useEffect(() => {
    const activeUid = user?.uid || ownerUid;
    // Strict Owner device detection: owner has logged in with PIN, Google, or session role
    const isOwnerDevice = Boolean(
      sessionRole === 'owner' ||
      (user && user.email) ||
      (auth.currentUser && auth.currentUser.email) ||
      localStorage.getItem('hellopoint_session_role') === 'owner' ||
      localStorage.getItem('hellopoint_has_owner_logged_in') === 'true' ||
      localStorage.getItem('hellopoint_is_owner_device') === 'true'
    );

    // If this is an owner device, strictly do not subscribe to customer transaction alerts
    if (isOwnerDevice) return;

    const targetCustId = (sessionRole === 'customer' && loggedInCustomerId) 
      ? loggedInCustomerId 
      : (localStorage.getItem('hellopoint_session_customer_id') || localStorage.getItem('hellopoint_remembered_cust_id'));

    if (targetCustId && activeUid) {
      const qTxs = query(
        collection(db, 'users', activeUid, 'transactions'),
        where('contactId', '==', targetCustId)
      );
      let isCustTxsInitial = true;
      const unsubCustTxs = onSnapshot(qTxs, (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Transaction);
        });

        if (!isCustTxsInitial) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const tx = change.doc.data() as Transaction;
              // Ensure this notification is STRICTLY for this specific customer
              if (tx.contactId === targetCustId) {
                const isGave = tx.type === 'GAVE';
                notifyWithDeduplication({
                  title: isGave 
                    ? (lang === 'bn' ? '📖 বাকির খাতায় নতুন এন্ট্রি!' : '📖 New Due Added!') 
                    : (lang === 'bn' ? '✅ টাকা জমা গ্রহণ!' : '✅ Payment Received!'),
                  body: isGave
                    ? (lang === 'bn' 
                        ? `আপনার হিসাবে ৳${tx.amount} টাকা বাকি যোগ হয়েছে।${tx.note ? ` (${tx.note})` : ''}` 
                        : `৳${tx.amount} was added to your ledger.${tx.note ? ` (${tx.note})` : ''}`)
                    : (lang === 'bn' 
                        ? `আপনার হিসাবে ৳${tx.amount} টাকা জমা নেওয়া হয়েছে।${tx.note ? ` (${tx.note})` : ''}` 
                        : `৳${tx.amount} payment received.${tx.note ? ` (${tx.note})` : ''}`),
                  tag: `cust-tx-${change.doc.id}`,
                  dedupeKey: `cust-tx-${change.doc.id}`,
                  playSound: true
                });
              }
            }
          });
        }
        isCustTxsInitial = false;

        setCustomerTransactions(list);
      }, (err) => {
        console.error('Failed to sync customer transactions:', err);
      });
      return unsubCustTxs;
    }
  }, [sessionRole, loggedInCustomerId, user, ownerUid, lang]);

  // Migrate local details to cloud securely upon sign-in
  const migrateLocalToCloud = async (uid: string) => {
    try {
      if (isQuotaExceeded()) {
        console.warn('Firestore quota reached. Skipping initial cloud migration until quota resets.');
        return;
      }
      const offlineContacts = loadContacts();
      const offlineTransactions = loadTransactions();
      const offlineCashbook = loadCashbook();
      const offlinePayBills = loadPayBills();
      const offlineCashInAccounts = loadCashInAccounts();
      const offlineCashInTransactions = loadCashInTransactions();
      const offlineQuickFaqs = loadQuickFaqs();

      const hasOfflineData = 
        offlineContacts.length > 0 || 
        offlineTransactions.length > 0 || 
        offlineCashbook.length > 0 ||
        offlinePayBills.length > 0 ||
        offlineCashInAccounts.length > 0 ||
        offlineCashInTransactions.length > 0 ||
        offlineQuickFaqs.length > 0;
      if (!hasOfflineData) return;

      const migrationToken = `hellopoint_synced_${uid}`;
      if (localStorage.getItem(migrationToken) === 'true') return;

      console.log('Initiating automatic Google Account sync to prevent data loss...');
      
      // Perform batch writes for each entity
      for (const cont of offlineContacts) {
        if (isQuotaExceeded()) break;
        await setDoc(doc(db, 'users', uid, 'contacts', cont.id), cleanForFirestore(cont));
      }
      for (const tx of offlineTransactions) {
        if (isQuotaExceeded()) break;
        await setDoc(doc(db, 'users', uid, 'transactions', tx.id), cleanForFirestore(tx));
      }
      for (const cb of offlineCashbook) {
        if (isQuotaExceeded()) break;
        await setDoc(doc(db, 'users', uid, 'cashbook', cb.id), cleanForFirestore(cb));
      }
      for (const pb of offlinePayBills) {
        if (isQuotaExceeded()) break;
        await setDoc(doc(db, 'users', uid, 'paybills', pb.id), cleanForFirestore(pb));
      }
      for (const cia of offlineCashInAccounts) {
        if (isQuotaExceeded()) break;
        await setDoc(doc(db, 'users', uid, 'cashin_accounts', cia.id), cleanForFirestore(cia));
      }
      for (const cit of offlineCashInTransactions) {
        if (isQuotaExceeded()) break;
        await setDoc(doc(db, 'users', uid, 'cashin_transactions', cit.id), cleanForFirestore(cit));
      }
      for (const faq of offlineQuickFaqs) {
        if (isQuotaExceeded()) break;
        await setDoc(doc(db, 'users', uid, 'quick_faqs', faq.id), cleanForFirestore(faq));
      }

      // Mark migration as successful to prevent double syncs if quota wasn't exceeded
      if (!isQuotaExceeded()) {
        localStorage.setItem(migrationToken, 'true');
        console.log('Synchronized off-grid transactions and products to Hello Point database cloud.');
      }
    } catch (err) {
      if (isQuotaError(err)) {
        markQuotaExceeded();
      }
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
    soundEngine.playSuccessSound();
    const contactId = 'contact-' + Date.now();

    const newContact: Contact = {
      id: contactId,
      name: name.trim(),
      phone: phone.trim(),
      type: 'customer', // Force customer type as supplier is removed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Instantaneous optimistic UI & local storage update for real-time responsiveness
    setContacts(prev => {
      const updated = [newContact, ...prev.filter(c => c.id !== contactId)];
      saveContacts(updated);
      return updated;
    });

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      const path = `users/${activeUid}/contacts/${contactId}`;
      try {
        await setDoc(doc(db, 'users', activeUid, 'contacts', contactId), cleanForFirestore(newContact));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }
  };

  const handleDeleteContact = async (id: string) => {
    soundEngine.playDeleteSound();
    // Instantaneous local UI updates & local persistent backup update
    setContacts(prev => {
      const updatedContacts = prev.filter(c => c.id !== id);
      saveContacts(updatedContacts);
      return updatedContacts;
    });
    setTransactions(prev => {
      const updatedTxs = prev.filter(t => t.contactId !== id);
      saveTransactions(updatedTxs);
      return updatedTxs;
    });

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        // Cascade delete on Firestore - delete contact
        await deleteDoc(doc(db, 'users', activeUid, 'contacts', id));
        
        // Delete child transactions
        const relatedTxs = transactions.filter(t => t.contactId === id);
        for (const tx of relatedTxs) {
          await deleteDoc(doc(db, 'users', activeUid, 'transactions', tx.id));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/contacts/${id}`);
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
  const handleSaveTransaction = (data: {
    amount: number;
    type: 'GAVE' | 'GOT';
    note: string;
    billNo: string;
    date: string;
    attachFile?: string;
    signature?: string;
    contactId?: string;
    transactionId?: string;
    skipSaveAnimation?: boolean;
  }) => {
    try {
      soundEngine.playCashEntrySound(data.type);
    } catch {
      // ignore
    }
    const contactId = data.contactId || (screen.type === 'transaction_form' ? screen.contactId : (screen.type === 'contact_detail' ? screen.contactId : ''));
    if (!contactId) return;
    const transactionId = data.transactionId || (screen.type === 'transaction_form' ? screen.transactionId : undefined);
    const isEditing = !!transactionId;

    const txId = transactionId || 'tx-' + Date.now();
    const formattedTx: Transaction = {
      id: txId,
      contactId,
      amount: data.amount,
      type: data.type,
      note: (data.note || '').trim(),
      billNo: (data.billNo || '').trim(),
      date: data.date || new Date().toISOString().split('T')[0],
      attachFile: data.attachFile,
      signature: data.signature,
      createdAt: isEditing && selectedTransaction ? selectedTransaction.createdAt : new Date().toISOString()
    };

    const targetContact = contacts.find(c => c.id === contactId);
    const updatedContact = targetContact ? {
      ...targetContact,
      updatedAt: new Date().toISOString()
    } : null;

    // ⚡ 0ms INSTANTANEOUS SCREEN RETURN TO CUSTOMER LEDGER (NO LAG)
    if (screen.type === 'transaction_form') {
      setScreen({ type: 'contact_detail', contactId });
    }

    // ⚡ INSTANTANEOUS OPTIMISTIC UPDATE FOR TRANSACTIONS & BALANCES
    setTransactions(prev => {
      let finalTxs = [];
      if (isEditing) {
        finalTxs = prev.map(t => t.id === txId ? formattedTx : t);
      } else {
        finalTxs = [...prev, formattedTx];
      }
      // Asynchronously offload JSON.stringify so the UI thread doesn't stutter
      setTimeout(() => {
        saveTransactions(finalTxs);
      }, 0);
      return finalTxs;
    });

    if (updatedContact) {
      setContacts(prev => {
        const finalContacts = prev.map(c => c.id === contactId ? updatedContact : c);
        setTimeout(() => {
          saveContacts(finalContacts);
        }, 0);
        return finalContacts;
      });
    }

    // ⚡ BACKGROUND CLOUD PERSISTENCE (Non-blocking promise)
    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      (async () => {
        try {
          await setDoc(doc(db, 'users', activeUid, 'transactions', txId), cleanForFirestore(formattedTx));
          if (updatedContact) {
            await setDoc(doc(db, 'users', activeUid, 'contacts', contactId), cleanForFirestore(updatedContact));
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/transactions/${txId}`);
        }
      })();
    }
  };

  const handleDeleteTransaction = (targetTxId?: string) => {
    try {
      soundEngine.playDeleteSound();
    } catch {
      // ignore
    }
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
    const activeUid = user?.uid || ownerUid;

    // ⚡ 0ms INSTANT SCREEN TRANSITION
    if (contactId) {
      setScreen({ type: 'contact_detail', contactId });
    } else {
      setScreen({ type: 'dashboard' });
    }

    // ⚡ INSTANTANEOUS OPTIMISTIC UPDATE
    setTransactions(prev => {
      const updatedTxs = prev.filter(t => t.id !== transactionId);
      setTimeout(() => {
        saveTransactions(updatedTxs);
      }, 0);
      return updatedTxs;
    });

    if (linkedCbId) {
      setCashbook(prev => {
        const updatedCb = prev.filter(e => e.id !== linkedCbId);
        setTimeout(() => {
          saveCashbook(updatedCb);
        }, 0);
        return updatedCb;
      });
    }

    // ⚡ BACKGROUND FIRESTORE DELETION (Non-blocking)
    if (activeUid && transactionId) {
      (async () => {
        try {
          await deleteDoc(doc(db, 'users', activeUid, 'transactions', transactionId));
          if (linkedCbId) {
            await deleteDoc(doc(db, 'users', activeUid, 'cashbook', linkedCbId));
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/transactions/${transactionId}`);
        }
      })();
    }
  };

  // Cashbook journal handlers
  const handleSaveCashbookEntry = (data: {
    amount: number;
    type: 'IN' | 'OUT';
    note: string;
    date: string;
    contactId?: string;
  }) => {
    try {
      soundEngine.playCashbookSound(data.type);
    } catch {
      // ignore
    }
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

    setIsCashbookOpen(false);

    // Instantaneous optimistic update
    setCashbook(prev => {
      const updatedCb = [entry, ...prev];
      setTimeout(() => {
        saveCashbook(updatedCb);
      }, 0);
      return updatedCb;
    });

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      (async () => {
        try {
          await setDoc(doc(db, 'users', activeUid, 'cashbook', entryId), cleanForFirestore(entry));
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/cashbook/${entryId}`);
        }
      })();
    }
  };

  const handleDeleteCashbookEntry = async (id: string) => {
    soundEngine.playDeleteSound();
    // Instantaneous local UI updates & local persistent backup update
    setCashbook(prev => {
      const updatedCb = prev.filter(e => e.id !== id);
      saveCashbook(updatedCb);
      return updatedCb;
    });

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'cashbook', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/cashbook/${id}`);
      }
    }
  };

  const handleSavePayBill = async (paybill: PayBillEntry, addToCustomerLedger: boolean = false, matchedContactId?: string) => {
    triggerSaveAnimation();
    
    // Check if transitioning to PAID
    const previousBill = paybills.find(p => p.id === paybill.id);
    const becamePaid = paybill.isPaid && (!previousBill || !previousBill.isPaid);

    if (paybill.isPaid) {
      soundEngine.playPayBillPaidSound();
    } else {
      soundEngine.playSuccessSound();
    }

    const activeUid = user?.uid || ownerUid;

    // Only add to customer baki ledger if user explicitly checked the tick mark
    if (addToCustomerLedger) {
      // Find matching contact
      let targetContactId = matchedContactId || paybill.contactId;
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

      // If we found a contact, create a GAVE ledger entry for them with note "বিদ্যুৎ বিল পেইড "
      if (targetContactId) {
        const txId = 'tx-auto-pb-' + Date.now();
        const formattedTx: Transaction = {
          id: txId,
          contactId: targetContactId,
          amount: paybill.amount,
          type: 'GAVE',
          note: 'বিদ্যুৎ বিল পেইড ',
          billNo: paybill.billerNumber,
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        };

        const targetContact = contacts.find(c => c.id === targetContactId);
        const updatedContact = targetContact ? {
          ...targetContact,
          updatedAt: new Date().toISOString()
        } : null;

        // Optimistic update for transactions & contacts
        setTransactions(prev => {
          const updatedTxs = [...prev, formattedTx];
          saveTransactions(updatedTxs);
          return updatedTxs;
        });

        if (updatedContact) {
          setContacts(prev => {
            const finalContacts = prev.map(c => c.id === targetContactId ? updatedContact : c);
            saveContacts(finalContacts);
            return finalContacts;
          });
        }

        if (activeUid) {
          try {
            await setDoc(doc(db, 'users', activeUid, 'transactions', txId), cleanForFirestore(formattedTx));
            if (updatedContact) {
              await setDoc(doc(db, 'users', activeUid, 'contacts', targetContactId), cleanForFirestore(updatedContact));
            }
          } catch (err) {
            console.error('Failed to auto-save paybill transaction/contact update to Firestore:', err);
          }
        }
      }
    }

    setPayBills(prev => {
      const exists = prev.some(p => p.id === paybill.id);
      let updated: PayBillEntry[];
      if (exists) {
        updated = prev.map(p => p.id === paybill.id ? paybill : p);
      } else {
        updated = [paybill, ...prev];
      }
      savePayBills(updated);
      return updated;
    });

    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'paybills', paybill.id), cleanForFirestore(paybill));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/paybills/${paybill.id}`);
      }
    }

    // Automated balance deduction & history recording for Cash In accounts matching last number
    const targetLastNum = paybill.paidAccount?.trim();
    const existingCashInTx = cashInTransactions.find(t => t.paybillId === paybill.id || t.id === 'tx-pb-' + paybill.id);

    if (paybill.isPaid && targetLastNum) {
      const matchedAccount = findMatchingCashInAccount(targetLastNum, cashInAccounts);
      if (matchedAccount) {
        if (!existingCashInTx) {
          // New deduction from matched Cash In account
          const prevBal = Number(matchedAccount.balance) || 0;
          const newBal = Math.max(0, Number((prevBal - paybill.amount).toFixed(2)));
          const updatedAcc: CashInAccount = {
            ...matchedAccount,
            balance: newBal,
            updatedAt: new Date().toISOString()
          };

          const newCashInTx: CashInTransaction = {
            id: 'tx-pb-' + paybill.id,
            paybillId: paybill.id,
            customerPhone: paybill.note?.trim() || paybill.billerNumber,
            customerName: 'বিল পেমেন্ট',
            amount: paybill.amount,
            lastDigits: matchedAccount.lastDigits,
            accountId: matchedAccount.id,
            accountNumber: matchedAccount.accountNumber,
            accountName: matchedAccount.accountName,
            category: 'paybill',
            date: paybill.date || new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            note: `বিল পেমেন্ট: ${paybill.billerDetails || ''} (বিলার: ${paybill.billerNumber})`
          };

          await handleSaveCashInTransaction(newCashInTx, updatedAcc);
        } else {
          // Existing transaction: check if account or amount changed
          const prevAccId = existingCashInTx.accountId;
          const prevAmount = existingCashInTx.amount;
          if (prevAccId !== matchedAccount.id || prevAmount !== paybill.amount) {
            // Refund the old account if it's different
            if (prevAccId && prevAccId !== matchedAccount.id) {
              const oldAcc = cashInAccounts.find(a => a.id === prevAccId);
              if (oldAcc) {
                const restoredAcc: CashInAccount = {
                  ...oldAcc,
                  balance: Number(((Number(oldAcc.balance) || 0) + prevAmount).toFixed(2)),
                  updatedAt: new Date().toISOString()
                };
                await handleSaveCashInAccount(restoredAcc);
              }
            }

            // Deduct from matched account
            const currentBal = prevAccId === matchedAccount.id
              ? (Number(matchedAccount.balance) || 0) + prevAmount
              : (Number(matchedAccount.balance) || 0);
            const newBal = Math.max(0, Number((currentBal - paybill.amount).toFixed(2)));
            const updatedAcc: CashInAccount = {
              ...matchedAccount,
              balance: newBal,
              updatedAt: new Date().toISOString()
            };

            const updatedTx: CashInTransaction = {
              ...existingCashInTx,
              customerPhone: paybill.note?.trim() || paybill.billerNumber,
              customerName: 'বিল পেমেন্ট',
              amount: paybill.amount,
              lastDigits: matchedAccount.lastDigits,
              accountId: matchedAccount.id,
              accountNumber: matchedAccount.accountNumber,
              accountName: matchedAccount.accountName,
              category: 'paybill',
              date: paybill.date || new Date().toISOString().split('T')[0],
              note: `বিল পেমেন্ট: ${paybill.billerDetails || ''} (বিলার: ${paybill.billerNumber})`
            };

            await handleSaveCashInTransaction(updatedTx, updatedAcc);
          }
        }
      } else if (existingCashInTx) {
        // Last number changed to one that doesn't match any cash in account: refund and remove tx
        await handleDeleteCashInTransaction(existingCashInTx.id, true);
      }
    } else if (!paybill.isPaid && existingCashInTx) {
      // Bill marked unpaid: refund previous deducted account and remove tx
      await handleDeleteCashInTransaction(existingCashInTx.id, true);
    }
  };

  const handleDeletePayBill = async (id: string, refundAccount: boolean = true) => {
    soundEngine.playDeleteSound();
    // Instantaneous local UI updates & local persistent backup update
    setPayBills(prev => {
      const updated = prev.filter(p => p.id !== id);
      savePayBills(updated);
      return updated;
    });

    // Handle matched Cash In account transaction
    const existingCashInTx = cashInTransactions.find(t => t.paybillId === id || t.id === 'tx-pb-' + id);
    if (existingCashInTx) {
      await handleDeleteCashInTransaction(existingCashInTx.id, refundAccount);
    }

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'paybills', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/paybills/${id}`);
      }
    }
  };

  // Cash-In Account & Transaction handlers
  const handleSaveCashInAccount = async (account: CashInAccount) => {
    triggerSaveAnimation();
    soundEngine.playSuccessSound();
    setCashInAccounts(prev => {
      const exists = prev.some(a => a.id === account.id);
      let updated: CashInAccount[];
      if (exists) {
        updated = prev.map(a => a.id === account.id ? account : a);
      } else {
        updated = [account, ...prev];
      }
      saveCashInAccounts(updated);
      return updated;
    });

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'cashin_accounts', account.id), cleanForFirestore(account));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/cashin_accounts/${account.id}`);
      }
    }
  };

  const handleDeleteCashInAccount = async (accountId: string) => {
    soundEngine.playDeleteSound();
    setCashInAccounts(prev => {
      const updated = prev.filter(a => a.id !== accountId);
      saveCashInAccounts(updated);
      return updated;
    });

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'cashin_accounts', accountId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/cashin_accounts/${accountId}`);
      }
    }
  };

  const handleSaveCashInTransaction = async (tx: CashInTransaction, updatedAccount?: CashInAccount) => {
    triggerSaveAnimation();
    soundEngine.playCashInSound();
    
    setCashInTransactions(prev => {
      const exists = prev.some(t => t.id === tx.id);
      const updated = exists ? prev.map(t => t.id === tx.id ? tx : t) : [tx, ...prev];
      saveCashInTransactions(updated);
      return updated;
    });

    if (updatedAccount) {
      setCashInAccounts(prev => {
        const updatedAccs = prev.map(a => a.id === updatedAccount.id ? updatedAccount : a);
        saveCashInAccounts(updatedAccs);
        return updatedAccs;
      });
    }

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'cashin_transactions', tx.id), cleanForFirestore(tx));
        if (updatedAccount) {
          await setDoc(doc(db, 'users', activeUid, 'cashin_accounts', updatedAccount.id), cleanForFirestore(updatedAccount));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/cashin_transactions/${tx.id}`);
      }
    }
  };

  const handleClearCashInAccountHistory = async (accountId: string) => {
    soundEngine.playDeleteSound();
    const acc = cashInAccounts.find(a => a.id === accountId);
    if (!acc) return;

    const txsToDelete = cashInTransactions.filter(t => 
      t.accountId === acc.id || 
      t.accountNumber === acc.accountNumber || 
      (t.lastDigits && (acc.lastDigits === t.lastDigits || acc.accountNumber.replace(/\D/g, '').endsWith(t.lastDigits.replace(/\D/g, ''))))
    );
    const txIdsToDelete = txsToDelete.map(t => t.id);
    const txIdsSet = new Set(txIdsToDelete);

    setCashInTransactions(prev => {
      const updated = prev.filter(t => !txIdsSet.has(t.id));
      saveCashInTransactions(updated);
      return updated;
    });

    const updatedAcc: CashInAccount = {
      ...acc,
      rechargeHistory: [],
      updatedAt: new Date().toISOString()
    };

    setCashInAccounts(prev => {
      const updatedAccs = prev.map(a => a.id === acc.id ? updatedAcc : a);
      saveCashInAccounts(updatedAccs);
      return updatedAccs;
    });

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await setDoc(doc(db, 'users', activeUid, 'cashin_accounts', acc.id), cleanForFirestore(updatedAcc));
        for (const txId of txIdsToDelete) {
          await deleteDoc(doc(db, 'users', activeUid, 'cashin_transactions', txId)).catch(() => {});
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${activeUid}/cashin_accounts/${acc.id}`);
      }
    }
  };

  const handleDeleteCashInTransaction = async (txId: string, refundAccount: boolean = true) => {
    soundEngine.playDeleteSound();
    const targetTx = cashInTransactions.find(t => t.id === txId);
    
    setCashInTransactions(prev => {
      const updated = prev.filter(t => t.id !== txId);
      saveCashInTransactions(updated);
      return updated;
    });

    let updatedAcc: CashInAccount | null = null;
    if (targetTx && refundAccount) {
      const matchedAccount = cashInAccounts.find(a => 
        (targetTx.accountId && a.id === targetTx.accountId) ||
        (targetTx.accountNumber && a.accountNumber === targetTx.accountNumber) ||
        (targetTx.lastDigits && (a.lastDigits === targetTx.lastDigits || a.accountNumber.replace(/\D/g, '').endsWith(targetTx.lastDigits.replace(/\D/g, ''))))
      );
      if (matchedAccount) {
        updatedAcc = {
          ...matchedAccount,
          balance: Number(((Number(matchedAccount.balance) || 0) + Number(targetTx.amount || 0)).toFixed(2)),
          updatedAt: new Date().toISOString()
        };
        setCashInAccounts(prev => {
          const next = prev.map(a => a.id === updatedAcc!.id ? updatedAcc! : a);
          saveCashInAccounts(next);
          return next;
        });
      }
    }

    const activeUid = user?.uid || ownerUid;
    if (activeUid) {
      try {
        await deleteDoc(doc(db, 'users', activeUid, 'cashin_transactions', txId));
        if (updatedAcc) {
          await setDoc(doc(db, 'users', activeUid, 'cashin_accounts', updatedAcc.id), cleanForFirestore(updatedAcc));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${activeUid}/cashin_transactions/${txId}`);
      }
    }
  };

  // Auto cleanup Cash In transactions older than 3 months (retaining current month + previous 2 months = total 3 months)
  // Ensures SIM balance remains completely intact and history starts fresh every month
  useEffect(() => {
    if (!cashInTransactions || cashInTransactions.length === 0) return;

    const now = new Date();
    // 3-month window: current month + past 2 months (total 3 calendar months)
    const oldestAllowedDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const oldestAllowedKey = `${oldestAllowedDate.getFullYear()}-${String(oldestAllowedDate.getMonth() + 1).padStart(2, '0')}`;

    const getTxMonthKey = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
      } catch {}
      if (/^\d{4}-\d{2}/.test(dateStr)) return dateStr.substring(0, 7);
      return '';
    };

    const expiredTxs = cashInTransactions.filter(tx => {
      const mk = getTxMonthKey(tx.date || tx.createdAt);
      return mk && mk < oldestAllowedKey;
    });

    if (expiredTxs.length > 0) {
      const expiredIds = new Set(expiredTxs.map(t => t.id));
      setCashInTransactions(prev => {
        const updated = prev.filter(t => !expiredIds.has(t.id));
        saveCashInTransactions(updated);
        return updated;
      });

      const activeUid = user?.uid || ownerUid;
      if (activeUid) {
        expiredTxs.forEach(tx => {
          deleteDoc(doc(db, 'users', activeUid, 'cashin_transactions', tx.id)).catch(() => {});
        });
      }
    }
  }, [cashInTransactions, user, ownerUid]);

  // Auto cleanup SIM account recharge records older than 3 months without modifying account balance
  useEffect(() => {
    if (!cashInAccounts || cashInAccounts.length === 0) return;

    const now = new Date();
    // 3-month window: current month + past 2 months (total 3 calendar months)
    const oldestAllowedDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const oldestAllowedKey = `${oldestAllowedDate.getFullYear()}-${String(oldestAllowedDate.getMonth() + 1).padStart(2, '0')}`;

    let accountsModified = false;
    const updatedAccounts = cashInAccounts.map(acc => {
      if (!acc.rechargeHistory || acc.rechargeHistory.length === 0) return acc;
      const validHistory = acc.rechargeHistory.filter(r => {
        const dStr = r.date || r.createdAt || '';
        const mKey = dStr ? dStr.substring(0, 7) : '';
        return !mKey || mKey >= oldestAllowedKey;
      });
      if (validHistory.length !== acc.rechargeHistory.length) {
        accountsModified = true;
        return {
          ...acc,
          rechargeHistory: validHistory,
          updatedAt: new Date().toISOString()
        };
      }
      return acc;
    });

    if (accountsModified) {
      setCashInAccounts(updatedAccounts);
      saveCashInAccounts(updatedAccounts);
      const activeUid = user?.uid || ownerUid;
      if (activeUid) {
        updatedAccounts.forEach(acc => {
          setDoc(doc(db, 'users', activeUid, 'cashin_accounts', acc.id), cleanForFirestore(acc)).catch(() => {});
        });
      }
    }
  }, [cashInAccounts, user, ownerUid]);

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

  const handleUnlock = (role: 'owner' | 'customer', contactId?: string) => {
    setIsLocked(false);
    setSessionRole(role);
    setLoggedInCustomerId(contactId || null);
    
    localStorage.setItem('hellopoint_session_role', role);
    if (role === 'owner') {
      localStorage.setItem('hellopoint_has_owner_logged_in', 'true');
      localStorage.setItem('hellopoint_is_owner_device', 'true');
    }
    if (contactId) {
      localStorage.setItem('hellopoint_session_customer_id', contactId);
      
      // 1. Immediately populate from local cached transactions (0ms instant display)
      const allTxList = transactions.length > 0 ? transactions : loadTransactions();
      const matched = allTxList.filter(t => t.contactId === contactId);
      if (matched.length > 0) {
        setCustomerTransactions(matched);
      }

      // 2. High-speed Firestore sync for this customer's latest transactions
      const activeUid = user?.uid || ownerUid || localStorage.getItem('hellopoint_synced_owner_uid') || 'lJRGRj5w92RxSUcGybklzs3cFho1';
      if (activeUid) {
        getDocs(query(collection(db, 'users', activeUid, 'transactions'), where('contactId', '==', contactId)))
          .then(snap => {
            const list: Transaction[] = [];
            snap.forEach(d => list.push({ ...d.data(), id: d.id } as Transaction));
            if (list.length > 0) {
              setCustomerTransactions(list);
              setTransactions(prev => {
                const existingIds = new Set(list.map(l => l.id));
                return [...list, ...prev.filter(p => !existingIds.has(p.id))];
              });
            }
          }).catch(err => console.warn('Customer transactions sync notice:', err));
      }

      const custObj = contacts.find(c => c.id === contactId) || customerOfflineObj;
      if (custObj) {
        try {
          let list: { id: string; name: string; phone: string }[] = [];
          const raw = localStorage.getItem('hellopoint_remembered_customers');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) list = parsed;
          }
          const cleanNum = (s: string) => (s || '').replace(/\D/g, '');
          const cleanNew = cleanNum(custObj.phone);
          const filtered = list.filter(c => c.id !== custObj.id && cleanNum(c.phone) !== cleanNew);
          const updated = [{ id: custObj.id, name: custObj.name, phone: custObj.phone }, ...filtered].slice(0, 2);
          const serialized = JSON.stringify(updated);
          localStorage.setItem('hellopoint_remembered_customers', serialized);
          localStorage.setItem('hellopoint_remembered_cust_id', updated[0].id);
          localStorage.setItem('hellopoint_remembered_cust_name', updated[0].name);
          localStorage.setItem('hellopoint_remembered_cust_num', updated[0].phone);
          window.dispatchEvent(new Event('storage'));
        } catch (e) {
          console.error('Failed to sync remembered customer in handleUnlock:', e);
        }
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
      <>
        <QuotaWarningBanner lang={lang} />
        <NotificationPermissionPrompt lang={lang} />
        <CustomerPortal 
          customer={loggedInCustomerObj}
          allTransactions={
            transactions.length > 0 
              ? transactions 
              : (customerTransactions.length > 0 ? customerTransactions : loadTransactions())
          }
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
      </>
    );
  }

  return (
    <div className="relative min-h-screen select-none selection:bg-purple-100 antialiased overflow-x-hidden transition-colors duration-300 bg-[#eaeff5] dark:bg-[#252B33] text-slate-800 dark:text-[#F1F3F5]">
      {/* Quota limit warning banner */}
      <QuotaWarningBanner lang={lang} />

      {/* Global Notification Permission Prompt for all visitors to HelloPoint.online */}
      <NotificationPermissionPrompt lang={lang} />

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
              onPinChange={handleUpdatePin}
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
              themeMode={themeMode}
              onChangeThemeMode={handleUpdateThemeMode}
              quickFaqs={quickFaqs}
              onSaveQuickFaqs={handleSaveQuickFaqs}
              cashInAccounts={cashInAccounts}
              cashInTransactions={cashInTransactions}
              onSaveCashInAccount={handleSaveCashInAccount}
              onDeleteCashInAccount={handleDeleteCashInAccount}
              onSaveCashInTransaction={handleSaveCashInTransaction}
              onDeleteCashInTransaction={handleDeleteCashInTransaction}
              onClearCashInAccountHistory={handleClearCashInAccountHistory}
              onSaveCustomerTransaction={handleSaveTransaction}
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
              allContacts={contacts}
              onSelectContact={(contactId) => setScreen({ type: 'contact_detail', contactId })}
              onSaveTransaction={handleSaveTransaction}
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

      {/* GLOBAL TRANSIENT FROSTED ENTRY LOADER OVERLAY (CASH-IN ANIMATION STYLE) */}
      <PremiumAppLoader
        isOpen={saveLoading}
        title={lang === 'bn' ? 'সংরক্ষণ করা হচ্ছে...' : 'Saving Entry...'}
        icon={CheckCircle2}
        iconGradient="from-purple-600 via-indigo-600 to-purple-700"
        ringColor="border-purple-500"
        progressColor="from-purple-500 to-indigo-500"
        duration={700}
      />

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
          chatMessages={chatMessages}
          onSendChatMessage={handleSendChatMessage}
          onDeleteChatMessage={handleDeleteChatMessage}
          currency={currency}
          themeColor={themeColor}
          quickFaqs={quickFaqs}
          onMarkChatsAsRead={handleMarkChatsAsRead}
        />
      )}

    </div>
  );
}
