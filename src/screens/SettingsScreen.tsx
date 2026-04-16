import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { colors } from '../theme/colors';
import { useAuth } from '../providers/AuthProvider';
import { apiClient } from '../config/api';

export const SettingsScreen = () => {
  const navigation = useNavigation();
  const { user, updateUser } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(!!user?.notifications_enabled);
  const [notifyLikes, setNotifyLikes] = useState(!!user?.notify_likes);
  const [notifyComments, setNotifyComments] = useState(!!user?.notify_comments);
  const [notifyFollows, setNotifyFollows] = useState(!!user?.notify_follows);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setNotificationsEnabled(!!user.notifications_enabled);
      setNotifyLikes(user.notify_likes !== 0);
      setNotifyComments(user.notify_comments !== 0);
      setNotifyFollows(user.notify_follows !== 0);
    }
  }, [user]);

  const updateSettings = async (updates: any) => {
    setLoading(true);
    try {
      const payload = {
        user_id: user?.id,
        push_token: user?.push_token,
        enabled: notificationsEnabled,
        notify_likes: notifyLikes,
        notify_comments: notifyComments,
        notify_follows: notifyFollows,
        ...updates
      };

      await apiClient.put('/users/settings/notifications', payload);
      await updateUser(updates);
    } catch (error) {
      console.error('Update Settings Error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث الإعدادات.');
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    let pushToken = user?.push_token || null;

    if (value && !pushToken) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted' && Device.isDevice) {
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: 'e4a2fac6-c96c-4930-825a-dc56ce8bcc75'
            });
            pushToken = tokenData.data;
        }
    }
    
    await updateSettings({ notifications_enabled: value ? 1 : 0, push_token: pushToken });
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>الإعدادات</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>تنبيهات نوبل</Text>
          
          <View style={styles.optionCard}>
            <View style={styles.optionLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,215,0,0.1)' }]}>
                <Ionicons name="notifications" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.optionLabel}>الإشعارات العامة</Text>
                <Text style={styles.optionSub}>تنبيهات فورية للرسائل والنظام</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleGlobalToggle}
              trackColor={{ false: '#333', true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          {notificationsEnabled && (
            <View style={styles.detailedSettings}>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>الإعجابات والتفاعلات</Text>
                    <Switch 
                        value={notifyLikes} 
                        onValueChange={(v) => { setNotifyLikes(v); updateSettings({ notify_likes: v ? 1 : 0 }); }}
                        trackColor={{ false: '#333', true: colors.primary }}
                        thumbColor="#FFF"
                    />
                </View>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>التعليقات الجديدة</Text>
                    <Switch 
                        value={notifyComments} 
                        onValueChange={(v) => { setNotifyComments(v); updateSettings({ notify_comments: v ? 1 : 0 }); }}
                        trackColor={{ false: '#333', true: colors.primary }}
                        thumbColor="#FFF"
                    />
                </View>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>المتابعون الجدد</Text>
                    <Switch 
                        value={notifyFollows} 
                        onValueChange={(v) => { setNotifyFollows(v); updateSettings({ notify_follows: v ? 1 : 0 }); }}
                        trackColor={{ false: '#333', true: colors.primary }}
                        thumbColor="#FFF"
                    />
                </View>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>عن التطبيق</Text>
          <TouchableOpacity style={styles.simpleRow}>
            <Text style={styles.simpleLabel}>مركز المساعدة</Text>
            <Ionicons name="chevron-back" size={20} color="#444" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.simpleRow}>
            <Text style={styles.simpleLabel}>سياسة الخصوصية</Text>
            <Ionicons name="chevron-back" size={20} color="#444" />
          </TouchableOpacity>
          
          <View style={styles.footer}>
            <Text style={styles.version}>Nouble v1.0.25</Text>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1, padding: 20 },
  sectionTitle: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textAlign: 'right', letterSpacing: 1 },
  optionCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  detailedSettings: { marginTop: 15, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 10 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  rowLabel: { color: '#BBB', fontSize: 14 },
  optionLeft: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  optionLabel: { color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'right' },
  optionSub: { color: '#666', fontSize: 12, marginTop: 2, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 30 },
  simpleRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#111' },
  simpleLabel: { color: '#DDD', fontSize: 16 },
  footer: { marginTop: 50, alignItems: 'center' },
  version: { color: '#333', fontSize: 12, fontWeight: 'bold' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
});


export default SettingsScreen;
