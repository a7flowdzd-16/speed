import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../config/api';

type User = {
  id: string | number;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
};

type AuthContextType = {
  session: string | null;
  user: User | null;
  loading: boolean;
  login: (data: any) => Promise<{ data: any; error: any }>;
  register: (data: any) => Promise<{ data: any; error: any }>;
  logout: () => Promise<void>;
  updateUser: (newData: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const updateUser = async (newData: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...newData };
    setUser(updatedUser);
    await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');
        
        if (storedToken && storedUser) {
          setSession(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error('Failed to load session from storage', e);
      } finally {
        setLoading(false);
      }
    };
    
    loadSession();
  }, []);

  const login = async (loginData: any) => {
    try {
      const response = await apiClient.post('/auth/login', loginData);
      
      if (response.error) {
        return { data: null, error: new Error(response.error) };
      }

      const { token, user: loggedInUser } = response;
      
      setSession(token);
      setUser(loggedInUser);
      
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(loggedInUser));
      
      return { data: response, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  };

  const register = async (registerData: any) => {
    try {
      const response = await apiClient.post('/auth/register', registerData);
      
      if (response.error) {
        return { data: null, error: new Error(response.error) };
      }

      const { token, user: registeredUser } = response;
      
      setSession(token);
      setUser(registeredUser);
      
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(registeredUser));
      
      return { data: response, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  };

  const logout = async () => {
    try {
      setSession(null);
      setUser(null);
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
