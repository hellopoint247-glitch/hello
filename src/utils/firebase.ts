/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  memoryLocalCache,
  doc, 
  getDocFromServer,
  disableNetwork,
  enableNetwork,
  setDoc,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

function canUsePersistentMultiTabCache(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // In cross-origin/sandboxed iframes (such as preview frames), IndexedDB and multi-tab
    // localStorage lease coordination can stall Firestore watch streams.
    const isInIframe = window.self !== window.top;
    if (isInIframe) return false;
    return typeof window.indexedDB !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    // Accessing window.top throws SecurityError in cross-origin iframes
    return false;
  }
}

// Initialize Firestore with Database ID, forced long-polling for proxy/mobile/iframe reliability,
// and resilient local cache fallback.
function createFirestoreInstance() {
  const baseSettings = {
    experimentalForceLongPolling: true,
    experimentalLongPollingOptions: {
      timeoutSeconds: 20,
    },
  };

  if (canUsePersistentMultiTabCache()) {
    try {
      return initializeFirestore(
        app,
        {
          ...baseSettings,
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      // Fall through to memoryLocalCache if IndexedDB/persistence is unavailable
    }
  }

  return initializeFirestore(
    app,
    {
      ...baseSettings,
      localCache: memoryLocalCache(),
    },
    firebaseConfig.firestoreDatabaseId
  );
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
export const FIRESTORE_UPGRADE_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;

const QUOTA_STORAGE_KEY = 'hellopoint_firestore_quota_exceeded_timestamp';

// Check if quota was exceeded recently (within last 24 hours)
let quotaExceededState = false;
try {
  if (typeof window !== 'undefined') {
    const savedQuotaTime = window.localStorage.getItem(QUOTA_STORAGE_KEY);
    if (savedQuotaTime) {
      const elapsed = Date.now() - parseInt(savedQuotaTime, 10);
      if (elapsed < 24 * 60 * 60 * 1000) {
        quotaExceededState = true;
        // Disable network immediately on startup so no failing network calls or backoff retries occur
        disableNetwork(db).catch(() => {});
      } else {
        window.localStorage.removeItem(QUOTA_STORAGE_KEY);
      }
    }
  }
} catch (e) {
  // ignore storage errors
}

// Sync Firestore network state with browser online/offline transitions so watch streams
// do not time out with "Backend didn't respond within 10 seconds" while offline.
if (typeof window !== 'undefined') {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    disableNetwork(db).catch(() => {});
  }
  window.addEventListener('offline', () => {
    disableNetwork(db).catch(() => {});
  });
  window.addEventListener('online', () => {
    if (!quotaExceededState) {
      enableNetwork(db).catch(() => {});
    }
  });
}

const quotaListeners = new Set<(exceeded: boolean) => void>();

export function isQuotaExceeded(): boolean {
  return quotaExceededState;
}

export function subscribeQuotaState(listener: (exceeded: boolean) => void): () => void {
  quotaListeners.add(listener);
  listener(quotaExceededState);
  return () => {
    quotaListeners.delete(listener);
  };
}

export async function markQuotaExceeded() {
  if (!quotaExceededState) {
    quotaExceededState = true;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(QUOTA_STORAGE_KEY, Date.now().toString());
      }
    } catch {}

    // Disable Firestore network to completely prevent retry storm & "Using maximum backoff delay"
    try {
      await disableNetwork(db);
    } catch (e) {
      console.warn('Could not disable Firestore network:', e);
    }

    quotaListeners.forEach((listener) => {
      try {
        listener(true);
      } catch (e) {
        console.error('Error in quota listener:', e);
      }
    });
  }
}

export async function resetQuotaState() {
  quotaExceededState = false;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(QUOTA_STORAGE_KEY);
    }
    await enableNetwork(db);
    console.log('Firestore network re-enabled.');
  } catch (e) {
    console.warn('Failed to re-enable Firestore network:', e);
  }
  quotaListeners.forEach((listener) => {
    try {
      listener(false);
    } catch (e) {
      console.error('Error in quota listener:', e);
    }
  });
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded')
  );
}

export function isTransientNetworkError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('Could not reach Cloud Firestore backend') ||
    msg.includes('Failed to get document because the client is offline')
  );
}

// Safe Firestore wrappers to prevent network errors when quota is exceeded
export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<void> {
  if (isQuotaExceeded()) return;
  try {
    if (options) {
      await setDoc(docRef, data, options);
    } else {
      await setDoc(docRef, data);
    }
  } catch (err) {
    if (isQuotaError(err)) {
      await markQuotaExceeded();
      return;
    }
    if (isTransientNetworkError(err)) {
      console.warn('Firestore write deferred (offline/network unavailable).');
      return;
    }
    throw err;
  }
}

export async function safeDeleteDoc(docRef: any): Promise<void> {
  if (isQuotaExceeded()) return;
  try {
    await deleteDoc(docRef);
  } catch (err) {
    if (isQuotaError(err)) {
      await markQuotaExceeded();
      return;
    }
    if (isTransientNetworkError(err)) {
      console.warn('Firestore delete deferred (offline/network unavailable).');
      return;
    }
    throw err;
  }
}

export async function safeAddDoc(collectionRef: any, data: any): Promise<any> {
  if (isQuotaExceeded()) return null;
  try {
    return await addDoc(collectionRef, data);
  } catch (err) {
    if (isQuotaError(err)) {
      await markQuotaExceeded();
      return null;
    }
    if (isTransientNetworkError(err)) {
      console.warn('Firestore add deferred (offline/network unavailable).');
      return null;
    }
    throw err;
  }
}

// Error diagnostic tracking
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isQuotaError(error)) {
    markQuotaExceeded();
    console.warn(`Firestore Quota limit reached during ${operationType} on ${path}. Seamlessly falling back to local offline storage.`);
    return;
  }

  if (isTransientNetworkError(error)) {
    console.warn(`Firestore temporarily unreachable during ${operationType} on ${path}. Operating with local cache until reconnected.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on boot gracefully
async function testConnection() {
  if (isQuotaExceeded()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (isQuotaError(error)) {
      await markQuotaExceeded();
      return;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently offline; using local cache until connection is restored.');
    }
  }
}
testConnection();

// Authentication login trigger
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign in failed:', error);
    throw error;
  }
}

export async function logoutFromGoogle() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Google sign out failed:', error);
    throw error;
  }
}

