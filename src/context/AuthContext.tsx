"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, isDemoMode } from '../lib/firebase';

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
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        // Logar usuário padrão para facilitar testes rápidos
        const defaultUser: UserProfile = {
          uid: 'user-demo-id',
          name: 'Chico Bento',
          email: 'chico@pesca.com',
          role: 'user',
          status: 'active',
          createdAt: new Date().toISOString()
        };
        setUser(defaultUser);
        localStorage.setItem('pesca_demo_user', JSON.stringify(defaultUser));
      }
      setLoading(false);
      return;
    }

    // Fluxo Firebase Real
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        // Escutar perfil do usuário no Firestore em tempo real
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        const unsubscribeProfile = onSnapshot(userRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            setUser({
              uid: firebaseUser.uid,
              ...(docSnapshot.data() as Omit<UserProfile, 'uid'>)
            });
          } else {
            // Se o documento ainda não existir, cria um perfil padrão provisório
            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Jogador Junino',
              email: firebaseUser.email || '',
              role: 'user',
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
    if (isDemoMode) {
      setLoading(true);
      // Chamar API mock ou simular
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Esperar leitura do perfil para garantir permissão e existência antes de redirecionar
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error("Perfil do usuário não encontrado no banco de dados.");
      }
      
      setUser({
        uid: userCredential.user.uid,
        ...(userSnap.data() as Omit<UserProfile, 'uid'>)
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
  const signup = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      if (isDemoMode) {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Erro no cadastro');
        
        setUser(data.user);
        localStorage.setItem('pesca_demo_user', JSON.stringify(data.user));
        return;
      }

      // Firebase Real
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      await updateProfile(firebaseUser, { displayName: name });

      // O backend inicializará a carteira e o registro via API ou nós salvamos aqui
      // Para garantir a integridade, criamos o doc do usuário e carteira
      // (Regras do Firebase devem permitir escrita de criação)
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, {
        name,
        email,
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString()
      });

      const walletRef = doc(db, 'wallets', firebaseUser.uid);
      await setDoc(walletRef, {
        uid: firebaseUser.uid,
        balance: 100.00, // Saldo inicial cortesia de boas-vindas
        lockedBalance: 0.00,
        updatedAt: new Date().toISOString()
      });

    } finally {
      setLoading(false);
    }
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
        headers: { 'Content-Type': 'application/json' },
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
