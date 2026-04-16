import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Animated, Easing, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { useAuth } from '../providers/AuthProvider';
import { getFileUrl, apiClient } from '../config/api';
import { CommentsModal } from './CommentsModal';
import { Video, ResizeMode } from 'expo-av';

const { width, height } = Dimensions.get('window');
const POST_HEIGHT   = width * 1.25;

// ─────────────────────────────────────────────────────────────────
//  ✨ StarParticle
// ─────────────────────────────────────────────────────────────────
const StarParticle = ({ style }: { style?: any }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 1500 + Math.random() * 1000, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 1500 + Math.random() * 1000, useNativeDriver: true }),
    ])).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.8, 0.1] });
  const scale      = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1.2, 0.6] });
  return <Animated.Text style={[styles.star, style, { transform: [{ translateY }, { scale }], opacity }]}>✨</Animated.Text>;
};

// ─────────────────────────────────────────────────────────────────
//  🪄 StarryComment Component
// ─────────────────────────────────────────────────────────────────
const StarryComment = ({ item, isStarry, canDelete, onDelete }: any) => {
  const [revealed, setRevealed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isStarry) {
      setRevealed(false);
      fadeAnim.setValue(1);
    }
  }, [isStarry]);

  const handleReveal = () => {
    if (!isStarry || revealed) return;
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 400,
      easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start(() => setRevealed(true));
  };

  return (
    <View style={styles.commentRow}>
      <Image source={{ uri: getFileUrl(item.profiles?.avatar_url) }} style={styles.commentAvatar} />
      <View style={styles.commentBubble}>
        <Text style={styles.commentUser}>{item.profiles?.full_name || 'مستخدم'}</Text>
        <Pressable onPress={handleReveal} style={styles.inkContainer}>
          <Text style={[styles.commentText, isStarry && !revealed && { color: 'transparent' }]}>{item.content}</Text>
          {isStarry && !revealed && (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
              <BlurView intensity={75} tint="dark" style={styles.inkBlur}>
                <StarParticle style={{ top: 2, left: '15%' }} />
                <StarParticle style={{ top: 6, left: '45%' }} />
                <StarParticle style={{ top: 0, left: '75%' }} />
                <Text style={styles.inkHint}>اضغط للكشف ✨</Text>
              </BlurView>
            </Animated.View>
          )}
        </Pressable>
      </View>
      {canDelete && <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="trash-outline" size={16} color="#444" /></TouchableOpacity>}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────
//  🤍 BigHeartPop
// ─────────────────────────────────────────────────────────────────
const BigHeartPop = ({ onDone }: { onDone: () => void }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.2, friction: 3, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.5, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start(onDone);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale }], opacity }}>
          <Ionicons name="heart" size={100} color="#FFF" />
        </Animated.View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────
//  Main PostCard
// ─────────────────────────────────────────────────────────────────
export const PostCard = ({ post, isActive = false }: any) => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const lastTapRef = useRef(0);
  const isCreator = user?.id === post.user_id;

  const [imgIdx, setImgIdx] = useState(0);
  // State for optimistic UI
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showMenu, setShowMenu] = useState(false);

  const [showComments, setShowComments] = useState(false);

  const [isStarryMode, setIsStarryMode] = useState(post.is_starry_mode_enabled || false);
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isFocused = useIsFocused();
  const timerRef = useRef<any>(null);

  // Sync state when post data changes (important when switching users/accounts)
  useEffect(() => {
    setIsLiked(post.is_liked || false);
    setLikesCount(post.likes_count || 0);
    // Reset play state when moving to a new post
    setIsPaused(false);
  }, [post.id, post.is_liked, post.likes_count, user?.id]);

  const submitLike = async (isDoubleTap = false) => {
    if (!user) return;

    // Save previous state for rollback
    const prevLiked = isLiked;
    const prevCount = likesCount;

    if (isDoubleTap && prevLiked) {
      setShowBigHeart(true);
      setTimeout(() => setShowBigHeart(false), 800);
      return;
    }

    const nextLiked = isDoubleTap ? true : !prevLiked;
    if (nextLiked === prevLiked) return; // No change needed

    // 1. Optimistic Update
    setIsLiked(nextLiked);
    setLikesCount(prevCount + (nextLiked ? 1 : -1));
    
    if (isDoubleTap || nextLiked) {
      setShowBigHeart(true);
      setTimeout(() => setShowBigHeart(false), 800);
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await apiClient.post('/likes/toggle', {
        user_id: user.id,
        post_id: post.id,
        force_like: isDoubleTap ? true : false
      });

      if (result && typeof result.liked === 'boolean') {
        setIsLiked(result.liked);
        if (typeof result.likeCount === 'number') {
          setLikesCount(result.likeCount);
        }
      }
    } catch (error) {
      console.error('Like toggle error:', error);
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const handleMediaPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double Tap detected
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      submitLike(true);
    } else {
      // Potential Single Tap
      timerRef.current = setTimeout(() => {
        setIsPaused(prev => !prev);
        timerRef.current = null;
      }, 250); // Faster response than 300ms
    }
    lastTapRef.current = now;
  };

  const openC = () => {
    setShowComments(true);
  };

  const toggleStarryMode = async () => {
    setIsStarryMode(!isStarryMode);
  };

  const goToProfile = () => {
    navigation.navigate('UserProfile', { userId: post.user_id });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }}
          onPress={goToProfile}
          activeOpacity={0.7}
        >
          <Image 
            source={{ uri: getFileUrl(post.profiles?.avatar_url) }} 
            style={{ width: 38, height: 38, borderRadius: 19 }} 
          />
          <View style={styles.headerText}>
            <Text style={styles.userName}>{post.profiles?.full_name || 'مجهول'}</Text>
            <Text style={styles.dateText}>@{post.profiles?.username || 'nouble'} • {new Date(post.created_at).toLocaleDateString()}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(true)} style={{ padding: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      <View style={styles.mediaFrame}>
        {(post.media && post.media.length > 0) ? (
          <FlatList 
            data={post.media} 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onScroll={e => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / width))} 
            renderItem={({ item, index }) => {
              const finalUri = getFileUrl(item.media_url);
              const isCurrent = isActive && imgIdx === index && isFocused;
              
              return (
                <Pressable 
                  style={[styles.fullMedia, { width }]} 
                  onPress={handleMediaPress}
                  onLongPress={() => setIsPaused(true)}
                  onPressOut={() => {
                    // Only resume if it was forced pause by long press
                    // (This is a bit tricky, but simple version suffices)
                    setIsPaused(false);
                  }}
                  delayLongPress={200}
                >
                  {item.media_type === 'video' ? (
                    <View style={{ flex: 1 }}>
                      <Video 
                        source={{ uri: finalUri }} 
                        style={{ width: '100%', height: '100%' }} 
                        resizeMode={ResizeMode.COVER} 
                        shouldPlay={isCurrent && !isPaused} 
                        isLooping 
                      />
                      {isPaused && (
                         <View style={styles.playOverlay} pointerEvents="none">
                           <BlurView intensity={20} style={styles.playBadgeBg}>
                             <Ionicons name="play" size={40} color="rgba(255,255,255,0.8)" />
                           </BlurView>
                         </View>
                      )}
                    </View>
                  ) : (
                    <Image source={{ uri: finalUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  )}
                </Pressable>
              );
            }} 
            keyExtractor={(item, index) => `${item.media_url}-${index}`}
          />
        ) : null}
        {showBigHeart && <BigHeartPop onDone={() => setShowBigHeart(false)} />}
      </View>

      <View style={styles.actionsWrap}>
        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => submitLike(false)}>
              {isLiked ? <Ionicons name="heart" size={28} color="#FF3B30" /> : <Ionicons name="heart-outline" size={28} color="#FFF" />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }]} onPress={openC}>
              <Ionicons name="chatbubble-outline" size={26} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>
                {post.comments_count || 0}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn}><Ionicons name="paper-plane-outline" size={26} color="#FFF" /></TouchableOpacity>
          </View>
          <Ionicons name="bookmark-outline" size={26} color="#FFF" />
        </View>
        {likesCount > 0 && <Text style={styles.rCount}>{likesCount} إعجابات</Text>}
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.postTitle}>{post.title}</Text>
        <Text style={styles.postDesc} numberOfLines={2}>{post.description}</Text>
      </View>

      <Modal visible={showMenu} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMenu(false)} />
        <View style={styles.menuSheet}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
             <Ionicons name="share-outline" size={22} color="#FFF" />
             <Text style={styles.menuItemTxt}>مشاركة</Text>
          </TouchableOpacity>
          {isCreator && (
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Ionicons name="trash-outline" size={22} color="#FF4D4D" />
              <Text style={[styles.menuItemTxt, { color: '#FF4D4D' }]}>حذف</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      <CommentsModal 
        isVisible={showComments} 
        onClose={() => setShowComments(false)} 
        postId={post.id} 
        userId={user?.id} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#000', marginBottom: 15 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12 },
  headerText: { flex: 1, marginRight: 10, alignItems: 'flex-end' },
  userName: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  dateText: { color: '#555', fontSize: 10 },
  mediaFrame: { width, height: POST_HEIGHT, backgroundColor: '#050505' },
  fullMedia: { width, height: '100%' },
  actionsWrap: { paddingHorizontal: 15, paddingTop: 10 },
  actionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  leftActions: { flexDirection: 'row-reverse', gap: 15, alignItems: 'center' },
  iconBtn: { padding: 4 },
  rCount: { color: '#AAA', fontSize: 12, marginTop: 8, textAlign: 'right' },
  textBlock: { padding: 15, alignItems: 'flex-end' },
  postTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  postDesc: { color: '#AAA', fontSize: 13, marginTop: 4, textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
  menuSheet: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  menuItem: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, gap: 15 },
  menuItemTxt: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  commentRow: { flexDirection: 'row-reverse', marginBottom: 15, gap: 10, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentBubble: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 10, alignItems: 'flex-end' },
  commentUser: { color: '#FFF', fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  commentText: { color: '#CCC', fontSize: 14, textAlign: 'right' },
  inkContainer: { position: 'relative', width: '100%', minHeight: 18 },
  inkBlur: { justifyContent: 'center', alignItems: 'center' },
  inkHint: { color: colors.primary, fontSize: 10, fontWeight: 'bold' },
  star: { position: 'absolute', fontSize: 12 },
  starryToggle: { alignSelf: 'flex-end', backgroundColor: '#1C1C1E', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  starryToggleOn: { backgroundColor: '#1A0A3A', borderColor: colors.primary },
  starryToggleTxt: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  cInputRow: { 
    flexDirection: 'row-reverse', alignItems: 'center', 
    paddingHorizontal: 16, paddingVertical: 12, gap: 10, 
    borderTopWidth: 0.5, borderTopColor: '#222', backgroundColor: '#111' 
  },
  cInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#FFF', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, textAlign: 'right', maxHeight: 100 },
  cSend: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: -5, left: -5, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 5 },
  badgeTxt: { color: '#000', fontSize: 9, fontWeight: 'bold' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  playBadgeBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
