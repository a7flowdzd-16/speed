import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

// 🏗️ محول تخزين مخصص باستخدام SecureStore (أكثر أماناً واستقراراً من AsyncStorage)
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = 'https://mgxfvcryohnystpjofzu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1neGZ2Y3J5b2hueXN0cGpvZnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTI2ODcsImV4cCI6MjA5MDM4ODY4N30.2d17offkG7XzSh0hKYsO64gXotaCAHpsJpAMAOBHcK8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
