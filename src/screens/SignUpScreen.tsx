import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../providers/AuthProvider';
import { colors } from '../theme/colors';
import { apiClient } from '../config/api';

const { width } = Dimensions.get('window');

export const SignUpScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  
  // States
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2
  const [username, setUsername] = useState('');
  const [isUsernameTaken, setIsUsernameTaken] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Validation Flags
  const hasEightChars = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const isMatch = password === confirmPassword && confirmPassword.length > 0;
  const showConfirmBorder = confirmPassword.length > 0;
  
  const handleNextStep = () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMsg('الرجاء ملء جميع الحقول');
      return;
    }
    if (!isMatch) {
      setErrorMsg('كلمات المرور غير متطابقة');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setErrorMsg('');
    
    // Slide Animation to Step 2
    // Must use -(width - 48) to match the exact stepContainer width
    Animated.timing(slideAnim, {
      toValue: -(width - 48),
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setStep(2);
    });
  };

  const handleBackStep = () => {
    setErrorMsg('');
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setStep(1);
    });
  };

  // Live Username Check (Instagram Logic)
  useEffect(() => {
    const checkUsername = async () => {
      const uname = username.trim();
      if (!uname) {
        setIsUsernameTaken(null);
        setUsernameSuggestions([]);
        return;
      }
      
      if (uname.includes(' ') || uname.length > 15) {
        setIsUsernameTaken(true); // Treat as invalid
        setUsernameSuggestions([]);
        return;
      }

      setCheckingUsername(true);
      try {
        const res = await apiClient.post('/auth/check-username', { username: uname });
        if (res?.available !== undefined) {
          setIsUsernameTaken(!res.available);
          setUsernameSuggestions(res?.suggestions || []);
        } else {
          setIsUsernameTaken(res?.exists);
          setUsernameSuggestions([]);
        }
      } catch (e) {
        setIsUsernameTaken(null);
      } finally {
        setCheckingUsername(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      checkUsername();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [username]);

  const handleRegister = async () => {
    const uname = username.trim();

    if (!uname || uname.includes(' ') || uname.length > 15) {
      setErrorMsg('Nouble Name غير صالح (بدون مسافات، أقصى حد 15 حرفاً)');
      return;
    }

    if (isUsernameTaken) {
      setErrorMsg('Nouble Name مستخدم بالفعل، جرب غيره');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 5) {
      setErrorMsg('الرجاء إدخال رقم هاتف صحيح');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // Format phone with prefix for the backend
    const fullPhone = `+213${phoneNumber.startsWith('0') ? phoneNumber.slice(1) : phoneNumber}`;

    const { error } = await register({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      username: uname,
      phone_number: fullPhone
    });

    if (error) {
      setErrorMsg(error.message || 'فشل التسجيل، تأكد من البيانات');
      setLoading(false);
    }
  };

  // UI Helpers
  const getUsernameBorderColor = () => {
    if (username.length === 0) return 'rgba(255,255,255,0.15)';
    if (checkingUsername) return colors.primary; // Yellow while checking
    if (isUsernameTaken === true) return '#FF3B30'; // Red if taken/invalid
    if (isUsernameTaken === false) return '#34C759'; // Green if available
    return 'rgba(255,255,255,0.15)';
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10), paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollGrow} bounces={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={step === 1 ? () => navigation.goBack() : handleBackStep} 
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.stepsWrap}>
              <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
              <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>
                {step === 1 ? 'إنشاء حساب جديد' : 'أكمل هويتك 🌟'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 1 ? 'مرحباً بك في عالم المنصات الحصرية والمزادات الخاصة.' : 'اختر اسماً يعبر عنك وأضف رقمك لتأمين حسابك.'}
              </Text>
            </View>

            {!!errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons name="warning" size={20} color="#FF3B30" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <View style={styles.carouselContainer}>
              <Animated.View style={[styles.carouselInner, { transform: [{ translateX: slideAnim }] }]}>
                
                {/* ── STEP 1 ── */}
                <View style={styles.stepContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.labelStrict}>الاسم الكامل (Full Name)</Text>
                    <View style={styles.inputGroupContainer}>
                      <TextInput
                        style={styles.inputZeroBase}
                        placeholder="Ahmed Ali"
                        placeholderTextColor="#888"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                        textAlign="right"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.labelStrict}>البريد الإلكتروني (Email)</Text>
                    <View style={styles.inputGroupContainer}>
                      <TextInput
                        style={styles.inputZeroBase}
                        placeholder="your@email.com"
                        placeholderTextColor="#888"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        textAlign="right"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.labelStrict}>كلمة المرور (Password)</Text>
                    <View style={styles.inputGroupContainer}>
                      <TextInput
                        style={styles.inputZeroBase}
                        placeholder="••••••••"
                        placeholderTextColor="#888"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        textAlign="right"
                      />
                    </View>
                    <View style={styles.passwordHintsRow}>
                      <Ionicons name={hasEightChars ? "checkmark-circle" : "ellipse-outline"} size={14} color={hasEightChars ? "#34C759" : "#666"} />
                      <Text style={[styles.hintTextSmall, hasEightChars && { color: "#34C759" }]}> 8 أحرف على الأقل</Text>
                      <View style={{ width: 12 }} />
                      <Ionicons name={hasNumber ? "checkmark-circle" : "ellipse-outline"} size={14} color={hasNumber ? "#34C759" : "#666"} />
                      <Text style={[styles.hintTextSmall, hasNumber && { color: "#34C759" }]}> تحتوي على أرقام</Text>
                    </View>
                    <Text style={styles.helperText}>اختر كلمة مرور قوية لتأمين مملكتك الخاصة.</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.labelStrict}>تأكيد كلمة المرور</Text>
                    <View style={[
                      styles.inputGroupContainer,
                      showConfirmBorder && (isMatch ? styles.inputWrapperSuccess : styles.inputWrapperError)
                    ]}>
                      <TextInput
                        style={styles.inputZeroBase}
                        placeholder="••••••••"
                        placeholderTextColor="#888"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        textAlign="right"
                      />
                      {showConfirmBorder && (
                        <Ionicons 
                          name={isMatch ? "checkmark-circle" : "close-circle"} 
                          size={20} 
                          color={isMatch ? "#34C759" : "#FF3B30"} 
                        />
                      )}
                    </View>
                    {showConfirmBorder && isMatch && (
                      <Text style={[styles.hintTextSmall, { color: "#34C759", marginTop: 6, marginLeft: 4 }]}>
                        كلمات المرور متطابقة ✅
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={styles.primaryBtn} 
                    onPress={handleNextStep}
                  >
                    <Text style={styles.primaryBtnText}>التالي (Next)</Text>
                    <Ionicons name="arrow-forward" size={18} color="#000" />
                  </TouchableOpacity>
                </View>

                {/* ── STEP 2 ── */}
                <View style={styles.stepContainer}>
                  
                  {/* Username Field */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.labelStrict}>اسم المستخدم 👑</Text>
                    <View style={[styles.inputGroupContainer, { borderColor: getUsernameBorderColor() }]}>
                      <View style={styles.atSymbolBox}>
                        <Text style={styles.atSymbol}>@</Text>
                      </View>
                      <TextInput
                        style={styles.inputZeroBase}
                        placeholder="أدخل اسم المستخدم"
                        placeholderTextColor="#888"
                        value={username}
                        onChangeText={(txt) => setUsername(txt.replace(/\s/g, '').toLowerCase().slice(0, 15))}
                        autoCapitalize="none"
                        textAlign="right"
                      />
                      {checkingUsername && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />}
                      {!checkingUsername && username.length > 0 && isUsernameTaken === false && (
                         <Ionicons name="checkmark-circle" size={20} color="#34C759" style={{ marginRight: 12 }} />
                      )}
                      {!checkingUsername && username.length > 0 && isUsernameTaken === true && (
                         <Ionicons name="close-circle" size={20} color="#FF3B30" style={{ marginRight: 12 }} />
                      )}
                    </View>
                    <Text style={styles.helperText}>اسم المستخدم هو هويتك الفريدة في Nouble، يمكنك تغييره لاحقاً.</Text>

                    {!checkingUsername && isUsernameTaken === true && usernameSuggestions.length > 0 && (
                      <View style={styles.suggestionsWrap}>
                        <Text style={styles.suggestionsTitle}>هذا الاسم مستخدم بالفعل، ما رأيك في هذه الخيارات؟</Text>
                        <View style={styles.chipsRow}>
                          {usernameSuggestions.map((sug) => (
                            <TouchableOpacity key={sug} style={styles.chip} onPress={() => setUsername(sug)}>
                              <Text style={styles.chipText}>{sug}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Phone Field (Custom Rebuild) */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.labelStrict}>رقم الهاتف</Text>
                    <View style={styles.customPhoneContainer}>
                      <View style={styles.phonePrefixBox}>
                        <Text style={styles.phonePrefixText}>+213</Text>
                      </View>
                      <View style={styles.verticalDivider} />
                      <TextInput
                        style={styles.customPhoneInput}
                        placeholder="7XX XX XX XX"
                        placeholderTextColor="#888"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        textAlign="left"
                      />
                    </View>
                  </View>

                  <TouchableOpacity 
                    style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]} 
                    onPress={handleRegister}
                    disabled={loading || isUsernameTaken === true || checkingUsername}
                  >
                    {loading ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>إنشاء الحساب الآن</Text>
                        <Ionicons name="checkmark-done" size={20} color="#000" />
                      </>
                    )}
                  </TouchableOpacity>
                  
                </View>

              </Animated.View>
            </View>

            <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', marginTop: 30, marginBottom: 40 }}>
              <Text style={{ color: '#888', fontSize: 14 }}>لديك حساب بالفعل؟ </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: 'bold' }}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollGrow: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  stepsWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  titleWrap: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 6,
    textAlign: 'right',
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    textAlign: 'right',
    width: '100%',
  },
  label: {
    width: '100%',
    textAlign: 'right',
    color: 'white',
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  carouselContainer: {
    overflow: 'hidden',
    width: width - 48, // Padding is 24 on each side
  },
  carouselInner: {
    flexDirection: 'row',
    width: (width - 48) * 2, // 2 steps
  },
  stepContainer: {
    width: width - 48,
  },
  inputGroup: {
    marginBottom: 24,
  },
  labelStrict: {
    width: '100%',
    textAlign: 'right',
    color: 'white',
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    height: 54,
    overflow: 'hidden',
  },
  atSymbolBox: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  atSymbol: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    fontWeight: '700',
  },
  inputZeroBase: {
    flex: 1,
    height: '100%',
    color: '#FFF',
    fontSize: 15,
    paddingHorizontal: 14,
  },
  inputWrapperSuccess: {
    borderColor: '#34C759',
    borderWidth: 1.5,
  },
  inputWrapperError: {
    borderColor: '#FF3B30',
    borderWidth: 1.5,
  },
  customPhoneContainer: {
    flexDirection: 'row',
    height: 54,
    backgroundColor: '#222222',
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  phonePrefixBox: {
    minWidth: 64,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#2a2a2a',
  },
  phonePrefixText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  verticalDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  customPhoneInput: {
    flex: 1,
    height: '100%',
    color: '#FFF',
    fontSize: 15,
    paddingHorizontal: 14,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    marginTop: 10,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  footerWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  footerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  footerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  passwordHintsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 8,
  },
  hintTextSmall: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  suggestionsWrap: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  suggestionsTitle: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'right',
  },
  chipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
