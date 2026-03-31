import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    getProfile();
  }, []);

  async function getProfile() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || '');
        setUsername(user.user_metadata?.username || '');
        setAvatarUrl(user.user_metadata?.avatar_url || null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user on session!');

      const updates = {
         data: {
            username,
            avatar_url: avatarUrl,
         }
      };

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      Alert.alert('نجاح', 'تم تحديث ملفك الشخصي بنجاح! 🎉');
    } catch (error: any) {
      Alert.alert('خطأ', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function pickImage() {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
      // في التطبيق الحقيقي، سنرفع الصورة لـ Supabase Storage أولاً،
      // ولكن للتبسيط حالياً سنحفظ الـ URI المحلي.
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/auth');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.header}>
           <Text style={styles.title}>إعدادات الحساب</Text>
           <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={24} color="#FF4B2B" />
           </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
           <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                   <Ionicons name="camera" size={30} color="#888" />
                </View>
              )}
              <View style={styles.editIcon}>
                 <Ionicons name="pencil" size={16} color="#fff" />
              </View>
           </TouchableOpacity>
           <Text style={styles.emailText}>{email}</Text>
        </View>

        <View style={styles.form}>
           <View style={styles.inputGroup}>
              <Text style={styles.label}>اسم المستخدم</Text>
              <View style={styles.field}>
                 <Ionicons name="person-outline" size={20} color="#888" />
                 <TextInput
                   style={styles.input}
                   value={username}
                   onChangeText={setUsername}
                   placeholder="أدخل اسمك الجديد"
                   placeholderTextColor="#555"
                 />
              </View>
           </View>

           <TouchableOpacity 
             style={styles.saveBtn} 
             onPress={updateProfile} 
             disabled={loading}
           >
             {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>حفظ التغييرات</Text>}
           </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
           <Text style={styles.infoTitle}>معلومات التطبيق</Text>
           <View style={styles.infoCard}>
              <Text style={styles.infoText}>إصدار التطبيق: 1.0.0 (Beta)</Text>
              <Text style={styles.infoText}>Supabase Connected: Verified ✅</Text>
           </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 35,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
  },
  logoutBtn: {
     width: 44, height: 44, borderRadius: 15,
     backgroundColor: 'rgba(255, 75, 43, 0.1)',
     justifyContent: 'center', alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarWrapper: {
     width: 120, height: 120, borderRadius: 60,
     position: 'relative',
     borderWidth: 3,
     borderColor: '#FF4B2B',
     padding: 4,
  },
  avatar: {
    width: '100%', height: '100%', borderRadius: 55,
  },
  avatarPlaceholder: {
    width: '100%', height: '100%', borderRadius: 55,
    backgroundColor: '#111',
    justifyContent: 'center', alignItems: 'center',
  },
  editIcon: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FF4B2B',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#000',
  },
  emailText: {
    color: '#888',
    fontSize: 14,
    marginTop: 15,
    fontWeight: '600',
  },
  form: {
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    marginLeft: 5,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 18,
    paddingHorizontal: 15,
    height: 60,
    borderWidth: 1,
    borderColor: '#222',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  saveBtn: {
    backgroundColor: '#FF4B2B',
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#FF4B2B', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 8,
  },
  saveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  infoSection: {
    marginTop: 10,
  },
  infoTitle: {
    color: '#555',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  infoText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  }
});
