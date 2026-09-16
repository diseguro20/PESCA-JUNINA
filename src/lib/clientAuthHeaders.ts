import { auth, isDemoMode } from './firebase';

export async function getOwnerRequestHeaders(uid?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (isDemoMode) {
    if (uid) headers['x-owner-demo-uid'] = uid;
    return headers;
  }

  const token = await auth?.currentUser?.getIdToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
