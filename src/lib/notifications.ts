import { supabase } from '../lib/supabase';

/**
 * 🔔 saveNotification
 * Persists a notification to the DB. Safe to call anywhere.
 * Will silently ignore if sender === receiver (no self-notifications).
 */
export const saveNotification = async (
  senderId: string,
  receiverId: string,
  type: 'like' | 'comment' | 'follow',
  postId?: string
): Promise<void> => {
  // Never notify yourself
  if (!senderId || !receiverId || senderId === receiverId) return;

  try {
    await supabase.from('notifications').insert({
      sender_id:   senderId,
      receiver_id: receiverId,
      type,
      post_id:     postId || null,
      is_read:     false,
    });
  } catch (err) {
    // Silent fail — notifications are non-critical
    console.warn('[saveNotification] failed:', err);
  }
};
