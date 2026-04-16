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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { PublicProfileScreen } from '../screens/PublicProfileScreen';
import { UserFeedScreen } from '../screens/UserFeedScreen';
import { RecordingScreen } from '../screens/RecordingScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ChatListScreen } from '../screens/ChatListScreen';
import { ChatRoomScreen } from '../screens/ChatRoomScreen';
import { StoryEditorScreen } from '../screens/StoryEditorScreen';
import { StoryViewerScreen } from '../screens/StoryViewerScreen';
import { StoryCameraScreen } from '../screens/StoryCameraScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { MusicScreen } from '../screens/MusicScreen';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { colors } from '../theme/colors';
import { CreateMenuModal } from '../components/CreateMenuModal';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const { width } = Dimensions.get('window');

// ======================================================
// Tab Navigator (Floating Pill)
// ======================================================
const TabNavigator = () => {
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
          name="Chats"
          component={ChatListScreen}
          options={{
            tabBarLabel: 'الرسائل',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="RecordingPlaceholder"
          component={HomeScreen}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('Recording');
            },
          })}
          options={{
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <View style={styles.recordBtnHighlight}>
                <Ionicons name="fitness" size={28} color="#000" />
              </View>
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

        <Tab.Screen
          name="Music"
          component={MusicScreen}
          options={{
            tabBarLabel: 'الموسيقى',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="musical-notes" size={size} color={color} />
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

    </>
  );
};

// ======================================================
// Root Navigator — wraps Tabs + Push Screens
// ======================================================
export const MainNavigator = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <BottomSheetModalProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen
          name="UserProfile"
          component={PublicProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="UserFeedScreen"
          component={UserFeedScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Recording"
          component={RecordingScreen}
          options={{ 
            animation: 'fade_from_bottom',
            gestureEnabled: false,
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="StoryCamera"
          component={StoryCameraScreen}
          options={{ animation: 'fade', gestureEnabled: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="StoryEditor"
          component={StoryEditorScreen}
          options={{ animation: 'fade', gestureEnabled: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="StoryViewer"
          component={StoryViewerScreen}
          options={{ animation: 'fade', gestureEnabled: true, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="ChatRoom"
          component={ChatRoomScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{ headerShown: false, presentation: 'fullScreenModal' }} 
        />
        <Stack.Screen 
          name="Notifications" 
          component={NotificationsScreen} 
          options={{ headerShown: false, presentation: 'pageSheet' }} 
        />
      </Stack.Navigator>
    </BottomSheetModalProvider>
  </GestureHandlerRootView>
);

const styles = StyleSheet.create({
  // Tab Bar
  recordBtnHighlight: {
    backgroundColor: colors.primary,
    width: 52,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.9,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: `0px 4px 12px ${colors.primary}`,
      },
    }),
    marginBottom: Platform.OS === 'ios' ? 0 : 5,
  },
  recordTabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTabIconActive: {
    // subtle glow behind active record icon
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
