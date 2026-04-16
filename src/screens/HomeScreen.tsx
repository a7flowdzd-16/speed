import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient, getFileUrl } from '../config/api';
import { PostCard } from '../components/PostCard';
import { NotificationBell } from '../components/NotificationsModal';
import { colors } from '../theme/colors';
import { useAuth } from '../providers/AuthProvider';
import { useStoryUpload } from '../providers/StoryUploadProvider';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CreateMenuModal } from '../components/CreateMenuModal';



export const HomeScreen = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const { user } = useAuth();
  const { isUploading } = useStoryUpload();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Use a second useEffect to react to the global isUploading status
  useEffect(() => {
    if (!isUploading) {
      fetchStories(); // Refresh when upload completes
    }
  }, [isUploading]);

  const fetchPosts = async () => {
    try {
      const data = await apiClient.get('/posts', { current_user_id: user?.id });
      if (data) setPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  useFocusEffect(
    useCallback(() => {
      fetchStories();
    }, [user])
  );

  useEffect(() => { 
    fetchPosts(); 
    fetchStories();

    return () => { };
  }, [user]);

  const fetchStories = async () => {
    if (!user) return;

    try {
      const storiesData = await apiClient.get('/stories');
      
      if (!storiesData || storiesData.error || !Array.isArray(storiesData)) return;

      const myStoryGroup = storiesData.find((g: any) => g.user_id === user.id);
      
      const friendsStories = storiesData
        .filter((g: any) => g.user_id !== user.id)
        .map((s: any) => ({
          id: s.user_id,
          name: s.username || s.full_name || 'مستخدم',
          image: s.avatar_url ? getFileUrl(s.avatar_url) : `https://i.pravatar.cc/150?u=${s.user_id}`,
          haveStory: true,
          isMe: false,
          hasUnseen: false, 
        }));

      // Find my avatar: priority API > Context > Pravatar
      const myAvatar = myStoryGroup?.avatar_url 
        ? getFileUrl(myStoryGroup.avatar_url) 
        : (user?.avatar_url ? getFileUrl(user.avatar_url) : `https://i.pravatar.cc/150?u=${user.id}`);

      setStories([
        { 
          id: 'me', 
          name: 'قصتك', 
          image: myAvatar, 
          isMe: true, 
          haveStory: !!myStoryGroup, 
          hasUnseen: false 
        },
        ...friendsStories
      ]);
    } catch (err) {
      console.error('Error fetching stories:', err);
    }
  };

  const onRefresh = () => { 
    setRefreshing(true); 
    fetchPosts(); 
    fetchStories();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) setActivePostId(viewableItems[0].item.id);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const renderHeader = () => (
    <View style={styles.storiesContainer}>
      <FlatList
        data={stories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.storiesList}
        renderItem={({ item }) => (
          <View style={styles.storyWrap}>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => {
                if (item.haveStory) {
                  navigation.navigate('StoryViewer', { userId: item.id === 'me' ? user?.id : item.id });
                } else if (item.isMe) {
                  if (isUploading) return; // Prevent double trigger
                  navigation.navigate('StoryCamera');
                }
              }}
            >
              <View style={[
                  styles.storyRing, 
                  item.haveStory && (item.isMe || item.hasUnseen ? styles.storyRingActive : styles.storyRingSeen), 
                  (item.isMe && isUploading) && { borderColor: 'rgba(255,255,255,0.1)' }
                ]}>
                <Image source={{ uri: item.image }} style={styles.storyImg} contentFit="cover" />
                {(item.isMe && isUploading) && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            {item.isMe && !isUploading && (
              <TouchableOpacity 
                style={styles.addStoryBadge} 
                onPress={() => navigation.navigate('StoryCamera')}
              >
                <Ionicons name="add" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.storyName} numberOfLines={1}>
              {item.isMe && isUploading ? 'جاري الرفع...' : item.name}
            </Text>
          </View>
        )}
      />
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => setShowCreateMenu(true)}
            activeOpacity={0.7}
            style={styles.headerIcon}
          >
            <Ionicons name="add-circle-outline" size={28} color="#FFF" />
          </TouchableOpacity>
          <NotificationBell />
        </View>
        <Image 
          source={require('../../assets/nouble-svg.svg')} 
          style={styles.logoIcon} 
          contentFit="contain"
        />
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={posts}
        ListHeaderComponent={renderHeader}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard 
            post={item} 
            isActive={activePostId === item.id} 
          />
        )}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        windowSize={5}
      />

      <CreateMenuModal 
        visible={showCreateMenu} 
        onClose={() => setShowCreateMenu(false)} 
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
  headerRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 15,
  },
  headerIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    width: 60,
    height: 30,
  },
  storiesContainer: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#111',
  },
  storiesList: {
    paddingHorizontal: 15,
    gap: 15,
  },
  storyWrap: {
    alignItems: 'center',
    width: 80,
  },
  storyRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  storyRingActive: {
    borderColor: colors.primary, // Using Snapchat yellow from theme
  },
  storyRingSeen: {
    borderColor: 'rgba(255,255,255,0.4)',
  },
  storyImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#222',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyName: {
    color: '#FFF',
    fontSize: 11,
    textAlign: 'center',
  },
  addStoryBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
});
