import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { apiClient, getFileUrl } from '../config/api';
import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 3;

export const PublicProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const { userId } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  const fetchData = async () => {
    try {
      const data = await apiClient.get(`/users/${userId}/profile-data`);
      if (data) {
        setProfile(data.user);
        setPosts(data.posts || []);
        setStats(data.stats);
        
        // Check if current user follows this profile
        if (currentUser?.id && userId !== currentUser.id) {
            const followersData = await apiClient.get(`/users/${userId}/followers?requester_id=${currentUser.id}`);
            const me = followersData.find((f: any) => f.id === currentUser.id);
            setIsFollowing(!!me);
        }
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) fetchData();
  }, [userId, isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const toggleFollow = async () => {
    if (!currentUser) return;
    setLoadingFollow(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiClient.post('/follows/toggle', {
        follower_id: currentUser.id,
        following_id: userId
      });
      setIsFollowing(!isFollowing);
      setStats(prev => ({
        ...prev,
        followers: isFollowing ? prev.followers - 1 : prev.followers + 1
      }));
    } catch (error) {
      console.error('Follow toggle error:', error);
    } finally {
      setLoadingFollow(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.mainInfo}>
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: getFileUrl(profile?.avatar_url) }} 
            style={styles.avatar} 
          />
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.posts}</Text>
            <Text style={styles.statLabel}>منشور</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.followers}</Text>
            <Text style={styles.statLabel}>متابع</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.following}</Text>
            <Text style={styles.statLabel}>يتابع</Text>
          </View>
        </View>
      </View>

      <View style={styles.bioContainer}>
        <Text style={styles.fullName}>{profile?.full_name || 'مستخدم نوبل'}</Text>
        <Text style={styles.username}>@{profile?.username || 'user'}</Text>
        {profile?.bio && <Text style={styles.bioText}>{profile.bio}</Text>}
        
        {profile?.link_1_url && (
            <TouchableOpacity style={styles.linkRow}>
                <Ionicons name="link-outline" size={14} color={colors.primary} />
                <Text style={styles.linkText}>{profile.link_1_title || profile.link_1_url}</Text>
            </TouchableOpacity>
        )}
      </View>

      {userId !== currentUser?.id && (
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.followBtn, isFollowing && styles.followingBtn]} 
            onPress={toggleFollow}
            disabled={loadingFollow}
          >
            {loadingFollow ? <ActivityIndicator size="small" color={isFollowing ? "#FFF" : "#000"} /> : (
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {isFollowing ? 'متابع' : 'متابعة'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.msgBtn} onPress={() => navigation.navigate('ChatRoom', { recipient: profile })}>
            <Text style={styles.msgBtnText}>رسالة</Text>
          </TouchableOpacity>

        </View>
      )}
      
      <View style={styles.gridHeader}>
        <Ionicons name="grid-outline" size={20} color={colors.primary} />
        <View style={styles.gridLine} />
      </View>
    </View>
  );

  const renderPost = ({ item, index }: { item: any; index: number }) => {
    const thumb = item.media?.[0]?.media_url;
    return (
      <TouchableOpacity 
        style={styles.gridItem}
        onPress={() => navigation.navigate('UserFeedScreen', { posts, initialIndex: index, title: profile.full_name })}
      >
        <Image 
          source={{ uri: getFileUrl(thumb) }} 
          style={styles.gridImage} 
          contentFit="cover"
        />
        {item.media?.length > 1 && (
            <View style={styles.multiBadge}>
                <Ionicons name="copy" size={12} color="#FFF" />
            </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{profile?.full_name}</Text>
          <TouchableOpacity style={styles.backBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={item => item.id.toString()}
          numColumns={3}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="camera-outline" size={50} color="#222" />
              <Text style={styles.emptyText}>لا توجد منشورات بعد</Text>
            </View>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  topNav: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 15,
    height: 50
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  listContainer: { paddingBottom: 50 },
  headerContent: { paddingHorizontal: 20, paddingTop: 10 },
  mainInfo: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  avatarContainer: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatar: { width: '100%', height: '100%', borderRadius: 40, backgroundColor: '#111' },
  statsContainer: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'space-around', marginRight: 10 },
  statBox: { alignItems: 'center' },
  statNum: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  bioContainer: { marginTop: 15, alignItems: 'flex-end' },
  fullName: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  username: { color: '#555', fontSize: 13, marginTop: 2 },
  bioText: { color: '#DDD', fontSize: 14, marginTop: 6, lineHeight: 20, textAlign: 'right' },
  linkRow: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 8, gap: 5 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '500' },
  actionRow: { flexDirection: 'row-reverse', gap: 10, marginTop: 20 },
  followBtn: { flex: 1, height: 38, backgroundColor: colors.primary, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  followingBtn: { backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#333' },
  followBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  followingBtnText: { color: '#FFF' },
  msgBtn: { flex: 1, height: 38, backgroundColor: '#1A1A1A', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  msgBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  gridHeader: { marginTop: 25, alignItems: 'center', gap: 10 },
  gridLine: { width: '100%', height: 1, backgroundColor: '#111' },
  gridItem: { width: COLUMN_WIDTH - 2, height: COLUMN_WIDTH - 2, margin: 1, position: 'relative' },
  gridImage: { width: '100%', height: '100%', backgroundColor: '#050505' },
  multiBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', padding: 4, borderRadius: 4 },
  emptyState: { height: 200, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { color: '#444', fontSize: 14 }
});
