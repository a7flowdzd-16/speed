import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  async function handleAuth() {
    if (!email || !password) return Alert.alert('خطأ', 'يرجى ملء جميع الحقول');
    setLoading(true);

    if (isSignUp) {
      if (!username) {
        setLoading(false);
        return Alert.alert('خطأ', 'يرجى كتابة اسم المستخدم');
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      });
      if (error) Alert.alert('خطأ في التسجيل', error.message);
      else Alert.alert('نجاح', 'تم تسجيل حسابك بنجاح! يرجى تسجيل الدخول.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) Alert.alert('خطأ في الدخول', error.message);
      else router.replace('/(tabs)');
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.logoContainer}>
             <View style={styles.iconCircle}>
                <Ionicons name="flash" size={50} color="#FF4B2B" />
             </View>
             <Text style={styles.title}>Flow Runner</Text>
             <Text style={styles.subtitle}>أهلاً بك في مستقبل الجري 🏃‍♂️</Text>
          </View>

          <BlurView intensity={20} tint="dark" style={styles.formCard}>
            <Text style={styles.formHeader}>{isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</Text>

            {isSignUp && (
              <View style={styles.inputGroup}>
                <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  placeholder="اسم المستخدم"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={20} color="#888" style={styles.inputIcon} />
              <TextInput
                placeholder="البريد الإلكتروني"
                placeholderTextColor="#666"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
              <TextInput
                placeholder="كلمة المرور"
                placeholderTextColor="#666"
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity style={styles.mainBtn} onPress={handleAuth} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>{isSignUp ? 'اشترك الآن' : 'دخول'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchBtn} onPress={() => setIsSignUp(!isSignUp)}>
              <Text style={styles.switchText}>
                {isSignUp ? 'لديك حساب بالفعل؟ سجل دخولك' : 'ليس لديك حساب؟ اشترك مجاناً'}
              </Text>
            </TouchableOpacity>
          </BlurView>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 25,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
     width: 90, height: 90, borderRadius: 45,
     backgroundColor: 'rgba(255, 75, 43, 0.1)',
     justifyContent: 'center', alignItems: 'center',
     marginBottom: 15,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#888',
    fontSize: 16,
    marginTop: 5,
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 30,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  formHeader: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 15,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 60,
    borderWidth: 1,
    borderColor: '#222',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  mainBtn: {
    backgroundColor: '#FF4B2B',
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#FF4B2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  mainBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  switchBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: '#888',
    fontSize: 14,
  }
});
