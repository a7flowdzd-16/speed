import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

export const SignUpScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    if (!email || !password || !name) {
      Alert.alert('تنبيه', 'يرجى تعبئة جميع الحقول');
      return;
    }
    
    setLoading(true);
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        }
      }
    });
    setLoading(false);

    if (error) {
      Alert.alert('فشل التسجيل', error.message);
    } else if (data?.user && !data?.session) {
       Alert.alert('تأكيد البريد', 'يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Gradients */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.blackBackground} />
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.05)', 'transparent']}
          style={styles.lightLeakTop}
        />
        <LinearGradient
          colors={['transparent', 'rgba(255, 252, 0, 0.08)']}
          style={styles.lightLeakBottom}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Image 
                source={require('../../assets/nouble-svg.svg')} 
                style={styles.logo} 
                contentFit="contain"
              />
              <Text style={styles.title}>Join Nouble</Text>
              <Text style={styles.subtitle}>انضم إلى نخبة المزادات المباشرة والحصرية</Text>
            </View>

            <View style={styles.form}>
              <CustomInput 
                label="Full Name"
                placeholder="Nouble Unique Name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={name}
                onChangeText={setName}
              />

              <CustomInput 
                label="Email"
                placeholder="nouble@example.com"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <CustomInput 
                label="Password"
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <CustomButton 
                title="إنشاء حساب" 
                onPress={onSignUp} 
                loading={loading}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>لديك حساب بالفعل؟ </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
                <Text style={styles.footerLink}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  blackBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  lightLeakTop: {
    position: 'absolute',
    top: -50,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  lightLeakBottom: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  form: {
    marginBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  footerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 15,
  }
});
