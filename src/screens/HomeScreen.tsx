import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Text } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { PostCard } from '../components/PostCard';
import { NotificationBell } from '../components/NotificationsModal';
import { colors } from '../theme/colors';
import { useAuth } from '../providers/AuthProvider';

export const HomeScreen = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [liveUsers, setLiveUsers] = useState<string[]>([]);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const fetchPosts = async () => {
    try {
      const { data } = await supabase
        .from('posts')
        .select(`*, profiles:user_id(full_name, avatar_url)`)
        .order('created_at', { ascending: false });
      if (data) setPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLiveSessions = async () => {
    const { data } = await supabase
      .from('live_streams')
      .select('user_id')
      .eq('status', 'live');
    if (data) setLiveUsers(data.map(d => d.user_id));
  };

  useEffect(() => { 
    fetchPosts(); 
    fetchLiveSessions();

    const channelId = `home-live-global-${Date.now()}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => {
        fetchLiveSessions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const onRefresh = () => { 
    setRefreshing(true); 
    fetchPosts(); 
    fetchLiveSessions();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) setActivePostId(viewableItems[0].item.id);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header Bar ─── */}
      <View style={styles.headerBar}>
        <NotificationBell />
        <Image 
          source={require('../../assets/nouble-svg.svg')} 
          style={styles.logoIcon} 
          contentFit="contain"
        />
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard 
            post={item} 
            isActive={activePostId === item.id} 
            isLive={liveUsers.includes(item.user_id)}
          />
        )}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        windowSize={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  headerBar: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#111',
  },
  logoIcon: {
    width: 60,
    height: 30,
  },
});
