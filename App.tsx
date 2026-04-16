import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Providers
import { AuthProvider } from './src/providers/AuthProvider';
import { PresenceProvider } from './src/providers/PresenceProvider';
import { StoryUploadProvider } from './src/providers/StoryUploadProvider';
import { GlobalMessageListener } from './src/providers/GlobalMessageListener';

// Navigator & Components
import { RootNavigator } from './src/navigation/RootNavigator';
import { InAppToast, setupToast } from './src/components/InAppToast';

export default function App() {
  const toastRef = useRef<any>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={Platform.OS === 'web' ? undefined : initialWindowMetrics}>
        <AuthProvider>
          <PresenceProvider>
            <StoryUploadProvider>
              <NavigationContainer>
                <StatusBar style="light" />
                <GlobalMessageListener>
                  <View style={styles.root}>
                    <RootNavigator />
                    <InAppToast
                      ref={(r) => {
                        toastRef.current = r;
                        if (r) setupToast(r);
                      }}
                    />
                  </View>
                </GlobalMessageListener>
              </NavigationContainer>
            </StoryUploadProvider>
          </PresenceProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});
