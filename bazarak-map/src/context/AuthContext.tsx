"use client";

import axios from "axios";
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  role: "admin" | "driver";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get<{ user: User }>("/api/auth-map/check-auth", { withCredentials: true });
        setUser(response.data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    void checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await axios.post<{ user: User }>("/api/auth-map/login", { username, password }, { withCredentials: true });
    setUser(response.data.user);
  };

  const logout = async () => {
    await axios.post("/api/auth-map/logout", {}, { withCredentials: true });
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
