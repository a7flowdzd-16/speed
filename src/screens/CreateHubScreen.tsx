import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  KeyboardAvoidingView, Platform, Alert, Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CreatePostScreen } from './CreatePostScreen';

const { width, height } = Dimensions.get('window');

export const CreateHubScreen = () => {
  const navigation = useNavigation() as any;
  const insets = useSafeAreaInsets();
  
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [title, setTitle] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const askPermissions = async () => {
      if (!permission?.granted && permission?.canAskAgain) {
        await requestPermission();
      }
      if (!micPermission?.granted && micPermission?.canAskAgain) {
        await requestMicPermission();
      }
    };
    askPermissions();
  }, [permission, micPermission]);

  const handleStartLive = async () => {
    if (!title.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return Alert.alert('تنبيه', 'الرجاء إدخال عنوان للبث المباشر أولاً 😉');
    }

    setIsStarting(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      setIsStarting(false);
      return Alert.alert('خطأ', 'يجب تسجيل الدخول أولاً');
    }

    // 1. Force close any existing sessions (to avoid ghost "LIVE" indicator)
    await supabase
      .from('live_streams')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'live');

    // 2. Insert new stream record
    const { data: stream, error } = await supabase
      .from('live_streams')
      .insert({ user_id: user.id, title: title.trim(), status: 'live' })
      .select()
      .single();

    if (error || !stream) {
      setIsStarting(false);
      return Alert.alert('خطأ', 'فشل تجهيز البث. حاول مرة أخرى.');
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // reset state
    setTitle('');
    setIsStarting(false);

    // Navigate to HostLive inside MainTabs
    navigation.navigate('MainTabs', {
      screen: 'HostLive',
      params: {
        streamId: stream.id,
        title: stream.title,
      }
    });
  };

  // Instagram Style Live preview
  return (
    <View style={styles.container}>
      
      {/* 1. Camera Background */}
      {permission?.granted && micPermission?.granted ? (
        <CameraView 
          style={styles.camera} 
          facing={facing}
        />
      ) : (
        <View style={styles.cameraPlaceholder}>
           <Ionicons name="camera-outline" size={80} color="rgba(255,255,255,0.1)" />
           <Text style={styles.permissionText}>يحتاج التطبيق إلى إذن الكاميرا والميكروفون</Text>
           <TouchableOpacity style={styles.permissionBtn} onPress={async () => {
             if (!permission?.granted) await requestPermission();
             if (!micPermission?.granted) await requestMicPermission();
           }}>
             <Text style={styles.permissionBtnText}>السماح بالوصول</Text>
           </TouchableOpacity>
        </View>
      )}

      {/* 2. Top UI Gradient & Header */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={[styles.topGradient, { paddingTop: insets.top + 10 }]}
        pointerEvents="none"
      />
      
      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>
        
        {permission?.granted && (
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFacing(f => f === 'back' ? 'front' : 'back');
            }}
          >
            <Ionicons name="camera-reverse-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Bottom UI Gradient & Controls */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.bottomControls}
      >
        <View style={styles.setupContainer}>
          
          <View style={styles.titleWrapper}>
            <TextInput 
              style={styles.titleInput} 
              placeholder="عنوان اللايف (مثال: مزاد تحف فنية 🔥)" 
              placeholderTextColor="rgba(255,255,255,0.6)" 
              value={title} 
              onChangeText={setTitle} 
              textAlign="right"
              maxLength={40}
            />
          </View>
          
          <View style={styles.liveActionRow}>
             {/* Center Big Instagram-like Record Button */}
             <TouchableOpacity 
               style={[styles.igLiveBtnWrapper, !title.trim() && { opacity: 0.8 }]} 
               onPress={handleStartLive}
               disabled={isStarting}
               activeOpacity={0.7}
             >
               <View style={styles.igLiveBtnOuter}>
                  <LinearGradient 
                    colors={['#FF3B30', '#FF6B30']}
                    style={styles.igLiveBtnInner}
                  >
                    {isStarting ? (
                      <ActivityIndicator color="#FFF" size="large" />
                    ) : (
                      <Ionicons name="radio-outline" size={32} color="#FFF" />
                    )}
                  </LinearGradient>
               </View>
               <Text style={styles.igLiveLabel}>
                 {isStarting ? 'جاري التجهيز...' : 'بدء البث 🔴'}
               </Text>
             </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  permissionText: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  permissionBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  permissionBtnText: { color: '#000', fontWeight: 'bold' },
  topGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 140,
  },
  topBar: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, zIndex: 10,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 350,
  },
  bottomControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 10,
  },
  setupContainer: {
    paddingHorizontal: 25,
    paddingBottom: 20,
    alignItems: 'center',
  },
  titleWrapper: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 35,
    overflow: 'hidden',
    paddingHorizontal: 15,
  },
  titleInput: {
    width: '100%',
    paddingVertical: 16,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  liveActionRow: {
    alignItems: 'center',
    marginBottom: 30,
  },
  igLiveBtnWrapper: {
    alignItems: 'center',
    gap: 12,
  },
  igLiveBtnOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  igLiveBtnInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  igLiveLabel: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
