import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Dimensions, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import io from 'socket.io-client';
import { apiClient, API_BASE_URL, getFileUrl } from '../config/api';
import { useAuth } from '../providers/AuthProvider';
import { usePresence } from '../providers/PresenceProvider';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface ChatItem {
  id: number;
  full_name: string;
  avatar_url: string | null;
  username: string | null;
  lastMessage: string | null;
  updatedAt: string | null;
  unreadCount: number;
}

export const ChatListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { onlineUsers } = usePresence();
  const socketRef = useRef<any>(null);

  const [items, setItems] = useState<ChatItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Socket Connection ─────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    // Connect to Socket.io (using root URL)
    socketRef.current = io(API_BASE_URL.replace('/api', ''));

    // If a message arrives, we refresh the list if needed
    socketRef.current.on('receive_message', (msg: any) => {
      // Logic: If the message is for us (receiver) or by us (sender), refresh the inbox list
      if (msg.receiver_id == user.id || msg.sender_id == user.id) {
        loadData(false); // Silent refresh
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user?.id]);

  // Refresh when screen is focused (to clear read badges)
  useEffect(() => {
    if (isFocused && user) {
      loadData(items.length === 0);
    }
  }, [isFocused, user]);

  // ─── Main data loader ───────────────────────────────────
  const loadData = async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setLoading(true);

    try {
      const response = await apiClient.get(`/messages/inbox?userId=${user.id}`);
      setItems(response || []);
    } catch (e) {
      console.error('ChatList loadData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ─── Search ──────────────────────────────────────────────
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchText.trim() === '') {
        setSearching(false);
        setSearchResults([]);
        return;
      }
      performSearch(searchText);
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchText]);

  const performSearch = async (query: string) => {
    setSearching(true);
    try {
      const resp = await apiClient.get(`/search?q=${query}`);
      setSearchResults(resp || []);
    } catch (e) {
      console.error('Search error:', e);
    }
  };

  // ─── Navigate to chat room ───────────────────────────────
  const openChat = (item: any) => {
    navigation.navigate('ChatRoom', {
      otherUserId: item.id,
      otherUserName: item.full_name,
      otherUserAvatar: item.avatar_url,
    });
  };

  // ─── Render ──────────────────────────────────────────────
  const renderItem = ({ item }: { item: ChatItem }) => {
    const subtitle = item.lastMessage || 'ابدأ المحادثة الآن...';
    const isUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => openChat(item)}
      >
        <View style={styles.avatarWrap}>
          <Image 
            source={{ uri: getFileUrl(item.avatar_url) }} 
            style={styles.avatar} 
            contentFit="cover"
          />
          {onlineUsers.has(String(item.id)) && (
            <View style={styles.onlineDot} />
          )}
          {isUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.rowInfo}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>{item.full_name}</Text>
            {item.updatedAt && (
              <Text style={styles.time}>{formatTime(item.updatedAt)}</Text>
            )}
          </View>
          
          <Text 
            style={[
              styles.subtitle,
              isUnread && styles.subtitleUnread
            ]} 
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.1)" />
      </TouchableOpacity>
    );
  };

  const displayData = searching ? searchResults : items;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الرسائل</Text>
        <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="chatbubbles" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.3)" />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث عن أصدقاء..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
             <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Content ── */}
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={displayData.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadData(false); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={64} color="rgba(255,255,255,0.05)" />
              <Text style={styles.emptyTitle}>
                {searching ? 'لا توجد نتائج' : 'صندوق الوارد فارغ'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `${diffMin}د`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}س`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}ي`;
  return d.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  headerIcon: { padding: 4 },
  searchWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#111',
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 44,
    gap: 10,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16, textAlign: 'right' },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 15,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#111' },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 4,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ADE80', // Green
    borderWidth: 2,
    borderColor: '#000',
  },
  unreadText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  rowInfo: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  time: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  subtitleUnread: { color: '#FFF', fontWeight: 'bold' },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 85 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', gap: 10 },
  emptyTitle: { color: 'rgba(255,255,255,0.2)', fontSize: 18 },
});
