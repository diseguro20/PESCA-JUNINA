export const OWNER_EMAIL = 'diseguro20@gmail.com';

export function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

export function isOwnerEmail(email?: string | null) {
  return normalizeEmail(email) === OWNER_EMAIL;
}

export function getPrivateAccessError() {
  return 'Acesso restrito. Este site esta disponivel somente para diseguro20@gmail.com.';
}
