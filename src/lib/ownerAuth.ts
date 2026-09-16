import { adminAuth, adminDb, isAdminDemoMode } from './firebaseAdmin';
import { getPrivateAccessError, isOwnerEmail } from './privateAccess';
import { getMockDb } from './mockDb';

function getBearerToken(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : '';
}

export async function requireOwnerRequest(req: Request, expectedUid?: string) {
  if (isAdminDemoMode) {
    const demoUid = req.headers.get('x-owner-demo-uid') || expectedUid || '';
    const user = getMockDb().users[demoUid];
    if (!user || !isOwnerEmail(user.email)) {
      throw new Error(getPrivateAccessError());
    }
    return { uid: user.uid, email: user.email };
  }

  if (!adminAuth) {
    throw new Error('Autenticacao indisponivel no servidor.');
  }

  const token = getBearerToken(req);
  if (!token) {
    throw new Error(getPrivateAccessError());
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const email = decoded.email || '';
  if (!isOwnerEmail(email)) {
    throw new Error(getPrivateAccessError());
  }

  if (expectedUid && decoded.uid !== expectedUid) {
    throw new Error(getPrivateAccessError());
  }

  if (adminDb) {
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (userSnap.exists && !isOwnerEmail(userSnap.data()?.email)) {
      throw new Error(getPrivateAccessError());
    }
  }

  return { uid: decoded.uid, email };
}
