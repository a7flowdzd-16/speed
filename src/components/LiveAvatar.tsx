import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

interface LiveAvatarProps {
  userId: string;
  avatarUrl?: string;
  size?: number;
  forceLive?: boolean;
}

export const LiveAvatar = ({ userId, avatarUrl, size = 60, forceLive }: LiveAvatarProps) => {
  const navigation = useNavigation() as any;
  const [isLive, setIsLive] = useState(forceLive || false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (forceLive !== undefined) {
      setIsLive(forceLive);
    }
  }, [forceLive]);

  // Instagram dynamic gradient palette
  const IG_COLORS = ['#F58529', '#DD2A7B', '#8134AF'];
  
  useEffect(() => {
    if (forceLive !== undefined) return; // Skip if controlled by parent
    let channel: any = null;
    let isMounted = true;

    const setupChannel = async () => {
      // 1. Initial check
      await checkLiveStatus();

      // 2. Unique channel name avoids clashes
      // We use a specific channel per user to ensure we catch changes for this avatar
      const channelName = `realtime-avatar-${userId}-${Math.random().toString(36).substring(7)}`;
      channel = supabase.channel(channelName);
      
      channel
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'live_streams',
          filter: `user_id=eq.${userId}`
        }, (payload: any) => {
          if (!isMounted) return;
          
          if (payload.eventType === 'INSERT') {
            if (payload.new.status === 'live') setIsLive(true);
          } else if (payload.eventType === 'UPDATE') {
            setIsLive(payload.new.status === 'live');
          } else if (payload.eventType === 'DELETE') {
            setIsLive(false);
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            // Re-check once subscribed to catch any changes during connection
            checkLiveStatus();
          }
        });
    };

    setupChannel();

    // 3. Fallback polling (every 45 seconds) in case of realtime disconnects
    const pollInterval = setInterval(() => {
      if (isMounted) checkLiveStatus();
    }, 45000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  useEffect(() => {
    if (isLive) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isLive]);

  const checkLiveStatus = async () => {
    const { data } = await supabase
      .from('live_streams')
      .select('status')
      .eq('user_id', userId)
      .eq('status', 'live')
      .maybeSingle();
    
    setIsLive(!!data);
  };

  const handlePress = () => {
    if (isLive) {
      navigation.navigate('LiveViewer', { hostId: userId });
    } else {
      navigation.navigate('UserProfile', { userId });
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const borderSize = size * 0.1; // Consistent relative border
  const innerSize = size - borderSize * 2;

  return (
    <Pressable onPress={handlePress} style={[styles.container, { width: size, height: size }]}>
      {isLive ? (
        <View style={[styles.liveWrap, { width: size, height: size, borderRadius: size / 2 }]}>
          <Animated.View style={[styles.gradientContainer, { transform: [{ rotate: spin }] }]}>
            <LinearGradient
              colors={IG_COLORS as any}
              style={[styles.gradient, { borderRadius: size / 2 }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>
          <View style={[styles.innerBorder, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]}>
             {avatarUrl ? (
               <Image source={{ uri: avatarUrl }} style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }} />
             ) : (
               <View style={[styles.fallback, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
                 <Ionicons name="person" size={size * 0.4} color="#666" />
               </View>
             )}
          </View>
          <View style={styles.liveBadge}>
             <Animated.Text style={styles.liveBadgeTxt}>LIVE</Animated.Text>
          </View>
        </View>
      ) : (
        <View style={[styles.standardWrap, { width: size, height: size, borderRadius: size / 2 }]}>
           {avatarUrl ? (
             <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
           ) : (
             <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
               <Ionicons name="person" size={size * 0.4} color="#466" />
             </View>
           )}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { justifyContent: 'center', alignItems: 'center' },
  liveWrap: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  gradientContainer: { position: 'absolute', width: '150%', height: '150%' },
  gradient: { flex: 1 },
  innerBorder: { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  standardWrap: { overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  fallback: { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  liveBadge: { 
    position: 'absolute', 
    bottom: -2, 
    backgroundColor: '#FF3B30', 
    paddingHorizontal: 6, 
    paddingVertical: 1, 
    borderRadius: 4, 
    borderWidth: 2, 
    borderColor: '#000',
    zIndex: 2
  },
  liveBadgeTxt: { color: '#FFF', fontSize: 8, fontWeight: '900' }
});
