import React, { useState } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { UserFeedScreen } from '../screens/UserFeedScreen';
import { HostLiveScreen } from '../screens/HostLiveScreen';
import { ViewerLiveScreen } from '../screens/ViewerLiveScreen';
import { colors } from '../theme/colors';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const { width } = Dimensions.get('window');

// ======================================================
// Create Menu Modal — يظهر فوق كل شيء بدون Navigation
// ======================================================
const CreateMenuModal = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) => {
  const navigation = useNavigation<any>();

  const goTo = (screen: string) => {
    onClose();
    setTimeout(() => navigation.navigate(screen), 50);
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
            {/* بث مباشر */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => goTo('CreateHub')}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#FF3B30' }]}>
                <Ionicons name="radio" size={38} color="#FFF" />
              </View>
              <Text style={styles.optionLabel}>بث مباشر</Text>
              <Text style={styles.optionSub}>ابدأ مزاد حي الآن</Text>
            </TouchableOpacity>

            {/* منشور جديد */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => goTo('CreatePost')}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="images" size={38} color="#FFF" />
              </View>
              <Text style={styles.optionLabel}>منشور جديد</Text>
              <Text style={styles.optionSub}>شارك صور أو فيديو</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.storyCard}
            onPress={() =>
              Alert.alert('قريباً', 'ميزة القصص ستكون متاحة قريباً 🔥')
            }
          >
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
            <Text style={styles.storyLabel}>قصة سريعة (Story)</Text>
            <Text style={styles.comingSoon}>قريباً</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerBrand}>A7 Flow Live Auction</Text>
      </SafeAreaView>
    </Modal>
  );
};

// ======================================================
// Tab Navigator (Floating Pill)
// ======================================================
const TabNavigator = () => {
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderTopWidth: 0,
            height: 65,
            bottom: Platform.OS === 'ios' ? 30 : 20, // ارفع البار لكي يطفو
            marginHorizontal: 20, // حواف جانبية لكي لا يلمس الشاشة
            borderRadius: 35, // حواف دائرية بالكامل (Capsule Look)
            paddingBottom: Platform.OS === 'ios' ? 5 : 10,
            paddingTop: Platform.OS === 'ios' ? 5 : 10,
            elevation: 15,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            overflow: 'hidden', // ضروري لتركيز الـ Blur داخل الحواف
          },
          tabBarBackground: () => (
            <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />
          ),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: '#AAAAAA',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginBottom: 5 },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: 'الرئيسية',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-sharp" size={size} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{
            tabBarLabel: 'البحث',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color} />
            ),
          }}
        />

        {/* زر الإنشاء — لا يفتح شاشة، فقط يفتح المودال */}
        <Tab.Screen
          name="CreatePlaceholder"
          component={HomeScreen} // مكون وهمي، لن يُرى أبداً
          listeners={{
            tabPress: (e) => {
              e.preventDefault(); // منع أي تنقل
              setShowCreateMenu(true); // فتح المودال فقط
            },
          }}
          options={{
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <View style={styles.createBtn}>
                <Ionicons name="add" size={32} color="#000" />
              </View>
            ),
          }}
        />

        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'حسابي',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-sharp" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      {/* المودال يظهر فوق كل شيء */}
      <CreateMenuModal
        visible={showCreateMenu}
        onClose={() => setShowCreateMenu(false)}
      />
    </>
  );
};

// ======================================================
// Root Navigator — wraps Tabs + Push Screens
// ======================================================
export const MainNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs" component={TabNavigator} />
    <Stack.Screen
      name="UserProfile"
      component={UserProfileScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="UserFeedScreen"
      component={UserFeedScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="HostLive"
      component={HostLiveScreen}
      options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
    />
    <Stack.Screen
      name="LiveViewer"
      component={ViewerLiveScreen}
      options={{ animation: 'slide_from_bottom' }}
    />
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  // Tab Bar
  createBtn: {
    backgroundColor: colors.primary,
    width: 48,
    height: 40, // مستطيل رويان (Squircle Look)
    borderRadius: 14, // حواف مربعة منحنية (Square Rounded)
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 12,
    marginBottom: Platform.OS === 'ios' ? 0 : 5, 
  },

  // Modal
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
  comingSoon: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,200,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  footerBrand: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 10,
  },
});
