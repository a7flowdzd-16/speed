import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { apiClient, getFileUrl } from '../config/api';
import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';

// ─────────────────────────────────────────────────────────────────
//  🎨 Notification types configuration
// ─────────────────────────────────────────────────────────────────
const NOTIF_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  like:        { icon: 'heart',        color: '#FF3B6F', label: 'أعجب بمنشورك' },
  comment:     { icon: 'chatbubble',   color: '#4A90FF', label: 'علّق على منشورك' },
  follow:      { icon: 'person-add',   color: colors.primary, label: 'بدأ متابعتك' },
  follow_back: { icon: 'people',       color: '#00FF9D', label: 'قام برد المتابعة لك' },
  system:      { icon: 'notifications', color: '#FFD700', label: 'تنبيه النظام' },
};


const timeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `${Math.floor(diff / 60)}د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}س`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}ي`;
  return new Date(dateStr).toLocaleDateString('ar');
};

export const NotificationsScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifs = async () => {
    if (!user) return;
    try {
      const data = await apiClient.get('/notifications', { user_id: user.id });
      setNotifs(Array.isArray(data) ? data : []);
      
      // Mark all as read after fetching
      markAsRead();
    } catch (err) {
      console.error('Fetch notifs error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async () => {
    if (!user?.id) return;
    try {
        await apiClient.put('/notifications/mark-as-read', { user_id: user.id });
    } catch (err) {
        console.error('Mark as read error:', err);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [user]);


  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifs();
  };

  const handleToggleFollow = async (item: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Call MySQL backend for follow toggle
      const res = await apiClient.post('/follows/toggle', {
        follower_id: user?.id,
        following_id: item.actor_id
      });

      // Update local state based on response state
      setNotifs(prev => prev.map(n => 
        n.actor_id === item.actor_id 
          ? { ...n, following_back: res.state === 'followed' ? 1 : 0 } 
          : n
      ));
    } catch (error) {
      console.error('Follow toggle error:', error);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const cfg = NOTIF_CONFIG[item.type] || NOTIF_CONFIG.like;
    const isFollow = item.type === 'follow' || item.type === 'follow_back';
    const thumbUrl = item.post_thumbnail ? getFileUrl(item.post_thumbnail) : null;

    return (
      <View style={[styles.notifRow, !item.is_read && styles.unreadBG]}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('UserProfile', { userId: item.actor_id })}
          style={styles.avatarWrap}
        >
          <Image 
            source={{ uri: getFileUrl(item.actor_avatar) || `https://i.pravatar.cc/150?u=${item.actor_id}` }} 
            style={styles.avatar} 
          />
          <View style={[styles.typeBadge, { backgroundColor: cfg.color }]}>
            <Ionicons name={cfg.icon as any} size={10} color="#000" />
          </View>
        </TouchableOpacity>

        <View style={styles.textWrap}>
          <Text style={styles.notifText} numberOfLines={3}>
            <Text style={styles.actorName}>@{item.actor_username || 'nouble_user'}</Text>
            {' '}{cfg.label}
            { (item.type === 'comment' || item.type === 'mention') && item.content && (
              <Text style={styles.commentPreview}>: "{item.content}"</Text>
            )}
            {' '}<Text style={styles.timeTag}>{timeAgo(item.created_at)}</Text>
          </Text>
        </View>

        {isFollow ? (
          <TouchableOpacity 
            style={[styles.actionBtn, item.following_back > 0 && styles.followingBtn]} 
            onPress={() => handleToggleFollow(item)}
          >
            <Text style={[styles.actionBtnTxt, item.following_back > 0 && styles.followingBtnTxt]}>
              {item.following_back > 0 ? 'يتابع' : 'رد المتابعة'}
            </Text>
          </TouchableOpacity>
        ) : thumbUrl ? (
          <TouchableOpacity onPress={() => navigation.navigate('PostDetail', { postId: item.post_id })}>
            <Image source={{ uri: thumbUrl }} style={styles.postThumb} contentFit="cover" />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="chevron-forward" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>النشاط</Text>
            <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
        ) : (
          <FlatList
            data={notifs}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={60} color="#222" />
                <Text style={styles.emptyTxt}>لا توجد تنبيهات بعد</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 15,
    height: 60,
    borderBottomWidth: 0.5,
    borderBottomColor: '#111'
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  listContent: { paddingVertical: 10 },
  notifRow: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12,
    gap: 12 
  },
  unreadBG: { backgroundColor: 'rgba(255, 252, 0, 0.03)' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#111' },
  typeBadge: { 
    position: 'absolute', 
    bottom: -2, 
    right: -2, 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000'
  },
  textWrap: { flex: 1, alignItems: 'flex-end' },
  notifText: { color: '#DDD', fontSize: 13, textAlign: 'right', lineHeight: 18 },
  actorName: { color: '#FFF', fontWeight: 'bold' },
  commentPreview: { color: '#888', fontStyle: 'italic' },
  timeTag: { color: '#555', fontSize: 11 },
  postThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#111' },
  actionBtn: { 
    backgroundColor: colors.primary, 
    paddingHorizontal: 15, 
    paddingVertical: 7, 
    borderRadius: 8 
  },
  followingBtn: { 
    backgroundColor: 'transparent', 
    borderWidth: 1, 
    borderColor: '#333' 
  },
  actionBtnTxt: { color: '#000', fontSize: 12, fontWeight: 'bold' },
  followingBtnTxt: { color: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, alignItems: 'center', marginTop: 150, gap: 10 },
  emptyTxt: { color: '#333', fontSize: 16 },
});
