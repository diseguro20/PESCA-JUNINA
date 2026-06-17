import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) 
  : null;

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export const isAdminDemoMode = !serviceAccount && !process.env.FIREBASE_DATABASE_EMULATOR_HOST;

let adminApp: any = null;
let adminAuth: any = null;
let adminDb: any = null;

if (!isAdminDemoMode) {
  try {
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: projectId
      });
    } else {
      adminApp = getApp();
    }
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
    console.log("Firebase Admin SDK inicializado com sucesso.");
  } catch (error) {
    console.error("Falha ao inicializar o Firebase Admin SDK. Entrando em Modo Admin Demo.", error);
  }
} else {
  console.warn("⚠️ Firebase Admin executando em MODO DEMO backend (dados em memória do servidor Next.js).");
}

export { adminAuth, adminDb };
