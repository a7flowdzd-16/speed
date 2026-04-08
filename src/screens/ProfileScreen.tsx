import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity,
  Modal, ActivityIndicator, Alert, ScrollView, TextInput, Linking,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';
import { PostCard } from '../components/PostCard';
import { GridVideoThumbnail } from '../components/GridVideoThumbnail';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { FollowListModal } from '../components/FollowListModal';
import { DynamicBottomSheet, DynamicBottomSheetRef } from '../components/DynamicBottomSheet';

const { width, height } = Dimensions.get('window');

const COLUMN_WIDTH = width / 3;

export const ProfileScreen = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);

  // Edit States
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [link1Title, setLink1Title] = useState('');
  const [link1Url, setLink1Url] = useState('');
  const [link2Title, setLink2Title] = useState('');
  const [link2Url, setLink2Url] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Stats States
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [showFollowList, setShowFollowList] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const editSheetRef = useRef<DynamicBottomSheetRef>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadUserPosts();
      fetchStats();
      setupRealtime();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    
    // 1. Followers Count
    const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
    setFollowersCount(fers || 0);

    // 2. Following Count
    const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
    setFollowingCount(fing || 0);

    // 3. Likes Count (from notifications type='like')
    const { count: lks } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('type', 'like');
    setLikesCount(lks || 0);
  };

  const setupRealtime = () => {
    const channelId = `stats-${user?.id}-${Date.now()}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => fetchStats())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${user?.id}` }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
    if (data) {
      setProfile(data);
      setEditFullName(data.full_name || '');
      setEditUsername(data.username || '');
      setEditBio(data.bio || '');
      setLink1Title(data.link_1_title || '');
      setLink1Url(data.link_1_url || '');
      setLink2Title(data.link_2_title || '');
      setLink2Url(data.link_2_url || '');
    }
  };

  const loadUserPosts = async () => {
    const { data } = await supabase.from('posts').select('*, profiles:user_id(*)').eq('user_id', user?.id).order('created_at', { ascending: false });
    if (data) setPosts(data);
    setLoading(false);
  };

  const handleLogout = async () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد أنك تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { 
        text: 'خروج', 
        style: 'destructive',
        onPress: async () => {
          setShowMenu(false);
          await supabase.auth.signOut();
        }
      }
    ]);
  };
  const handleSaveProfile = async () => {
    if (!editFullName.trim() || !editUsername.trim()) return;
    setSaving(true);
    setUsernameError('');

    try {
      // 1. Check Uniqueness (except self)
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', editUsername)
        .neq('id', user?.id)
        .maybeSingle();

      if (existing) {
        setUsernameError('هذا الاسم مستخدم مسبقاً في Nouble. اختر اسماً آخر.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setSaving(false);
        return;
      }

      // 2. 60-Day Check for Username
      const isUsernameChanging = editUsername !== profile?.username;
      if (isUsernameChanging && profile?.nouble_name_updated_at) {
        const lastUpdate = new Date(profile.nouble_name_updated_at).getTime();
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
        if (Date.now() - lastUpdate < sixtyDaysMs) {
          Alert.alert('قفل الهوية', 'لا يمكنك تغيير اسم Nouble إلا مرة واحدة كل 60 يوماً.');
          setSaving(false);
          return;
        }
      }

      // 3. Update
      const updates: any = { 
        full_name: editFullName, 
        username: editUsername,
        bio: editBio,
        link_1_title: link1Title,
        link_1_url: link1Url,
        link_2_title: link2Title,
        link_2_url: link2Url
      };
      
      if (isUsernameChanging) {
        updates.nouble_name_updated_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id);

      if (error) throw error;

      await loadProfile();
      setShowEdit(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('خطأ', err.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      // Upload to public 'avatars' bucket
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      setProfile({ ...profile, avatar_url: publicUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('خطأ في الرفع', err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const cleanUsername = (text: string) => {
    // Rule: No spaces, only alphanumeric and . _ -
    const cleaned = text.replace(/\s+/g, '_').toLowerCase();
    setEditUsername(cleaned);
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.profileMain}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{likesCount}</Text>
            <Text style={styles.statLabel}>إعجاب</Text>
          </View>
          <TouchableOpacity style={styles.statBox} onPress={() => { setFollowListType('following'); setShowFollowList(true); }}>
            <Text style={styles.statNum}>{followingCount}</Text>
            <Text style={styles.statLabel}>يتابع</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statBox} onPress={() => { setFollowListType('followers'); setShowFollowList(true); }}>
            <Text style={styles.statNum}>{followersCount}</Text>
            <Text style={styles.statLabel}>متابع</Text>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{posts.length}</Text>
            <Text style={styles.statLabel}>منشور</Text>
          </View>
        </View>
        <View style={styles.avatarBorder}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar}>
            <Image source={{ uri: profile?.avatar_url }} style={styles.avatar} contentFit="cover" />
            {uploadingAvatar && (
              <View style={[StyleSheet.absoluteFill, styles.avatarOverlay]}>
                <ActivityIndicator color="#FFF" />
              </View>
            )}
            <View style={styles.avatarEditIcon}>
              <Ionicons name="camera" size={16} color="#000" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.profileTitle}>{profile?.full_name || 'مستخدم'}</Text>
      
      {profile?.bio && <Text style={styles.bioTxt}>{profile.bio}</Text>}

      <View style={styles.linksRow}>
        {profile?.link_1_url && (
          <TouchableOpacity style={styles.linkBadge} onPress={() => Linking.openURL(profile.link_1_url)}>
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Text style={styles.linkBadgeTxt}>{profile.link_1_title || 'رابط 1'}</Text>
          </TouchableOpacity>
        )}
        {profile?.link_2_url && (
          <TouchableOpacity style={styles.linkBadge} onPress={() => Linking.openURL(profile.link_2_url)}>
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Text style={styles.linkBadgeTxt}>{profile.link_2_title || 'رابط 2'}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity style={styles.editBtn} onPress={() => setShowEdit(true)}>
        <Text style={styles.editBtnTxt}>تعديل الملف الشخصي</Text>
      </TouchableOpacity>

      <View style={styles.tabBar}>
        <View style={styles.tabActive}><Ionicons name="grid" size={20} color={colors.primary} /></View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(true)}>
          <Ionicons name="menu" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.topUsername}>@{profile?.username || 'nouble'}</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <FlatList
        data={posts}
        numColumns={3}
        ListHeaderComponent={renderHeader}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.postThumb} onPress={() => setSelectedPost(item)}>
            {item.media_type === 'video' ? (
              <GridVideoThumbnail uri={item.media_urls[0]} />
            ) : (
              <Image source={{ uri: item.media_urls[0] }} style={styles.thumbImage} contentFit="cover" />
            )}
            {item.media_type === 'video' && <View style={styles.playIcon}><Ionicons name="play" size={14} color="#FFF" /></View>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? <View style={styles.empty}><Ionicons name="images-outline" size={50} color="#333" /><Text style={styles.emptyTxt}>لا توجد منشورات حتى الآن</Text></View> : null}
      />

      {/* Settings Menu Modal */}
      <Modal visible={showMenu} animationType="slide" transparent onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)} />
        <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.dragHandle} />
          <Text style={styles.menuTitle}>الإعدادات والخصوصية</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconWrap}><Ionicons name="settings-outline" size={22} color="#FFF" /></View>
            <Text style={styles.menuItemTxt}>الإعدادات</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconWrap}><Ionicons name="shield-checkmark-outline" size={22} color="#FFF" /></View>
            <Text style={styles.menuItemTxt}>الأمان</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#300' }]}><Ionicons name="log-out-outline" size={22} color="#FF4D4D" /></View>
            <Text style={[styles.menuItemTxt, { color: '#FF4D4D' }]}>تسجيل الخروج</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <DynamicBottomSheet 
        ref={editSheetRef}
        isVisible={showEdit} 
        onClose={() => setShowEdit(false)} 
        title="تعديل الملف الشخصي"
        initialSnap={0.7}
      >
        <View style={[styles.editSheetContent, { paddingBottom: insets.bottom + 20 }]}>
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
          >
            <View style={styles.editInputGroup}>
              <Text style={styles.inputLabel}>الاسم الكامل</Text>
              <TextInput 
                style={styles.editInput} 
                value={editFullName} 
                onChangeText={setEditFullName} 
                onFocus={() => editSheetRef.current?.expand()}
                placeholder="الاسم المعروض" 
                placeholderTextColor="#444"
              />
            </View>

            <View style={styles.editInputGroup}>
              <Text style={styles.inputLabel}>اسم Nouble (@)</Text>
              <TextInput 
                style={[styles.editInput, usernameError ? { borderColor: '#F44' } : {}]} 
                value={editUsername} 
                onChangeText={cleanUsername} 
                onFocus={() => editSheetRef.current?.expand()}
                autoCapitalize="none"
                placeholder="nouble_name" 
                placeholderTextColor="#444"
              />
              {usernameError ? <Text style={styles.errorTxt}>{usernameError}</Text> : <Text style={styles.inputHint}>يجب أن يكون فريداً وبدون مسافات.</Text>}
            </View>

            <View style={styles.editInputGroup}>
              <Text style={styles.inputLabel}>نبذة تعريفية (Bio)</Text>
              <TextInput 
                style={[styles.editInput, { height: 80, textAlignVertical: 'top' }]} 
                value={editBio} 
                onChangeText={setEditBio} 
                onFocus={() => editSheetRef.current?.expand()}
                multiline 
                maxLength={2500}
                placeholder="أخبر العالم عنك..." 
                placeholderTextColor="#444"
              />
            </View>

            <View style={styles.linksEditRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>رابط 1</Text>
                <TextInput style={styles.miniInput} value={link1Title} onChangeText={setLink1Title} onFocus={() => editSheetRef.current?.expand()} placeholder="العنوان" placeholderTextColor="#444" />
                <TextInput style={styles.miniInput} value={link1Url} onChangeText={setLink1Url} onFocus={() => editSheetRef.current?.expand()} placeholder="https://..." placeholderTextColor="#444" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>رابط 2</Text>
                <TextInput style={styles.miniInput} value={link2Title} onChangeText={setLink2Title} onFocus={() => editSheetRef.current?.expand()} placeholder="العنوان" placeholderTextColor="#444" />
                <TextInput style={styles.miniInput} value={link2Url} onChangeText={setLink2Url} onFocus={() => editSheetRef.current?.expand()} placeholder="https://..." placeholderTextColor="#444" />
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity 
            style={[styles.saveBtn, (saving || !!usernameError) && { opacity: 0.5 }]} 
            onPress={handleSaveProfile} 
            disabled={saving || !!usernameError}
          >
            <Text style={styles.saveBtnTxt}>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</Text>
          </TouchableOpacity>
        </View>
      </DynamicBottomSheet>

      {/* Post Detail Modal */}
      <Modal visible={!!selectedPost} animationType="fade" onRequestClose={() => setSelectedPost(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 10 }]} onPress={() => setSelectedPost(null)}>
            <Ionicons name="chevron-back" size={30} color="#FFF" />
          </TouchableOpacity>
          <ScrollView style={{ marginTop: insets.top + 60 }}>
            {selectedPost && <PostCard post={selectedPost} isActive={true} />}
          </ScrollView>
        </View>
      </Modal>

      {loading && <View style={StyleSheet.absoluteFill}><ActivityIndicator color={colors.primary} size="large" style={{ flex: 1 }} /></View>}
      
      {user && (
        <FollowListModal 
          visible={showFollowList} 
          onClose={() => setShowFollowList(false)} 
          userId={user.id} 
          type={followListType} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, marginBottom: 15 },
  topUsername: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  menuBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerContent: { paddingHorizontal: 20 },
  profileMain: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  avatarBorder: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: colors.primary, padding: 3 },
  avatar: { width: '100%', height: '100%', borderRadius: 45, backgroundColor: '#111' },
  avatarOverlay: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 45, justifyContent: 'center', alignItems: 'center' },
  avatarEditIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.primary, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  statsRow: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'space-around', marginLeft: 10 },
  statBox: { alignItems: 'center' },
  statNum: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  profileTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 },
  bioTxt: { color: '#AAA', fontSize: 13, textAlign: 'right', marginBottom: 15, lineHeight: 18 },
  linksRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  linkBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#111', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, borderWidth: 1, borderColor: '#222', gap: 5 },
  linkBadgeTxt: { color: colors.primary, fontSize: 12, fontWeight: '500' },
  editBtn: { backgroundColor: '#1A1A1A', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 25 },
  editBtnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  tabBar: { borderBottomWidth: 1, borderBottomColor: '#333', flexDirection: 'row-reverse' },
  tabActive: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: colors.primary },
  postThumb: { width: COLUMN_WIDTH, height: COLUMN_WIDTH, padding: 1 },
  thumbImage: { width: '100%', height: '100%', backgroundColor: '#111' },
  playIcon: { position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 },
  empty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyTxt: { color: '#333', marginTop: 10, fontSize: 16 },
  
  // Menu Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  menuSheet: { backgroundColor: '#111', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#333', alignSelf: 'center', borderRadius: 2, marginBottom: 20 },
  menuTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 25 },
  menuItem: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 15 },
  menuIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  menuItemTxt: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 10 },
  
  // Close Btn
  closeBtn: { position: 'absolute', left: 20, zIndex: 10, padding: 5 },

  // Edit Profile Styles
  noubleName: { color: colors.primary, fontSize: 13, textAlign: 'right', marginBottom: 15, fontWeight: '500' },
  editSheet: { backgroundColor: '#111', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25 },
  sheetHeaderEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  editTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  editInputGroup: { marginBottom: 20 },
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 8, paddingRight: 5, textAlign: 'right' },
  editInput: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 15, color: '#FFF', textAlign: 'right', borderWidth: 1, borderColor: '#222' },
  inputHint: { color: '#555', fontSize: 11, marginTop: 5, textAlign: 'right' },
  errorTxt: { color: '#F44', fontSize: 11, marginTop: 5, textAlign: 'right' },
  linksEditRow: { flexDirection: 'row-reverse', marginTop: 10 },
  miniInput: { backgroundColor: '#1A1A1A', borderRadius: 8, padding: 10, color: '#FFF', fontSize: 12, textAlign: 'right', marginBottom: 8, borderWidth: 1, borderColor: '#222' },
  editSheetContent: { flex: 1, padding: 20 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  saveBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});

export default ProfileScreen;
