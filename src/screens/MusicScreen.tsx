import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { colors } from '../theme/colors';
import { apiClient } from '../config/api';
import { FullPlayerModal } from '../components/FullPlayerModal';

const { width } = Dimensions.get('window');
const ALBUM_CARD_SIZE = width * 0.44;

interface NowPlaying {
  title: string;
  artist: string;
  thumbnail: string | null;
  query: string;
  duration: number;
}

interface SearchResult {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  durationFormatted: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const TRENDING_ALBUMS = [
  { id: '1', title: 'After Hours',   artist: 'The Weeknd',     color: ['#7B0000', '#1a0000'] as const },
  { id: '2', title: 'GUTS',          artist: 'Olivia Rodrigo', color: ['#1a1a4e', '#0a0a1a'] as const },
  { id: '3', title: 'SOS',           artist: 'SZA',            color: ['#0d3b0d', '#000']    as const },
  { id: '4', title: 'Midnights',     artist: 'Taylor Swift',   color: ['#1a0a3a', '#000']    as const },
  { id: '5', title: 'Un Verano',     artist: 'Bad Bunny',      color: ['#3a1a00', '#000']    as const },
];

const SPOTIFY_GRID = [
  { id: '1', title: 'الأغاني التي أعجبتك', color: ['#450af5', '#c4efd9'] as const, icon: 'heart' },
  { id: '2', title: 'Daily Mix 1',      color: ['#283593', '#1a237e'] as const, initial: 'D1' },
  { id: '3', title: 'Nouble Vibes 🌙',  color: ['#C62828', '#4A148C'] as const, initial: 'NV' },
  { id: '4', title: 'Rap Caviar',       color: ['#1565C0', '#00838F'] as const, initial: 'RC' },
  { id: '5', title: 'Hip-Hop Heat',     color: ['#E65100', '#827717'] as const, initial: 'HH' },
  { id: '6', title: 'Discover Weekly',  color: ['#b71c1c', '#4a148c'] as const, initial: 'DW' },
];

const TOP_HITS = [
  { id: '1', title: 'Blinding Lights',  artist: 'The Weeknd',     duration: '3:20', color: '#7B0000' },
  { id: '2', title: 'As It Was',        artist: 'Harry Styles',   duration: '2:47', color: '#00406e' },
  { id: '3', title: 'Anti-Hero',        artist: 'Taylor Swift',   duration: '3:21', color: '#283593' },
  { id: '4', title: 'Flowers',          artist: 'Miley Cyrus',    duration: '3:21', color: '#1b5e20' },
  { id: '5', title: 'Unholy',           artist: 'Sam Smith',      duration: '2:37', color: '#4a148c' },
  { id: '6', title: 'Ella Baila Sola',  artist: 'Eslabon Armado', duration: '3:14', color: '#b71c1c' },
  { id: '7', title: 'Cupid',            artist: 'FIFTY FIFTY',    duration: '2:54', color: '#004d40' },
  { id: '8', title: 'Creepin\'',        artist: 'Metro Boomin',   duration: '3:16', color: '#212121' },
  { id: '9', title: 'Calm Down',        artist: 'Rema',           duration: '3:39', color: '#4e342e' },
  { id: '10', title: 'Cruel Summer',    artist: 'Taylor Swift',   duration: '2:58', color: '#880e4f' },
];

const FEATURED_PLAYLISTS = [
  { id: '1', title: 'Nouble Vibes 🌙', subtitle: '24 أغنية | 1h 12m', color: ['#C62828', '#4A148C'] as const },
  { id: '2', title: 'صح النوم ☀️',      subtitle: '18 أغنية | 58m',   color: ['#1565C0', '#00838F'] as const },
  { id: '3', title: 'Hip-Hop Heat 🔥',  subtitle: '31 أغنية | 1h 44m', color: ['#E65100', '#827717'] as const },
];

// ── Main Screen ────────────────────────────────────────────────────────────────
export const MusicScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  // Audio State
  const soundRef = useRef<Audio.Sound | null>(null);
  const miniPlayerAnim = useRef(new Animated.Value(0)).current;

  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [loadingId, setLoadingId]   = useState<string | null>(null);

  // Search & Modal States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Spotify Filter Pills
  const [activeFilter, setActiveFilter] = useState('الكل');
  const FILTERS = ['الكل', 'موسيقى', 'بودكاست'];

  // Search Debounce Effect
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.get(`/music/search?query=${encodeURIComponent(searchQuery)}`);
        if (res?.success) {
          setSearchResults(res.songs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Setup audio mode on mount
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      allowsRecordingIOS: false,
    });

    return () => {
      // Cleanup on unmount
      soundRef.current?.unloadAsync();
    };
  }, []);

  // Animate Mini Player in/out
  useEffect(() => {
    Animated.spring(miniPlayerAnim, {
      toValue: nowPlaying ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [nowPlaying]);

  // ── Core: Play Song ────────────────────────────────────────
  const handlePlay = useCallback(async (songTitle: string, artist: string, songId: string, songColor: string) => {
    try {
      setLoadingId(songId);

      // Stop & unload current sound
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setIsPlaying(false);
      }

      const query = encodeURIComponent(`${songTitle} ${artist}`);
      const res = await apiClient.get(`/music/play?query=${query}`);

      if (!res?.success || !res?.streamUrl) {
        Alert.alert('تعذر التشغيل', res?.error || 'لم يتمكن السيرفر من إيجاد الأغنية.');
        setLoadingId(null);
        return;
      }

      // Create & play sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: res.streamUrl },
        { shouldPlay: true, volume: 1.0 },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);
      setNowPlaying({
        title: res.title || songTitle,
        artist: res.artist || artist,
        thumbnail: res.thumbnail || null,
        query: `${songTitle} ${artist}`,
        duration: (res.duration || 200) * 1000,
      });

    } catch (err: any) {
      Alert.alert('خطأ في التشغيل', err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setLoadingId(null);
    }
  }, []);

  // ── Toggle Pause / Resume ──────────────────────────────────
  const handleTogglePlay = useCallback(async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // ── Stop & Close Mini Player ───────────────────────────────
  const handleStop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsPlaying(false);
    setNowPlaying(null);
  }, []);

  // ── Render Helpers ─────────────────────────────────────────

  const renderFilterPills = () => (
    <View style={styles.pillContainer}>
      {FILTERS.map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[styles.pillBtn, activeFilter === filter && styles.pillBtnActive]}
          onPress={() => setActiveFilter(filter)}
        >
          <Text style={[styles.pillText, activeFilter === filter && styles.pillTextActive]}>
            {filter}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSpotifyGrid = () => (
    <View style={styles.gridContainer}>
      {SPOTIFY_GRID.map((item) => (
        <TouchableOpacity key={item.id} style={styles.gridCard} activeOpacity={0.8}>
          <LinearGradient colors={item.color} style={styles.gridImage}>
            {item.icon ? (
              <Ionicons name="heart" size={24} color="#FFF" />
            ) : (
              <Text style={styles.gridInitial}>{item.initial}</Text>
            )}
          </LinearGradient>
          <Text style={styles.gridTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderAlbumCard = ({ item }: { item: typeof TRENDING_ALBUMS[0] }) => (
    <TouchableOpacity style={styles.albumCard} activeOpacity={0.85}>
      <LinearGradient colors={item.color} style={styles.albumArt}>
        <Text style={styles.albumArtInitial}>{item.title[0]}</Text>
      </LinearGradient>
      <Text style={styles.albumTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.albumArtist} numberOfLines={1}>{item.artist}</Text>
    </TouchableOpacity>
  );

  const miniPlayerTranslateY = miniPlayerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  // ── JSX ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Background gradient - Spotify Style */}
      <LinearGradient
        colors={['#1F1F1F', '#121212', '#121212']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
      />

      <View style={[styles.staticHeader, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerGreeting}>مرحباً 👋</Text>
          <View style={styles.headerIcons}>
            <Ionicons name="notifications-outline" size={24} color="#FFF" style={{ marginRight: 16 }} />
            <Ionicons name="time-outline" size={24} color="#FFF" style={{ marginRight: 16 }} />
            <Ionicons name="settings-outline" size={24} color="#FFF" />
          </View>
        </View>
        
        {renderFilterPills()}

        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#B3B3B3" />
          <TextInput
            style={styles.searchInput}
            placeholder="ماذا تود أن تسمع؟"
            placeholderTextColor="#B3B3B3"
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right"
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: 10,
            paddingBottom: insets.bottom + (nowPlaying ? 160 : 100),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!searchQuery ? (
          <>
            {/* ── Spotify Grid ── */}
            {renderSpotifyGrid()}

            {/* ── Trending Albums ── */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>حلقات خصيصاً لك</Text>
            </View>
            <FlatList
              data={TRENDING_ALBUMS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.horizontalList}
              renderItem={renderAlbumCard}
            />

            {/* ── Top Hits ── */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>موسيقى الشائعة اليوم</Text>
            </View>
          </>
        ) : (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>نتائج البحث 🔍</Text>
          </View>
        )}

        {isSearching ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.songsList}>
            {(searchQuery ? searchResults : TOP_HITS).map((item: any, index) => {
              const itemId = item.videoId || item.id;
              const isLoading = loadingId === itemId;
              const isCurrent = nowPlaying?.title === item.title;

              return (
                <TouchableOpacity
                  key={itemId}
                  style={[styles.songRow, isCurrent && styles.songRowActive]}
                  activeOpacity={0.7}
                  onPress={() => handlePlay(item.title, item.artist, itemId, item.color || '#222')}
                >
                  <View style={[styles.songThumb, { backgroundColor: item.color || '#222' }]}>
                    {item.thumbnail ? (
                       <Image source={{ uri: item.thumbnail }} style={StyleSheet.absoluteFillObject} borderRadius={10} />
                    ) : null}
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFF" style={StyleSheet.absoluteFillObject} />
                    ) : isCurrent && isPlaying ? (
                       <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }]}>
                         <Ionicons name="musical-note" size={20} color={colors.primary} />
                       </View>
                    ) : !item.thumbnail && (
                      <Text style={styles.songThumbText}>{item.title[0]}</Text>
                    )}
                  </View>
                  <View style={styles.songInfo}>
                    <Text
                      style={[styles.songTitle, isCurrent && { color: colors.primary }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.songArtist} numberOfLines={1}>
                      {item.artist} {item.durationFormatted ? `• ${item.durationFormatted}` : (item.duration && typeof item.duration === 'string') ? `• ${item.duration}` : ''}
                    </Text>
                  </View>
                  {!searchQuery && (
                    <Text style={[styles.songRank, isCurrent && { color: colors.primary }]}>
                      #{index + 1}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => handlePlay(item.title, item.artist, itemId, item.color || '#222')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons
                        name={isCurrent && isPlaying ? 'pause-circle' : 'play-circle'}
                        size={36}
                        color={isCurrent ? colors.primary : 'rgba(255,255,255,0.5)'}
                      />
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Mini Player - Spotify Style ──────────────────────── */}
      <Animated.View
        style={[
          styles.miniPlayer,
          {
            bottom: insets.bottom + 65,
            transform: [{ translateY: miniPlayerTranslateY }],
          },
        ]}
        pointerEvents={nowPlaying ? 'auto' : 'none'}
      >
        <TouchableOpacity activeOpacity={0.9} onPress={() => setIsModalVisible(true)}>
          <View style={styles.miniPlayerInner}>
            {/* Progress Bar Top */}
            <View style={styles.miniProgressContainer}>
              <View style={[styles.miniProgressBar, { width: '40%' }]} /> 
            </View>
            
            <View style={styles.miniPlayerContent}>
              {/* Thumbnail */}
              <View style={styles.miniThumb}>
                {nowPlaying?.thumbnail ? (
                  <Image source={{ uri: nowPlaying.thumbnail }} style={StyleSheet.absoluteFillObject} borderRadius={6} />
                ) : (
                  <Ionicons name="musical-note" size={20} color="#B3B3B3" />
                )}
              </View>

              {/* Info */}
              <View style={styles.miniInfo}>
                <Text style={styles.miniTitle} numberOfLines={1}>
                  {nowPlaying?.title}
                </Text>
                <Text style={styles.miniArtist} numberOfLines={1}>
                  {nowPlaying?.artist}
                </Text>
              </View>

              {/* Controls */}
              <View style={styles.miniControls}>
                <TouchableOpacity onPress={handleStop} style={styles.miniControlBtn}>
                  <Ionicons name="heart-outline" size={24} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleTogglePlay} style={styles.miniControlBtn}>
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={28}
                    color="#FFF"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Full Player Modal ─────────────────────────────────── */}
      <FullPlayerModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        nowPlaying={nowPlaying}
        isPlaying={isPlaying}
        soundObj={soundRef.current}
        onTogglePlay={handleTogglePlay}
        onNext={() => {}} 
        onPrev={() => {}}
      />
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Spotify pure dark background
  },
  staticHeader: {
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerGreeting: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'left',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Filter Pills
  pillContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pillBtn: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  pillBtnActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#000',
  },

  // Search
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },

  scroll: {
    paddingHorizontal: 20,
  },

  // Spotify Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 6,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    height: 56,
  },
  gridImage: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridInitial: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  gridTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    paddingHorizontal: 10,
    textAlign: 'left',
  },

  // Section
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  horizontalList: {
    paddingRight: 20,
  },

  // Album Card
  albumCard: {
    width: ALBUM_CARD_SIZE,
    marginRight: 16,
  },
  albumArt: {
    width: ALBUM_CARD_SIZE,
    height: ALBUM_CARD_SIZE,
    borderRadius: 4, // Spotify uses sharp corners or very slight roundness for albums
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  albumArtInitial: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 40,
    fontWeight: '900',
  },
  albumTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'left',
  },
  albumArtist: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'left',
  },

  // Song Row
  songsList: {
    gap: 0,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: 'transparent',
    gap: 12,
  },
  songRowActive: {
    // Spotify doesn't highlight the whole row
  },
  songThumb: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songThumbText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 20,
    fontWeight: '900',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  songArtist: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '500',
  },
  songRank: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
    fontWeight: '800',
    width: 24,
    textAlign: 'center',
  },
  playBtn: {
    padding: 2,
  },

  // Mini Player
  miniPlayer: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20,
  },
  miniPlayerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
  },
  miniThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,220,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
  },
  miniInfo: {
    flex: 1,
  },
  miniTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  miniArtist: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniControlBtn: {
    padding: 2,
  },
  miniCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
