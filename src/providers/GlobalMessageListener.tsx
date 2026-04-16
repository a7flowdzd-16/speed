import React, { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { useAuth } from './AuthProvider';
import { ToastManager } from '../components/InAppToast';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { apiClient } from '../config/api';

// Foreground notification configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// We replace /api with root for socket
const SOCKET_URL = API_BASE_URL.replace('/api', '');

// نحفظ معرف المستخدم الذي ندردش معه حالياً حتى لا نُظهر إشعاراً له
let _activeChatPartnerId: string | null = null;

export const setActiveChatPartner = (userId: string | null) => {
  _activeChatPartnerId = userId ? String(userId) : null;
};

export const GlobalMessageListener = ({ children }: { children: React.ReactNode }) => {
  const { user, updateUser } = useAuth();
  const navigation = useNavigation<any>();
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (user?.id) {
       registerForPushNotificationsAsync();
    }
  }, [user?.id]);

  const registerForPushNotificationsAsync = async () => {
    if (!Device.isDevice) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'e4a2fac6-c96c-4930-825a-dc56ce8bcc75'
      })).data;
      
      // Update only if changed or not present
      if (user?.push_token !== token) {
        await apiClient.put('/users/settings/notifications', {
          user_id: user?.id,
          push_token: token,
          enabled: true
        });
        await updateUser({ push_token: token, notifications_enabled: 1 });
      }
    } catch (err) {
      console.warn('Error registering for push notifications:', err);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Global listener socket connected');
      socket.emit('register_user', user.id);
    });

    socket.on('new_notification', (data: any) => {
      // data: { type, title, message, avatar, sender_id, message_id }
      
      // 1. لا تظهر الإشعار إذا كان المستخدم يشاهد نفس الدردشة حالياً
      if (_activeChatPartnerId === String(data.sender_id)) return;

      // 2. إظهار الإشعار المنسدل
      ToastManager.show({
        title: data.title || 'رسالة جديدة',
        subtitle: data.message,
        avatar: data.avatar,
        icon: 'chatbubble-ellipses',
        duration: 5000,
        onPress: () => {
          if (navigation && typeof navigation.navigate === 'function') {
            navigation.navigate('ChatRoom', {
              otherUserId: data.sender_id,
              otherUserName: data.title,
              otherUserAvatar: data.avatar,
            });
          }
        },
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  return <>{children}</>;
};
