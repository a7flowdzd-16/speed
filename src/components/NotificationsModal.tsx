import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../providers/AuthProvider';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../config/api';

// ─────────────────────────────────────────────────────────────────
//  🔔 NotificationBell
// ─────────────────────────────────────────────────────────────────
export const NotificationBell = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [unread, setUnread] = useState(0);
  const scale = useRef(new Animated.Value(1)).current;

  const fetchCount = async () => {
    if (!user?.id) return;
    try {
        // Fetch specific unread count for badge
        const res = await apiClient.get('/notifications/unread-count', { user_id: user.id });
        if (res && typeof res.unread_count === 'number') {
            setUnread(res.unread_count);
        }
    } catch (err) {
        console.error('Error fetching notif count:', err);
    }
  };

  useEffect(() => {
    fetchCount();
    
    // Poll every 30s to keep the badge alive
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handlePress = () => {
    navigation.navigate('Notifications');
  };

  return (
    <TouchableOpacity 
      style={styles.bellBtn} 
      onPress={handlePress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="heart" size={28} color="#FFF" />
      </Animated.View>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};


const styles = StyleSheet.create({
  bellBtn: { position: 'relative', padding: 5 },
  badge: { 
    position: 'absolute', 
    top: 0, 
    right: 0, 
    backgroundColor: '#FF3B30', 
    minWidth: 18, 
    height: 18, 
    borderRadius: 9, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#000' 
  },
  badgeTxt: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
});
