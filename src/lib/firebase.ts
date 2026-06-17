import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Verificar se as credenciais mínimas necessárias estão presentes
const hasCredentials = 
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export const isDemoMode = !hasCredentials;

let app;
let auth: any = null;
let db: any = null;

if (!isDemoMode) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase cliente inicializado com sucesso.");
  } catch (error) {
    console.error("Falha ao inicializar o Firebase. Entrando em Modo Demo.", error);
  }
} else {
  console.warn(
    "⚠️ Credenciais do Firebase não detectadas no .env.local.\n" +
    "A plataforma está rodando em MODO DEMONSTRAÇÃO (Demo Mode).\n" +
    "Os dados serão persistidos localmente no navegador."
  );
}

export { auth, db };
