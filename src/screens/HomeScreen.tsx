import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { PostCard } from '../components/PostCard';
import { colors } from '../theme/colors';
import { useAuth } from '../providers/AuthProvider';

export const HomeScreen = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth(); 

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (full_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
      } else if (data) {
        setPosts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  // Mock data so you can see the UI immediately before setting up the Supabase tables
  const displayPosts = posts.length > 0 ? posts : [
    {
      id: 'mock1',
      user_id: user?.id || 'uid1',
      title: 'مزاد ساعة فاخرة',
      description: 'هذه سلسلة من أفضل الساعات الكلاسيكية. شاهد التفاصيل بالكامل لمعرفة سعر البدء. الساعة لم تلبس من قبل وهي جديدة تماماً وتم استيرادها خصيصاً لهذا المزاد. لا تفوتوا الفرصة!',
      media_type: 'images',
      media_urls: [
        'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=800',
        'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?q=80&w=800'
      ],
      created_at: new Date().toISOString(),
      profiles: { full_name: 'أحمد محمود' }
    },
    {
      id: 'mock2',
      user_id: user?.id || 'uid2',
      title: 'بث قادم: سيارات كلاسيكية',
      description: 'فيديو حصري لاستعراض السيارة قبل بدء المزاد عليها. ننتظركم الليلة!',
      media_type: 'video',
      media_urls: [
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
      ],
      created_at: new Date().toISOString(),
      profiles: { full_name: 'Auto Auctions' }
    }
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0', // Slight gray to clearly separate multiple PostCards
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  }
});
