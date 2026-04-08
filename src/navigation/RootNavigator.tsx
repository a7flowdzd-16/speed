import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { CreateMenuScreen } from '../screens/CreateMenuScreen';
import { CreatePostScreen } from '../screens/CreatePostScreen';
import { CreateHubScreen } from '../screens/CreateHubScreen';
import { LiveViewerScreen } from '../screens/LiveViewerScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <AuthNavigator />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainNavigator} />
      
      {/* Modals & Full Screens */}
      <Stack.Screen 
        name="CreateMenu" 
        component={CreateMenuScreen} 
        options={{ 
            presentation: 'overFullScreenModal',
            animation: 'fade_from_bottom' 
        }} 
      />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="CreateHub" component={CreateHubScreen} />
      <Stack.Screen 
        name="LiveViewer" 
        component={LiveViewerScreen} 
        options={{ presentation: 'fullScreenModal' }} 
      />
    </Stack.Navigator>
  );
};
