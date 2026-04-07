import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, ActivityIndicator, Alert, Linking, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const THUMB_SIZE = width / 3;

interface Profile {
  full_name: string;
  avatar_url: string;
  bio: string;
  link_url: string;
  link_text: string;
}

export const ProfileScreen = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Edit Modal States
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editLinkText, setEditLinkText] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUserPosts();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setProfile(data);
        setEditName(data.full_name || '');
        setEditBio(data.bio || '');
        setEditLinkUrl(data.link_url || '');
        setEditLinkText(data.link_text || '');
      }
    } catch (error: any) {
      console.log('Error fetching profile:', error.message);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.log('Error fetching user posts:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // Pro Crop Mode
        aspect: [1, 1],      // Perfect Square
        quality: 1, // BEST QUALITY
      });

      if (result.canceled || !result.assets[0].uri) {
        return;
      }

      setUploadingAvatar(true);
      const asset = result.assets[0];
      const fileName = `${user?.id}/${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });

      const { error: uploadError } = await supabase.storage
        .from('post-media') 
        .upload(filePath, decode(base64), { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('post-media')
        .getPublicUrl(filePath);

      // Add timestamp to prevent local caching keeping the old image
      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      if (!profile) {
        const { error: insertError } = await supabase.from('profiles').insert({ id: user?.id, avatar_url: avatarUrl });
        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user?.id);
        if (updateError) throw updateError;
      }
      
      setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : { full_name: 'مستخدم جديد', avatar_url: avatarUrl, bio: '', link_url: '', link_text: '' });
      
    } catch (error: any) {
      Alert.alert('حدث خطأ', error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      return Alert.alert('تنبيه', 'يجب أن لا يكون الاسم فارغاً');
    }
    setSavingProfile(true);
    try {
      const updates = {
        full_name: editName.trim(),
        bio: editBio.trim(),
        link_url: editLinkUrl.trim(),
        link_text: editLinkText.trim()
      };

      if (!profile) {
        const { error } = await supabase.from('profiles').insert({ id: user?.id, ...updates });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
        if (error) throw error;
      }

      setProfile(prev => prev ? { ...prev, ...updates } : { avatar_url: '', ...updates });
      setEditModalVisible(false);
    } catch (err: any) {
      Alert.alert('خطأ أثناء الحفظ', err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenLink = () => {
    if (profile?.link_url) {
      Linking.openURL(profile.link_url).catch((err) => 
        Alert.alert('خطأ', 'لا يمكن فتح الرابط!')
      );
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Profile Picture */}
      <TouchableOpacity onPress={uploadAvatar} disabled={uploadingAvatar}>
        <View style={styles.avatarWrapper}>
          {profile?.avatar_url ? (
            <Image 
              source={{ uri: profile.avatar_url }} 
              style={styles.avatarImage} 
              contentFit="cover"
              cachePolicy="none" // To always assure we see fresh image if multiple uploads happen
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={50} color={colors.border} />
            </View>
          )}
          {uploadingAvatar && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
          <View style={styles.editIconBadge}>
            <Ionicons name="camera" size={14} color="#000" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Name and Stats */}
      <Text style={styles.fullName}>{profile?.full_name || 'مستخدم جديد'}</Text>

      {/* Bio Component */}
      {(profile?.bio) && <Text style={styles.bio}>{profile.bio}</Text>}

      {/* Custom Feature Link Component */}
      {(profile?.link_url && profile?.link_text) && (
        <TouchableOpacity style={styles.linkContainer} onPress={handleOpenLink}>
          <Ionicons name="link-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.linkText}>{profile.link_text}</Text>
        </TouchableOpacity>
      )}

      {/* Edit Profile Button */}
      <TouchableOpacity 
        style={styles.editProfileBtn} 
        onPress={() => setEditModalVisible(true)}
      >
        <Text style={styles.editProfileBtnText}>تعديل الحساب</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider} />
    </View>
  );

  const renderGridItem = ({ item }: { item: any }) => {
    const isVideo = item.media_type === 'video';
    const thumbUrl = item.media_urls?.[0]; // first frame/image

    return (
      <View style={styles.gridItem}>
        <Image style={styles.gridImage} source={{ uri: thumbUrl }} contentFit="cover" />
        {isVideo && (
          <View style={styles.videoIconOverlay}>
            <Ionicons name="play" size={24} color="#FFF" />
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        ListHeaderComponent={renderHeader}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={renderGridItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="albums-outline" size={50} color={colors.border} />
            <Text style={styles.emptyText}>لم تقم بنشر أي مزاد أو صورة بعد.</Text>
          </View>
        }
      />

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>تعديل البيانات</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>الاسم (Username)</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="الاسم الكامل"
            />

            <Text style={styles.inputLabel}>السيرة الذاتية (Bio)</Text>
            <TextInput
              style={[styles.modalInput, { height: 100 }]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="اكتب شيئاً عنك..."
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>رابط المتجر / الموقع</Text>
            <TextInput
              style={styles.modalInput}
              value={editLinkUrl}
              onChangeText={setEditLinkUrl}
              placeholder="https://..."
              keyboardType="url"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>وصف الرابط (يظهر للزوار)</Text>
            <TextInput
              style={styles.modalInput}
              value={editLinkText}
              onChangeText={setEditLinkText}
              placeholder="مثال: متجري الخاص"
            />

            <TouchableOpacity 
              style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]} 
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                 <ActivityIndicator color="#000" />
              ) : (
                 <Text style={styles.saveBtnText}>حفظ التعديلات</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  headerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  avatarWrapper: {
    marginBottom: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.inputBackground,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  fullName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  bio: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
    marginBottom: 15,
  },
  linkText: {
    color: colors.text,
    fontWeight: '600',
    marginLeft: 5,
    fontSize: 14,
  },
  editProfileBtn: {
    width: '80%',
    paddingVertical: 12,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    alignItems: 'center',
  },
  editProfileBtnText: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.text,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginTop: 20,
  },
  gridItem: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderWidth: 0.5,
    borderColor: colors.background,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.inputBackground,
  },
  videoIconOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
    opacity: 0.8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 16,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
