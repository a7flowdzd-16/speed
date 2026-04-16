import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Dimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { saveNotification } from '../lib/notifications';
import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';
import { GridVideoThumbnail } from '../components/GridVideoThumbnail';
import { ProfileQRCodeModal } from '../components/ProfileQRCodeModal';

const { width } = Dimensions.get('window');
const THUMB = width / 3;

type FollowState = 'follow' | 'following' | 'follow_back';

export const UserProfileScreen = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId } = route.params;

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [followState, setFollowState] = useState<FollowState>('follow');
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [showQRView, setShowQRView] = useState(false);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      // Fetch everything in one go from our MySQL backend
      const data = await apiClient.get(`users/${userId}/profile-data`, {
        requester_id: user?.id
      });

      if (data) {
        setProfile({
          full_name: data.full_name,
          username: data.username,
          avatar_url: data.avatar_url,
          bio: data.bio
        });
        setPosts(data.posts || []);
        setFollowersCount(data.followers || 0);
        setFollowingCount(data.following || 0);
        
        // Relationship logic
        if (data.is_following > 0) setFollowState('following');
        else if (data.is_followed_by > 0) setFollowState('follow_back');
        else setFollowState('follow');
      }
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadProfileData();
    }
  }, [userId, user?.id]);

  const handleFollowToggle = async () => {
    if (followLoading || !user) return;
    setFollowLoading(true);

    try {
      // Call MySQL backend for follow toggle
      const res = await apiClient.post('/follows/toggle', {
        follower_id: user.id,
        following_id: userId
      });

      // Update state based on the actual operation performed
      if (res.state === 'followed') {
        setFollowState('following');
        setFollowersCount(n => n + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setFollowState('follow');
        setFollowersCount(n => Math.max(0, n - 1));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Follow toggle error:', error);
      loadProfileData(); // Refresh on error
    } finally {
      setFollowLoading(false);
    }
  };

  const getFollowBtnLabel = () => {
    if (followState === 'following') return 'أتابعه ✓';
    if (followState === 'follow_back') return 'رد المتابعة ↩';
    return 'متابعة +';
  };

  const getFollowBtnStyle = () => {
    if (followState === 'following') return [styles.followBtn, styles.btnFollowing];
    if (followState === 'follow_back') return [styles.followBtn, styles.btnFollowBack];
    return [styles.followBtn, styles.btnFollow];
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back Button and Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#FFF" />
        </TouchableOpacity><Text style={styles.topTitle} numberOfLines={1}>{profile?.username || profile?.full_name}</Text><View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowQRView(true)}>
            <Ionicons name="qr-code-outline" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="menu" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarBorder}>
            {profile?.avatar_url
              ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
              : <View style={styles.avatarFallback}><Ionicons name="person" size={40} color="#333" /></View>
            }
          </View>
          <Text style={styles.profileName}>{profile?.full_name}</Text>
          {profile?.bio && <Text style={styles.profileBio}>{profile.bio}</Text>}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{posts.length}</Text>
            <Text style={styles.statLabel}>منشور</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{followersCount}</Text>
            <Text style={styles.statLabel}>متابع</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{followingCount}</Text>
            <Text style={styles.statLabel}>يتابع</Text>
          </View>
        </View>

        {/* Follow Button */}
        {user?.id !== userId && (
          <TouchableOpacity
            style={getFollowBtnStyle()}
            onPress={handleFollowToggle}
            activeOpacity={0.8}
            disabled={followLoading}
          >
            {followLoading
              ? <ActivityIndicator size="small" color={followState === 'following' ? '#FFF' : '#000'} />
              : <Text style={[styles.followBtnTxt, followState === 'following' && { color: '#DDD' }]}>
                  {getFollowBtnLabel()}
                </Text>
            }
          </TouchableOpacity>
        )}

        {/* Posts Grid */}
        <View style={styles.gridHeader}>
          <Ionicons name="grid-outline" size={20} color="#555" />
          <Text style={styles.gridHeaderTxt}>المنشورات</Text>
        </View>

        <View style={styles.grid}>
          {posts.map(item => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.thumb}
              onPress={() => navigation.navigate('UserFeedScreen', { userId: userId, initialPostId: item.id })}
            >
              {item.media_type === 'video' ? (
                <GridVideoThumbnail uri={item.media_urls[0]} />
              ) : (
                <Image source={{ uri: item.media_urls?.[0] }} style={styles.thumbImg} contentFit="cover" />
              )}
            </TouchableOpacity>
          ))}
          {posts.length === 0 && (
            <View style={styles.noPostsWrap}>
              <Ionicons name="images-outline" size={50} color="#1E1E1E" />
              <Text style={styles.noPostsTxt}>لا توجد منشورات</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {profile && (
        <ProfileQRCodeModal 
          visible={showQRView} 
          onClose={() => setShowQRView(false)} 
          user={{ id: userId, username: profile.username || profile.full_name }} 
        />
      )}
    </View>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#000' },
  topBar:        { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 10 },
  topTitle:      { color: '#FFF', fontSize: 17, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  backBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  headerRightActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, width: 70 },
  iconBtn:       { padding: 4 },
  profileHeader: { alignItems: 'center', paddingVertical: 20 },
  avatarBorder:  { width: 96, height: 96, borderRadius: 48, borderWidth: 2.5, borderColor: colors.primary, padding: 3, marginBottom: 12 },
  avatar:        { width: '100%', height: '100%', borderRadius: 45, backgroundColor: '#111' },
  avatarFallback:{ width: '100%', height: '100%', borderRadius: 45, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  profileName:   { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  profileBio:    { color: '#777', fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  statsRow:      { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#111' },
  statBox:       { alignItems: 'center', flex: 1 },
  statNum:       { color: '#FFF', fontSize: 20, fontWeight: '800' },
  statLabel:     { color: '#555', fontSize: 12, marginTop: 4 },
  statDivider:   { width: 0.5, height: 40, backgroundColor: '#1E1E1E' },
  followBtn:     { marginHorizontal: 20, marginVertical: 16, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  btnFollow:     { backgroundColor: colors.primary },
  btnFollowBack: { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  btnFollowing:  { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333' },
  followBtnTxt:  { color: '#000', fontSize: 15, fontWeight: '700' },
  gridHeader:    { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 15, paddingVertical: 12 },
  gridHeaderTxt: { color: '#555', fontSize: 13, fontWeight: '700' },
  grid:          { flexDirection: 'row', flexWrap: 'wrap' },
  thumb:         { width: THUMB, height: THUMB, padding: 1 },
  thumbImg:      { width: '100%', height: '100%', backgroundColor: '#0D0D0D' },
  playBadge:     { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 4 },
  noPostsWrap:   { width: '100%', alignItems: 'center', paddingTop: 60, gap: 12 },
  noPostsTxt:    { color: '#222', fontSize: 16 },
});
