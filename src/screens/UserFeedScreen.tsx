import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, FlatList, ViewToken, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../config/api';
import { PostCard } from '../components/PostCard';
import { colors } from '../theme/colors';


export const UserFeedScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  
  const { userId, initialPostId, posts: passedPosts, initialIndex, title } = route.params || {};

  const [posts, setPosts] = useState<any[]>(passedPosts || []);
  const [loading, setLoading] = useState(!passedPosts);
  const [activeId, setActiveId] = useState<string | null>(initialPostId || (passedPosts && initialIndex !== undefined ? passedPosts[initialIndex]?.id : null));

  useEffect(() => {
    if (!passedPosts && userId) {
      loadUserPosts();
    } else if (passedPosts && initialIndex !== undefined) {
      // Small delay to ensure FlatList is ready for scrolling
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [userId, passedPosts]);

  const loadUserPosts = async () => {
    try {
      const data = await apiClient.get(`/users/${userId}/profile-data`);
      if (data && data.posts) {
        setPosts(data.posts);
        if (initialPostId) {
            const idx = data.posts.findIndex((p: any) => p.id === initialPostId);
            if (idx !== -1) {
                setTimeout(() => flatListRef.current?.scrollToIndex({ index: idx, animated: false }), 100);
            }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) setActiveId(viewableItems[0].item.id);
  }).current;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{title || 'المنشورات'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => <PostCard post={item} isActive={item.id === activeId} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
        showsVerticalScrollIndicator={false}
        getItemLayout={(data, index) => ({
          length: Dimensions.get('window').width * 1.25 + 150, // Estimate PostCard height
          offset: (Dimensions.get('window').width * 1.25 + 150) * index,
          index,
        })}
      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 10 },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 5 },
});
