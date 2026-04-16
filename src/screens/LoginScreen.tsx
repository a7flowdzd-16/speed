import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { colors } from '../theme/colors';
import { useAuth } from '../providers/AuthProvider';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

export const LoginScreen = ({ navigation }: any) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم Nouble أو البريد الإلكتروني');
      return;
    }
    
    setLoading(true);

    // Call unified login method from custom backend
    const { error } = await login({ 
      identifier: identifier.trim().toLowerCase(), 
      password 
    });

    setLoading(false);

    if (error) {
      Alert.alert('فشل الدخول', error.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Gradients for Liquid Feel */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.blackBackground} />
        <LinearGradient
          colors={['rgba(255, 252, 0, 0.08)', 'transparent']}
          style={styles.lightLeakTop}
        />
        <LinearGradient
          colors={['transparent', 'rgba(255, 215, 0, 0.05)']}
          style={styles.lightLeakBottom}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <Image 
              source={require('../../assets/nouble-svg.svg')} 
              style={styles.logo} 
              contentFit="contain"
            />
            <Text style={styles.title}>Welcome to Nouble</Text>
            <Text style={styles.subtitle}>الوصول إلى أفخم المزادات الحية والمباشرة</Text>
          </View>

          <View style={styles.formGlass}>
            <CustomInput 
              label="Email or Nouble Name"
              placeholder="Username or @email"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={identifier}
              onChangeText={setIdentifier}
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

            <TouchableOpacity style={styles.forgotPass}>
              <Text style={styles.forgotText}>نسيت كلمة المرور؟</Text>
            </TouchableOpacity>

            <CustomButton 
              title="دخول" 
              onPress={onLogin} 
              loading={loading}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>ليس لديك حساب؟ </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={loading}>
              <Text style={styles.footerLink}>إنشاء حساب جديد</Text>
            </TouchableOpacity>
          </View>
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
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  lightLeakBottom: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  keyboardView: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: `0px 10px 20px ${colors.primary}80`, // 80 is roughly 0.5 opacity
      },
    }),
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
  formGlass: {
    borderRadius: 30,
    padding: 4,
  },
  forgotPass: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginRight: 4,
  },
  forgotText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
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
