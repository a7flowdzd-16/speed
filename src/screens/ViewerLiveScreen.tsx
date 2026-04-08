import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../providers/AuthProvider';

// ─────────────────────────────────────────────────────────────────────────────
//  RTMP VIEWER — Google Cloud Media Server
//  ─────────────────────────────────────────────────────────────────────────────
//  NodePlayerView provides lowest latency via RTMP or HTTP-FLV.
//  Requires custom Dev Client:
//    npx expo prebuild --clean
//    npx expo run:ios  OR  npx expo run:android
//
//  Stream URLs from Google Cloud (34.40.108.188):
//    RTMP:      rtmp://34.40.108.188/live/{streamId}     ← lowest latency (~1s)
//    HTTP-FLV:  http://34.40.108.188:8000/live/{streamId}.flv   (~1-2s latency)
//    HLS:       http://34.40.108.188:8000/live/{streamId}.m3u8  (~5-15s latency)
//
//  We use HTTP-FLV for viewer (best balance of compatibility + latency)
// ─────────────────────────────────────────────────────────────────────────────

// Safe import — graceful fallback for Expo Go
let NodePlayerView: any = null;
try {
  NodePlayerView = require('react-native-nodemediaclient').NodePlayerView;
} catch (_) {
  // Running in Expo Go — player unavailable
}

const { width, height } = Dimensions.get('window');
const FLV_BASE = 'http://34.40.108.188:8000/live';

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string };
}

export const ViewerLiveScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation() as any;
  const route = useRoute() as any;
  const { user } = useAuth();

  const { hostId, streamId: routeStreamId } = route.params || {};

  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [resolvedStreamId, setResolvedStreamId] = useState<string | null>(routeStreamId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);

  const playerRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadProfile();
    resolveStream();
  }, []);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) setProfile(data);
  };

  const resolveStream = async () => {
    let sid = routeStreamId;

    if (!sid && hostId) {
      const { data } = await supabase
        .from('live_streams')
        .select('id, title, status, profiles:user_id(full_name, avatar_url)')
        .eq('user_id', hostId)
        .eq('status', 'live')
        .maybeSingle();

      if (data) {
        sid = data.id;
        setStreamInfo(data);
      }
    } else if (sid) {
      const { data } = await supabase
        .from('live_streams')
        .select('id, title, status, profiles:user_id(full_name, avatar_url)')
        .eq('id', sid)
        .maybeSingle();
      if (data) setStreamInfo(data);
    }

    if (sid) {
      setResolvedStreamId(sid);
      await loadMessages(sid);
      setupRealtimeChat(sid);

      // Start playback after a short delay to let the player mount
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.start();
          setPlayerReady(true);
        }
      }, 800);
    }

    setLoading(false);
  };

  const loadMessages = async (sid: string) => {
    const { data } = await supabase
      .from('live_chats')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .eq('stream_id', sid)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) setMessages(data);
  };

  const setupRealtimeChat = (sid: string) => {
    const channel = supabase.channel(`viewer-chat-${sid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_chats',
        filter: `stream_id=eq.${sid}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('live_chats')
          .select('*, profiles:user_id(full_name, avatar_url)')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setMessages(prev => [...prev, data]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !resolvedStreamId) return;
    const text = inputText.trim();
    setInputText('');
    await supabase.from('live_chats').insert({
      stream_id: resolvedStreamId,
      user_id: user.id,
      message: text,
    });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.msgRow}>
      {item.profiles?.avatar_url ? (
        <Image source={{ uri: item.profiles.avatar_url }} style={styles.msgAvatar} contentFit="cover" />
      ) : (
        <View style={[styles.msgAvatar, styles.avatarFallback]}>
          <Ionicons name="person" size={12} color="#666" />
        </View>
      )}
      <View style={styles.msgBubble}>
        <Text style={styles.msgName}>{item.profiles?.full_name || 'مستخدم'}</Text>
        <Text style={styles.msgText}>{item.message}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: '#555', marginTop: 12, fontSize: 13 }}>جاري الاتصال بالبث...</Text>
      </View>
    );
  }

  if (!streamInfo) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: 14 }]}>
        <Ionicons name="wifi-outline" size={60} color="#2A2A2A" />
        <Text style={{ color: '#555', fontSize: 15 }}>البث أُنهي أو غير متوفر</Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ═══════════════════════════════════════════════════════════
          LAYER 0 — VIDEO PLAYER (absolute background, zIndex: 0)
          ─────────────────────────────────────────────────────────
          NodePlayerView plays:
          HTTP-FLV:  http://34.40.108.188:8000/live/{streamId}.flv  (~1-2s latency)
          
          Alternative (HLS, higher latency):
          http://34.40.108.188:8000/live/{streamId}.m3u8
          ═══════════════════════════════════════════════════════════ */}
      {NodePlayerView && resolvedStreamId ? (
        <NodePlayerView
          ref={playerRef}
          style={styles.videoLayer}
          inputUrl={`${FLV_BASE}/${resolvedStreamId}.flv`}
          bufferTime={300}        // 300ms buffer — minimizes latency
          maxBufferTime={1000}    // 1s max buffer
          autorotate={false}
          hwDecoderEnabled={true} // Hardware decoding for smooth playback
        />
      ) : (
        // Expo Go fallback
        <View style={[styles.videoLayer, styles.placeholderLayer]}>
          <LinearGradient
            colors={['#0F0F1A', '#1A1A2E', '#0D0D1A']}
            style={StyleSheet.absoluteFill}
          />
          {streamInfo.profiles?.avatar_url && (
            <Image
              source={{ uri: streamInfo.profiles.avatar_url }}
              style={styles.hostAvatarBig}
              contentFit="cover"
            />
          )}
          <Text style={styles.placeholderTitle}>⚠️ يتطلب Dev Client</Text>
          <Text style={styles.placeholderSub}>شغّل: npx expo run:ios</Text>
          <Text style={styles.streamUrlLabel}>
            {FLV_BASE}/{resolvedStreamId?.slice(0, 12)}....flv
          </Text>
        </View>
      )}

      {/* Dark gradient scrim — readability over video */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.7)']}
        style={styles.scrim}
        pointerEvents="none"
      />

      {/* ═══════════════════════════════════════════════════════════
          LAYER 1 — TOP BAR (zIndex: 20)
          ═══════════════════════════════════════════════════════════ */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.hostPill}>
          {streamInfo.profiles?.avatar_url && (
            <Image
              source={{ uri: streamInfo.profiles.avatar_url }}
              style={styles.hostAvatar}
              contentFit="cover"
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.hostName}>{streamInfo.profiles?.full_name || 'Nouble'}</Text>
            <Text style={styles.streamTitle} numberOfLines={1}>{streamInfo.title}</Text>
          </View>
        </View>

        <LinearGradient
          colors={['#FF3B30', '#FF6B30']}
          style={styles.livePill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.redDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </LinearGradient>
      </View>

      {/* ═══════════════════════════════════════════════════════════
          LAYER 2 — CHAT + INPUT (zIndex: 15, bottom 52%)
          ═══════════════════════════════════════════════════════════ */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatOverlay}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
          style={styles.chatList}
          contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 12 }}
          ListEmptyComponent={
            <Text style={styles.emptyChat}>كن أول من يرسل رسالة! 🎉</Text>
          }
        />

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.inputAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.inputAvatar, styles.avatarFallback]}>
              <Ionicons name="person" size={13} color="#666" />
            </View>
          )}
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="أضف تعليقاً..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.4 }]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={16} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Layer 0: Video
  videoLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  placeholderLayer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  hostAvatarBig: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: '#FF3B30',
    marginBottom: 8,
  },
  placeholderTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700' },
  placeholderSub: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  streamUrlLabel: {
    color: 'rgba(255,255,255,0.1)',
    fontSize: 9,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 4,
  },

  // Scrim
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },

  // Layer 1: Top bar
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
    zIndex: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  hostPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  hostAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#222' },
  hostName: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  streamTitle: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  redDot: { width: 6, height: 6, backgroundColor: '#FFF', borderRadius: 3 },
  liveText: { color: '#FFF', fontWeight: '900', fontSize: 12 },

  // Layer 2: Chat
  chatOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: height * 0.52,
    justifyContent: 'flex-end',
    zIndex: 15,
  },
  chatList: { flex: 1 },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 9,
    gap: 7,
  },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1C1C1C',
    marginTop: 1,
  },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  msgBubble: {
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: width * 0.72,
  },
  msgName: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  msgText: {
    color: 'rgba(255,255,255,0.93)',
    fontSize: 13,
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyChat: {
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    marginTop: 30,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1C1C1C' },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    color: '#FFF',
    fontSize: 14,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
});
