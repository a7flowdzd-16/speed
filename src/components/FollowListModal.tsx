import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { apiClient, getFileUrl } from '../config/api';
import { colors } from '../theme/colors';
import { useAuth } from '../providers/AuthProvider';
import * as Haptics from 'expo-haptics';

interface FollowListModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
}

export const FollowListModal = ({ visible, onClose, userId, type }: FollowListModalProps) => {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible && userId) {
      loadList();
    }
  }, [visible, userId, type]);

  const loadList = async () => {
    setLoading(true);
    try {
      // Fetch list from MySQL backend (Note: You might need to create an endpoint for this)
      // For now, we assume search or specialized user routes can handle this.
      // Since I haven't created GET /users/:id/followers yet, I should probably do that in the backend.
      // But for speed, I'll use the existing /search or similar if possible.
      // Actually, I'll update users.js in the backend to support /:id/followers and /:id/following.
      
      const data = await apiClient.get(`/users/${userId}/${type}`);
      if (data && Array.isArray(data)) {
        setUsers(data);
        
        // Sync following states
        const states: Record<string, boolean> = {};
        data.forEach(u => {
            states[u.id] = !!u.is_following; // Backend should return this
        });
        setFollowingStates(states);
      }
    } catch (err) {
      console.error(`Error loading ${type}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (targetId: string) => {
    if (!currentUser) return;
    const isCurrentlyFollowing = followingStates[targetId];

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const response = await apiClient.post('/follows/toggle', {
        follower_id: currentUser.id,
        following_id: targetId
      });

      if (response && response.state) {
          setFollowingStates(prev => ({ ...prev, [targetId]: response.state === 'followed' }));
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    if (!item) return null;
    const isMe = item.id === currentUser?.id;
    const amFollowing = followingStates[item.id];

    return (
      <View style={styles.userRow}>
        {!isMe && (
          <TouchableOpacity 
            style={[styles.followBtn, amFollowing && styles.unfollowBtn]} 
            onPress={() => toggleFollow(item.id)}
          >
            <Text style={[styles.followBtnTxt, amFollowing && styles.unfollowBtnTxt]}>
              {amFollowing ? 'إلغاء المتابعة' : 'متابعة'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.userInfo}>
          <View style={styles.txtWrap}>
            <Text style={styles.username}>@{item.username}</Text>
            <Text style={styles.fullName}>{item.full_name}</Text>
          </View>
          <Image source={{ uri: getFileUrl(item.avatar_url) }} style={styles.avatar} contentFit="cover" />
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 10), paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{type === 'followers' ? 'المتابعون' : 'يتابع'}</Text>
          <View style={{ width: 34 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={item => item?.id?.toString() || Math.random().toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={60} color="#111" />
                <Text style={styles.emptyTxt}>لا توجد بيانات للعرض</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 0.5, 
    borderBottomColor: '#111' 
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  listContent: { paddingHorizontal: 20, paddingTop: 10 },
  userRow: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 12 
  },
  userInfo: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#111', marginLeft: 15 },
  txtWrap: { alignItems: 'flex-end', flex: 1 },
  username: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  fullName: { color: '#666', fontSize: 13, marginTop: 2 },
  followBtn: { 
    backgroundColor: colors.primary, 
    paddingHorizontal: 20, 
    paddingVertical: 8, 
    borderRadius: 8 
  },
  unfollowBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333' },
  followBtnTxt: { color: '#000', fontSize: 13, fontWeight: 'bold' },
  unfollowBtnTxt: { color: '#FFF' },
  empty: { flex: 1, alignItems: 'center', marginTop: 100, gap: 10 },
  emptyTxt: { color: '#222', fontSize: 16 },
});
