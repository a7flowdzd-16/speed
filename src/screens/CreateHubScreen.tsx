import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import io from 'socket.io-client';
import { LIVE_CONFIG } from '../config/api';

// IMPORTANT: Install this library for RTMP broadcasting
// npx expo install react-native-nodemediaclient
// NOTE: This library requires a custom dev client (expo prebuild). It WILL NOT work in standard Expo Go!
// We use require() below to avoid crashing Expo Go if you haven't built the DEV client yet.
let NodeCameraView: any;
try {
  NodeCameraView = require('react-native-nodemediaclient').NodeCameraView;
} catch (e) {
  // Graceful fallback for Expo Go
}

import { CreatePostScreen } from './CreatePostScreen';

// Production Cloud Endpoints mapped to your Google Compute Engine
const BACKEND_URL = LIVE_CONFIG.CHAT_SERVER; 
const RTMP_SERVER = LIVE_CONFIG.RTMP_PUBLISH; 

export const CreateHubScreen = () => {
  const navigation = useNavigation() as any;
  const [activeTab, setActiveTab] = useState<'live' | 'post'>('live');
  
  // Settings & HUD
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [quality, setQuality] = useState<'720p' | '240p'>('720p');
  const [title, setTitle] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  
  // Real-Time Socket State
  const socketRef = useRef<any>(null);
  const nodeCameraRef = useRef<any>(null); // RTMP Camera Reference
  const [roomId, setRoomId] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [liveChatMessages, setLiveChatMessages] = useState<any[]>([]);
  const [myMessage, setMyMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Profile data for chat
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // Fetch host profile
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single()
          .then(({ data }) => setProfile(data));
      }
    });
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isLive && roomId) {
      // 1. Timer
      timer = setInterval(() => setSeconds(prev => prev + 1), 1000);

      // 2. Connect to Socket.io Backend
      socketRef.current = io(BACKEND_URL);
      
      socketRef.current.emit('join_room', roomId);

      socketRef.current.on('chat_message', (msg: any) => {
        setLiveChatMessages(prev => [...prev, msg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      });

      socketRef.current.on('viewers_update', (count: number) => {
        // Broadcaster doesn't count as viewer, subtract 1 if needed, or just display
        setViewerCount(count > 0 ? count - 1 : 0); 
      });

      return () => {
        clearInterval(timer);
        if (socketRef.current) socketRef.current.disconnect();
      };
    } else {
      setSeconds(0);
      setViewerCount(0);
      setLiveChatMessages([]);
    }
  }, [isLive, roomId]);

  const handleStartLive = () => {
    if (!title.trim()) {
      return Alert.alert('تنبيه', 'الرجاء إدخال عنوان للبث المباشر');
    }
    
    // Create unique room key (could save to Supabase here)
    const newRoomId = `auction_${Date.now()}`;
    setRoomId(newRoomId);
    setIsLive(true);

    // Start RTMP Publisher physically
    if (nodeCameraRef.current) {
      nodeCameraRef.current.start();
    }
  };

  const handleStopLive = () => {
    Alert.alert(
      "إنهاء البث 🔴",
      "هل أنت متأكد أنك تريد إنهاء البث المباشر المربح الخاص بك؟",
      [
        { text: "إلغاء", style: "cancel" },
        { 
          text: "إنهاء البث", 
          style: "destructive", 
          onPress: () => {
             setIsLive(false);
             if (nodeCameraRef.current) {
               nodeCameraRef.current.stop(); // Stop Publishing
             }
             navigation.navigate('Home');
          } 
        }
      ]
    );
  };

  const sendMessage = () => {
    if (!myMessage.trim() || !socketRef.current) return;
    socketRef.current.emit('send_message', {
      roomId,
      user: profile?.full_name || 'البائع (أنا)',
      text: myMessage.trim()
    });
    setMyMessage('');
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderTabSwitcher = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity style={[styles.tabBtn, activeTab === 'post' && styles.activeTabBtn]} onPress={() => setActiveTab('post')}>
        <Text style={[styles.tabText, activeTab === 'post' && styles.activeTabText]}>منشور</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tabBtn, activeTab === 'live' && styles.activeTabBtn]} onPress={() => setActiveTab('live')}>
        <Text style={[styles.tabText, activeTab === 'live' && styles.activeTabText]}>لايف</Text>
      </TouchableOpacity>
    </View>
  );

  if (activeTab === 'post') {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={{ backgroundColor: colors.background, paddingBottom: 0 }}>{renderTabSwitcher()}</SafeAreaView>
        <CreatePostScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fallback Warning if NodeMediaClient isn't installed properly */}
      {!NodeCameraView && (
         <View style={styles.nativeWarning}>
             <Text style={{color: 'white', textAlign: 'center'}}>⚠️ مكتبة البث RTMP تتطلب (expo prebuild).</Text>
         </View>
      )}

      {/* NODE MEDIA SERVER RTMP PUBLISHER */}
      {NodeCameraView && (
        <NodeCameraView
          style={styles.camera}
          ref={nodeCameraRef}
          outputUrl={`${RTMP_SERVER}/${roomId}`}
          camera={{ cameraId: facing === 'front' ? 1 : 0, cameraFrontMirror: true }}
          audio={{ bitrate: 32000, profile: 1, samplerate: 44100 }}
          video={{ 
            preset: 1, 
            bitrate: quality === '720p' ? 1500000 : 400000, 
            profile: 1, 
            fps: 24, 
            videoFrontMirror: false 
          }}
          smoothSkinLevel={3}
          autopreview={true}
        />
      )}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        
        {!isLive && (
          <View style={styles.preLiveHeaderFlex}>
            <TouchableOpacity style={styles.exitIconWrapper} onPress={() => navigation.navigate('Home')}>
              <Ionicons name="close" size={32} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.tabsWrapper}>
               {renderTabSwitcher()}
            </View>
          </View>
        )}

        {isLive ? (
          // ============================== ACTIVE LIVE ==============================
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.liveDashboard} pointerEvents="box-none">
            <View style={styles.topHud}>
              <View style={styles.liveBadge}><View style={styles.redDot}/><Text style={styles.hudTextBold}>LIVE</Text></View>
              <View style={styles.statsBadge}><Text style={styles.hudText}>{formatTime(seconds)}</Text></View>
              <View style={styles.viewersBadge}><Ionicons name="eye" size={16} color="#FFF" style={{marginRight: 4}}/><Text style={styles.hudText}>{viewerCount}</Text></View>
              <TouchableOpacity style={styles.stopBtn} onPress={handleStopLive}><Ionicons name="power" size={22} color="#FFF" /></TouchableOpacity>
            </View>

            <View style={styles.flexSpacer} pointerEvents="none" />

            <View style={styles.chatContainer}>
              <FlatList
                ref={flatListRef}
                data={liveChatMessages}
                keyExtractor={(_, index) => index.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.chatMessage}>
                    <Text style={styles.chatUser}>{item.user}</Text>
                    <Text style={styles.chatText}>{item.text}</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.welcomeText}>تم بدء البث! بانتظار المزايدين المشترين...</Text>}
              />
            </View>

            <View style={styles.bottomInteractions}>
                <TextInput 
                    placeholder="وجه رسالة للمتابعين..."
                    placeholderTextColor="#DDD"
                    style={styles.chatInputNode}
                    value={myMessage}
                    onChangeText={setMyMessage}
                    onSubmitEditing={sendMessage}
                />
                <TouchableOpacity style={styles.actionIconRound} onPress={sendMessage}>
                  <Ionicons name="send" size={22} color="#000" />
                </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          // ============================== PRE-LIVE ==============================
          <View style={styles.preLiveDashboard} pointerEvents="box-none">
            <View style={styles.toolsMenu}>
              <TouchableOpacity style={styles.toolBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}><Ionicons name="camera-reverse" size={28} color="#FFF" /></TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={() => setQuality(q => q === '720p' ? '240p' : '720p')}><Text style={styles.qualityText}>{quality}</Text></TouchableOpacity>
            </View>

            <View style={styles.bottomPreLiveSetup}>
              <TextInput style={styles.liveTitleInput} placeholder="عنوان اللايف (مثال: مزاد سيارات 🔥)" placeholderTextColor="#DDD" value={title} onChangeText={setTitle} textAlign="center" />
              <TouchableOpacity style={[styles.goLiveBtn, !title.trim() && { opacity: 0.8 }]} onPress={handleStartLive}>
                <Text style={styles.goLiveBtnText}>بدء البث كبائع 🔴</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

// ... Styles (omitted brevity, retaining core)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { ...StyleSheet.absoluteFillObject },
  nativeWarning: { position: 'absolute', top: 50, left: 10, right: 10, backgroundColor: 'red', padding: 10, zIndex: 100 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  preLiveHeaderFlex: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 20 },
  exitIconWrapper: { position: 'absolute', left: 20, zIndex: 20 },
  tabsWrapper: { flex: 1, alignItems: 'center' },
  tabContainer: { flexDirection: 'row' },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 25, marginHorizontal: 10 },
  activeTabBtn: { borderBottomWidth: 3, borderBottomColor: colors.primary },
  tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: 'bold' },
  activeTabText: { color: '#FFF' },
  preLiveDashboard: { flex: 1, justifyContent: 'space-between' },
  toolsMenu: { alignItems: 'flex-end', paddingRight: 20, marginTop: 20 },
  toolBtn: { backgroundColor: 'rgba(0,0,0,0.5)', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  qualityText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  bottomPreLiveSetup: { paddingHorizontal: 25, paddingBottom: 40, alignItems: 'center' },
  liveTitleInput: { backgroundColor: 'rgba(0,0,0,0.7)', width: '100%', paddingVertical: 18, paddingHorizontal: 20, borderRadius: 15, color: '#FFF', fontSize: 16, marginBottom: 25, fontWeight: '600' },
  goLiveBtn: { backgroundColor: colors.primary, width: '100%', paddingVertical: 20, borderRadius: 35, alignItems: 'center' },
  goLiveBtnText: { color: '#000', fontSize: 22, fontWeight: '900' },
  liveDashboard: { flex: 1 },
  topHud: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginTop: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginRight: 10 },
  redDot: { width: 6, height: 6, backgroundColor: '#FFF', borderRadius: 3, marginRight: 6 },
  statsBadge: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginRight: 10 },
  viewersBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  hudText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  hudTextBold: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  stopBtn: { marginLeft: 'auto', backgroundColor: 'rgba(0,0,0,0.5)', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  flexSpacer: { flex: 1 },
  chatContainer: { height: 250, paddingHorizontal: 15, marginBottom: 10 },
  chatMessage: { backgroundColor: 'rgba(0,0,0,0.35)', alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, marginBottom: 10, maxWidth: '85%' },
  chatUser: { color: colors.primary, fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  chatText: { color: '#FFF', fontSize: 15, lineHeight: 20 },
  welcomeText: { color: '#FFF', textAlign: 'center', marginTop: 50, opacity: 0.6 },
  bottomInteractions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 25 },
  chatInputNode: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', height: 50, borderRadius: 25, paddingHorizontal: 20, color: '#FFF', marginRight: 10 },
  actionIconRound: { backgroundColor: colors.primary, width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});
