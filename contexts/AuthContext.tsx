import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { 
    User, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseEnabled } from '../services/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthEnabled: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<any>;
  signupWithEmail: (email: string, pass: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  logout: () => Promise<any>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseEnabled && auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Firebase is not configured, so we are not in an authenticated session.
      // We just stop the loading indicator.
      setLoading(false);
    }
  }, []);

  const noOpPromise = () => Promise.reject(new Error("Authentication is disabled."));

  const loginWithEmail = (email: string, pass: string) => {
    if (!isFirebaseEnabled || !auth) return noOpPromise();
    return signInWithEmailAndPassword(auth, email, pass);
  };
  
  const signupWithEmail = (email: string, pass: string) => {
    if (!isFirebaseEnabled || !auth) return noOpPromise();
    return createUserWithEmailAndPassword(auth, email, pass);
  };
  
  const loginWithGoogle = () => {
    if (!isFirebaseEnabled || !auth || !googleProvider) return noOpPromise();
    return signInWithPopup(auth, googleProvider);
  };

  const logout = () => {
    if (!isFirebaseEnabled || !auth) return Promise.resolve();
    return signOut(auth);
  };

  const value = {
    user,
    loading,
    isAuthEnabled: isFirebaseEnabled,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};