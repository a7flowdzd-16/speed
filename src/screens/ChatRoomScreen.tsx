import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Pressable, Animated, Alert
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import io from 'socket.io-client';
import { API_BASE_URL, getFileUrl } from '../config/api';
import { apiClient } from '../config/api';
import { useAuth } from '../providers/AuthProvider';
import { setActiveChatPartner } from '../providers/GlobalMessageListener';
import { colors } from '../theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string | number;
  sender_id: string | number;
  receiver_id: string | number;
  content: string;
  created_at: string;
  is_read: boolean;
  reply_to_id?: string | number | null;
  reply_content?: string | null;
  reply_sender_name?: string | null;
  reply_media_type?: string | null;
  media_url?: string | null;
  media_type?: 'image' | 'video' | 'file' | null;
  file_name?: string | null;
}

// ─── Download Helper ──────────────────────────────────────────────────────────
const downloadMedia = async (url: string, fileName: string, type: string) => {
  try {
    const fullUrl = `${API_BASE_URL.replace('/api', '')}/api/uploads${url}`;
    const fileUri = `${FileSystem.documentDirectory}${fileName || `file_${Date.now()}`}`;
    
    Alert.alert('جاري التحميل', 'بدأ تحميل الملف...');
    
    const download = await FileSystem.downloadAsync(fullUrl, fileUri);
    
    if (type === 'image' || type === 'video') {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(download.uri);
        Alert.alert('تم الحفظ', 'تم حفظ الوسائط في المعرض بنجاح! ✅');
      } else {
        await Sharing.shareAsync(download.uri);
      }
    } else {
      await Sharing.shareAsync(download.uri);
    }
  } catch (e) {
    console.error('Download error:', e);
    Alert.alert('خطأ', 'فشل تحميل الملف.');
  }
};

// ─── Replied Message Component ────────────────────────────────────────────────
const RepliedMessageContext = ({ msg, isMe }: { msg: Message; isMe: boolean }) => {
  if (!msg.reply_to_id) return null;
  return (
    <View style={[styles.repliedContext, isMe ? styles.repliedMe : styles.repliedThem]}>
      <View style={[styles.repliedBar, { backgroundColor: isMe ? '#000' : colors.primary }]} />
      <View style={styles.repliedInfo}>
        <Text style={[styles.repliedSender, { color: isMe ? '#222' : colors.primary }]} numberOfLines={1}>
          {msg.reply_sender_name || 'رسالة سابقة'}
        </Text>
        <Text style={styles.repliedText} numberOfLines={1}>
          {msg.reply_media_type ? (msg.reply_media_type === 'image' ? '📷 صورة' : msg.reply_media_type === 'video' ? '🎥 فيديو' : '📎 ملف') : msg.reply_content}
        </Text>
      </View>
    </View>
  );
};

// ─── Media Bubble ─────────────────────────────────────────────────────────────
const MediaContent = ({ msg, isMe }: { msg: Message; isMe: boolean }) => {
  const fullUrl = `${API_BASE_URL.replace('/api', '')}/api/uploads${msg.media_url}`;

  return (
    <View style={styles.mediaContainer}>
      {msg.media_type === 'image' ? (
        <Image source={{ uri: fullUrl }} style={styles.mediaBubbleImage} contentFit="cover" />
      ) : msg.media_type === 'video' ? (
        <View style={styles.mediaBubbleImage}>
          <Video
            source={{ uri: fullUrl }}
            style={{ width: '100%', height: '100%', borderRadius: 14 }}
            resizeMode={ResizeMode.COVER}
            useNativeControls
          />
        </View>
      ) : msg.media_type === 'file' ? (
        <View style={[styles.fileBox, isMe ? styles.fileBoxMe : styles.fileBoxThem]}>
          <Ionicons name="document-outline" size={28} color={isMe ? '#000' : colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.fileName, isMe && { color: '#000' }]} numberOfLines={2}>
              {msg.file_name || 'ملف'}
            </Text>
          </View>
        </View>
      ) : null}
      
      {/* Download Indicator Overlay for Images/Videos */}
      {(msg.media_type === 'image' || msg.media_type === 'video' || msg.media_type === 'file') && (
        <TouchableOpacity 
          style={styles.downloadIconBtn} 
          onPress={() => downloadMedia(msg.media_url!, msg.file_name!, msg.media_type!)}
        >
          <Ionicons name="download" size={18} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────
const MessageBubble = React.memo(({ msg, isMe, onReply }: {
  msg: Message; isMe: boolean; onReply: (msg: Message) => void;
}) => {
  const swipeableRef = useRef<Swipeable>(null);
  const time = new Date(msg.created_at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', hour12: true });
  const hasMedia = !!msg.media_url;
  const hasText = !!msg.content?.trim();

  const triggerReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReply(msg);
    swipeableRef.current?.close();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={!isMe ? () => <View style={styles.swipeAction}><Ionicons name="arrow-undo" size={22} color={colors.primary} /></View> : undefined}
      renderRightActions={isMe ? () => <View style={styles.swipeAction}><Ionicons name="arrow-undo" size={22} color={colors.primary} /></View> : undefined}
      onSwipeableWillOpen={triggerReply}
      friction={2} overshootFriction={8} leftThreshold={40} rightThreshold={40}
    >
      <TouchableOpacity
        onLongPress={triggerReply} delayLongPress={350} activeOpacity={0.82}
        style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}
      >
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, hasMedia && !hasText && styles.bubbleMediaOnly]}>
          {msg.reply_to_id && <RepliedMessageContext msg={msg} isMe={isMe} />}
          {hasMedia && <MediaContent msg={msg} isMe={isMe} />}
          {hasText && (
            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
              {msg.content}
            </Text>
          )}
          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>{time}</Text>
            {isMe && (
              <Ionicons
                name={msg.is_read ? 'checkmark-done' : 'checkmark'}
                size={14} color={msg.is_read ? colors.primary : 'rgba(0,0,0,0.35)'}
                style={styles.tickIcon}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

// ─── Progress Bar ─────────────────────────────────────────────────────────────
const UploadProgressBar = ({ progress }: { progress: number }) => {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: progress, duration: 200, useNativeDriver: false }).start();
  }, [progress]);
  return (
    <View style={styles.progressContainer}>
      <Animated.View style={[styles.progressBar, { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
      <Text style={styles.progressText}>{Math.round(progress)}%</Text>
    </View>
  );
};

// ─── Attachment Menu ──────────────────────────────────────────────────────────
const AttachmentMenu = ({ visible, onClose, onGallery, onFile }: {
  visible: boolean; onClose: () => void;
  onGallery: () => void; onFile: () => void;
}) => {
  if (!visible) return null;
  return (
    <Pressable style={[StyleSheet.absoluteFill, styles.attachOverlay, { zIndex: 9999 }]} onPress={onClose}>
      <View style={styles.attachMenu}>
        <TouchableOpacity style={styles.attachOption} onPress={onGallery}>
          <View style={[styles.attachIcon, { backgroundColor: '#6C47FF' }]}>
            <Ionicons name="images" size={24} color="#FFF" />
          </View>
          <Text style={styles.attachLabel}>المعرض</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachOption} onPress={onFile}>
          <View style={[styles.attachIcon, { backgroundColor: '#FF6B35' }]}>
            <Ionicons name="document" size={24} color="#FFF" />
          </View>
          <Text style={styles.attachLabel}>ملف</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const ChatRoomScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { otherUserName, otherUserAvatar, otherUserId } = route.params || {};
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const isPicking = useRef(false);
  const socketRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    if (!user || !otherUserId) return;
    try {
      const response = await apiClient.get(`/messages/${user.id}/${otherUserId}`);
      setMessages([...(response || [])].reverse());
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, otherUserId]);

  const markAsRead = async () => {
    if (!user || !otherUserId) return;
    try {
      await apiClient.put(`/messages/read/${otherUserId}`, { userId: user.id });
      if (socketRef.current) socketRef.current.emit('mark_seen', { sender_id: user.id, receiver_id: otherUserId });
    } catch (e) { }
  };

  useEffect(() => {
    fetchMessages();
    if (!user?.id || !otherUserId) return;
    setActiveChatPartner(otherUserId);
    socketRef.current = io(API_BASE_URL.replace('/api', ''));
    socketRef.current.emit('join_chat', { userId1: user.id, userId2: otherUserId });
    markAsRead();

    socketRef.current.on('receive_message', (newMsg: Message) => {
      setMessages((prev) => {
        if (prev.some(m => String(m.id) === String(newMsg.id))) return prev;
        const filtered = prev.filter(m => !(String(m.id).startsWith('opt_') && m.content === newMsg.content));
        return [newMsg, ...filtered];
      });
      if (newMsg.sender_id == otherUserId) markAsRead();
    });

    socketRef.current.on('display_typing', (data: any) => {
      if (data.sender_id == otherUserId) setIsOtherTyping(data.is_typing);
    });

    socketRef.current.on('messages_seen', (data: any) => {
      if (data.sender_id == otherUserId)
        setMessages(prev => prev.map(m => m.sender_id == user.id ? { ...m, is_read: true } : m));
    });

    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [user?.id, otherUserId, fetchMessages]);

  useFocusEffect(useCallback(() => {
    setActiveChatPartner(otherUserId?.toString());
    return () => setActiveChatPartner(null);
  }, [otherUserId]));

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || !otherUserId) return;

    const optimistic: Message = {
      id: `opt_${Date.now()}`, sender_id: user.id, receiver_id: otherUserId,
      content: trimmed, created_at: new Date().toISOString(), is_read: false,
      reply_to_id: replyingTo?.id,
      reply_content: replyingTo?.content,
      reply_sender_name: replyingTo?.sender_id == user.id ? 'أنت' : otherUserName,
      reply_media_type: replyingTo?.media_type
    };
    setMessages(prev => [optimistic, ...prev]);
    const replyIdToSend = replyingTo?.id;
    setText('');
    setReplyingTo(null);

    if (socketRef.current) {
      socketRef.current.emit('send_message', {
        sender_id: user.id, receiver_id: otherUserId, content: trimmed,
        sender_name: user.full_name || user.username, sender_avatar: user.avatar_url,
        reply_to_id: replyIdToSend,
      });
      socketRef.current.emit('typing', { sender_id: user.id, receiver_id: otherUserId, is_typing: false });
    }
  };

  const sendQuickLike = () => {
    if (!user || !otherUserId) return;
    const emoji = '❤️';
    const optimistic: Message = {
      id: `opt_${Date.now()}`, sender_id: user.id, receiver_id: otherUserId,
      content: emoji, created_at: new Date().toISOString(), is_read: false,
    };
    setMessages(prev => [optimistic, ...prev]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (socketRef.current) {
      socketRef.current.emit('send_message', {
        sender_id: user.id, receiver_id: otherUserId, content: emoji,
        sender_name: user.full_name || user.username,
      });
    }
  };

  const uploadMedia = async (assets: any[]) => {
    if (!user || !otherUserId) return;
    for (const asset of assets) {
      setUploadProgress(0);
      const isVideo = asset.type === 'video' || (asset.uri && asset.uri.endsWith('.mp4'));
      const name = asset.fileName || asset.name || `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
      const mimeType = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

      const formData = new FormData();
      formData.append('user_id', String(user.id));
      formData.append('receiver_id', String(otherUserId));
      formData.append('reply_to_id', replyingTo ? String(replyingTo.id) : '');
      formData.append('media', { uri: asset.uri, name, type: mimeType } as any);

      try {
        const response = await axios.post(`${API_BASE_URL}/messages/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / (e.total || 1))),
        });
        
        if (response.data?.message) {
          const newM = response.data.message;
          setMessages(prev => {
            if (prev.some(m => String(m.id) === String(newM.id))) return prev;
            return [newM, ...prev];
          });
          setReplyingTo(null);
        }
      } catch (e: any) {
        console.error('Upload fail:', e);
        Alert.alert('خطأ', `فشل رفع ${name}`);
      }
    }
    setUploadProgress(null);
  };

  const handleGalleryPress = async () => {
    setShowAttachMenu(false); 
    if (isPicking.current) return;
    isPicking.current = true;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('صلاحية مرفوضة', 'نحتاج للوصول للصور لرفع المرفقات.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'], 
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
      });
      if (!result.canceled && result.assets) await uploadMedia(result.assets);
    } catch (e) {
      Alert.alert('خطأ', 'تعذر فتح المعرض.');
    } finally {
      isPicking.current = false;
    }
  };

  const handleFilePress = async () => {
    setShowAttachMenu(false); 
    if (isPicking.current) return;
    isPicking.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      if (!result.canceled && result.assets) await uploadMedia(result.assets);
    } catch (e) {
      Alert.alert('خطأ', 'تعذر فتح الملفات.');
    } finally {
      isPicking.current = false;
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (!socketRef.current || !user?.id || !otherUserId) return;
    if (val.length > 0) {
      socketRef.current.emit('typing', { sender_id: user.id, receiver_id: otherUserId, is_typing: true });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current) socketRef.current.emit('typing', { sender_id: user.id, receiver_id: otherUserId, is_typing: false });
      }, 2000);
    } else {
      socketRef.current.emit('typing', { sender_id: user.id, receiver_id: otherUserId, is_typing: false });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Image source={{ uri: getFileUrl(otherUserAvatar) }} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerName}>{otherUserName || 'مستخدم'}</Text>
            <Text style={[styles.headerStatus, isOtherTyping && styles.headerStatusTyping]}>
              {isOtherTyping ? 'جاري الكتابة...' : 'نشط الآن'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerAction}>
          <Ionicons name="call-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => `${item.id}_${index}`}
            inverted
            renderItem={({ item }) => (
              <MessageBubble
                msg={item}
                isMe={item.sender_id == user?.id}
                onReply={(msg) => {
                  setReplyingTo(msg);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
              />
            )}
            contentContainerStyle={styles.messagesList}
          />
        )}

        {uploadProgress !== null && <UploadProgressBar progress={uploadProgress} />}

        {replyingTo && (
          <View style={styles.replyPreviewWrapper}>
            <View style={styles.replyPreviewInner}>
              <View style={[styles.replyPreviewLine, { backgroundColor: colors.primary }]} />
              <View style={styles.replyPreviewContent}>
                <Text style={[styles.replyPreviewSender, { color: colors.primary }]}>
                  {replyingTo.sender_id == user?.id ? 'أنت' : otherUserName}
                </Text>
                <Text style={styles.replyPreviewText} numberOfLines={1}>
                  {replyingTo.media_type ? (replyingTo.media_type === 'image' ? '📷 صورة' : replyingTo.media_type === 'video' ? '🎥 فيديو' : '📎 ملف') : replyingTo.content}
                </Text>
              </View>
              <TouchableOpacity style={styles.replyClose} onPress={() => setReplyingTo(null)}>
                <Ionicons name="close" size={18} color="#888" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttachMenu(true)}>
            <Ionicons name="attach" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={text}
              onChangeText={handleTextChange}
              placeholder="رسالة..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
            />
          </View>
          {text.trim() ? (
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <Ionicons name="send" size={20} color="#000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.likeBtn} onPress={sendQuickLike}>
              <Ionicons name="heart" size={28} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <AttachmentMenu
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        onGallery={handleGalleryPress}
        onFile={handleFilePress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)', gap: 10,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111' },
  headerName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  headerStatus: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  headerStatusTyping: { color: colors.primary, fontWeight: 'bold' },
  headerAction: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  messagesList: { paddingHorizontal: 15, paddingVertical: 15 },
  bubbleRow: { marginVertical: 3, flexDirection: 'row' },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 24, overflow: 'hidden' },
  bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#1A1A1A', borderBottomLeftRadius: 4 },
  bubbleMediaOnly: { padding: 4, backgroundColor: 'transparent' },
  bubbleText: { fontSize: 16, lineHeight: 22, textAlign: 'right' },
  bubbleTextMe: { color: '#000', fontWeight: '500' },
  bubbleTextThem: { color: '#FFF' },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 4, paddingHorizontal: 5 },
  bubbleTime: { fontSize: 10 },
  bubbleTimeMe: { color: 'rgba(0,0,0,0.4)' },
  bubbleTimeThem: { color: 'rgba(255,255,255,0.3)' },
  tickIcon: { marginBottom: -2 },
  swipeAction: { width: 60, justifyContent: 'center', alignItems: 'center' },
  mediaContainer: { position: 'relative' },
  mediaBubbleImage: { width: 220, height: 220, borderRadius: 14, overflow: 'hidden' },
  downloadIconBtn: {
    position: 'absolute', bottom: 8, left: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'
  },
  fileBox: {
    flexDirection: 'row-reverse', alignItems: 'center', padding: 12,
    borderRadius: 14, gap: 10, minWidth: 180, maxWidth: 240, borderWidth: 1,
  },
  fileBoxMe: { backgroundColor: 'rgba(0,0,0,0.15)', borderColor: 'rgba(0,0,0,0.2)' },
  fileBoxThem: { backgroundColor: '#252525', borderColor: '#333' },
  fileName: { color: '#FFF', fontSize: 13, fontWeight: '600', textAlign: 'right' },
  repliedContext: {
    flexDirection: 'row-reverse', padding: 8, borderRadius: 10,
    marginBottom: 6, gap: 8, backgroundColor: 'rgba(255,255,255,0.05)'
  },
  repliedMe: { backgroundColor: 'rgba(0,0,0,0.1)' },
  repliedThem: { backgroundColor: 'rgba(255,255,255,0.05)' },
  repliedBar: { width: 3, borderRadius: 2 },
  repliedInfo: { flex: 1, alignItems: 'flex-end' },
  repliedSender: { fontSize: 11, fontWeight: 'bold' },
  repliedText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  progressContainer: {
    height: 36, marginHorizontal: 15, marginBottom: 8,
    backgroundColor: '#1A1A1A', borderRadius: 18, overflow: 'hidden', justifyContent: 'center',
  },
  progressBar: { height: '100%', backgroundColor: colors.primary, borderRadius: 18 },
  progressText: { position: 'absolute', width: '100%', textAlign: 'center', color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, paddingHorizontal: 12, gap: 8, backgroundColor: '#000' },
  attachBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  inputWrap: { flex: 1, backgroundColor: '#111', borderRadius: 25, paddingHorizontal: 15, paddingVertical: 8, minHeight: 44 },
  textInput: { flex: 1, color: '#FFF', fontSize: 16, textAlign: 'right', maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  likeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  replyPreviewWrapper: { paddingHorizontal: 12, paddingBottom: 4 },
  replyPreviewInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, borderWidth: 0.5, borderColor: `${colors.primary}55`, padding: 10, gap: 8 },
  replyPreviewLine: { width: 3, height: '100%', borderRadius: 2, marginRight: 4 },
  replyPreviewContent: { flex: 1 },
  replyPreviewSender: { fontSize: 12, fontWeight: '700', marginBottom: 2, textAlign: 'right' },
  replyPreviewText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'right' },
  replyClose: { padding: 4 },
  attachOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  attachMenu: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 30, paddingBottom: 50, flexDirection: 'row', justifyContent: 'center', gap: 40 },
  attachOption: { alignItems: 'center', gap: 10 },
  attachIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  attachLabel: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
