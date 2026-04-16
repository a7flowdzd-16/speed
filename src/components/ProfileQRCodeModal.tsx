import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ProfileQRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  user: {
    id: number | string;
    username: string;
  };
}

export const ProfileQRCodeModal: React.FC<ProfileQRCodeModalProps> = ({
  visible,
  onClose,
  user,
}) => {
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<any>(null);

  // The deep link URL that the QR code will represent
  const profileUrl = `nouble://profile/${user?.id}`;

  const handleDownload = async () => {
    try {
      // 1. Request Media Library Permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'صلاحية مطلوبة',
          'التطبيق يحتاج إلى صلاحية المعرض لحفظ الصورة.'
        );
        return;
      }

      // 2. Capture the White Card as an image
      const uri = await viewShotRef.current.capture();

      // 3. Save to Media Library
      await MediaLibrary.saveToLibraryAsync(uri);
      
      Alert.alert('تم الحفظ بنجاح', 'تم حفظ الـ QR Code في المعرض الخاص بك. ✅');
    } catch (error) {
      console.error('Error saving QR code:', error);
      Alert.alert('خطأ', 'حدث مشكلة أثناء حفظ الصورة.');
    }
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(profileUrl);
    Alert.alert('تم النسخ', 'تم نسخ رابط الملف الشخصي بنجاح! 📋');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `تابعني على Nouble! رابط الحساب: ${profileUrl}`,
        url: Platform.OS === 'ios' ? profileUrl : undefined,
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  };

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']} // Instagram style gradient
        style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}
      >
        <View style={styles.contentArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={32} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>COLOR</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          {/* QR Code Card Wrapped in ViewShot for downloading */}
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1 }}
            style={styles.cardWrapper}
          >
            <View style={styles.qrCard}>
              <QRCode
                value={profileUrl}
                size={220}
                color="#d62976" // QR Code color to match gradient theme visually
                backgroundColor="#FFF"
              />
              <Text style={styles.usernameText}>@{user.username?.toUpperCase()}</Text>
            </View>
          </ViewShot>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={26} color="#000" />
              <Text style={styles.actionText}>مشاركة</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleCopyLink}>
              <Ionicons name="link-outline" size={26} color="#000" />
              <Text style={styles.actionText}>نسخ الرابط</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleDownload}>
              <Ionicons name="download-outline" size={26} color="#000" />
              <Text style={styles.actionText}>تحميل</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  closeBtn: {
    padding: 5,
  },
  headerTitleWrap: {
    borderWidth: 1,
    borderColor: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
  },
  headerTitle: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  qrCard: {
    backgroundColor: '#FFF',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  usernameText: {
    marginTop: 25,
    fontSize: 22,
    fontWeight: '800',
    color: '#d62976', // Gradient-like text color
    letterSpacing: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: '30%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  actionText: {
    marginTop: 8,
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
});
