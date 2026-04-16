import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, ActivityIndicator, 
  TouchableOpacity, TouchableWithoutFeedback, Animated, 
  Platform, SafeAreaView, Alert, PanResponder
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { apiClient, getFileUrl } from '../config/api';
import { useAuth } from '../providers/AuthProvider';
import { BottomSheetModal, BottomSheetFlatList, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useVideoPlayer, VideoView, VideoPlayer as ExpoVideoPlayer } from 'expo-video';

const { width, height } = Dimensions.get('window');

export const StoryViewerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId, initialStories = [], initialIndex = 0 } = route.params || {};
  const { user: currentUser } = useAuth();

  const [stories, setStories] = useState<any[]>(initialStories);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(initialStories.length === 0);
  const [isPaused, setIsPaused] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [storyDuration, setStoryDuration] = useState(5000);
  const [viewers, setViewers] = useState<any[]>([]);

  // Scrubbing & Animation states
  const progressAnim = useRef(new Animated.Value(0)).current;
  const lastProgress = useRef(0);
  const isScrubbing = useRef(false);
  const [activePlayer, setActivePlayer] = useState<ExpoVideoPlayer | null>(null);

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%', '80%'], []);

  // Sync animation value for resumed timing calculation
  useEffect(() => {
    const listener = progressAnim.addListener(({ value }) => {
      lastProgress.current = value;
    });
    return () => {
      progressAnim.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (stories.length === 0 && userId) {
      fetchUserStories();
    }
  }, [userId]);

  const fetchUserStories = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/stories/user/${userId}`);
      if (data && Array.isArray(data) && data.length > 0) {
        setStories(data);
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Error fetching user stories:', err);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const currentStory = stories[currentIndex] || null;

  useEffect(() => {
    if (!currentStory) return;

    if (currentStory.media_type === 'image') {
      setStoryDuration(5000);
      setIsReady(true);
      setActivePlayer(null); // Clear active player if it's an image
    } else {
      setIsReady(false);
    }
    // Reset progress when moving to next story
    progressAnim.setValue(0);
    lastProgress.current = 0;
  }, [currentIndex, currentStory]);

  // Animation logic - Handles both initial play and resumed play after scrubbing
  useEffect(() => {
    if (!currentStory || isPaused || !isReady) {
      progressAnim.stopAnimation();
      return;
    }

    const remainingPercentage = 1 - lastProgress.current;
    const remainingDuration = storyDuration * remainingPercentage;

    if (remainingDuration <= 0) {
      handleNext();
      return;
    }

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: remainingDuration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !isScrubbing.current) {
        handleNext();
      }
    });

    return () => {
      progressAnim.stopAnimation();
    };
  }, [currentIndex, currentStory, isPaused, isReady, storyDuration]);

  // PanResponder for Scrubbing
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      isScrubbing.current = true;
      setIsPaused(true);
    },
    onPanResponderMove: (evt) => {
      const touchX = evt.nativeEvent.pageX;
      const percentage = Math.max(0, Math.min(1, touchX / width));
      
      progressAnim.setValue(percentage);
      lastProgress.current = percentage;

      if (activePlayer && currentStory?.media_type === 'video') {
        const seekTime = (storyDuration / 1000) * percentage;
        activePlayer.currentTime = seekTime;
      }
    },
    onPanResponderRelease: () => {
      isScrubbing.current = false;
      setIsPaused(false);
    },
    onPanResponderTerminate: () => {
      isScrubbing.current = false;
      setIsPaused(false);
    }
  }), [activePlayer, currentStory, storyDuration]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handlePress = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    if (x < width * 0.3) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  const handleLongPress = () => setIsPaused(true);
  const handlePressOut = () => {
    if (!isScrubbing.current && bottomSheetModalRef.current === null) {
      setIsPaused(false);
    }
  };

  const handleDelete = async () => {
    if (!currentStory) return;
    Alert.alert(
      'حذف القصة',
      'هل أنت متأكد من حذف هذه القصة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'حذف', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsPaused(true);
              const { error } = await apiClient.delete(`/stories/${currentStory.id}`);
              if (error) throw new Error(error);
              Alert.alert('تم الحذف', 'تم حذف القصة بنجاح.');
              navigation.goBack();
            } catch (err: any) {
              console.error('Delete Error:', err);
              Alert.alert('خطأ', 'تعذر حذف القصة.');
              setIsPaused(false);
            }
          }
        }
      ]
    );
  };

  const fetchViewers = async () => { setViewers([]); };
  const openViewersModal = () => { setIsPaused(true); fetchViewers(); bottomSheetModalRef.current?.present(); };
  const closeViewersModal = () => { setIsPaused(false); };

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    []
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FFF" /></View>;
  if (stories.length === 0) return null;

  const isMyStory = currentStory.user_id === currentUser?.id;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback 
        onPress={handlePress} 
        onLongPress={handleLongPress} 
        onPressOut={handlePressOut}
        delayLongPress={200}
      >
        <View style={StyleSheet.absoluteFillObject}>
          <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', justifyContent: 'center' }]}>
            {currentStory.media_type === 'video' ? (
                <VideoPlayer 
                  uri={getFileUrl(currentStory.media_url)} 
                  isPaused={isPaused} 
                  onPlayerReady={(p) => setActivePlayer(p)}
                  onReady={(duration) => {
                    const cappedDuration = Math.min(duration, 30000);
                    setStoryDuration(cappedDuration);
                    setIsReady(true);
                  }}
                />
            ) : (
              <Image source={{ uri: getFileUrl(currentStory.media_url) }} style={{ flex: 1 }} contentFit="contain" />
            )}
            
            {/* Overlays */}
            {currentStory.content_json?.overlays?.map((ov: any) => (
              <View 
                key={ov.id} 
                style={[styles.textOverlay, { alignSelf: 'center', top: height / 2 - 20, transform: [{ translateX: ov.x || 0 }, { translateY: ov.y || 0 }, { scale: ov.scale || 1 }, { rotateZ: `${ov.rotation || 0}rad` }] }]} 
                pointerEvents="none"
              >
                <View style={ov.bgStyle === 'highlight' ? styles.highlightTextWrapper : null}>
                  <Text style={[styles.textOverlayContent, { color: ov.color }, ov.bgStyle === 'highlight' && styles.highlightText]}>
                    {ov.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Progress Bars with Scrubbing PanResponder */}
      <View style={styles.progressContainer} {...panResponder.panHandlers}>
        {stories.map((s, index) => {
          const widthInterpolated = index === currentIndex 
            ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
            : (index < currentIndex ? '100%' : '0%');
            
          return (
            <View key={s.id} style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFg, { width: widthInterpolated }]} />
            </View>
          );
        })}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image source={{ uri: currentStory.avatar_url ? getFileUrl(currentStory.avatar_url) : `https://i.pravatar.cc/150?u=${currentStory.user_id}` }} style={styles.avatar} />
          <Text style={styles.username}>{currentStory.full_name || 'مستخدم'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
          {isMyStory && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#FF4B4B" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {isMyStory && (
        <View style={styles.viewersTriggerContainer}>
          <TouchableOpacity style={styles.viewersTriggerBtn} onPress={openViewersModal}>
            <Ionicons name="eye" size={24} color="#FFF" />
            <Text style={styles.viewersCountText}>المشاهدات</Text>
            <Ionicons name="chevron-up" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      <BottomSheetModal ref={bottomSheetModalRef} index={0} snapPoints={snapPoints} onDismiss={closeViewersModal} backdropComponent={renderBackdrop} backgroundStyle={styles.sheetBackground} handleIndicatorStyle={{ backgroundColor: '#888' }}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <Ionicons name="eye" size={20} color="#FFF" />
            <Text style={styles.sheetTitle}>{viewers.length} مشاهدة</Text>
          </View>
          <BottomSheetFlatList
            data={viewers}
            keyExtractor={item => item.profiles.id + item.viewed_at}
            renderItem={({ item }) => (
              <View style={styles.viewerRow}>
                <Image source={{ uri: item.avatar_url ? getFileUrl(item.avatar_url) : `https://i.pravatar.cc/150?u=${item.id}` }} style={styles.viewerAvatar} />
                <Text style={styles.viewerName}>{item.full_name || 'مستخدم'}</Text>
              </View>
            )}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyViewersText}>لا توجد مشاهدات حتى الآن</Text>}
          />
        </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
};

const VideoPlayer = ({ uri, isPaused, onReady, onPlayerReady }: { uri: string, isPaused: boolean, onReady: (duration: number) => void, onPlayerReady: (p: ExpoVideoPlayer) => void }) => {
  const player = useVideoPlayer(uri, (p) => { 
    p.loop = true;
    p.play(); 
  });
  
  useEffect(() => {
    onPlayerReady(player);
  }, [player]);

  useEffect(() => {
    if (isPaused) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPaused, player]);

  useEffect(() => {
    let interval = setInterval(() => {
      if (player.status === 'readyToPlay' && player.duration > 0) {
        onReady(player.duration * 1000);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [player, onReady]);

  return <VideoView player={player} style={StyleSheet.absoluteFillObject} nativeControls={false} />;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  media: { width: '100%', height: '100%', borderRadius: 10 },
  textOverlay: { position: 'absolute', zIndex: 2 },
  textOverlayContent: { fontSize: 30, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  highlightTextWrapper: { backgroundColor: '#000', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' },
  highlightText: { textShadowColor: 'transparent', textShadowRadius: 0 },
  progressContainer: { flexDirection: 'row', paddingHorizontal: 10, paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 15, gap: 5, zIndex: 10, backgroundColor: 'transparent' },
  progressBarBg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressBarFg: { height: '100%', backgroundColor: '#FFF', borderRadius: 2 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15, zIndex: 10, marginTop: 10 },
  userInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#333' },
  username: { color: '#FFF', fontWeight: 'bold', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  closeBtn: { padding: 5 },
  viewersTriggerContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 20, width: '100%', alignItems: 'center', zIndex: 15 },
  viewersTriggerBtn: { alignItems: 'center', padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 100 },
  viewersCountText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  sheetBackground: { backgroundColor: '#111', borderRadius: 24, borderWidth: 1, borderColor: '#222' },
  sheetContent: { flex: 1 },
  sheetHeader: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#222', gap: 10 },
  sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  viewerRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15, gap: 12 },
  viewerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222' },
  viewerName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  emptyViewersText: { color: '#888', textAlign: 'center', marginTop: 30, fontSize: 15 },
  deleteBtn: { padding: 5 }
});
