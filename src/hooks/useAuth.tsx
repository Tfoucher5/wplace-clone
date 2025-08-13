'use client';

import { useState, useEffect, useContext, createContext, ReactNode } from 'react';

interface AuthUser {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
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
}

// Fonctions utilitaires pour localStorage
const getStoredUsers = (): StoredUser[] => {
  if (typeof window === 'undefined') return [];
  const users = localStorage.getItem(USERS_KEY);
  return users ? JSON.parse(users) : [];
};

const saveStoredUsers = (users: StoredUser[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const generateId = (): number => {
  return Date.now() + Math.floor(Math.random() * 1000);
};

const generateToken = (user: StoredUser): string => {
  // Token simple pour le test (en vrai, JWT côté serveur)
  return btoa(JSON.stringify({ id: user.id, username: user.username, timestamp: Date.now() }));
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Charger l'utilisateur connecté au démarrage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData.user);
        setToken(userData.token);
        console.log('👤 Utilisateur chargé:', userData.user.username);
      } catch (error) {
        console.error('Erreur lors du chargement de l\'utilisateur:', error);
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (loginField: string, password: string) => {
    try {
      console.log('🔐 Tentative de connexion pour:', loginField);

      const users = getStoredUsers();
      const user = users.find(u =>
        (u.username === loginField || u.email === loginField) && u.password === password
      );

      if (!user) {
        return { success: false, error: 'Nom d\'utilisateur/email ou mot de passe incorrect' };
      }

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        email: user.email
      };

      const userToken = generateToken(user);

      setUser(authUser);
      setToken(userToken);

      // Sauvegarder dans localStorage
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        user: authUser,
        token: userToken
      }));

      console.log('✅ Connexion réussie pour:', user.username);
      return { success: true };

    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return { success: false, error: 'Erreur de connexion' };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      console.log('📝 Tentative d\'inscription pour:', username);

      const users = getStoredUsers();

      // Vérifier si l'utilisateur existe déjà
      const existingUser = users.find(u => u.username === username || u.email === email);
      if (existingUser) {
        return { success: false, error: 'Nom d\'utilisateur ou email déjà utilisé' };
      }

      // Créer le nouvel utilisateur
      const newUser: StoredUser = {
        id: generateId(),
        username,
        email,
        password // En vrai, il faudrait hasher le mot de passe
      };

      // Sauvegarder dans la "base de données"
      users.push(newUser);
      saveStoredUsers(users);

      const authUser: AuthUser = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      };

      const userToken = generateToken(newUser);

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
      return { success: false, error: 'Erreur lors de l\'inscription' };
    }
  };

  const logout = () => {
    console.log('👋 Déconnexion de:', user?.username);
    setUser(null);
    setToken(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user && !!token,
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