"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, isDemoMode } from '../lib/firebase';
import { OWNER_EMAIL, getPrivateAccessError, isOwnerEmail, normalizeEmail } from '../lib/privateAccess';
import { getOwnerRequestHeaders } from '../lib/clientAuthHeaders';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'blocked' | 'review';
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateName: (newName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Monitorar estado de autenticação
  useEffect(() => {
    if (isDemoMode) {
      // Carregar sessão mock do localStorage
      const savedUser = localStorage.getItem('pesca_demo_user');
      const parsedUser = savedUser ? JSON.parse(savedUser) : null;
      if (parsedUser && isOwnerEmail(parsedUser.email)) {
        setUser(parsedUser);
      } else {
        localStorage.removeItem('pesca_demo_user');
        setUser(null);
      }
      setLoading(false);
      return;
    }

    // Fluxo Firebase Real
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!isOwnerEmail(firebaseUser.email)) {
          await signOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        // Escutar perfil do usuário no Firestore em tempo real
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        const unsubscribeProfile = onSnapshot(userRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const profileData = docSnapshot.data() as Omit<UserProfile, 'uid'>;
            setUser({
              uid: firebaseUser.uid,
              ...profileData,
              role: isOwnerEmail(profileData.email) ? 'admin' : profileData.role,
              status: isOwnerEmail(profileData.email) ? 'active' : profileData.status
            });
          } else {
            // Se o documento ainda não existir, cria um perfil padrão provisório
            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Jogador Junino',
              email: firebaseUser.email || '',
              role: 'admin',
              status: 'active',
              createdAt: new Date().toISOString()
            };
            setUser(fallbackProfile);
            // Salva no banco
            setDoc(userRef, {
              name: fallbackProfile.name,
              email: fallbackProfile.email,
              role: fallbackProfile.role,
              status: fallbackProfile.status,
              createdAt: fallbackProfile.createdAt
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("Erro ao escutar perfil:", error);
          setUser(null);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Login
  const login = async (email: string, password: string) => {
    const normalizedEmail = normalizeEmail(email);
    if (!isOwnerEmail(normalizedEmail)) {
      throw new Error(getPrivateAccessError());
    }

    if (isDemoMode) {
      setLoading(true);
      // Chamar API mock ou simular
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Erro no login');
        
        setUser(data.user);
        localStorage.setItem('pesca_demo_user', JSON.stringify(data.user));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Firebase Real
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      if (!isOwnerEmail(userCredential.user.email)) {
        await signOut(auth);
        throw new Error(getPrivateAccessError());
      }
      
      // Esperar leitura do perfil para garantir permissão e existência antes de redirecionar
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const ownerProfile = {
          name: userCredential.user.displayName || 'diseguro20',
          email: OWNER_EMAIL,
          role: 'admin' as const,
          status: 'active' as const,
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, ownerProfile);
        const walletRef = doc(db, 'wallets', userCredential.user.uid);
        await setDoc(walletRef, {
          uid: userCredential.user.uid,
          balance: 0,
          lockedBalance: 0,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setUser({ uid: userCredential.user.uid, ...ownerProfile });
        return;
      }
      const profileData = userSnap.data() as Omit<UserProfile, 'uid'>;
      if (isOwnerEmail(profileData.email) && (profileData.role !== 'admin' || profileData.status !== 'active')) {
        await setDoc(userRef, { role: 'admin', status: 'active' }, { merge: true });
      }
      
      setUser({
        uid: userCredential.user.uid,
        ...profileData,
        role: isOwnerEmail(profileData.email) ? 'admin' : profileData.role,
        status: isOwnerEmail(profileData.email) ? 'active' : profileData.status
      });
    } catch (err: any) {
      // Garantir limpeza em caso de erro
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Cadastro
  const signup = async (_name: string, _email: string, _password: string) => {
    throw new Error('Cadastro desativado. Use apenas a conta privada ' + OWNER_EMAIL + '.');
  };

  // Logout
  const logout = async () => {
    if (isDemoMode) {
      setUser(null);
      localStorage.removeItem('pesca_demo_user');
      return;
    }
    await signOut(auth);
  };

  // Recuperação de senha
  const resetPassword = async (email: string) => {
    if (!isOwnerEmail(email)) {
      throw new Error(getPrivateAccessError());
    }

    if (isDemoMode) {
      alert("Modo de Demonstração: Link de redefinição de senha simulado para o e-mail: " + email);
      return;
    }
    await sendPasswordResetEmail(auth, email);
  };

  // Atualizar nome
  const updateName = async (newName: string) => {
    if (!user) throw new Error("Usuário não autenticado");

    if (isDemoMode) {
      const updated = { ...user, name: newName };
      setUser(updated);
      localStorage.setItem('pesca_demo_user', JSON.stringify(updated));
      
      // Atualizar também no mockDb do servidor
      await fetch('/api/admin/users', {
        method: 'PUT',
        headers: await getOwnerRequestHeaders(user.uid),
        body: JSON.stringify({ uid: user.uid, name: newName })
      });
      return;
    }

    // Firebase Real
    await updateProfile(auth.currentUser!, { displayName: newName });
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { name: newName }, { merge: true });
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isDemo: isDemoMode,
      login,
      signup,
      logout,
      resetPassword,
      updateName
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
