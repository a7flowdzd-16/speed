import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface CreateMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreateMenuModal = ({
  visible,
  onClose,
}: CreateMenuModalProps) => {
  const navigation = useNavigation<any>();

  const goTo = (screen: string) => {
    onClose();
    // Small delay to ensure modal close animation doesn't jitter with navigation
    setTimeout(() => navigation.navigate(screen), 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.modalContainer}>
        {/* زر الإغلاق */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={30} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* العنوان */}
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>ماذا تريد أن تنشئ؟</Text>

          <View style={styles.optionsRow}>
            {/* منشور جديد */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => goTo('CreatePost')}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#5856D6' }]}>
                <Ionicons name="images" size={38} color="#FFF" />
              </View>
              <Text style={styles.optionLabel}>منشور جديد</Text>
              <Text style={styles.optionSub}>شارك صور أو فيديو</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.storyCard}
            onPress={() => goTo('StoryCamera')}
          >
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
            <Text style={styles.storyLabel}>قصة سريعة (Story)</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        <Text style={styles.footerBrand}>Nouble Fitness & Auction</Text>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  modalHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 40,
    textAlign: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  optionCard: {
    width: width * 0.42,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  optionIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  optionSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  storyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: width * 0.88,
    marginTop: 5,
  },
  storyLabel: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  footerBrand: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 10,
  },
});
