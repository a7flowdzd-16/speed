import React, { createContext, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { apiClient } from '../config/api';

interface StoryUploadContextType {
  isUploading: boolean;
  uploadError: string | null;
  startUpload: (params: {
    userId: string;
    media: any; // { uri: string, type: 'image' | 'video' }
    contentJson?: any; 
  }) => Promise<void>;
}

const StoryUploadContext = createContext<StoryUploadContextType | undefined>(undefined);

export const StoryUploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const startUpload = async ({ userId, media, contentJson }: { userId: string, media: any, contentJson?: any }) => {
    console.log('--- PROVIDER: startUpload function entered ---');

    if (!userId || !media?.uri) {
      console.error('PROVIDER ERROR: Missing required data (userId or media.uri)');
      Alert.alert('خطأ', 'بيانات الرفع ناقصة، يرجى المحاولة مرة أخرى.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    
    try {
      // 1. Prepare FormData for our specific backend
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('upload_type', 'stories');
      
      const ext = media.type === 'video' ? 'mp4' : 'jpg';
      const fileName = `story_${Date.now()}.${ext}`;
      const type = media.type === 'video' ? 'video/mp4' : 'image/jpeg';
      
      formData.append('media', {
        uri: media.uri,
        name: fileName,
        type: type,
      } as any);

      console.log('2. Uploading to custom backend /upload...');
      const uploadRes = await apiClient.post('/upload', formData);

      if (!uploadRes.files || uploadRes.files.length === 0) {
        throw new Error('لم يستجب الخادم ببيانات الملف المرفوع.');
      }

      console.log('3. Saving to Database table [stories] via /stories endpoint');
      // Our backend expects { user_id, media: [{url, type}] }
      const dbRes = await apiClient.post('/stories', {
        user_id: userId,
        media: uploadRes.files
      });

      if (dbRes.error) {
        throw new Error(dbRes.error);
      }

      console.log('--- SUCCESS: Story Upload Finished! ---');
      
    } catch (err: any) {
      console.error('--- CRITICAL UPLOAD FAILURE ---', err);
      setUploadError(err.message);
      Alert.alert(
        'فشل الرفع', 
        `حدث خطأ أثناء المحاولة: ${err.message || 'خطأ مجهول'}\n\nيرجى التأكد من اتصال الإنترنت.`
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <StoryUploadContext.Provider value={{ isUploading, uploadError, startUpload }}>
      {children}
    </StoryUploadContext.Provider>
  );
};

export const useStoryUpload = () => {
  const context = useContext(StoryUploadContext);
  if (context === undefined) {
    throw new Error('useStoryUpload must be used within a StoryUploadProvider');
  }
  return context;
};
