import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iedsonpxnhzyrbqipzji.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZHNvbnB4bmh6eXJicWlwemppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTkyNDQsImV4cCI6MjA5MDk3NTI0NH0.nRIhowpO2dbVZhNCW1O_vC_6F3HnP1G6OG6S_91YgZE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
