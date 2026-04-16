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
import { apiClient, getFileUrl } from '../config/api';
import { useNavigation } from '@react-navigation/native';
import { PostCard } from '../components/PostCard';
import { ActivityPostCard } from '../components/ActivityPostCard';
import { GridVideoThumbnail } from '../components/GridVideoThumbnail';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { FollowListModal } from '../components/FollowListModal';
import { DynamicBottomSheet, DynamicBottomSheetRef } from '../components/DynamicBottomSheet';
import { ProfileQRCodeModal } from '../components/ProfileQRCodeModal';

const { width, height } = Dimensions.get('window');

const COLUMN_WIDTH = width / 3;

export const ProfileScreen = () => {
  const { user, logout, updateUser } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'activities'>('posts');
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showQRView, setShowQRView] = useState(false);

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
      setProfile(user);
      setEditFullName(user.full_name || '');
      setEditUsername(user.username || '');
      setEditBio(user.bio || '');
      setLink1Title(user.link_1_title || '');
      setLink1Url(user.link_1_url || '');
      setLink2Title(user.link_2_title || '');
      setLink2Url(user.link_2_url || '');
      
      // Temporary bypass for Supabase migrations
      // loadUserPosts();
      // loadUserActivities();
      // fetchStats();
      // setupRealtime();
      
      fetchProfileData();

      setLoading(false);
    }
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;
    try {
      const data = await apiClient.get(`/users/${user.id}/profile-data`);
      console.log('API FETCH PROFILE DATA:', JSON.stringify(data.user));
      if (data && !data.error) {
        setProfile(data.user);
        setPosts(data.posts || []);
        setFollowersCount(data.stats?.followers || 0);
        setFollowingCount(data.stats?.following || 0);
        
        // Use fresh data to sync edit states if we are editing
        if (data.user) {
          setEditFullName(data.user.full_name || '');
          setEditUsername(data.user.username || '');
          setEditBio(data.user.bio || '');
          setLink1Title(data.user.link_1_title || '');
          setLink1Url(data.user.link_1_url || '');
          setLink2Title(data.user.link_2_title || '');
          setLink2Url(data.user.link_2_url || '');
        }
      }
    } catch (err) {
      console.error('Error fetching profile data:', err);
    }
  };

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
    // Temporarily disabled due to custom backend migration
    return () => {};
    /*
    const channelId = `stats-${user?.id}-${Date.now()}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => fetchStats())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${user?.id}` }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    */
  };

  const loadProfile = async () => {
    // try {
    //   // If we had a GET /users/:id endpoint, we'd use it here. 
    //   // For now, Auth user data usually acts as profile.
    // } catch (e) {}
  };

  const loadUserPosts = async () => {
    if (!user) return;
    try {
      const data = await apiClient.get(`/users/${user.id}/profile-data`);
      if (data && data.posts) setPosts(data.posts);
    } catch (e) {}
    setLoading(false);
  };

  const loadUserActivities = async () => {
    const { data } = await supabase.from('activities').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
    if (data) setActivities(data);
  };

  const handleLogout = async () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد أنك تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { 
        text: 'خروج', 
        style: 'destructive',
        onPress: async () => {
          setShowMenu(false);
          await logout();
        }
      }
    ]);
  };
  const handleSaveProfile = async () => {
    if (!editFullName.trim() || !editUsername.trim()) return;
    setSaving(true);
    setUsernameError('');

    try {
      // 1. Send Update to API
      const updates: any = { 
        id: user?.id,
        full_name: editFullName, 
        username: editUsername,
        bio: editBio,
        link_1_title: link1Title,
        link_1_url: link1Url,
        link_2_title: link2Title,
        link_2_url: link2Url
      };

      const updateRes = await apiClient.put('/users/update', updates);
      
      if (updateRes.error) {
        throw new Error(updateRes.error);
      }

      // Update global context so other screens (like Home) reflect changes instantly
      await updateUser({
        full_name: editFullName,
        username: editUsername,
        bio: editBio
      });

      // Re-fetch to update ui
      await fetchProfileData();
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
      // 1. Compress & Resize the cropped image
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 500, height: 500 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 2. Prepare upload payload
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('upload_type', 'avatars');
      const filename = manipResult.uri.split('/').pop() || 'avatar.jpg';
      formData.append('media', {
        uri: manipResult.uri,
        name: filename,
        type: 'image/jpeg',
      } as any);

      // 3. Send to Server (/upload endpoint expects 'media')
      const uploadRes = await apiClient.post('/upload', formData);
      
      if (uploadRes.urls && uploadRes.urls.length > 0) {
        const newAvatarUrl = uploadRes.urls[0];

        // 4. Update MySQL Database using /users/update
        await apiClient.put('/users/update', { id: user.id, avatar_url: newAvatarUrl });

        // 5. Update global context instantly (fix Home story circle)
        await updateUser({ avatar_url: newAvatarUrl });

        // 6. Sync local UI 
        setProfile((prev: any) => ({ ...prev, avatar_url: newAvatarUrl }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error('لم يستجب الخادم برابط الصورة المرفوعة.');
      }
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      Alert.alert('خطأ', 'فشل في رفع وتحديث الصورة الشخصية.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const cleanUsername = (text: string) => {
    // Rule: No spaces, only alphanumeric and . _ -
    const cleaned = text.replace(/\s+/g, '_').toLowerCase();
    setEditUsername(cleaned);
  };

  const renderHeader = () => {
    const displayUser = profile || user; // fallback to stale auth user if profile not yet loaded

    return (
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
            <Image 
              source={{ uri: displayUser?.avatar_url ? getFileUrl(displayUser.avatar_url) : `https://i.pravatar.cc/150?u=${displayUser?.id || 'default'}` }} 
              style={styles.avatar} 
              contentFit="cover" 
            />
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
      
      <Text style={styles.profileTitle}>{displayUser?.full_name || 'مستخدم'}</Text>
      
      <Text style={styles.bioTxt}>{displayUser?.bio || 'لا توجد سيرة ذاتية بعد'}</Text>

      <View style={styles.linksRow}>
        {displayUser?.link_1_url && (
          <TouchableOpacity style={styles.linkBadge} onPress={() => Linking.openURL(displayUser.link_1_url)}>
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Text style={styles.linkBadgeTxt}>{displayUser.link_1_title || 'رابط 1'}</Text>
          </TouchableOpacity>
        )}
        {displayUser?.link_2_url && (
          <TouchableOpacity style={[styles.linkBadge, { marginLeft: 8 }]} onPress={() => Linking.openURL(displayUser.link_2_url)}>
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Text style={styles.linkBadgeTxt}>{displayUser.link_2_title || 'رابط 2'}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity style={styles.editBtn} onPress={() => setShowEdit(true)}>
        <Text style={styles.editBtnTxt}>تعديل الملف الشخصي</Text>
      </TouchableOpacity>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabContent, activeTab === 'posts' && styles.tabActive]} onPress={() => setActiveTab('posts')}>
          <Ionicons name="grid" size={22} color={activeTab === 'posts' ? colors.primary : '#555'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabContent, activeTab === 'activities' && styles.tabActive]} onPress={() => setActiveTab('activities')}>
          <Ionicons name="pulse" size={24} color={activeTab === 'activities' ? colors.primary : '#555'} />
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(true)}>
          <Ionicons name="menu" size={28} color="#FFF" />
        </TouchableOpacity><Text style={styles.topUsername}>@{profile?.username || user?.username || 'user'}</Text><TouchableOpacity style={styles.menuBtn} onPress={() => setShowQRView(true)}>
          <Ionicons name="qr-code-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {activeTab === 'posts' ? (
        <FlatList
          key="posts-grid"
          data={posts}
          numColumns={3}
          ListHeaderComponent={renderHeader}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.postThumb} onPress={() => setSelectedPost(item)}>
              {item.media_type === 'video' ? (
                <GridVideoThumbnail uri={getFileUrl(item.media_urls[0])} />
              ) : (
                <Image source={{ uri: getFileUrl(item.media_urls[0]) }} style={styles.thumbImage} contentFit="cover" />
              )}
              {item.media_type === 'video' && <View style={styles.playIcon}><Ionicons name="play" size={14} color="#FFF" /></View>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={!loading ? <View style={styles.empty}><Ionicons name="images-outline" size={50} color="#333" /><Text style={styles.emptyTxt}>لا توجد منشورات حتى الآن</Text></View> : null}
        />
      ) : (
        <FlatList
          key="activities-list"
          data={activities}
          ListHeaderComponent={renderHeader}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ActivityPostCard activity={item} profile={profile} />
          )}
          ListEmptyComponent={!loading ? <View style={styles.empty}><Ionicons name="walk" size={50} color="#333" /><Text style={styles.emptyTxt}>لا توجد نشاطات مسجلة</Text></View> : null}
        />
      )}

      {/* Settings Menu Modal */}
      <Modal visible={showMenu} animationType="slide" transparent onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)} />
        <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.dragHandle} />
          <Text style={styles.menuTitle}>الإعدادات والخصوصية</Text>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => { setShowMenu(false); navigation.navigate('Settings'); }}
          >
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
              <Text style={styles.inputLabel}>Nouble Name (@)</Text>
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

      {profile && (
        <ProfileQRCodeModal 
          visible={showQRView} 
          onClose={() => setShowQRView(false)} 
          user={{ id: user.id, username: profile.username || profile.full_name }} 
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
  tabBar: { borderBottomWidth: 1, borderBottomColor: '#222', flexDirection: 'row-reverse' },
  tabContent: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
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
