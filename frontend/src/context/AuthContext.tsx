import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (data: any) => Promise<User>;
  register: (data: any) => Promise<User>;
  registerHospital: (data: any) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getCachedUser = (): User | null => {
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getCachedUser);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(() => {
    const hasToken = !!localStorage.getItem('token');
    const hasCachedUser = !!getCachedUser();
    return hasToken && !hasCachedUser;
  });

  const refreshUser = async () => {
    if (!localStorage.getItem('token')) {
      setUser(null);
      localStorage.removeItem('auth_user');
      setLoading(false);
      return;
    }
    try {
      const u = await api.getMe();
      setUser(u);
      localStorage.setItem('auth_user', JSON.stringify(u));
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_user');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (data: any): Promise<User> => {
    const res = await api.login(data);
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data: any): Promise<User> => {
    const res = await api.register(data);
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const registerHospital = async (data: any): Promise<User> => {
    const res = await api.registerHospital(data);
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, registerHospital, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
