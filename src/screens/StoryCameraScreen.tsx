import React, { useRef, useState, useEffect } from 'react';
import { 
  View, StyleSheet, TouchableOpacity, Text, 
  Alert, Dimensions, ActivityIndicator 
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const StoryCameraScreen = () => {
  const navigation = useNavigation<any>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [isRecording, setIsRecording] = useState(false);
  
  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, [cameraPermission, micPermission]);

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const processMedia = async (uri: string, type: 'image' | 'video', width: number, height: number) => {
    try {
      if (type === 'video') {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_FILE_SIZE) {
          Alert.alert('تنبيه', 'حجم الفيديو يجب ألا يتجاوز 50 ميجابايت.');
          return;
        }
      }
      
      const mediaAsset = { uri, type, width, height, facing };
      navigation.navigate('StoryEditor', { capturedMedia: mediaAsset });
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'فشلت معالجة الوسائط');
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      if (photo) {
        processMedia(photo.uri, 'image', photo.width, photo.height);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;
    try {
      setIsRecording(true);
      const video = await cameraRef.current.recordAsync({
        maxDuration: 25, // Auto-stop at 25s (~50MB limit)
      });
      if (video) {
        processMedia(video.uri, 'video', cameraRef.current.width || 1080, cameraRef.current.height || 1920);
      }
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!cameraRef.current || !isRecording) return;
    cameraRef.current.stopRecording();
    setIsRecording(false);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false, 
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      processMedia(asset.uri, asset.type === 'video' ? 'video' : 'image', asset.width, asset.height);
    }
  };

  if (!cameraPermission || !cameraPermission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>نحتاج لمحلقات الكاميرا لنبدأ الإبداع!</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
          <Text style={styles.permissionBtnTxt}>سماح</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <CameraView 
        ref={cameraRef}
        style={styles.camera} 
        facing={facing}
        mode="video"
        videoQuality="1080p"
        mirror={false}
      />
      <SafeAreaView style={[styles.overlay, StyleSheet.absoluteFill]} edges={['top', 'bottom']}>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="close" size={30} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleCameraFacing} style={styles.iconBtn}>
            <Ionicons name="camera-reverse" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
            <Ionicons name="images" size={26} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.captureBtnWrap}>
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[styles.captureBtn, isRecording && styles.recordingBtn]} 
              onPress={takePicture}
              onLongPress={startRecording}
              onPressOut={stopRecording}
              delayLongPress={300}
            />
          </View>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  topActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  bottomActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20 },
  galleryBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  captureBtnWrap: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  captureBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF' },
  recordingBtn: { backgroundColor: '#FF0000', transform: [{ scale: 0.8 }] },
  permissionText: { color: '#FFF', fontSize: 18, marginBottom: 20 },
  permissionBtn: { paddingHorizontal: 30, paddingVertical: 12, backgroundColor: '#0A84FF', borderRadius: 20 },
  permissionBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
