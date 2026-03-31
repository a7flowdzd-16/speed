import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// 🌟 بيانات تجريبية (Mock Data) إلى أن نربط بـ Supabase 🚀
const MOCK_RUNS = [
  { id: '1', date: 'اليوم - مسائي', distance: '5.24', time: '28:45', pace: '5:29', color: '#FF4B2B' },
  { id: '2', date: 'أمس - صباحي', distance: '10.01', time: '55:10', pace: '5:30', color: '#1E90FF' },
  { id: '3', date: 'منذ يومين', distance: '4.50', time: '24:00', pace: '5:20', color: '#FF4B2B' },
];

export default function DashboardScreen() {
  const router = useRouter();

  // تصميم كل بطاقة نشاط سابق (Strava Feed Card)
  const renderRunCard = ({ item }: { item: typeof MOCK_RUNS[0] }) => (
    <View style={styles.card}>
      {/* هيدر النشاط */}
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.userName}>أيمن (أنت)</Text>
            <Text style={styles.runDate}>{item.date}</Text>
          </View>
        </View>
        <Ionicons name="ellipsis-horizontal" size={24} color="#888" />
      </View>

      {/* تفاصيل الجري */}
      <Text style={styles.runTitle}>جري اعتيادي - {item.distance} كم</Text>
      
      <View style={styles.cardMetrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>المسافة</Text>
          <Text style={styles.metricVal}>{item.distance} <Text style={styles.metricUnit}>كم</Text></Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>الزمن</Text>
          <Text style={styles.metricVal}>{item.time} <Text style={styles.metricUnit}>دقيقة</Text></Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>البيس (Pace)</Text>
          <Text style={styles.metricVal}>{item.pace} <Text style={styles.metricUnit}>/كم</Text></Text>
        </View>
      </View>

      {/* خريطة مصغرة وهمية (Map Snapshot Placeholder) */}
      <View style={[styles.mapPlaceholder, { borderColor: item.color }]}>
        <Ionicons name="map" size={50} color={item.color} style={{ opacity: 0.3 }} />
        <Text style={{ color: item.color, marginTop: 10, fontWeight: '700', opacity: 0.5 }}>مسار الجري (خريطة)</Text>
      </View>

      {/* أزرار تفاعل (إعجاب وتعليق) */}
      <View style={styles.interactionRow}>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="heart-outline" size={24} color="#ccc" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={22} color="#ccc" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* 🌟 القسم الأول: الهيدر والملخص (Stats Summary) */}
      <View style={styles.header}>
        <Text style={styles.greeting}>مرحباً بك مجدداً 👋</Text>
        <Ionicons name="notifications-outline" size={28} color="#fff" />
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsSubtitle}>إجمالي أرقامك هذا الأسبوع</Text>
        <Text style={styles.statsMainNum}>19.75 <Text style={styles.statsMainUnit}>كم</Text></Text>
        
        <View style={styles.statsSubRow}>
          <Text style={styles.statsSubText}>⏰ الوقت: 1:48:00</Text>
          <Text style={styles.statsSubText}>🔥 السعرات: 1,205</Text>
        </View>
      </View>

      {/* 🌟 القسم الثاني: سجل النشاطات (History Feed) */}
      <Text style={styles.feedTitle}>نشاطاتك الأخيرة</Text>
      <FlatList
        data={MOCK_RUNS}
        keyExtractor={item => item.id}
        renderItem={renderRunCard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }} // مساحة لزر التسجيل السفلي
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
  },
  greeting: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  statsContainer: {
    backgroundColor: '#111',
    marginHorizontal: 15,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 25,
  },
  statsSubtitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  statsMainNum: {
    color: '#FF4B2B',
    fontSize: 55,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statsMainUnit: {
    fontSize: 22,
    color: '#ccc',
  },
  statsSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 15,
  },
  statsSubText: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '700',
  },
  feedTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#111',
    marginBottom: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#222',
    paddingVertical: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  runDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  runTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 15,
    marginTop: 5,
    marginBottom: 15,
  },
  cardMetrics: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  metric: {
    marginRight: 35,
  },
  metricLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  metricVal: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  metricUnit: {
    fontSize: 12,
    color: '#888',
  },
  mapPlaceholder: {
    height: 180,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  interactionRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginTop: 5,
  },
  actionBtn: {
    marginRight: 20,
  }
});
