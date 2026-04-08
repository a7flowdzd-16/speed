import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ScrollView, Alert, ActivityIndicator, Switch, Dimensions,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';

// Elite Dynamic Import — Silent fallback for Expo Go
let Compressor: any = null;
try {
    Compressor = require('react-native-compressor').Video;
} catch (_) { /* Compressor unavailable in Expo Go — handled below */ }

const { width } = Dimensions.get('window');

// ── Constants ──────────────────────────────────────────────
const MAX_UPLOAD_BYTES = 49 * 1024 * 1024; // 49 MB hard ceiling (Supabase Free Plan)

// ── Helpers ────────────────────────────────────────────────
const getFileSize = async (uri: string): Promise<number> => {
    const info: any = await FileSystem.getInfoAsync(uri);
    return info?.size ?? 0;
};

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// ──────────────────────────────────────────────────────────
export const CreatePostScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const [title, setTitle]           = useState('');
    const [description, setDescription] = useState('');
    const [media, setMedia]           = useState<any>(null);
    const [isHighQuality, setIsHighQuality] = useState(false);
    const [uploading, setUploading]   = useState(false);
    const [statusMsg, setStatusMsg]   = useState('');

    // Modern expo-video player
    const player = useVideoPlayer(media?.uri ?? '', (p) => {
        p.loop = true;
        p.play();
    });

    // ── Pick media from library ──────────────────────────
    const pickMedia = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsEditing: true,
            quality: 1,
        });

        if (result.canceled || !result.assets[0]?.uri) return;
        const asset = result.assets[0];

        // Basic size check at selection time (soft UX hint only)
        try {
            const size = await getFileSize(asset.uri);
            if (size > MAX_UPLOAD_BYTES && asset.type === 'video') {
                Alert.alert(
                    'تنبيه',
                    `حجم الفيديو ${fmtMB(size)}. إذا كان الضغط مفعلاً سنحاول تصغيره، وإلا لن يمكن رفعه.`
                );
            }
        } catch (_) { /* Non-blocking */ }

        setMedia(asset);
    };

    // ── Upload flow ──────────────────────────────────────
    const handleUpload = async () => {
        if (!title || !media) {
            return Alert.alert('تنبيه', 'يرجى إضافة عنوان ومحتوى للمنشور.');
        }
        if (!user) return;

        setUploading(true);
        setStatusMsg('جاري التحقق من الملف...');

        try {
            let finalUri = media.uri;

            if (media.type === 'video') {
                // ── STEP 1: Get initial file size ─────────────
                const initialSize = await getFileSize(media.uri);

                // ── STEP 2: HQ + big file → BLOCK ─────────────
                if (initialSize > MAX_UPLOAD_BYTES && isHighQuality) {
                    setUploading(false);
                    setStatusMsg('');
                    return Alert.alert(
                        'تنبيه',
                        "هذا الفيديو كبير جداً. يرجى إيقاف زر 'رفع بجودة عالية' ليتم ضغطه، أو اختيار فيديو أقصر."
                    );
                }

                // ── STEP 3: Compression if needed ─────────────
                if (initialSize > MAX_UPLOAD_BYTES && !isHighQuality) {
                    if (!Compressor) {
                        setUploading(false);
                        setStatusMsg('');
                        return Alert.alert(
                            'تنبيه',
                            'الضغط غير متاح في وضع الاختبار. يرجى تثبيت التطبيق الفعلي أو اختيار فيديو أصغر.'
                        );
                    }

                    setStatusMsg('جاري ضغط الفيديو (1080p)...');
                    try {
                        finalUri = await Compressor.compress(media.uri, {
                            compressionMethod: 'auto',
                            maximumResolution: 1080,
                        });
                    } catch (compressErr) {
                        setUploading(false);
                        setStatusMsg('');
                        return Alert.alert('خطأ', 'فشل ضغط الفيديو. يرجى اختيار فيديو أقصر.');
                    }

                    // ── STEP 4: Post-compression size check ───
                    const compressedSize = await getFileSize(finalUri);
                    if (compressedSize > MAX_UPLOAD_BYTES) {
                        setUploading(false);
                        setStatusMsg('');
                        return Alert.alert(
                            'لا يزال كبيراً',
                            `حجم الفيديو بعد الضغط (${fmtMB(compressedSize)}) يتجاوز 49 ميجا. يرجى اختيار فيديو أقصر.`
                        );
                    }
                }
            }

            // ── Upload to Supabase Storage ─────────────────
            setStatusMsg('جاري الرفع...');
            const base64 = await FileSystem.readAsStringAsync(finalUri, { encoding: 'base64' });
            const ext      = media.type === 'video' ? 'mp4' : 'jpg';
            const filePath = `posts/${user.id}/${Date.now()}.${ext}`;

            const { error: uploadErr } = await supabase.storage
                .from('post-media')
                .upload(filePath, decode(base64), {
                    contentType: media.type === 'video' ? 'video/mp4' : 'image/jpeg',
                    upsert: true,
                });

            if (uploadErr) throw uploadErr;

            const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(filePath);

            // ── Insert post record ─────────────────────────
            const { error: dbError } = await supabase.from('posts').insert({
                user_id:      user.id,
                title,
                description,
                media_urls:   [publicUrl],
                media_type:   media.type === 'video' ? 'video' : 'images',
            });

            if (dbError) throw dbError;

            Alert.alert('تم بنجاح 🎉', 'لقد تم نشر منشورك!');
            navigation.replace('MainTabs');

        } catch (error: any) {
            Alert.alert('خطأ في الرفع', error.message ?? 'حدث خطأ غير متوقع.');
        } finally {
            setUploading(false);
            setStatusMsg('');
        }
    };

    // ── Render ─────────────────────────────────────────────
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

                    {/* Media Frame */}
                    <View style={styles.mediaFrame}>
                        {media ? (
                            <View style={styles.flex1}>
                                {media.type === 'video' ? (
                                    <VideoView player={player} style={styles.media} nativeControls={false} />
                                ) : (
                                    <Image source={{ uri: media.uri }} style={styles.media} contentFit="contain" />
                                )}
                                <TouchableOpacity style={styles.clearBtn} onPress={() => setMedia(null)}>
                                    <Ionicons name="close-circle" size={30} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.picker} onPress={pickMedia}>
                                <Ionicons name="cloud-upload-outline" size={60} color="#222" />
                                <Text style={styles.pickerLab}>اضغط لرفع فيديو أو صورة</Text>
                                <Text style={styles.pickerSub}>الحد الأقصى للرفع 49 MB</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Quality Toggle — shown only for videos */}
                    {media?.type === 'video' && (
                        <View style={styles.qualityCard}>
                            <View style={styles.flex1}>
                                <Text style={styles.qualityTitle}>رفع بجودة عالية</Text>
                                <Text style={styles.qualitySub}>
                                    {isHighQuality
                                        ? 'سيتم رفع النسخة الأصلية — يجب أن يكون حجمها أقل من 49 MB.'
                                        : 'سيتم ضغط الفيديو إلى 1080p لضمان نجاح الرفع.'}
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
    mediaFrame:   { width: '100%', height: width * 0.9, backgroundColor: '#050505', borderRadius: 24, overflow: 'hidden', borderStyle: 'dashed', borderWidth: 1, borderColor: '#1A1A1A', marginBottom: 25 },
    picker:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pickerLab:    { color: '#333', marginTop: 15, fontSize: 16 },
    pickerSub:    { color: '#222', marginTop: 6, fontSize: 12 },
    media:        { width: '100%', height: '100%' },
    clearBtn:     { position: 'absolute', top: 15, right: 15 },
    qualityCard:  { flexDirection: 'row-reverse', backgroundColor: '#0D0D0D', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 25, gap: 15 },
    qualityTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
    qualitySub:   { color: '#555', fontSize: 11, marginTop: 4, textAlign: 'right' },
    form:         { marginBottom: 30 },
    inputT:       { backgroundColor: '#0D0D0D', borderRadius: 12, padding: 18, color: '#FFF', marginBottom: 12, fontSize: 16, textAlign: 'right' },
    inputD:       { backgroundColor: '#0D0D0D', borderRadius: 12, padding: 18, color: '#FFF', height: 110, fontSize: 16, textAlign: 'right' },
    loader:       { alignItems: 'center', paddingVertical: 20 },
    loaderTxt:    { color: colors.primary, marginTop: 12, fontWeight: 'bold' },
});
