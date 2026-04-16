          import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Pressable
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { getFileUrl, apiClient } from '../config/api';

interface CommentsModalProps {
  isVisible: boolean;
  onClose: () => void;
  postId: number;
  userId: number; // Current logged-in user
}

export const CommentsModal = ({ isVisible, onClose, postId, userId }: CommentsModalProps) => {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null); // Stores the comment object being replied to
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isVisible) {
      fetchComments();
    } else {
      // Reset state when closed
      setReplyingTo(null);
      setNewComment('');
    }
  }, [isVisible]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      // Pass current_user_id to know if the user liked the comments
      const data = await apiClient.get(`/comments/${postId}`, { current_user_id: userId });
      if (data) setComments(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleLike = async (commentId: number, isCurrentlyLiked: boolean, currentCount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Optimistic Update
    setComments(prev => 
      prev.map(c => 
        c.id === commentId 
          ? { ...c, is_liked: !isCurrentlyLiked, likes_count: currentCount + (isCurrentlyLiked ? -1 : 1) } 
          : c
      )
    );

    try {
      const result = await apiClient.post(`/comments/${commentId}/like`, { user_id: userId });
      if (result) {
        // Sync with server if needed
        setComments(prev => 
          prev.map(c => 
            c.id === commentId 
              ? { ...c, is_liked: result.is_liked, likes_count: result.likes_count } 
              : c
          )
        );
      }
    } catch (e) {
      console.error(e);
      // Revert on error
      setComments(prev => 
        prev.map(c => 
          c.id === commentId 
            ? { ...c, is_liked: isCurrentlyLiked, likes_count: currentCount } 
            : c
        )
      );
    }
  };

  const handleReplyPress = (comment: any) => {
    setReplyingTo(comment);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const submitComment = async () => {
    const content = newComment.trim();
    if (!content) return;

    const parentId = replyingTo ? replyingTo.id : null;
    
    // Optimistic reset of input
    setNewComment('');
    setReplyingTo(null);

    try {
      const parent_id_payload = parentId ? { parent_id: parentId } : {};
      const data = await apiClient.post('/comments', { 
        user_id: userId, 
        post_id: postId, 
        content,
        ...parent_id_payload
      });
      if (data) {
        setComments(prev => [...prev, data]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch(e) {
      console.error(e);
    }
  };

  // Grouping replies under parent comments
  const renderComments = () => {
    const mainComments = comments.filter(c => !c.parent_id);
    const repliesMap: any = {};
    
    comments.filter(c => c.parent_id).forEach(reply => {
      if (!repliesMap[reply.parent_id]) repliesMap[reply.parent_id] = [];
      repliesMap[reply.parent_id].push(reply);
    });

    const renderCommentNode = (item: any, isReply = false) => {
      const _isLiked = item.is_liked;
      const _likeCount = item.likes_count || 0;
      
      return (
        <View key={item.id}>
          <View style={[styles.commentRow, isReply && { marginLeft: 40, marginTop: 10 }]}>
            <Image 
              source={{ uri: getFileUrl(item.profiles?.avatar_url) }} 
              style={[styles.commentAvatar, isReply && { width: 28, height: 28, borderRadius: 14 }]} 
            />
            <View style={styles.commentContentArea}>
              <View style={styles.commentBubble}>
                <Text style={styles.commentUser}>
                  {item.profiles?.username || item.profiles?.full_name || 'مستخدم'}
                </Text>
                <Text style={styles.commentText}>{item.content}</Text>
              </View>
              
              <View style={styles.commentActions}>
                <Text style={styles.actionTextSmall}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
                {_likeCount > 0 && (
                  <Text style={styles.actionTextSmall}>{_likeCount} إعجابات</Text>
                )}
                <TouchableOpacity onPress={() => handleReplyPress(isReply ? {id: item.parent_id, profiles: item.profiles} : item)}>
                  <Text style={styles.actionTextReply}>رد</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.likeBtn} 
              onPress={() => handleLike(item.id, _isLiked, _likeCount)}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            >
              <Ionicons 
                name={_isLiked ? "heart" : "heart-outline"} 
                size={14} 
                color={_isLiked ? "#FF3B30" : "#888"} 
              />
            </TouchableOpacity>
          </View>

          {/* Render its replies */}
          {!isReply && repliesMap[item.id] && repliesMap[item.id].map((reply: any) => renderCommentNode(reply, true))}
        </View>
      );
    };

    return (
      <FlatList
        data={mainComments}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => renderCommentNode(item)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? <Text style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>لا توجد تعليقات بعد. كن أول من يعلق!</Text> : null
        }
      />
    );
  };

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: Math.max(insets.top, 10), paddingBottom: insets.bottom }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          
          <View style={styles.header}>
            <View style={styles.headerDragIndicator} />
            <Text style={styles.headerTitle}>التعليقات</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
            ) : (
              renderComments()
            )}
          </View>

          {/* Input Bar Fixed at Bottom */}
          <View style={styles.inputContainer}>
            {replyingTo && (
              <View style={styles.replyingToBar}>
                <Text style={styles.replyingToText}>
                  يتم الرد على @{replyingTo.profiles?.username || replyingTo.profiles?.full_name}
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Ionicons name="close-circle" size={16} color="#AAA" />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={newComment}
                onChangeText={setNewComment}
                placeholder="أضف تعليقاً..."
                placeholderTextColor="#666"
                multiline
                maxLength={300}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !newComment.trim() && { opacity: 0.5 }]}
                onPress={submitComment}
                disabled={!newComment.trim()}
              >
                <Ionicons name="arrow-up" size={18} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
          
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  headerDragIndicator: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', marginBottom: 12
  },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  closeBtn: { position: 'absolute', right: 15, top: 15 },
  
  commentRow: { flexDirection: 'row-reverse', marginBottom: 16, alignItems: 'flex-start' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginLeft: 10 },
  commentContentArea: { flex: 1, alignItems: 'flex-end' },
  commentBubble: { alignItems: 'flex-end' },
  commentUser: { color: '#999', fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  commentText: { color: '#FFF', fontSize: 14, textAlign: 'right', lineHeight: 20 },
  
  commentActions: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 6, gap: 15 },
  actionTextSmall: { color: '#666', fontSize: 11 },
  actionTextReply: { color: '#888', fontSize: 11, fontWeight: 'bold' },
  
  likeBtn: { paddingLeft: 10, paddingTop: 5 },

  inputContainer: {
    borderTopWidth: 0.5, 
    borderTopColor: '#222', 
    backgroundColor: '#0A0A0A',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10
  },
  replyingToBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8
  },
  replyingToText: { color: '#AAA', fontSize: 12 },
  
  inputRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  textInput: { 
    flex: 1, 
    backgroundColor: '#1A1A1A', 
    color: '#FFF', 
    borderRadius: 20, 
    paddingHorizontal: 18, 
    paddingVertical: 10, 
    textAlign: 'right', 
    maxHeight: 100,
    minHeight: 40
  },
  sendBtn: { 
    width: 36, height: 36, 
    borderRadius: 18, 
    backgroundColor: colors.primary, 
    justifyContent: 'center', alignItems: 'center' 
  },
});
