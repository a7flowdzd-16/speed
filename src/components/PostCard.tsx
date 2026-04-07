import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

const { width } = Dimensions.get('window');

const EMOJIS = ['🔥', '🥰', '🤮', '💸', '🔫'];

interface PostProps {
  post: {
    id: string;
    user_id: string;
    title: string;
    description: string;
    media_type: 'video' | 'images';
    media_urls: string[];
    created_at: string;
    profiles?: {
        full_name: string;
        avatar_url?: string;
    }
  };
}

export const PostCard = ({ post }: PostProps) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Reactions State
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<{ [key: string]: number }>({});
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);

  // Comments State
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postCommentLoading, setPostCommentLoading] = useState(false);
  
  const videoSource = (post.media_type === 'video' && post.media_urls.length > 0) ? post.media_urls[0] : null;
  const player = useVideoPlayer(videoSource, player => {
    player.loop = true;
    player.play();
  });

  useEffect(() => {
    fetchReactions();
  }, []);

  const fetchReactions = async () => {
    try {
      const { data, error } = await supabase
        .from('reactions')
        .select('*')
        .eq('post_id', post.id);

      if (error && error.code !== '42P01') throw error; // Ignore relation doesn't exist yet

      if (data) {
        const counts: { [key: string]: number } = {};
        let myReact = null;
        data.forEach(r => {
          counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
          if (r.user_id === user?.id) myReact = r.reaction_type;
        });
        setReactionCounts(counts);
        setMyReaction(myReact);
      }
    } catch (e: any) {
      console.log('Error fetching reactions:', e.message);
    }
  };

  const handleToggleLike = async () => {
    if (showReactionsMenu) {
        setShowReactionsMenu(false);
        return;
    }
    
    const targetReaction = myReaction === '❤️' ? null : '❤️';
    await submitReaction(targetReaction);
  };

  const submitReaction = async (reaction: string | null) => {
    try {
      // Optimistic Update
      setMyReaction(reaction);
      setShowReactionsMenu(false);

      if (reaction) {
        const { error } = await supabase
          .from('reactions')
          .upsert({ 
             user_id: user?.id, 
             post_id: post.id, 
             reaction_type: reaction 
          }, { onConflict: 'user_id,post_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('user_id', user?.id)
          .eq('post_id', post.id);
        if (error) throw error;
      }
      fetchReactions();
    } catch (e: any) {
      console.log('Reaction Error', e.message);
    }
  };

  const handleOpenComments = async () => {
    setShowComments(true);
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`*, profiles:user_id (full_name, avatar_url)`)
        .eq('post_id', post.id)
        .order('created_at', { ascending: false });

      if (error && error.code !== '42P01') throw error;
      setComments(data || []);
    } catch (e: any) {
      console.log('Fetch Comments Error', e.message);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPostCommentLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          user_id: user?.id,
          post_id: post.id,
          content: newComment.trim()
        })
        .select(`*, profiles:user_id (full_name, avatar_url)`)
        .single();

      if (error) throw error;
      if (data) {
        setComments([data, ...comments]);
        setNewComment('');
      }
    } catch (e: any) {
      console.log('Post Comment Error', e.message);
    } finally {
      setPostCommentLoading(false);
    }
  };
  
  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);

  const renderMedia = () => {
    if (post.media_type === 'video' && videoSource) {
      return (
        <View style={styles.mediaContainer}>
          <VideoView
            style={styles.media}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
          />
        </View>
      );
    }

    if (post.media_type === 'images') {
      return (
        <View>
          <FlatList
            data={post.media_urls}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <Image 
                source={{ uri: item }} 
                style={styles.media} 
                contentFit="cover" 
                transition={200}
                cachePolicy="memory-disk"
              />
            )}
          />
          {post.media_urls.length > 1 && (
            <View style={styles.pagination}>
              {post.media_urls.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === currentIndex ? styles.paginationDotActive : null
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatarPlaceholder}>
          {post.profiles?.avatar_url ? (
            <Image 
              source={{ uri: post.profiles.avatar_url }} 
              style={styles.avatarImage} 
              contentFit="cover" 
            />
          ) : (
            <Ionicons name="person" size={24} color="#FFF" />
          )}
        </View>
        <Text style={styles.username}>{post.profiles?.full_name || 'مستخدم'}</Text>
      </View>

      {renderMedia()}

      <View style={styles.actionsContainer}>
        {/* Reactions Tooltip Menu */}
        {showReactionsMenu && (
          <View style={styles.reactionTooltip}>
            {EMOJIS.map(emoji => (
              <TouchableOpacity key={emoji} onPress={() => submitReaction(emoji)}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.actionButtons}>
            <TouchableOpacity 
                style={styles.actionIcon} 
                onPress={handleToggleLike} 
                onLongPress={() => setShowReactionsMenu(true)}
                delayLongPress={300}
            >
                {myReaction ? (
                    <Text style={{ fontSize: 28, marginTop: -4 }}>{myReaction}</Text>
                ) : (
                    <Ionicons name="heart-outline" size={28} color={colors.text} />
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionIcon} onPress={handleOpenComments}>
                <Ionicons name="chatbubble-outline" size={26} color={colors.text} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionIcon}>
                <Ionicons name="paper-plane-outline" size={26} color={colors.text} />
            </TouchableOpacity>
        </View>
        
        {totalReactions > 0 && (
            <Text style={styles.likesCount}>{totalReactions} تفاعلات</Text>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{post.title}</Text>
        <Text 
          style={styles.description} 
          numberOfLines={isExpanded ? undefined : 2}
        >
          {post.description}
        </Text>
        
        {post.description.length > 80 && (
          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
            <Text style={styles.viewMoreText}>
              {isExpanded ? 'عرض أقل' : 'عرض المزيد...'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* COMMENTS MODAL */}
      <Modal
        visible={showComments}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowComments(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>التعليقات</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.commentsList}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Image 
                      source={{ uri: item.profiles?.avatar_url }} 
                      style={styles.commentAvatar} 
                      contentFit="cover" 
                    />
                    <View style={styles.commentBody}>
                      <Text style={styles.commentUser}>{item.profiles?.full_name || 'مستخدم'}</Text>
                      <Text style={styles.commentText}>{item.content}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyCommentsText}>لا توجد تعليقات بعد. كن أول من يعلق!</Text>
                }
              />
            )}

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="أضف تعليقاً..."
                placeholderTextColor={colors.textSecondary}
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendBtn, !newComment.trim() && { opacity: 0.5 }]} 
                onPress={handlePostComment}
                disabled={postCommentLoading || !newComment.trim()}
              >
                {postCommentLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Ionicons name="arrow-up" size={24} color="#000" />
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 16,
    color: colors.text,
  },
  mediaContainer: {
    width: width,
    height: width * 1.2, 
    backgroundColor: '#000',
  },
  media: {
    width: width,
    height: width * 1.2,
    backgroundColor: colors.inputBackground, 
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 15,
    alignSelf: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: colors.primary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionsContainer: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 5,
    position: 'relative',
    zIndex: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    marginRight: 15,
  },
  likesCount: {
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
    fontSize: 14,
  },
  reactionTooltip: {
    position: 'absolute',
    bottom: 45, 
    left: 15,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  emojiText: {
    fontSize: 28,
    marginHorizontal: 6,
  },
  content: {
    paddingHorizontal: 15,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 5,
  },
  description: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  viewMoreText: {
    color: colors.textSecondary,
    marginTop: 5,
    fontWeight: '600',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  commentsList: {
    padding: 15,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBackground,
    marginRight: 10,
  },
  commentBody: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    padding: 10,
    borderRadius: 10,
    borderTopLeftRadius: 2,
  },
  commentUser: {
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 3,
    fontSize: 13,
  },
  commentText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCommentsText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
    backgroundColor: colors.background,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    color: colors.text,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 40,
    maxHeight: 100,
    marginRight: 10,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
