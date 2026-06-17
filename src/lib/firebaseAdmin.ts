import * as admin from 'firebase-admin';

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
    if ((admin as any).apps.length === 0) {
      adminApp = admin.initializeApp({
        credential: (admin as any).credential.cert(serviceAccount),
        projectId: projectId
      });
    } else {
      adminApp = (admin as any).apps[0]!;
    }
    adminAuth = (admin as any).auth();
    adminDb = (admin as any).firestore();
    console.log("Firebase Admin SDK inicializado com sucesso.");
  } catch (error) {
    console.error("Falha ao inicializar o Firebase Admin SDK. Entrando em Modo Admin Demo.", error);
  }
} else {
  console.warn("⚠️ Firebase Admin executando em MODO DEMO backend (dados em memória do servidor Next.js).");
}

export { adminAuth, adminDb };
