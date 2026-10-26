import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import baseConfig from '../firebase-applet-config.json';

export interface FirebaseConfigType {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export function getEffectiveFirebaseConfig(): FirebaseConfigType {
  const cfg: FirebaseConfigType = { ...baseConfig };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedConfig = window.localStorage.getItem('dsb_firebase_config');
      if (storedConfig) {
        try {
          const parsed = JSON.parse(storedConfig);
          if (parsed && typeof parsed === 'object') {
            if (parsed.apiKey && String(parsed.apiKey).trim().length !== 39) {
              delete parsed.apiKey;
            }
            Object.assign(cfg, parsed);
          }
        } catch (_) {}
      }
      const storedApiKey = window.localStorage.getItem('dsb_firebase_api_key');
      if (storedApiKey && storedApiKey.trim()) {
        const trimmed = storedApiKey.trim();
        if (trimmed.length !== 39) {
          window.localStorage.removeItem('dsb_firebase_api_key');
        } else {
          cfg.apiKey = trimmed;
        }
      }
      if (cfg.apiKey.length !== 39 && baseConfig.apiKey.length === 39) {
        cfg.apiKey = baseConfig.apiKey;
      }
    }
  } catch (e) {
    console.warn('Could not read custom Firebase config from localStorage:', e);
  }
  return cfg;
}

let activeConfig = getEffectiveFirebaseConfig();

// Prevent duplicate initialization across development hot reloads
export let app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(activeConfig);
export let auth: Auth = getAuth(app);
export let db: Firestore = getFirestore(app);

const reconfigListeners: Array<(cfg: FirebaseConfigType) => void> = [];

export function onFirebaseReconfigured(fn: (cfg: FirebaseConfigType) => void) {
  reconfigListeners.push(fn);
  return () => {
    const idx = reconfigListeners.indexOf(fn);
    if (idx !== -1) reconfigListeners.splice(idx, 1);
  };
}

export async function reinitializeFirebase(newConfig?: Partial<FirebaseConfigType>): Promise<FirebaseConfigType> {
  if (newConfig) {
    activeConfig = { ...activeConfig, ...newConfig };
  } else {
    activeConfig = getEffectiveFirebaseConfig();
  }

  try {
    const currentApps = getApps();
    for (const a of currentApps) {
      try {
        await deleteApp(a);
      } catch (err) {
        console.warn('Could not cleanly delete existing Firebase app:', err);
      }
    }
  } catch (e) {
    console.warn('Error cleaning up existing apps:', e);
  }

  app = initializeApp(activeConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  for (const fn of reconfigListeners) {
    try {
      fn(activeConfig);
    } catch (e) {
      console.error('Error in reconfig listener:', e);
    }
  }

  return activeConfig;
}

export async function testApiKeyValidity(keyToTest: string): Promise<{ valid: boolean; reason?: string; code?: string }> {
  const trimmed = (keyToTest || '').trim();
  if (!trimmed) {
    return { valid: false, reason: 'API key is empty.' };
  }
  if (trimmed.length < 35) {
    return {
      valid: false,
      reason: `Key has only ${trimmed.length} characters (standard Google API keys are 39 characters).`
    };
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(trimmed)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'probe@devtoshsuperbazaar.com', password: 'probe-password', returnSecureToken: false })
    });
    const data = await res.json();
    if (data.error) {
      const msg = data.error.message || '';
      if (msg.includes('API key not valid') || data.error.status === 'INVALID_ARGUMENT' || data.error.details?.some((d: any) => d.reason === 'API_KEY_INVALID')) {
        return {
          valid: false,
          code: 'API_KEY_INVALID',
          reason: `Google rejected this API key (${trimmed.length} characters). The key is either mistyped, incomplete, or restricted in Google Cloud Console.`
        };
      }
      // If error is EMAIL_NOT_FOUND or INVALID_PASSWORD, the API key itself is VALID!
      if (msg === 'EMAIL_NOT_FOUND' || msg === 'INVALID_PASSWORD' || msg === 'INVALID_LOGIN_CREDENTIALS') {
        return { valid: true };
      }
      if (msg === 'OPERATION_NOT_ALLOWED') {
        return { valid: true, reason: 'API key is valid, but Email/Password authentication is disabled in Firebase Console.' };
      }
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: err?.message || 'Network error while testing key.' };
  }
}

export async function saveAndApplyApiKey(newKey: string): Promise<{ success: boolean; message: string; valid?: boolean }> {
  const trimmed = newKey.trim();
  if (!trimmed) {
    return { success: false, message: 'Please provide a non-empty API key.' };
  }

  // 1. Save to localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('dsb_firebase_api_key', trimmed);
    }
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }

  // 2. Persist to disk via vite dev server middleware
  try {
    await fetch('/api/save-firebase-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: trimmed })
    });
  } catch (e) {
    console.warn('Failed to persist to /api/save-firebase-config:', e);
  }

  // 3. Test validity
  const testRes = await testApiKeyValidity(trimmed);

  // 4. Reinitialize app
  await reinitializeFirebase({ apiKey: trimmed });

  if (!testRes.valid) {
    return {
      success: false,
      valid: false,
      message: testRes.reason || 'Google rejected this API key.'
    };
  }

  return {
    success: true,
    valid: true,
    message: 'API Key successfully updated, verified, and reconnected to Firebase!'
  };
}

export function getCurrentFirebaseConfig(): FirebaseConfigType {
  return activeConfig;
}

// Connection test helper
export async function testConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true, message: 'Cloud Firestore connected successfully.' };
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (msg.includes('offline') || msg.includes('unavailable')) {
      return { connected: false, message: 'Firestore is currently offline or unreachable.' };
    }
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      // Permission denied on test/connection is expected if rules restrict access; Firestore itself is reachable!
      return { connected: true, message: 'Firestore is reachable (security rules active).' };
    }
    return { connected: false, message: msg };
  }
}
