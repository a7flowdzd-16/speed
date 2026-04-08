import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ActivityIndicator, Animated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';

// ─────────────────────────────────────────────────────────────────
//  🎨 Notification type config
// ─────────────────────────────────────────────────────────────────
const NOTIF_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  like:    { icon: 'heart',        color: '#FF3B6F', label: 'أعجب بمنشورك' },
  comment: { icon: 'chatbubble',   color: '#4A90FF', label: 'علّق على منشورك' },
  follow:  { icon: 'person-add',   color: colors.primary, label: 'بدأ متابعتك' },
  system:  { icon: 'notifications', color: '#FFD700', label: 'تنبيه النظام' },
};


const timeAgo = (dateStr: string) => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ي`;
  return new Date(dateStr).toLocaleDateString('ar');
};

// ─────────────────────────────────────────────────────────────────
//  🔔 NotificationsModal
// ─────────────────────────────────────────────────────────────────
export const NotificationsModal = ({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && user?.id) loadNotifs();
  }, [visible, user?.id]);

  const loadNotifs = async () => {
    setLoading(true);
    try {
      // Explicitly Fetch Notifications with Senders and Posts
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:profiles!sender_id ( full_name, avatar_url ),
          post:post_id ( media_urls )
        `)
        .eq('receiver_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setNotifs(data);

      // تحديث حالة القراءة في الخلفية
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('receiver_id', user?.id)
        .eq('is_read', false)
        .then(() => {});
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const cfg = NOTIF_CONFIG[item.type] || NOTIF_CONFIG.like;
    return (
      <View style={[styles.notifRow, !item.is_read && styles.notifUnread]}>
        {/* Avatar Area */}
        <View style={styles.avWrap}>
          {item.sender?.avatar_url
            ? <Image source={{ uri: item.sender.avatar_url }} style={styles.av} contentFit="cover" />
            : <View style={styles.avFallback}><Ionicons name="person" size={20} color="#444" /></View>
          }
          <View style={[styles.typeBadge, { backgroundColor: cfg.color }]}>
            <Ionicons name={cfg.icon as any} size={10} color="#FFF" />
          </View>
        </View>

        {/* Content Area */}
        <View style={styles.notifContent}>
           <Text style={styles.notifText}>
              {item.type === 'system' ? (
                <Text style={{ color: '#FFD700', fontWeight: 'bold' }}>
                  تنبيه هام: يرجى تحديث اسم Nouble الخاص بك ليكون بدون مسافات للحفاظ على حسابك.
                </Text>
              ) : (
                <>
                  <Text style={styles.boldText}>{item.sender?.full_name || 'مستخدم'}</Text>
                  {' '}{cfg.label}
                </>
              )}
           </Text>
           <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
        </View>

        {/* Post Thumbnail Area */}
        {item.post?.media_urls?.[0] && (
          <Image source={{ uri: item.post.media_urls[0] }} style={styles.thumb} contentFit="cover" />
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>الإشعارات</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {loading && notifs.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 50 }} size="large" />
        ) : (
          <FlatList
            data={notifs}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="heart-dislike-outline" size={70} color="#1A1A1A" />
                <Text style={styles.emptyTxt}>لا توجد إشعارات</Text>
                <Text style={styles.emptySubTxt}>نشاطاتك وتفاعلاتك ستظهر هنا</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────
//  🔔 NotificationBell
// ─────────────────────────────────────────────────────────────────
export const NotificationBell = () => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const fetchCount = async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user?.id)
      .eq('is_read', false);
    setUnread(count || 0);
  };

  useEffect(() => {
    fetchCount();
    
    // Realtime listener
    const channelId = `notifs-bell-${user?.id}-${Date.now()}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `receiver_id=eq.${user?.id}`
      }, () => {
        fetchCount();
        animateBell();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const animateBell = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.bellBtn} 
        onPress={() => { setModalVisible(true); setUnread(0); }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="heart" size={28} color={unread > 0 ? '#FF3B6F' : '#FFF'} />
        </Animated.View>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
      <NotificationsModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 0.5, borderBottomColor: '#111' },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  
  notifRow: { flexDirection: 'row-reverse', alignItems: 'center', padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#0a0a0a', gap: 12 },
  notifUnread: { backgroundColor: '#050510' },
  avWrap: { width: 50, height: 50, position: 'relative' },
  av: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#111' },
  avFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  typeBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#000' },
  
  notifContent: { flex: 1, alignItems: 'flex-end', gap: 2 },
  notifText: { color: '#888', fontSize: 13, textAlign: 'right' },
  boldText: { color: '#FFF', fontWeight: 'bold' },
  timeText: { color: '#444', fontSize: 11 },
  thumb: { width: 45, height: 45, borderRadius: 8, backgroundColor: '#111' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 10 },
  emptyTxt: { color: '#333', fontSize: 18, fontWeight: 'bold' },
  emptySubTxt: { color: '#222', fontSize: 14 },

  bellBtn: { position: 'relative', padding: 5 },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#FF3B30', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  badgeTxt: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
});
