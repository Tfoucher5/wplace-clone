'use client';

import { useState, useEffect, useContext, createContext, ReactNode } from 'react';

export interface User {
  id: number;
  username: string;
  email: string;
  pixelsPlaced?: number;
  lastPixelTime?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simulation d'une base de données en localStorage
const USERS_KEY = 'wplace_users';
const CURRENT_USER_KEY = 'wplace_current_user';

interface StoredUser {
  id: number;
  username: string;
  email: string;
  password: string; // En vrai, ce serait hashé
  pixelsPlaced: number;
  lastPixelTime?: string;
  createdAt: string;
}

// Fonctions utilitaires pour localStorage
const getStoredUsers = (): StoredUser[] => {
  if (typeof window === 'undefined') return [];
  try {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
  } catch {
    return [];
  }
};

const saveStoredUsers = (users: StoredUser[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Erreur sauvegarde utilisateurs:', error);
  }
};

const generateId = (): number => {
  return Date.now() + Math.floor(Math.random() * 1000);
};

const generateToken = (user: StoredUser): string => {
  // Token simple pour le test (en vrai, JWT côté serveur)
  return btoa(JSON.stringify({
    id: user.id,
    username: user.username,
    timestamp: Date.now()
  }));
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger l'utilisateur connecté au démarrage
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const savedUser = localStorage.getItem(CURRENT_USER_KEY);
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData.user);
        setToken(userData.token);
        console.log('👤 Utilisateur chargé:', userData.user.username);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'utilisateur:', error);
      localStorage.removeItem(CURRENT_USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (loginField: string, password: string) => {
    try {
      setError(null);
      console.log('🔐 Tentative de connexion pour:', loginField);

      const users = getStoredUsers();
      const storedUser = users.find(u =>
        (u.username === loginField || u.email === loginField) && u.password === password
      );

      if (!storedUser) {
        const errorMsg = 'Nom d\'utilisateur/email ou mot de passe incorrect';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const authUser: User = {
        id: storedUser.id,
        username: storedUser.username,
        email: storedUser.email,
        pixelsPlaced: storedUser.pixelsPlaced || 0,
        lastPixelTime: storedUser.lastPixelTime,
        createdAt: storedUser.createdAt
      };

      const userToken = generateToken(storedUser);

      setUser(authUser);
      setToken(userToken);

      // Sauvegarder dans localStorage
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        user: authUser,
        token: userToken
      }));

      console.log('✅ Connexion réussie pour:', storedUser.username);
      return { success: true };

    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      const errorMsg = 'Erreur de connexion';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      setError(null);
      console.log('📝 Tentative d\'inscription pour:', username);

      // Validations de base
      if (username.length < 3) {
        const errorMsg = 'Le nom d\'utilisateur doit contenir au moins 3 caractères';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (password.length < 6) {
        const errorMsg = 'Le mot de passe doit contenir au moins 6 caractères';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const users = getStoredUsers();

      // Vérifier si l'utilisateur existe déjà
      const existingUser = users.find(u => u.username === username || u.email === email);
      if (existingUser) {
        const errorMsg = 'Nom d\'utilisateur ou email déjà utilisé';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Créer le nouvel utilisateur
      const newStoredUser: StoredUser = {
        id: generateId(),
        username,
        email,
        password, // En vrai, il faudrait hasher le mot de passe
        pixelsPlaced: 0,
        createdAt: new Date().toISOString()
      };

      // Sauvegarder dans la "base de données"
      users.push(newStoredUser);
      saveStoredUsers(users);

      const authUser: User = {
        id: newStoredUser.id,
        username: newStoredUser.username,
        email: newStoredUser.email,
        pixelsPlaced: 0,
        createdAt: newStoredUser.createdAt
      };

      const userToken = generateToken(newStoredUser);

      setUser(authUser);
      setToken(userToken);

      // Sauvegarder la session
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        user: authUser,
        token: userToken
      }));

      console.log('✅ Inscription réussie pour:', username);
      return { success: true };

    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      const errorMsg = 'Erreur lors de l\'inscription';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    console.log('👋 Déconnexion de:', user?.username);
    setUser(null);
    setToken(null);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  };

  const refreshUser = async () => {
    // En mode demo, on ne fait rien
    // En vrai, on ferait un appel API pour rafraîchir les données utilisateur
    console.log('🔄 Refresh user (mode demo)');
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user && !!token,
    error,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}