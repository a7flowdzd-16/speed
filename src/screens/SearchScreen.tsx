import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { saveNotification } from '../lib/notifications';
import { colors } from '../theme/colors';
import { apiClient } from '../config/api';

const { width } = Dimensions.get('window');
const DEBOUNCE_MS = 350;

// ─────────────────────────────────────────────────────────────────
//  💀 Skeleton Loader Card
// ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => {
  const pulse = useRef(new Animated.Value(0.4)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.skeletonRow, { opacity: pulse }]}>
      <View style={styles.skeletonAv} />
      <View style={styles.skeletonInfo}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: 90, marginTop: 8 }]} />
      </View>
      <View style={styles.skeletonBtn} />
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────
//  🔍 SearchScreen
// ─────────────────────────────────────────────────────────────────
export const SearchScreen = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [followStates, setFollowStates] = useState<Record<string, 'follow' | 'following' | 'follow_back'>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Multi-field debounced search ──
  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 1) { setResults([]); setSearched(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(text), DEBOUNCE_MS);
  };

  const runSearch = async (text: string) => {
    try {
      const results = await apiClient.get(`/search?q=${encodeURIComponent(text)}`);
      
      if (results && !results.error) {
        setResults(results);
        setSearched(true);
        // Load follow states in parallel
        Promise.all(results.map((p: any) => checkFollowState(p.id)));
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkFollowState = async (targetId: string) => {
    try {
      const followersData = await apiClient.get(`/users/${targetId}/followers?requester_id=${user?.id}`);
      const iFollow = Array.isArray(followersData) && followersData.some((f: any) => f.id === user?.id);
      
      const followingData = await apiClient.get(`/users/${targetId}/following?requester_id=${user?.id}`);
      const theyFollow = Array.isArray(followingData) && followingData.some((f: any) => f.id === user?.id);
      
      let state: 'follow' | 'following' | 'follow_back' = 'follow';
      if (iFollow) state = 'following';
      else if (theyFollow) state = 'follow_back';
      setFollowStates(prev => ({ ...prev, [targetId]: state }));
    } catch (e) {
      console.error('Check follow state error:', e);
    }
  };

  const toggleFollow = async (targetId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setFollowStates(prev => {
        const current = prev[targetId] || 'follow';
        return { ...prev, [targetId]: current === 'following' ? 'follow' : 'following' };
      });
      
      await apiClient.post('/follows/toggle', {
        follower_id: user?.id,
        following_id: targetId
      });
    } catch (error) {
      console.error('Follow toggle error:', error);
      // Rollback UI
      checkFollowState(targetId);
    }
  };


  const getBtnStyle = (state: string) => {
    if (state === 'following') return styles.btnFollowing;
    if (state === 'follow_back') return styles.btnFollowBack;
    return styles.btnFollow;
  };

  const getBtnText = (state: string) => {
    if (state === 'following') return 'أتابعه ✓';
    if (state === 'follow_back') return 'رد المتابعة';
    return 'متابعة';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>البحث</Text>
      </View>

      {/* ── Search Bar (iOS style) ── */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#666" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleChangeText}
            placeholder="ابحث بالاسم أو المعرف..."
            placeholderTextColor="#555"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle-sharp" size={18} color="#555" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Skeleton while loading ── */}
      {loading && (
        <View style={{ paddingHorizontal: 15 }}>
          {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
        </View>
      )}

      {/* ── Results List ── */}
      {!loading && (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            searched
              ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="search-outline" size={55} color="#1E1E1E" />
                  <Text style={styles.emptyTitle}>لا نتائج</Text>
                  <Text style={styles.emptySubtitle}>جرّب البحث باسم مختلف</Text>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <Ionicons name="people-outline" size={65} color="#151515" />
                  <Text style={styles.emptyTitle}>اكتشف الناس</Text>
                  <Text style={styles.emptySubtitle}>ابحث عن أشخاص للمتابعة</Text>
                </View>
              )
          }
          renderItem={({ item }) => {
            const state = followStates[item.id] || 'follow';
            return (
              <TouchableOpacity
                style={styles.userCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
              >
                <View style={styles.userLeft}>
                  {item.avatar_url
                    ? <Image source={{ uri: item.avatar_url }} style={styles.userAv} contentFit="cover" />
                    : <View style={styles.userAvFallback}><Ionicons name="person" size={24} color="#333" /></View>
                  }
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>{item.full_name}</Text>
                    <Text style={styles.userHandle}>عضو في A7 Flow</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.followBtn, getBtnStyle(state)]}
                  onPress={(e) => { e.stopPropagation?.(); toggleFollow(item.id); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.followBtnTxt, state === 'following' && { color: '#777' }]}>
                    {getBtnText(state)}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Header
  headerWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { color: '#FFF', fontSize: 26, fontWeight: '800', textAlign: 'right' },

  // Search Bar
  searchBarWrap: { paddingHorizontal: 15, marginBottom: 18 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A1A1A', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15, textAlign: 'right' },

  // List
  listContent: { paddingHorizontal: 15, paddingBottom: 100 },

  // User Card
  userCard: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#111',
  },
  userLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 },
  userAv: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#111' },
  userAvFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  userInfo: { flex: 1, alignItems: 'flex-end' },
  userName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  userHandle: { color: '#555', fontSize: 12, marginTop: 3 },

  // Follow Buttons
  followBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, minWidth: 90, alignItems: 'center' },
  btnFollow: { backgroundColor: colors.primary },
  btnFollowBack: { backgroundColor: colors.primary, borderWidth: 1.5, borderColor: '#FFF2' },
  btnFollowing: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333' },
  followBtnTxt: { color: '#000', fontSize: 12, fontWeight: '700' },

  // Skeleton
  skeletonRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12, gap: 12 },
  skeletonAv: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1E1E1E' },
  skeletonInfo: { flex: 1, alignItems: 'flex-end' },
  skeletonLine: { width: 130, height: 14, borderRadius: 7, backgroundColor: '#1E1E1E' },
  skeletonBtn: { width: 85, height: 34, borderRadius: 17, backgroundColor: '#1E1E1E' },

  // Empty
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyTitle: { color: '#333', fontSize: 19, fontWeight: 'bold', marginTop: 10 },
  emptySubtitle: { color: '#272727', fontSize: 14 },
});
