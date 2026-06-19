import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface User {
  id: number;
  username: string;
  role: string;
  displayName?: string;
  status?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; frozen?: boolean; message?: string }>;
  logout: () => void;
  isAdmin: boolean;
  isDirector: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => ({ success: false }),
  logout: () => {},
  isAdmin: false,
  isDirector: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      api.auth.profile().then((u) => {
        if (u.status === 'frozen') {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        } else {
          setUser(u);
        }
      }).catch(() => {
        localStorage.removeItem('token');
        setToken(null);
      });
    }
  }, [token]);

  const login = async (username: string, password: string): Promise<{ success: boolean; frozen?: boolean; message?: string }> => {
    const res = await api.auth.login(username, password);
    if (res.success) {
      localStorage.setItem('token', res.accessToken);
      setToken(res.accessToken);
      setUser(res.user);
      return { success: true };
    }
    if (res.frozen) {
      return { success: false, frozen: true, message: res.message || '该账号已被冻结，请联系管理员' };
    }
    return { success: false, message: res.message || '用户名或密码错误' };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        isDirector: user?.role === 'director' || user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
