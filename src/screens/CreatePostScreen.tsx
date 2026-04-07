import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';

export const CreatePostScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaAssets, setMediaAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [mediaType, setMediaType] = useState<'video' | 'images' | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 50,
      quality: 1, // Max quality to prevent compression issues
    });

    if (!result.canceled && result.assets.length > 0) {
      const type = result.assets[0].type === 'video' ? 'video' : 'images';
      setMediaType(type);
      
      if (type === 'video' && result.assets.length > 1) {
        Alert.alert('تنبيه', 'يمكنك رفع فيديو واحد فقط للمزاد في كل مرة.');
        setMediaAssets([result.assets[0]]);
      } else {
        setMediaAssets(result.assets);
      }
    }
  };

  const handleCreatePost = async () => {
    if (!title.trim()) return Alert.alert('خطأ', 'يرجى كتابة عنوان المزاد');
    if (mediaAssets.length === 0) return Alert.alert('خطأ', 'يرجى اختيار صورة أو فيديو واحد على الأقل');

    setUploading(true);
    try {
      const urls: string[] = [];

      // Upload files securely using Blob (Safest approach for large Video files without Memory crash)
      for (let i = 0; i < mediaAssets.length; i++) {
        const asset = mediaAssets[i];
        const ext = asset.type === 'video' ? 'mp4' : 'jpg';
        const fileName = `${user?.id}/${Date.now()}_${i}.${ext}`;
        const filePath = `posts/${fileName}`;

        // Read file securely as Base64 to bypass React Native 0-byte blob bug
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(filePath, decode(base64), { 
            contentType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg' 
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('post-media')
          .getPublicUrl(filePath);

        urls.push(urlData.publicUrl);
      }

      // Save Data to Database
      const { error: dbError } = await supabase.from('posts').insert([
        {
          user_id: user?.id,
          title,
          description,
          media_type: mediaType,
          media_urls: urls,
        }
      ]);

      if (dbError) throw dbError;

      Alert.alert('نجاح', 'تم بدء المزاد ونشره بنجاح!');
      setTitle('');
      setDescription('');
      setMediaAssets([]);
      setMediaType(null);
      navigation.navigate('Home'); // Redirect to Home Feed

    } catch (error: any) {
      Alert.alert('خطأ أثناء الرفع', error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.headerTitle}>مزاد أو منشور جديد 🚀</Text>

          {/* Media Picker Area */}
          <TouchableOpacity 
            style={styles.mediaPicker} 
            onPress={pickMedia}
            activeOpacity={0.8}
          >
            {mediaAssets.length > 0 ? (
              <View style={styles.selectedMediaContainer}>
                <Image source={{ uri: mediaAssets[0].uri }} style={styles.mediaPreview} />
                {mediaAssets.length > 1 && (
                  <View style={styles.mediaBadge}>
                    <Text style={styles.mediaBadgeText}>+{mediaAssets.length - 1}</Text>
                  </View>
                )}
                {mediaType === 'video' && (
                  <View style={styles.videoBadge}>
                    <Ionicons name="videocam" size={20} color="#FFF" />
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.deleteMediaBtn}
                  onPress={() => setMediaAssets([])}
                >
                  <Ionicons name="close-circle" size={28} color="red" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="images-outline" size={40} color={colors.textSecondary} />
                <Text style={styles.mediaPlaceholderText}>انقر لاختيار فيديو المزاد أو مجموعة صور</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form Fields */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.titleInput}
              placeholder="عن ماذا هذا المزاد؟ (العنوان)"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            
            <TextInput
              style={styles.descriptionInput}
              placeholder="اكتب تفاصيل السيارة، الجودة، السعر الابتدائي..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, uploading && styles.submitButtonDisabled]} 
            onPress={handleCreatePost}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.submitButtonText}>إنشاء المزاد</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  mediaPicker: {
    width: '100%',
    height: 250,
    backgroundColor: colors.inputBackground,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: 25,
    overflow: 'hidden',
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mediaPlaceholderText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  selectedMediaContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mediaBadgeText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  videoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 20,
  },
  deleteMediaBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  inputContainer: {
    marginBottom: 25,
  },
  titleInput: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: colors.text,
    marginBottom: 15,
  },
  descriptionInput: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: colors.text,
    height: 120,
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.text, // yellow background -> black text matches snapchat style
    fontSize: 18,
    fontWeight: 'bold',
  }
});
