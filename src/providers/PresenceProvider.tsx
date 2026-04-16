import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { useAuth } from './AuthProvider';

type PresenceContextType = {
  onlineUsers: Set<string>;
};

const PresenceContext = createContext<PresenceContextType>({
  onlineUsers: new Set(),
});

// We replace /api with root for socket
const SOCKET_URL = API_BASE_URL.replace('/api', '');

export const PresenceProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const socketRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!user?.id) {
      setOnlineUsers(new Set());
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Initialize Socket
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Presence socket connected');
      socket.emit('register_user', user.id);
    });

    socket.on('user_online', (userId: string) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.add(String(userId));
        return next;
      });
    });

    socket.on('user_offline', (userId: string) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(String(userId));
        return next;
      });
    });

    // AppState listener
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (socket?.connected) socket.emit('register_user', user.id);
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      socket.disconnect();
    };
  }, [user?.id]);

  return (
    <PresenceContext.Provider value={{ onlineUsers }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);
