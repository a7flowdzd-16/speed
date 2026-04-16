import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ScrollView, Alert, ActivityIndicator, Switch, Dimensions,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { apiClient } from '../config/api';
import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';

let Compressor: any = null;
try {
    Compressor = require('react-native-compressor').Video;
} catch (_) { }

const { width } = Dimensions.get('window');
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB limit
const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const getFileSize = async (uri: string): Promise<number> => {
    const info: any = await FileSystem.getInfoAsync(uri);
    return info?.size ?? 0;
};

export const CreatePostScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const [title, setTitle]           = useState('');
    const [description, setDescription] = useState('');
    const [mediaList, setMediaList]   = useState<any[]>([]);
    const [isHighQuality, setIsHighQuality] = useState(false);
    const [uploading, setUploading]   = useState(false);
    const [statusMsg, setStatusMsg]   = useState('');

    const pickMedia = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsMultipleSelection: true,
            selectionLimit: 10,
            quality: 1,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) return;

        let totalSize = 0;
        for (let asset of result.assets) {
            totalSize += await getFileSize(asset.uri);
        }

        if (totalSize > 500 * 1024 * 1024) {
             Alert.alert('تنبيه', 'حجم الملفات الإجمالي كبير جداً، يرجى تقليل بعض الفيديوهات.');
             return;
        }

        setMediaList([...mediaList, ...result.assets].slice(0, 10)); // max 10
    };

    const handleUpload = async () => {
        if (!title || mediaList.length === 0) {
            return Alert.alert('تنبيه', 'يرجى إضافة عنوان واختيار ملفات لرفعها.');
        }
        if (!user) return;

        setUploading(true);
        setStatusMsg('جاري التحضير...');

        try {
            const formData = new FormData();
            formData.append('user_id', user.id);
            formData.append('upload_type', 'posts');
            const finalMediaMeta: any[] = [];

            // Process each file
            for (let i = 0; i < mediaList.length; i++) {
                let m = mediaList[i];
                let finalUri = m.uri;
                setStatusMsg(`معالجة الملف ${i + 1} من ${mediaList.length}...`);

                if (m.type === 'video') {
                    const initialSize = await getFileSize(m.uri);
                    if (initialSize > MAX_UPLOAD_BYTES && !isHighQuality) {
                        setStatusMsg(`جاري ضغط الفيديو ${i + 1}...`);
                        if (Compressor) {
                            try {
                                finalUri = await Compressor.compress(m.uri, {
                                    compressionMethod: 'auto',
                                    maximumResolution: 1080,
                                });
                            } catch (e) {
                                console.log('Compressor failed:', e);
                            }
                        }
                    }
                }

                formData.append('media', {
                    uri: finalUri,
                    name: m.fileName || `media-${Date.now()}-${i}.${m.type === 'video' ? 'mp4' : 'jpg'}`,
                    type: m.type === 'video' ? 'video/mp4' : 'image/jpeg'
                } as any);

                finalMediaMeta.push({ type: m.type === 'video' ? 'video' : 'image' });
            }

            setStatusMsg('جاري الرفع إلى الخادم...');
            const uploadRes = await apiClient.post('/upload', formData);

            if (uploadRes.error) throw new Error(uploadRes.error);
            
            setStatusMsg('نشر المنشور...');
            const uploadedUrls = uploadRes.urls;
            const fullMediaList = finalMediaMeta.map((meta, idx) => ({
                url: uploadedUrls[idx],
                type: meta.type
            }));

            // Save Post
            const postRes = await apiClient.post('/posts', {
                content: `${title} - ${description}`,
                user_id: user.id,
                media: fullMediaList
            });

            if (postRes.error) throw new Error(postRes.error);

            Alert.alert('تم بنجاح 🎉', 'لقد تم نشر منشورك المتعدد الوسائط!');
            navigation.replace('MainTabs');

        } catch (error: any) {
            console.log('Post Creation Failed Server Data:', error.response?.data || error);
            Alert.alert('خطأ في الرفع', error.response?.data?.error || error.message || 'حدث خطأ أثناء الرفع.');
        } finally {
            setUploading(false);
            setStatusMsg('');
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex1}>
                {/* Nav */}
                <View style={styles.nav}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="close-outline" size={30} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.navTitle}>إنشاء منشور جديد</Text>
                    <TouchableOpacity onPress={handleUpload} disabled={uploading}>
                        {uploading
                            ? <ActivityIndicator color={colors.primary} />
                            : <Text style={styles.navAction}>نشر</Text>}
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                    {/* Media Frame Carousel */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaFrameCarousel}>
                        {mediaList.map((m, index) => (
                            <View key={index} style={styles.mediaItem}>
                                <Image source={{ uri: m.uri }} style={styles.media} contentFit="cover" />
                                {m.type === 'video' && (
                                    <View style={styles.videoBadge}>
                                        <Ionicons name="play-circle" size={30} color="#FFF" />
                                    </View>
                                )}
                                <TouchableOpacity 
                                    style={styles.clearBtn} 
                                    onPress={() => setMediaList(mediaList.filter((_, i) => i !== index))}
                                >
                                    <Ionicons name="close-circle" size={24} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        
                        {mediaList.length < 10 && (
                            <TouchableOpacity style={styles.pickerBox} onPress={pickMedia}>
                                <Ionicons name="add-circle-outline" size={40} color="#666" />
                                <Text style={styles.pickerLab}>أضف ({mediaList.length}/10)</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {/* Quality Toggle */}
                    {mediaList.some(m => m.type === 'video') && (
                        <View style={styles.qualityCard}>
                            <View style={styles.flex1}>
                                <Text style={styles.qualityTitle}>رفع الفيديوهات الأصلية (أسرع)</Text>
                                <Text style={styles.qualitySub}>
                                    {isHighQuality
                                        ? 'سيتم تجاوز الضغط. تأكد أن استهلاك البيانات مناسب.'
                                        : 'سيتم ضغط الفيديوهات قبل الرفع لضمان سلاسة التشغيل.'}
                                </Text>
                            </View>
                            <Switch
                                value={isHighQuality}
                                onValueChange={setIsHighQuality}
                                trackColor={{ false: '#333', true: colors.primary }}
                                thumbColor="#FFF"
                            />
                        </View>
                    )}

                    {/* Form */}
                    <View style={styles.form}>
                        <TextInput
                            style={styles.inputT}
                            placeholder="عنوان المنشور..."
                            value={title}
                            onChangeText={setTitle}
                            placeholderTextColor="#444"
                        />
                        <TextInput
                            style={styles.inputD}
                            placeholder="اكتب وصفاً..."
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            placeholderTextColor="#444"
                        />
                    </View>

                    {/* Loader */}
                    {uploading && (
                        <View style={styles.loader}>
                            <ActivityIndicator color={colors.primary} size="large" />
                            <Text style={styles.loaderTxt}>{statusMsg}</Text>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe:         { flex: 1, backgroundColor: '#000' },
    flex1:        { flex: 1 },
    nav:          { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: '#111' },
    navTitle:     { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    navAction:    { color: colors.primary, fontSize: 18, fontWeight: 'bold' },
    scroll:       { padding: 20 },
    mediaFrameCarousel: { flexDirection: 'row-reverse', marginBottom: 25 },
    mediaItem:    { width: width * 0.4, height: width * 0.6, backgroundColor: '#050505', borderRadius: 16, overflow: 'hidden', marginRight: 15, position: 'relative' },
    media:        { width: '100%', height: '100%' },
    videoBadge:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    clearBtn:     { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 15, padding: 2 },
    pickerBox:    { width: width * 0.3, height: width * 0.6, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#333' },
    pickerLab:    { color: '#666', marginTop: 10, fontSize: 13, fontWeight: 'bold' },
    qualityCard:  { flexDirection: 'row-reverse', backgroundColor: '#0D0D0D', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 25, gap: 15 },
    qualityTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
    qualitySub:   { color: '#555', fontSize: 11, marginTop: 4, textAlign: 'right' },
    form:         { marginBottom: 30 },
    inputT:       { backgroundColor: '#0D0D0D', borderRadius: 12, padding: 18, color: '#FFF', marginBottom: 12, fontSize: 16, textAlign: 'right' },
    inputD:       { backgroundColor: '#0D0D0D', borderRadius: 12, padding: 18, color: '#FFF', height: 110, fontSize: 16, textAlign: 'right' },
    loader:       { alignItems: 'center', paddingVertical: 20 },
    loaderTxt:    { color: colors.primary, marginTop: 12, fontWeight: 'bold' },
});
