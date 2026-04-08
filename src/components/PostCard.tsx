import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Animated, Easing, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { saveNotification } from '../lib/notifications';
import { DynamicBottomSheet, DynamicBottomSheetRef } from './DynamicBottomSheet';
import { LiveAvatar } from './LiveAvatar';

const { width, height } = Dimensions.get('window');
const POST_HEIGHT   = width * 1.25;
const REACTION_EMOJIS = ['💸', '🤮', '🥰', '❤️', '🔥', '👏'];
const ALL_EMOJIS      = REACTION_EMOJIS; // Using the exact requested order as the base

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

  // If starry mode is toggled OFF globally, ensure it resets if it was revealed
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
      <Image source={{ uri: item.profiles?.avatar_url }} style={styles.commentAvatar} />
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
//  👏 ClapAnimation (Centered Pop)
// ─────────────────────────────────────────────────────────────────
const ClapAnimation = ({ onDone }: { onDone: () => void }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.5, friction: 4, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(scale, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(onDone);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.clapCenter, { transform: [{ scale }], opacity }]}>
        <Text style={{ fontSize: 80 }}>👏</Text>
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────
//  ✅ Media Helpers
// ─────────────────────────────────────────────────────────────────
const VideoItem = ({ uri, isActive, onDoubleTap }: { uri: string; isActive: boolean; onDoubleTap: () => void }) => {
  const isFocused = useIsFocused();
  const [isMuted, setIsMuted] = useState(false);
  const [isPausedManually, setIsPausedManually] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const lastTap = useRef(0);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (isActive && isFocused && !isPausedManually) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isFocused, isPausedManually]);

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onDoubleTap();
    }
    lastTap.current = now;
    if (showOverlay) setShowOverlay(false);
  };

  const handleLongPress = () => {
    setIsPausedManually(true);
    setShowOverlay(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  return (
    <View style={styles.fullMedia}>
      <Pressable 
        style={styles.fullMedia}
        onPress={handlePress} 
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        <VideoView style={styles.fullMedia} player={player} contentFit="cover" nativeControls={false} />
        
        {showOverlay && (
          <BlurView intensity={20} tint="dark" style={styles.videoOverlay}>
            <View style={styles.overlayInner}>
              <TouchableOpacity style={styles.overlayCircle} onPress={() => setIsMuted(!isMuted)}>
                <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={32} color="#FFF" />
                <Text style={styles.overlayLabel}>{isMuted ? "إلغاء الكتم" : "كتم الصوت"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.overlayCircle, { backgroundColor: colors.primary }]} onPress={() => { setIsPausedManually(false); setShowOverlay(false); }}>
                <Ionicons name="play" size={32} color="#000" />
                <Text style={[styles.overlayLabel, { color: '#000' }]}>إكمال</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        )}
      </Pressable>
    </View>
  );
};

const EmojiParticle = ({ emoji, dx, dy, onDone }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start(onDone); }, []);
  return <Animated.Text style={[styles.particle, { transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) }, { scale: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1.5, 0.5] }) }], opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }) }]}>{emoji}</Animated.Text>;
};

const EmojiExplosion = ({ emoji, onComplete }: any) => {
  const COUNT = 8;
  const [alive, setAlive] = useState(COUNT);
  useEffect(() => { if (alive <= 0) onComplete(); }, [alive]);
  const pData = Array.from({ length: COUNT }, (_, i) => ({ id: i, dx: Math.cos((i / COUNT) * 2 * Math.PI) * 70, dy: Math.sin((i / COUNT) * 2 * Math.PI) * 70 }));
  return <View style={styles.explosionCenter} pointerEvents="none">{pData.map(p => <EmojiParticle key={p.id} emoji={emoji} dx={p.dx} dy={p.dy} onDone={() => setAlive(n => Math.max(0, n-1))} />)}</View>;
};

// ─────────────────────────────────────────────────────────────────
//  Main PostCard
// ─────────────────────────────────────────────────────────────────
export const PostCard = ({ post, isActive = false, isLive = false }: any) => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const lastTapRef = useRef(0);
  const isCreator = user?.id === post.user_id;

  const [imgIdx, setImgIdx] = useState(0);
  const [myReact, setMyReact] = useState<string | null>(null);
  const [reacts, setReacts] = useState<any[]>([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const [boom, setBoom] = useState<{ emoji: string; k: number } | null>(null);
  const [showRS, setShowRS] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newC, setNewC] = useState('');
  const [loadingC, setLoadingC] = useState(false);
  const [syncingStarry, setSyncingStarry] = useState(false);

  const [isStarryMode, setIsStarryMode] = useState(post.is_starry_mode_enabled || false);
  const [showClap, setShowClap] = useState(false);

  const commentSheetRef = useRef<DynamicBottomSheetRef>(null);

  useEffect(() => { loadR(); }, [post.id]);

  const loadR = async () => {
    const { data } = await supabase.from('reactions').select('*, profiles:user_id(full_name, avatar_url)').eq('post_id', post.id);
    if (data) { setReacts(data); setMyReact(data.find((r:any) => r.user_id === user?.id)?.reaction_type || null); }
  };

  const submitR = async (e: string | null) => {
    setShowEmojis(false); if (e) setBoom({ emoji: e, k: Date.now() });
    setMyReact(e);
    if (e) {
      await supabase.from('reactions').upsert(
        { user_id: user?.id, post_id: post.id, reaction_type: e },
        { onConflict: 'user_id,post_id' }
      );
      await saveNotification(user!.id, post.user_id, 'like', post.id);
    } else {
      await supabase.from('reactions').delete().eq('user_id', user?.id).eq('post_id', post.id);
    }
    loadR();
  };

  const openC = async () => {
    setShowComments(true); setLoadingC(true);
    const { data } = await supabase.from('posts').select('is_starry_mode_enabled').eq('id', post.id).single();
    if (data) setIsStarryMode(data.is_starry_mode_enabled);

    const { data: cmts } = await supabase.from('comments').select('*, profiles:user_id(full_name, avatar_url)').eq('post_id', post.id).order('created_at', { ascending: false });
    if (cmts) setComments(cmts);
    setLoadingC(false);
  };

  const toggleStarryMode = async () => {
    if (syncingStarry) return;
    const previousState = isStarryMode;
    const newState = !isStarryMode;
    setIsStarryMode(newState);
    setSyncingStarry(true);

    try {
      const { error } = await supabase.from('posts').update({ is_starry_mode_enabled: newState }).eq('id', post.id);
      if (error) throw error;
    } catch (err) {
      setIsStarryMode(previousState);
      Alert.alert('خطأ في المزامنة', 'لم يتم تفعيل الوضع النجمي بسبب مشكلة في الاتصال.');
    } finally {
      setSyncingStarry(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }}
          onPress={() => navigation.navigate('UserProfile', { userId: post.user_id })}
          activeOpacity={0.7}
        >
          <LiveAvatar 
            userId={post.user_id} 
            avatarUrl={post.profiles?.avatar_url} 
            size={38} 
            forceLive={isLive}
          />
          <View style={styles.headerText}>
            <Text style={styles.userName}>{post.profiles?.full_name || 'مستخدم'}</Text>
            <Text style={styles.dateText}>{new Date(post.created_at).toLocaleDateString()}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowRS(true)} style={{ padding: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      <View style={styles.mediaFrame}>
        {post.media_type === 'video' ? (
          <VideoItem 
            uri={post.media_urls[0]} 
            isActive={isActive} 
            onDoubleTap={() => { setShowClap(true); submitR('👏'); }} 
          />
        ) : (
          <Pressable 
            style={styles.fullMedia}
            onPress={() => {
              const now = Date.now();
              if (now - lastTapRef.current < 300) { setShowClap(true); submitR('👏'); }
              lastTapRef.current = now;
            }}
          >
            <FlatList 
              data={post.media_urls} 
              horizontal 
              pagingEnabled 
              showsHorizontalScrollIndicator={false}
              onScroll={e => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / width))} 
              renderItem={({ item }) => (
                <Image 
                  source={{ uri: item }} 
                  style={styles.fullMedia} 
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={200}
                />
              )} 
              keyExtractor={(item, index) => `${item}-${index}`}
            />
          </Pressable>
        )}
        {showClap && <ClapAnimation onDone={() => setShowClap(false)} />}
      </View>

      <View style={styles.actionsWrap}>
        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            <View style={styles.likeBtnWrap}>
              {boom && <EmojiExplosion key={boom.k} emoji={boom.emoji} onComplete={() => setBoom(null)} />}
              {showEmojis && (
                <View style={styles.instaBar}>
                  {ALL_EMOJIS.map(e => (
                    <TouchableOpacity key={e} onPress={() => submitR(e)} style={styles.emojiItem}>
                      <Text style={[styles.emojiTxt, myReact === e && { transform:[{scale:1.3}] }]}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity 
                style={styles.iconBtn} 
                onPress={() => { 
                  if (showEmojis) setShowEmojis(false); 
                  else { 
                    const n = myReact ? null : '❤️'; 
                    if (n) setBoom({ emoji: '❤️', k: Date.now() }); 
                    submitR(n); 
                  } 
                }} 
                onLongPress={() => setShowEmojis(true)} 
                delayLongPress={300}
              >
                <Text style={styles.aEmoji}>{myReact || <Ionicons name="heart-outline" size={28} color="#FFF" />}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={openC}>
              <Ionicons name="chatbubble-outline" size={26} color="#FFF" />
              {comments.length > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{comments.length}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}><Ionicons name="paper-plane-outline" size={26} color="#FFF" /></TouchableOpacity>
          </View>
          <Ionicons name="bookmark-outline" size={26} color="#FFF" />
        </View>
        {reacts.length > 0 && <TouchableOpacity onPress={() => setShowRS(true)}><Text style={styles.rCount}>{reacts.length} تفاعلات ›</Text></TouchableOpacity>}
      </View>

      <View style={styles.textBlock}><Text style={styles.postTitle}>{post.title}</Text><Text style={styles.postDesc} numberOfLines={2}>{post.description}</Text></View>

      {/* MODALS */}
      <DynamicBottomSheet isVisible={showRS} onClose={() => setShowRS(false)} title="التفاعلات">
        <FlatList
          data={reacts}
          style={{ paddingHorizontal: 16 }}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.rRow}>
              <Image source={{ uri: item.profiles?.avatar_url }} style={styles.rAvatar} />
              <Text style={styles.rName}>{item.profiles?.full_name}</Text>
              <Text style={styles.rEmoji}>{item.reaction_type}</Text>
            </View>
          )}
        />
      </DynamicBottomSheet>

      <DynamicBottomSheet 
        ref={commentSheetRef}
        isVisible={showComments} 
        onClose={() => setShowComments(false)} 
        title="التعليقات" 
        initialSnap={0.55}
      >
        <View style={{ flex: 1 }}>
          {isCreator && (
            <View style={{ paddingHorizontal: 16 }}>
              <TouchableOpacity style={[styles.starryToggle, isStarryMode && styles.starryToggleOn]} onPress={toggleStarryMode} disabled={syncingStarry}>
                {syncingStarry ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.starryToggleTxt}>{isStarryMode ? '✨ الوضع النجمي مفعّل للجميع' : '✨ تفعيل الوضع النجمي'}</Text>}
              </TouchableOpacity>
            </View>
          )}
          {loadingC ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => item.id}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
              renderItem={({ item }) => (
                <StarryComment
                  item={item}
                  isStarry={isStarryMode}
                  canDelete={isCreator || user?.id === item.user_id}
                  onDelete={async () => {
                    await supabase.from('comments').delete().eq('id', item.id);
                    setComments(c => c.filter(x => x.id !== item.id));
                  }}
                />
              )}
            />
          )}
          <View style={styles.cInputRow}>
            <TextInput
              style={styles.cInput}
              value={newC}
              onChangeText={setNewC}
              onFocus={() => commentSheetRef.current?.expand()}
              placeholder="أضف تعليقاً..."
              placeholderTextColor="#555"
            />
            <TouchableOpacity
              style={[styles.cSend, !newC.trim() && { opacity: 0.5 }]}
              disabled={!newC.trim()}
              onPress={async () => {
                const content = newC.trim();
                setNewC('');
                const { data } = await supabase
                  .from('comments')
                  .insert({ post_id: post.id, user_id: user?.id, content })
                  .select('*, profiles:user_id(*)')
                  .single();
                if (data) {
                  setComments([data, ...comments]);
                  await saveNotification(user!.id, post.user_id, 'comment', post.id);
                }
              }}
            >
              <Ionicons name="arrow-up" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </DynamicBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#000', marginBottom: 15 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12 },
  avatarWrap: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1, marginRight: 10, alignItems: 'flex-end' },
  userName: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  dateText: { color: '#555', fontSize: 10 },
  mediaFrame: { width, height: POST_HEIGHT, backgroundColor: '#050505' },
  fullMedia: { width, height: '100%' },
  actionsWrap: { paddingHorizontal: 15, paddingTop: 10 },
  actionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  leftActions: { flexDirection: 'row-reverse', gap: 15, alignItems: 'center' },
  iconBtn: { padding: 4 },
  likeBtnWrap: { position: 'relative' },
  instaBar: { position: 'absolute', bottom: 55, right: -10, flexDirection: 'row', backgroundColor: '#1F1F1F', borderRadius: 100, padding: 8, zIndex: 999, minWidth: 230, justifyContent: 'space-around' },
  emojiItem: { padding: 5 },
  emojiTxt: { fontSize: 26 },
  aEmoji: { fontSize: 26, color: '#FFF' },
  rCount: { color: '#AAA', fontSize: 12, marginTop: 8, textAlign: 'right' },
  textBlock: { padding: 15, alignItems: 'flex-end' },
  postTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  postDesc: { color: '#AAA', fontSize: 13, marginTop: 4, textAlign: 'right' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
  sheetContainer: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, maxHeight: height * 0.85 },
  dragHandle: { width: 45, height: 5, backgroundColor: '#333', borderRadius: 10, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  rRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#222', gap: 12 },
  rAvatar: { width: 40, height: 40, borderRadius: 20 },
  rName: { flex: 1, color: '#FFF', textAlign: 'right' },
  rEmoji: { fontSize: 24 },
  commentRow: { flexDirection: 'row-reverse', marginBottom: 15, gap: 10, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentBubble: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 10, alignItems: 'flex-end', overflow: 'hidden' },
  commentUser: { color: '#FFF', fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  commentText: { color: '#CCC', fontSize: 14, textAlign: 'right' },
  inkContainer: { position: 'relative', width: '100%', minHeight: 18 },
  inkBlur: { justifyContent: 'center', alignItems: 'center' },
  inkHint: { color: colors.primary, fontSize: 10, fontWeight: 'bold' },
  star: { position: 'absolute', fontSize: 12 },
  starryToggle: { alignSelf: 'flex-end', backgroundColor: '#1C1C1E', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  starryToggleOn: { backgroundColor: '#1A0A3A', borderColor: colors.primary },
  starryToggleTxt: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  cInputRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15, gap: 10, borderTopWidth: 0.5, borderTopColor: '#222' },
  cInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#FFF', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, textAlign: 'right' },
  cSend: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  explosionCenter: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 1000 } as any,
  particle: { position: 'absolute', fontSize: 22 },
  badge: { position: 'absolute', top: -5, left: -5, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 5 },
  badgeTxt: { color: '#000', fontSize: 9, fontWeight: 'bold' },
  clapCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  overlayInner: { flexDirection: 'row', gap: 30, alignItems: 'center' },
  overlayCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  overlayLabel: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginTop: 4, textAlign: 'center' },
  liveAvatarWrap: { borderWidth: 2, borderColor: '#FF3B30' },
  liveBadgeSmall: { position: 'absolute', bottom: -2, alignSelf: 'center', backgroundColor: '#FF3B30', paddingHorizontal: 4, borderRadius: 3, borderWidth: 1, borderColor: '#000' },
  liveBadgeTxtSmall: { color: '#FFF', fontSize: 7, fontWeight: '900' },
});
