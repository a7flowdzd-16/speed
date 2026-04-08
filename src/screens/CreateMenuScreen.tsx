import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export const CreateMenuScreen = () => {
    const navigation = useNavigation<any>();

    return (
        <View style={styles.container}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                        <Ionicons name="close" size={32} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <Text style={styles.title}>ماذا تريد أن تنشئ اليوم؟</Text>
                    
                    <View style={styles.optionsGrid}>
                        {/* Option 1: Live Auction */}
                        <TouchableOpacity 
                            style={styles.optionCard}
                            onPress={() => navigation.replace('CreateHub')}
                        >
                            <View style={[styles.iconWrapper, { backgroundColor: '#FF3B30' }]}>
                                <Ionicons name="videocam" size={40} color="#FFF" />
                            </View>
                            <Text style={styles.optionLabel}>بث مباشر</Text>
                            <Text style={styles.optionSub}>ابدأ مزاد حي الآن</Text>
                        </TouchableOpacity>

                        {/* Option 2: Post Image/Video */}
                        <TouchableOpacity 
                            style={styles.optionCard}
                            onPress={() => navigation.replace('CreatePost')}
                        >
                            <View style={[styles.iconWrapper, { backgroundColor: '#FF9500' }]}>
                                <Ionicons name="images" size={40} color="#FFF" />
                            </View>
                            <Text style={styles.optionLabel}>منشور جديد</Text>
                            <Text style={styles.optionSub}>شارك صور أو فيديو</Text>
                        </TouchableOpacity>

                         {/* Option 3: Camera / Story (Future) */}
                         <TouchableOpacity 
                            style={styles.optionCard}
                            onPress={() => Alert.alert('قريباً', 'سيتم تفعيل ميزة القصص في التحديث القادم')}
                        >
                            <View style={[styles.iconWrapper, { backgroundColor: '#5856D6' }]}>
                                <Ionicons name="camera" size={40} color="#FFF" />
                            </View>
                            <Text style={styles.optionLabel}>كاميرا</Text>
                            <Text style={styles.optionSub}>التقاط صورة سريعة</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                
                <Text style={styles.footerText}>A7 Flow Live Auction</Text>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    safeArea: {
        flex: 1,
    },
    header: {
        padding: 20,
        alignItems: 'flex-end',
    },
    closeBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 40,
        textAlign: 'center',
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 20,
    },
    optionCard: {
        width: width * 0.4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    iconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    optionLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 5,
    },
    optionSub: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
    },
    footerText: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.3)',
        marginBottom: 20,
        fontSize: 12,
        letterSpacing: 2,
    }
});
