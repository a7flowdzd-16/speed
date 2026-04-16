/**
 * DashboardScreen.tsx
 * ─────────────────────────────────────────────────────────────────
 * لوحة تحكم نشاطات اللياقة — بستايل Strava النظيف
 *  • تجلب جميع نشاطات المستخدم من Supabase (activities)
 *  • تعرض كل نشاط كـ ActivityCard فاخر
 *  • الخريطة المصغرة مقفلة (Non-interactive) وتضبط الـ Zoom تلقائياً
 *    على المسار بالكامل (fitBounds)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────
interface Activity {
  id:               string;
  activity_type:    'run' | 'walk';
  total_time:       number;
  total_distance:   number;
  total_steps:      number;
  average_pace:     string;
  average_speed:    number;
  route_coordinates: { latitude: number; longitude: number }[];
  created_at:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────
const formatTime = (s: number): string => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`
    : `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('ar-DZ', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
};

// ─── Mini Map — خريطة مصغرة مقفلة بـ fitBounds ───────────────────
const MiniRouteMap: React.FC<{
  coords: { latitude: number; longitude: number }[];
  color:  string;
}> = ({ coords, color }) => {
  // نبني HTML مصغر بـ Leaflet — مقفل تماماً (non-interactive)
  const center = coords.length > 0
    ? coords[Math.floor(coords.length / 2)]
    : { latitude: 36.7538, longitude: 3.0588 };

  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
body,html,#map{margin:0;padding:0;height:100%;width:100%;background:#111;overflow:hidden}
.leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
</style></head><body>
<div id="map"></div>
<script>
var map=L.map('map',{
  zoomControl:false,
  attributionControl:false,
  dragging:false,
  scrollWheelZoom:false,
  doubleClickZoom:false,
  touchZoom:false,
  keyboard:false,
  boxZoom:false
}).setView([${center.latitude},${center.longitude}],14);

L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',{maxZoom:20,detectRetina:true}).addTo(map);

var coords=${JSON.stringify(coords.map(c => [c.latitude, c.longitude]))};
if(coords.length>1){
  var pl=L.polyline(coords,{
    color:'${color}',
    weight:6,
    opacity:0.95,
    lineCap:'round',
    lineJoin:'round'
  }).addTo(map);
  // fitBounds يحيط بالمسار تلقائياً
  map.fitBounds(pl.getBounds(),{padding:[18,18]});
  // نقطة البداية (خضراء) ونقطة النهاية (حمراء)
  L.circleMarker(coords[0],{radius:7,color:'#fff',fillColor:'#22C55E',fillOpacity:1,weight:2.5}).addTo(map);
  L.circleMarker(coords[coords.length-1],{radius:7,color:'#fff',fillColor:'${color}',fillOpacity:1,weight:2.5}).addTo(map);
} else if(coords.length===1){
  map.setView(coords[0],15);
  L.circleMarker(coords[0],{radius:8,color:'#fff',fillColor:'${color}',fillOpacity:1,weight:2.5}).addTo(map);
}
</script></body></html>`;

  return (
    <WebView
      source={{ html }}
      style={styles.miniMap}
      scrollEnabled={false}
      pointerEvents="none"
      originWhitelist={['*']}
      javaScriptEnabled
    />
  );
};

// ─── Activity Card → Strava Clean Style ──────────────────────────
const ActivityCard: React.FC<{ item: Activity; profile: any }> = ({ item, profile }) => {
  const isRun   = item.activity_type === 'run';
  const accent  = isRun ? '#FF4B2B' : '#007AFF';
  const emoji   = isRun ? '🏃' : '🚶';
  const label   = isRun ? 'Morning Run' : 'Morning Walk';
  const hasRoute = item.route_coordinates?.length > 1;

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <View style={styles.cardHeader}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={18} color="#555" />
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{profile?.full_name ?? 'Runner'}</Text>
          <Text style={styles.dateText}>
            {emoji} {label} · {formatDate(item.created_at)}
          </Text>
        </View>
        {/* Badge نوع النشاط */}
        <View style={[styles.typeBadge, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
          <Text style={[styles.typeBadgeText, { color: accent }]}>
            {isRun ? 'Run' : 'Walk'}
          </Text>
        </View>
      </View>

      {/* ── Stats Row ── */}
      <View style={styles.statsRow}>
        {/* المسافة — أبرز رقم */}
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: accent }]}>
            {item.total_distance.toFixed(2)}
          </Text>
          <Text style={styles.statUnit}>KM</Text>
        </View>
        <View style={styles.statDivider} />
        {/* الوقت */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatTime(item.total_time)}</Text>
          <Text style={styles.statUnit}>TEMPS</Text>
        </View>
        <View style={styles.statDivider} />
        {/* البيس أو الخطوات */}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {isRun ? (item.average_pace ?? '--:--') : (item.total_steps?.toLocaleString() ?? '0')}
          </Text>
          <Text style={styles.statUnit}>{isRun ? 'PACE' : 'PAS'}</Text>
        </View>
      </View>

      {/* ── Mini Map (Locked) ── */}
      {hasRoute ? (
        <View style={styles.mapContainer}>
          <MiniRouteMap coords={item.route_coordinates} color={accent} />
          {/* شريط المسافة فوق الخريطة */}
          <View style={styles.mapOverlayBadge}>
            <Ionicons name="map-outline" size={12} color="#fff" />
            <Text style={styles.mapOverlayText}>{item.route_coordinates.length} pts</Text>
          </View>
        </View>
      ) : (
        <View style={styles.noMapBox}>
          <Ionicons name="map-outline" size={28} color="#333" />
          <Text style={styles.noMapText}>لا يوجد مسار مسجّل</Text>
        </View>
      )}
    </View>
  );
};

// ─── Empty State ──────────────────────────────────────────────────
const EmptyState = () => (
  <View style={styles.emptyWrap}>
    <Text style={styles.emptyEmoji}>🏃</Text>
    <Text style={styles.emptyTitle}>لا توجد نشاطات بعد</Text>
    <Text style={styles.emptyDesc}>ابدأ جلستك الأولى من زر التسجيل!</Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────
export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile,    setProfile]    = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // إحصائيات إجمالية
  const totalKm    = activities.reduce((s, a) => s + (a.total_distance ?? 0), 0);
  const totalRuns  = activities.filter(a => a.activity_type === 'run').length;
  const totalWalks = activities.filter(a => a.activity_type === 'walk').length;

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: acts }, { data: prof }] = await Promise.all([
        supabase
          .from('activities')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single(),
      ]);
      if (acts) setActivities(acts as Activity[]);
      if (prof) setProfile(prof);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF4B2B" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>نشاطاتي 🏃</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Summary Banner ── */}
      <BlurView intensity={18} tint="dark" style={styles.summaryBanner}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalKm.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>KM Total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalRuns}</Text>
          <Text style={styles.summaryLabel}>Runs 🏃</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalWalks}</Text>
          <Text style={styles.summaryLabel}>Walks 🚶</Text>
        </View>
      </BlurView>

      {/* ── Feed ── */}
      <FlatList
        data={activities}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ActivityCard item={item} profile={profile} />}
        ListEmptyComponent={<EmptyState />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF4B2B" />
        }
        removeClippedSubviews
        windowSize={4}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────
const MAP_HEIGHT = width * 0.52;

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0A0A0A' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#1A1A1A',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', letterSpacing: 0.3 },

  // Summary banner
  summaryBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 14,
    borderRadius: 18, padding: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryValue:   { fontSize: 22, fontWeight: '900', color: '#FFF' },
  summaryLabel:   { fontSize: 11, color: '#666', marginTop: 3, fontWeight: '700' },
  summaryDivider: { width: 0.5, height: 36, backgroundColor: '#222' },

  // Feed
  feedContent: { paddingHorizontal: 16, paddingBottom: 120 },

  // Card
  card: {
    backgroundColor: '#111',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#222',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 10,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: {
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  userName:   { fontSize: 14, fontWeight: '800', color: '#FFF' },
  dateText:   { fontSize: 11, color: '#666', marginTop: 2 },
  typeBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 14,
    gap: 0,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 24, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  statUnit:    { fontSize: 10, fontWeight: '800', color: '#555', marginTop: 2, letterSpacing: 1.2 },
  statDivider: { width: 0.5, height: 32, backgroundColor: '#252525' },

  // Mini map
  mapContainer: {
    height: MAP_HEIGHT,
    backgroundColor: '#0A0A0A',
    position: 'relative',
  },
  miniMap: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mapOverlayBadge: {
    position: 'absolute', bottom: 10, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  mapOverlayText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // No route
  noMapBox: {
    height: 90, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0D0D0D', gap: 6,
  },
  noMapText: { color: '#333', fontSize: 12 },

  // Empty
  emptyWrap:  { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  emptyDesc:  { fontSize: 13, color: '#555', textAlign: 'center' },
});
