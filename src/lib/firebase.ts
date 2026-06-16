import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Support both standard Vite environment variables and requested Next.js layouts with seamless JSON fallback
const metaObj = (import.meta as any);
const firebaseConfig = {
  apiKey: (metaObj.env?.VITE_FIREBASE_API_KEY || metaObj.env?.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfigJson.apiKey) as string,
  authDomain: (metaObj.env?.VITE_FIREBASE_AUTH_DOMAIN || metaObj.env?.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain) as string,
  projectId: (metaObj.env?.VITE_FIREBASE_PROJECT_ID || metaObj.env?.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId) as string,
  storageBucket: (metaObj.env?.VITE_FIREBASE_STORAGE_BUCKET || metaObj.env?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket) as string,
  messagingSenderId: (metaObj.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || metaObj.env?.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId) as string,
  appId: (metaObj.env?.VITE_FIREBASE_APP_ID || metaObj.env?.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfigJson.appId) as string,
  measurementId: (metaObj.env?.VITE_FIREBASE_MEASUREMENT_ID || metaObj.env?.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId || '') as string,
  firestoreDatabaseId: (metaObj.env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID || metaObj.env?.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId) as string,
};

// Initialize the Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom database ID and long polling
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
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

// Provider for Google Sign-in
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Validates connection to Firestore (mandatory sanity check from guidelines)
 */
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Firestore connected successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or network status.", error);
    }
  }
}

testConnection();
