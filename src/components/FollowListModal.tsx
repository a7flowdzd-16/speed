import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Image } from 'expo-image';
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
      let query;
      if (type === 'followers') {
        // Find people who FOLLOW this userId (follower_id is the person in the list)
        query = supabase
          .from('follows')
          .select(`
            follower:profiles!follower_id ( id, username, full_name, avatar_url )
          `)
          .eq('following_id', userId);
      } else {
        // Find people this userId FOLLOWS (following_id is the person in the list)
        query = supabase
          .from('follows')
          .select(`
            following:profiles!following_id ( id, username, full_name, avatar_url )
          `)
          .eq('follower_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Extract the nested user object based on the join alias
      const formatted = data?.map((item: any) => type === 'followers' ? item.follower : item.following) || [];
      setUsers(formatted);
      
      // Check which of these the current user follows
      if (currentUser) {
        const { data: myFollowing } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUser.id);
        
        const myFollowingIds = new Set(myFollowing?.map(f => f.following_id) || []);
        const states: Record<string, boolean> = {};
        formatted.forEach(u => {
          if (u) states[u.id] = myFollowingIds.has(u.id);
        });
        setFollowingStates(states);
      }
    } catch (err) {
      console.error('Error loading follow list:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (targetId: string) => {
    if (!currentUser) return;
    const isCurrentlyFollowing = followingStates[targetId];

    try {
      if (isCurrentlyFollowing) {
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetId);
        setFollowingStates(prev => ({ ...prev, [targetId]: false }));
      } else {
        await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: targetId });
        setFollowingStates(prev => ({ ...prev, [targetId]: true }));
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        <View style={styles.userInfo}>
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} contentFit="cover" />
          <View style={styles.txtWrap}>
            <Text style={styles.username}>@{item.username || 'nouble_user'}</Text>
            <Text style={styles.fullName}>{item.full_name}</Text>
          </View>
        </View>

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
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{type === 'followers' ? 'المتابعون' : 'يتابع'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={item => item?.id || Math.random().toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={60} color="#1A1A1A" />
                <Text style={styles.emptyTxt}>لا توجد بيانات للعرض</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
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
  unfollowBtn: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333' },
  followBtnTxt: { color: '#000', fontSize: 13, fontWeight: 'bold' },
  unfollowBtnTxt: { color: '#FFF' },
  empty: { flex: 1, alignItems: 'center', marginTop: 100, gap: 10 },
  emptyTxt: { color: '#333', fontSize: 16 },
});
