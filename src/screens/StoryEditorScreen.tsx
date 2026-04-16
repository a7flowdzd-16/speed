import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Dimensions, Keyboard, TouchableWithoutFeedback,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { useStoryUpload } from '../providers/StoryUploadProvider';
import { colors } from '../theme/colors';

import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
  bgStyle: 'normal' | 'highlight';
}

interface MediaTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export const StoryEditorScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { startUpload } = useStoryUpload();
  
  const [media, setMedia] = useState<any>(route.params?.capturedMedia || null);
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  
  const [isAddingText, setIsAddingText] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [currentTextStyle, setCurrentTextStyle] = useState<'normal' | 'highlight'>('normal');

  // References to keep latest transform coordinates without re-rendering everything
  const mediaTransformRef = useRef<MediaTransform>({ x: 0, y: 0, scale: 1, rotation: 0 });
  const overlaysTransformRef = useRef<Record<string, MediaTransform>>({});

  const player = useVideoPlayer(media?.type === 'video' ? media.uri : '', (p) => {
    p.loop = true;
    p.play();
    p.muted = false;
  });

  useEffect(() => {
    if (!media) {
       pickMedia();
    }
  }, []);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false, 
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setMedia(result.assets[0]);
    }
  };

  const toggleTextStyle = () => {
    setCurrentTextStyle(prev => prev === 'normal' ? 'highlight' : 'normal');
  };

  const handleAddText = () => {
    if (currentText.trim() === '') {
      setIsAddingText(false);
      return;
    }
    const newId = Date.now().toString();
    setOverlays([...overlays, {
      id: newId,
      text: currentText,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      color: '#FFF',
      bgStyle: currentTextStyle
    }]);
    
    // Init transform ref
    overlaysTransformRef.current[newId] = { x: 0, y: 0, scale: 1, rotation: 0 };
    
    setCurrentText('');
    setIsAddingText(false);
    Keyboard.dismiss();
  };

  const handleUpload = async () => {
    if (!media || !user) return;
    
    console.log('--- Share Clicked (UI ACTION) ---');

    // 1. IMMEDIATE NAVIGATION - Use goBack to avoid "Ghost Home"
    console.log('UI: Dismissing editor using goBack().');
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Tabs', { screen: 'Home' });
    }

    // 2. TRIGGER BACKGROUND ACTION
    try {
      console.log('UI: Attempting to call startUpload in background...');
      
      // Construct final content JSON
      const finalOverlays = overlays.map(ov => ({
        ...ov,
        ...(overlaysTransformRef.current[ov.id] || { x: 0, y: 0, scale: 1, rotation: 0 })
      }));

      const contentJson = {
        mediaTransform: mediaTransformRef.current,
        overlays: finalOverlays,
        mediaWidth: media.width,
        mediaHeight: media.height,
        facing: media.facing // Store camera orientation
      };

      startUpload({ 
        userId: user.id, 
        media, 
        contentJson 
      });
      
      console.log('UI: startUpload called successfully.');
    } catch (err: any) {
      console.error('UI ERROR: Failed to call startUpload:', err);
      Alert.alert('خطأ فني', 'تعذر بدء عملية الرفع: ' + err.message);
    }
  };

  if (!media) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <TouchableOpacity style={styles.pickBtn} onPress={pickMedia}>
            <Ionicons name="images-outline" size={50} color="#FFF" />
            <Text style={styles.pickText}>اختر صورة أو فيديو</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
            <Text style={{ color: '#888', fontSize: 16 }}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Calculate generic aspect ratio for centering
  const aspectRatio = media.width / media.height;
  let mediaDisplayWidth = width;
  let mediaDisplayHeight = width / aspectRatio;

  if (mediaDisplayHeight > height) {
    mediaDisplayHeight = height;
    mediaDisplayWidth = height * aspectRatio;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Fixed: Moved buttons to be absolutely positioned on TOP of everything else with higher zIndex */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setIsAddingText(true)}>
            <Ionicons name="text" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>

        <TouchableWithoutFeedback onPress={() => setIsAddingText(false)}>
          <View style={styles.canvas} pointerEvents="box-none">
            <DraggableComponent
              id="media"
              initialScale={1}
              onTransform={(id, x, y, scale, rotation) => {
                mediaTransformRef.current = { x, y, scale, rotation };
              }}
              style={{
                width: mediaDisplayWidth,
                height: mediaDisplayHeight,
                alignSelf: 'center',
                justifyContent: 'center',
              }}
            >
              {media.type === 'video' ? (
                <VideoView player={player} style={{ flex: 1 }} nativeControls={false} />
              ) : (
                <Image source={{ uri: media.uri }} style={{ flex: 1 }} contentFit="contain" />
              )}
            </DraggableComponent>
            {overlays.map((ov) => (
              <DraggableComponent
                key={ov.id}
                id={ov.id}
                initialScale={1}
                onTransform={(id, x, y, scale, rotation) => {
                  overlaysTransformRef.current[id] = { x, y, scale, rotation };
                }}
                style={{ position: 'absolute', alignSelf: 'center', top: height / 2 - 20 }}
              >
                <View style={ov.bgStyle === 'highlight' ? styles.highlightTextWrapper : null}>
                  <Text style={[
                      styles.overlayText, 
                      { color: ov.color },
                      ov.bgStyle === 'highlight' && styles.highlightText
                    ]}>
                    {ov.text}
                  </Text>
                </View>
              </DraggableComponent>
            ))}
          </View>
        </TouchableWithoutFeedback>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleUpload}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.shareTxt}>مشاركة</Text>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </View>
          </TouchableOpacity>
        </View>

        {isAddingText && (
          <View style={styles.textInputOverlay}>
            <View style={styles.textToolsHeader}>
               <TouchableOpacity style={styles.styleToggleBtn} onPress={toggleTextStyle}>
                 <Text style={styles.styleToggleTxt}>A++</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.doneBtn} onPress={handleAddText}>
                 <Text style={styles.doneTxt}>تم</Text>
               </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.textInput,
                currentTextStyle === 'highlight' ? styles.highlightTextInput : {}
              ]}
              value={currentText}
              onChangeText={setCurrentText}
              placeholder="اكتب شيئاً مميزاً..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoFocus
              multiline
              onSubmitEditing={handleAddText}
            />
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};


// Flexible Draggable Component for Media & Text
const DraggableComponent = ({ 
  id, 
  initialScale = 1, 
  onTransform, 
  children,
  style
}: { 
  id: string, 
  initialScale?: number, 
  onTransform: (id: string, x: number, y: number, scale: number, rotation: number) => void,
  children: React.ReactNode,
  style?: any
}) => {
  
  const offset = useSharedValue({ x: 0, y: 0 });
  const scale = useSharedValue(initialScale);
  const rotation = useSharedValue(0);

  const savedOffset = useSharedValue({ x: 0, y: 0 });
  const savedScale = useSharedValue(initialScale);
  const savedRotation = useSharedValue(0);

  const reportUpdate = () => {
    onTransform(id, offset.value.x, offset.value.y, scale.value, rotation.value);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      offset.value = {
        x: savedOffset.value.x + e.translationX,
        y: savedOffset.value.y + e.translationY,
      };
    })
    .onEnd(() => {
      savedOffset.value = { x: offset.value.x, y: offset.value.y };
      runOnJS(reportUpdate)();
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      runOnJS(reportUpdate)();
    });

  const rotationGesture = Gesture.Rotation()
    .onUpdate((e) => {
      rotation.value = savedRotation.value + e.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
      runOnJS(reportUpdate)();
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value.x },
      { translateY: offset.value.y },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickBtn: { alignItems: 'center', padding: 20, backgroundColor: '#1A1A1A', borderRadius: 24, borderWidth: 1, borderColor: '#333' },
  pickText: { color: '#FFF', marginTop: 15, fontSize: 18, fontWeight: '800' },
  
  canvas: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', justifyContent: 'center' },
  
  topBar: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  
  bottomBar: { position: 'absolute', bottom: 40, right: 20, zIndex: 10 },
  shareBtn: { flexDirection: 'row-reverse', backgroundColor: '#FFF', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, alignItems: 'center', gap: 8 },
  shareTxt: { color: '#000', fontSize: 17, fontWeight: 'bold' },
  
  overlayText: { fontSize: 30, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  highlightTextWrapper: { backgroundColor: '#000', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' },
  highlightText: { textShadowColor: 'transparent', textShadowRadius: 0 },
  
  textInputOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  textToolsHeader: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, width: '100%', flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center' },
  
  styleToggleBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFF' },
  styleToggleTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  doneBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  doneTxt: { color: '#000', fontSize: 17, fontWeight: 'bold' },
  
  textInput: { color: '#FFF', fontSize: 34, fontWeight: '800', textAlign: 'center', width: '90%', minHeight: 100 },
  highlightTextInput: { backgroundColor: '#000', color: '#FFF', borderRadius: 16, padding: 15, overflow: 'hidden' },
});
