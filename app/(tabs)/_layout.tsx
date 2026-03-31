import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF4B2B',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#111',
          borderTopWidth: 0,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'التسجيل',
          // زر "Record" بارز جداً (Strava style)
          tabBarIcon: ({ color, focused }) => (
            <View style={{
               backgroundColor: focused ? '#E03E1E' : '#FF4B2B',
               width: 56, height: 56, borderRadius: 28,
               justifyContent: 'center', alignItems: 'center',
               marginTop: -20, // رفعه للأعلى قليلاً
               shadowColor: '#FF4B2B', shadowOffset: { width: 0, height: 4 }, 
               shadowOpacity: 0.4, shadowRadius: 5, elevation: 5
            }}>
              <Ionicons name="radio-button-on" size={32} color="#FFF" />
            </View>
          ),
          tabBarLabel: () => null, // إخفاء النص ليكون زراً مركزياً فقط
          // إخفاء الـ Tab Bar بالكامل عند دخول شاشة الخريطة (Record)
          tabBarStyle: { display: 'none' }, 
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
