import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, Dimensions, TouchableOpacity,
  StatusBar, Platform, Alert,
  Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  interpolate, Extrapolation, withRepeat, withTiming,
} from 'react-native-reanimated';
import {
  GestureHandlerRootView, Gesture, GestureDetector,
} from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { useSensorFusion } from '../hooks/useSensorFusion';
import { supabase } from '../lib/supabase';
import MapSettingsModal, { MapSettings } from '../components/MapSettingsModal';

// ─────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────
type ActivityType   = 'run' | 'walk';
type TrackingStatus = 'idle' | 'recording' | 'paused' | 'auto-paused';

const LOCATION_TASK_NAME = 'nouble-bg-location-task';
const { width: SW } = Dimensions.get('window');
const ACCENT_RUN   = '#FF4B2B';
const ACCENT_WALK  = '#007AFF';
const CARD_BOTTOM  = Platform.OS === 'ios' ? 36 : 22;

// ─────────────────────────────────────────────────────────────────
// Background Task (kept for foreground-service fallback on Android)
// ─────────────────────────────────────────────────────────────────
TaskManager.defineTask(LOCATION_TASK_NAME, () => {
  // بيانات الموقع الآن تُعالج داخل useSensorFusion مباشرة
  // هذا المهمة تُستخدم فقط لإبقاء التطبيق حياً في الخلفية (Android)
});

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const formatTime = (s: number): string => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`
    : `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
};

/**
 * ── formatPace ──────────────────────────────────────────────
 * تحول سرعة (كم/ساعة) إلى بيس (min:sec لكل كيلومتر).
 * مثال: 10 كم/ساعة = 6:00 دقيقة/كم
 */
const formatPace = (speedKmh: number): string => {
  if (speedKmh < 0.3) return '--:--';
  const paceMin = 60 / speedKmh;           // دقائق/كم
  const mins    = Math.floor(paceMin);
  const secs    = Math.round((paceMin - mins) * 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * ═══════════════════════════════════════════════════════
 *  GPS Kalman Filter — محرك التصحيح الرياضي
 * ═══════════════════════════════════════════════════════
 * يجمع بين التنبؤ (بناءً على السرعة) والقياس (إحداثيات GPS الخام)
 * ليعطي تقديراً أدق للموقع الحقيقي.
 *
 * Q: ضوضاء العملية  — كلما زاد، يعطي أهمية أكبر للقراءات الجديدة
 * R: ضوضاء القياس  — يُأخذ من accuracy^2 تلقائياً
 * K: مكسب كالمان   — K=0 ثق بالتنبؤ فقط, K=1 ثق بالقياس فقط
 */
class GPSKalmanFilter {
  private variance: number = -1;   // -1 = لم يُهيَّأ بعد
  private lat: number = 0;
  private lng: number = 0;
  private ts:  number = 0;
  // Q (متر/ث): 3 جيد للركض — ارفعه إذا بدا التنعيم زائداً
  private readonly Q = 3;

  reset() { this.variance = -1; }

  filter(
    lat: number, lng: number,
    accuracy: number, timestamp: number
  ): { latitude: number; longitude: number } {
    const measNoise = accuracy * accuracy;  // R = accuracy²

    if (this.variance < 0) {
      // القراءة الأولى: تهيئة الحالة
      this.lat = lat; this.lng = lng;
      this.variance = measNoise;
      this.ts = timestamp;
      return { latitude: lat, longitude: lng };
    }

    // ── مرحلة التنبؤ: عدم اليقين ينمو مع الوقت (حركة متوقعة) ──
    const dt = Math.max((timestamp - this.ts) / 1000, 0);
    this.ts = timestamp;
    this.variance += dt * this.Q * this.Q;

    // ── مكسب كالمان: وزن ديناميكي بين التنبؤ والقياس ──
    const K = this.variance / (this.variance + measNoise);

    // ── مرحلة التحديث: سحب التقدير نحو القياس ──
    this.lat  += K * (lat - this.lat);
    this.lng  += K * (lng - this.lng);
    this.variance = Math.max((1 - K) * this.variance, 1);

    return { latitude: this.lat, longitude: this.lng };
  }
}

/**
 * ── Haversine Formula ────────────────────────────────────────────
 * تحسب المسافة بالكيلومترات بين نقطتين على سطح الأرض.
 * تُستخدم في بوابة التفتيش لقياس المسافة بين كل نقطتين GPS متتاليتين.
 * @param coords1 - نقطة البداية { latitude, longitude }
 * @param coords2 - نقطة النهاية { latitude, longitude }
 */
const calculateHaversineDistance = (
  coords1: { latitude: number; longitude: number },
  coords2: { latitude: number; longitude: number }
): number => {
  const R = 6371; // نصف قطر الأرض بالكيلومترات
  const dLat = (coords2.latitude  - coords1.latitude)  * Math.PI / 180;
  const dLon = (coords2.longitude - coords1.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(coords1.latitude * Math.PI / 180) *
    Math.cos(coords2.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─────────────────────────────────────────────────────────────────
// Share Modal
// ─────────────────────────────────────────────────────────────────
type ShareModalProps = {
  visible:  boolean;
  onClose:  () => void;
  onShare:  (caption: string) => void;
  isSaving: boolean;
  data:     { type: ActivityType; time: number; distance: number; steps: number; pace: string };
};

const ShareModal = ({ visible, onClose, onShare, isSaving, data }: ShareModalProps) => {
  const [caption, setCaption] = useState('');
  const accent = data.type === 'run' ? ACCENT_RUN : ACCENT_WALK;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
      <SafeAreaView style={ms.wrap}>
        <View style={ms.sheet}>
          <View style={ms.hdr}>
            <Text style={ms.title}>شارك نشاطك {data.type === 'run' ? '🏃' : '🚶'}</Text>
            <TouchableOpacity onPress={onClose} style={ms.closeBtn} disabled={isSaving}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={[ms.statsCard, { borderColor: accent + '55' }]}>
            <View style={ms.statsRow}>
              {[
                { v: data.distance.toFixed(2), l: 'KM', c: accent },
                { v: formatTime(data.time),    l: 'TEMPS', c: '#fff' },
                { v: data.type === 'run' ? data.pace : data.steps.toLocaleString(), l: data.type === 'run' ? 'PACE' : 'PAS', c: '#fff' },
              ].map(({ v, l, c }) => (
                <View key={l} style={ms.statItem}>
                  <Text style={[ms.statV, { color: c }]}>{v}</Text>
                  <Text style={ms.statL}>{l}</Text>
                </View>
              ))}
            </View>
            <View style={[ms.badge, { backgroundColor: accent + '20', borderColor: accent + '44' }]}>
              <Text style={[ms.badgeT, { color: accent }]}>{data.type === 'run' ? '🏃 Run' : '🚶 Walk'}</Text>
            </View>
          </View>

          <TextInput
            style={ms.input}
            placeholder="أضف وصفاً للـ post (اختياري)..."
            placeholderTextColor="#444"
            value={caption}
            onChangeText={setCaption}
            multiline maxLength={280}
          />

          <View style={ms.actions}>
            <TouchableOpacity style={[ms.btn, ms.saveBtn]} onPress={() => onShare('')} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Ionicons name="save-outline" size={17} color="#fff" /><Text style={ms.btnT}>حفظ فقط</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity style={[ms.btn, { backgroundColor: accent }]} onPress={() => onShare(caption)} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Ionicons name="share-social" size={17} color="#fff" /><Text style={ms.btnT}>نشر Post</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────
// Recording Screen
// ─────────────────────────────────────────────────────────────────
export const RecordingScreen = () => {
  const navigation = useNavigation<any>();

  // ── State ────────────────────────────────────────────────
  const [activityType,   setActivityType]   = useState<ActivityType>('run');
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('idle');
  // Refs pour les closures (les états ne sont pas à jour dans les callbacks)
  const statusRef  = useRef<TrackingStatus>('idle');
  const actTypeRef = useRef<ActivityType>('run');
  useEffect(() => { statusRef.current  = trackingStatus; }, [trackingStatus]);
  useEffect(() => { actTypeRef.current = activityType;   }, [activityType]);

  // ── Sensor Fusion Engine ────────────────────────────────
  // نستدعي المحرك مرة واحدة — يعمل في الخلفية طوال الوقت
  const sensor = useSensorFusion({
    gpsAccuracy:       Location.Accuracy.BestForNavigation,
    maxAccuracyMeters: 20,
    gpsInterval:       1000,
    enableBackground:  true,
  });

  // ── Activity Stats ──────────────────────────────────────
  const [route,    setRoute]    = useState<{ latitude: number; longitude: number }[]>([]);
  const [distance, setDistance] = useState(0);
  const [timer,    setTimer]    = useState(0);
  const [pace,     setPace]     = useState('--:--');
  // آخر نقطة مسجلة (ref لتجنب stale closure داخل useEffect)
  const lastPointRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // ── Rolling Average — آخر 10 سرعات لحساب بيس ناعم ──
  const speedWindowRef = useRef<number[]>([]);

  // ── Kalman Filter — محرك تصحيح GPS الرياضي ──
  const kalmanRef    = useRef(new GPSKalmanFilter());
  // ── Path Smoothing Buffer — آخر 3 نقاط للمتوسط المرجّح (تجعل الخط انسيابياً) ──
  const smoothBufRef = useRef<{ latitude: number; longitude: number }[]>([]);

  // ── Smart Auto-Pause Refs ───────────────────────────────
  // silenceCountRef: عداد الثواني المتتالية بدون حركة (منع False Positives)
  // lastStepsForAutoRef: آخر قيمة للخطوات لمعرفة إن كانت تتغير
  // autoStopTimerRef: مؤقت يفحص كل ثانية
  const silenceCountRef      = useRef<number>(0);
  const lastStepsForAutoRef  = useRef<number>(0);
  const autoStopTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showShare, setShowShare] = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [showMap,   setShowMap]   = useState(false);
  // زر إعادة التمركز — يظهر عند سحب الخريطة، يختفي عند العودة
  const [isRecenterVisible, setIsRecenterVisible] = useState(false);
  // Modal إعدادات الخريطة
  const [showMapSettings,  setShowMapSettings]  = useState(false);
  const [mapSettings, setMapSettings] = useState<MapSettings>({
    mapType:      'hybrid',   // Hybrid: أفضل خيار للياقة — قمر صناعي + شوارع واضحة
    activeHeatmap: null,      // null = لا توجد خريطة حرارية مفعّلة
    showWaymarks: false,
    showTerrain:  false,
  });

  useEffect(() => {
    // تأجيل تحميل الخريطة الثقيلة حتى تنتهي حركة الانتقال
    const t = setTimeout(() => setShowMap(true), 150);
    return () => clearTimeout(t);
  }, []);

  const webRef   = useRef<WebView | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headSub  = useRef<Location.LocationSubscription | null>(null);

  // ── Animated Values ──────────────────────────────────────
  const translateX  = useSharedValue(0);
  const savedX      = useSharedValue(0);
  const pulse       = useSharedValue(0);
  const toggleAnim  = useSharedValue(0);

  useEffect(() => {
    toggleAnim.value = withSpring(activityType === 'run' ? 0 : 1, { stiffness: 280, damping: 22 });
  }, [activityType]);

  useEffect(() => {
    if (trackingStatus === 'recording') {
      pulse.value = withRepeat(withTiming(1, { duration: 650 }), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [trackingStatus]);

  // ── Gesture: horizontal swipe to hide/show card ──────────
  const panGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-12, 12])
      .onBegin(() => {
        savedX.value = translateX.value;
      })
      .onUpdate((e) => {
        translateX.value = Math.max(-SW, Math.min(0, savedX.value + e.translationX));
      })
      .onEnd((e) => {
        const finalX = savedX.value + e.translationX;
        const hide = e.velocityX < -500 || finalX < -(SW * 0.38);
        translateX.value = withSpring(hide ? -SW : 0, { damping: 20, stiffness: 210 });
      })
  , []);

  // ── Animated Styles ──────────────────────────────────────
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Pull-tab fades in as card slides away
  const pullTabStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(translateX.value, [-SW * 0.2, -SW * 0.55], [0, 1], Extrapolation.CLAMP),
    transform: [{
      translateX: interpolate(translateX.value, [-SW * 0.2, -SW * 0.6], [-55, 0], Extrapolation.CLAMP),
    }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [1, 0.15]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.4]) }],
  }));

  const toggleSliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(toggleAnim.value, [0, 1], [0, 109], Extrapolation.CLAMP) }],
  }));

  // ─────────────────────────────────────────────────────────────────
  // Smooth Heading — بوصلة سلسة مثل Google Maps
  // ─────────────────────────────────────────────────────────────────
  // بدلاً من تحديث التحويل مباشرة، نستدعي window.uch() في الـ WebView
  // وهي تدير محرك lerp+rAF داخلياً بدون أي فرامات مفقودة
  useEffect(() => {
    let lastHeading = -1;
    let sub: Location.LocationSubscription | null = null;

    Location.watchHeadingAsync((h) => {
      // نأخذ trueHeading إن كان متاحاً، وإلا magHeading
      const heading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;

      // ── فلتر الدرجتين — تجاهل التغييرات الصغيرة (تقلل الارتجاف والمعالجة) ──
      if (lastHeading !== -1 && Math.abs(heading - lastHeading) < 2) return;
      lastHeading = heading;

      // ── نستدعي window.uch() التي تدير الأنيميشن داخل الـ WebView ──
      webRef.current?.injectJavaScript(
        `if(window.uch)window.uch(${heading});true;`
      );
    }).then(s => { sub = s; headSub.current = s; });

    return () => { sub?.remove(); };
  }, []);

  // ── تمركز فوري عند تجهيز المستشعرات (قبل بدء التسجيل) ──
  useEffect(() => {
    if (!sensor.isReady || !showMap) return;
    const { latitude, longitude } = sensor.data;
    if (latitude === 0) return;
    // نوجه كاميرا الخريطة فوراً لموقع المستخدم كأول خطوة
    webRef.current?.injectJavaScript(
      `if(window.url)window.url(${latitude},${longitude});true;`
    );
  }, [sensor.isReady, showMap]);

  // ── تحديث الخريطة عند تغيير الموقع ─────────────────────
  useEffect(() => {
    if (!sensor.isReady) return;
    const { latitude, longitude, hasValidFix } = sensor.data;
    if (latitude === 0 || !hasValidFix) return;
    webRef.current?.injectJavaScript(
      `if(window.url)window.url(${latitude},${longitude});`
    );
  }, [sensor.data.latitude, sensor.data.longitude]);

  // ─────────────────────────────────────────────────────────────────
  // Rolling Average Pace ─ بيس مستقر من آخر 10 قراءات للسرعة
  // ─────────────────────────────────────────────────────────────────
  // بدلاً من حساب البيس من المسافة/الوقت الكليين (متقلب),
  // نحسبه من متوسط آخر 10 سرعات GPS. هذا يعطي رقماً ناعماً جداً.
  useEffect(() => {
    const currentSpeed = sensor.data.speed;
    if (statusRef.current !== 'recording' || currentSpeed < 0.3) return;

    // أضف السرعة الحالية واحتفظ بآخر 10 فقط (احذف الأقدم)
    speedWindowRef.current = [
      ...speedWindowRef.current.slice(-9),
      currentSpeed,
    ];

    // حساب متوسط النافذة المتحركة
    const windowLen = speedWindowRef.current.length;
    const avgSpeed  = speedWindowRef.current.reduce((a, b) => a + b, 0) / windowLen;

    // تحويل متوسط السرعة إلى بيس (min:sec/km) وتحديث الحالة
    setPace(formatPace(avgSpeed));

  }, [sensor.data.speed]);

  // ═══════════════════════════════════════════════════════════
  // ── بوابة التفتيش (Inspection Gate) ──────────────────────
  //
  // هذا useEffect هو قلب نظام التتبع.
  // يستمع لكل تغيير في بيانات المستشعرات ويمررها عبر 4 فلاتر
  // قبل أن يُسمح لها بتحديث المسار والمسافة.
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const sd = sensor.data;

    // ── 🔒 الفلتر 1: هل التطبيق في وضع التسجيل الفعلي؟ ──
    if (statusRef.current !== 'recording') return;

    // ── 🔒 الفلتر 2: هل الإحداثيات صالحة؟ ──
    if (sd.latitude === 0 && sd.longitude === 0) return;

    // ── 🔒 الفلتر 3: هل دقة الـ GPS مقبولة؟ ──
    // عتبة الدقة: 20 متر run | 15 متر walk (walk أكثر حساسية)
    const maxAccuracy = actTypeRef.current === 'run' ? 20 : 15;
    if (sd.accuracy > maxAccuracy) return;

    // ── 🔒 الفلتر 4: هل الحركة حقيقية؟ (Anti-GPS-Jitter) ──
    // isGPSJitter = true تعني: GPS ادعى تحركاً لكن Pedometer قال 0 خطوات
    // نرفض القراءة لأنها حركة وهمية ناتجة عن اهتزاز الـ GPS
    if (sd.isGPSJitter) return;

    // ── ✅ اجتازت البوابة — معالجة النقطة ──

    // ── فلتر السرعة الساكنة: لا نجمع نقاطاً عندما يكون المستخدم ساكناً ──
    // هذا يمنع تكديس النقاط (سحابة) في نفس المكان وتشويه شكل المسار
    if (sd.speed < 1.0) return;

    // ── فلتر كالمان: تصحيح الارتجاف الرياضي لإحداثيات GPS الخام ──
    // accuracy تحدد ضوضاء القياس (R) تلقائياً، والفلتر يجمع بين التنبؤ + القياس
    const filtered = kalmanRef.current.filter(
      sd.latitude, sd.longitude,
      sd.accuracy, Date.now()
    );

    // ── متوسط مرجّح بين آخر 3 نقاط (تنعيم الانعطافات) ──
    // الأوزان: الجديدة 0.65 | السابقة 0.25 | قبلها 0.10
    // هذا يجعل الخط انسيابياً عند الانعطافات بدلاً من زاوية حادة
    const buf = smoothBufRef.current;
    buf.push(filtered);
    if (buf.length > 3) buf.shift();

    let smoothed = filtered;
    if (buf.length === 3) {
      smoothed = {
        latitude:  buf[2].latitude  * 0.65 + buf[1].latitude  * 0.25 + buf[0].latitude  * 0.10,
        longitude: buf[2].longitude * 0.65 + buf[1].longitude * 0.25 + buf[0].longitude * 0.10,
      };
    } else if (buf.length === 2) {
      smoothed = {
        latitude:  buf[1].latitude  * 0.75 + buf[0].latitude  * 0.25,
        longitude: buf[1].longitude * 0.75 + buf[0].longitude * 0.25,
      };
    }

    // ── نستخدم النقطة المنعّمة للخريطة، والمفلترة للمسافة ──
    // هذا يمنع نقص المسافة الناتجة عن التنعيم الزائد
    const distPoint   = filtered;   // لحساب المسافة (Haversine أدق)
    const renderPoint = smoothed;   // لرسم الخط على الخريطة (منعّم)

    // في أول نقطة: نسجلها كنقطة بداية ونرسمها على الخريطة
    if (lastPointRef.current === null) {
      lastPointRef.current = distPoint;
      setRoute([renderPoint]);
      webRef.current?.injectJavaScript(
        `if(window.upl)window.upl(${JSON.stringify([renderPoint])});`
      );
      return;
    }

    // حساب المسافة بين النقطة المفلترة الحالية وآخر نقطة محفوظة
    const segmentDistance = calculateHaversineDistance(lastPointRef.current, distPoint);

    // الحد الأدنى للمسافة: run 3م | walk 4م (منع النقاط المتكدسة)
    const minSegment = actTypeRef.current === 'run' ? 0.003 : 0.004; // كيلومتر
    if (segmentDistance < minSegment) return;

    // تحديث المسافة الإجمالية (بالنقطة المفلترة: أدق)
    setDistance(prev => prev + segmentDistance);

    // تحديث المسار ورسم الخط بالنقطة المنعّمة (أجمل بصرياً)
    lastPointRef.current = distPoint;
    setRoute(prev => {
      const next = [...prev, renderPoint];
      webRef.current?.injectJavaScript(
        `if(window.upl)window.upl(${JSON.stringify(next)});`
      );
      return next;
    });

  // نستمع لتغير latitude فقط — يتغير مع كل قراءة GPS جديدة
  }, [sensor.data.latitude, sensor.data.longitude, sensor.data.accuracy, sensor.data.isGPSJitter]);

  // ═══════════════════════════════════════════════════════════
  // Smart Auto-Pause — إيقاف ذكي / استئناف تلقائي
  //
  // منطق منع الإيقاف الخاطئ (False Positive Prevention):
  // ─ لا نوقف بمجرد ثانية واحدة بطيئة
  // ─ نشترط 5 ثوانٍ متتالية بدون حركة (السرعة < 1.0 km/h والخطوات ثابتة)
  // ─ عند الاستئناف: إذا عادت السرعة > 2.0 km/h أو زادت الخطوات → إكمال فوري
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // نشغل المؤقت فقط في حالة recording أو auto-paused
    if (trackingStatus !== 'recording' && trackingStatus !== 'auto-paused') {
      if (autoStopTimerRef.current) {
        clearInterval(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      silenceCountRef.current = 0;
      return;
    }

    if (autoStopTimerRef.current) clearInterval(autoStopTimerRef.current);

    autoStopTimerRef.current = setInterval(() => {
      const currentSpeed = sensor.data.speed;
      const currentSteps = sensor.data.totalSessionSteps;

      // ── كشف تغيير الخطوات منذ آخر فحص ──
      const stepsChanged = currentSteps !== lastStepsForAutoRef.current;
      lastStepsForAutoRef.current = currentSteps;

      if (statusRef.current === 'recording') {
        // ── شرط السكون ──
        // كل ا لشرطين يجب أن يتحققا معاً لتجنب إيقافات خاطئة:
        // 1. السرعة أقل من 1.0 km/h (GPS يقرأ سرعة ضعيفة)
        // 2. الخطوات لم تتغير (كاشف الخداع من Pedometer)
        if (currentSpeed < 1.0 && !stepsChanged) {
          silenceCountRef.current += 1;

          // ── تفعيل Auto-Pause بعد 5 ثوانٍ متتالية ──
          if (silenceCountRef.current >= 5) {
            silenceCountRef.current = 0;
            setTrackingStatus('auto-paused');
          }
        } else {
          // حركة مكتشفة — إعادة تشغيل العداد
          silenceCountRef.current = 0;
        }

      } else if (statusRef.current === 'auto-paused') {
        // ── شرط الاستئناف ──
        // تحقق أي من الشرطين لإكمال التسجيل فوراً:
        if (currentSpeed > 2.0 || stepsChanged) {
          silenceCountRef.current = 0;
          setTrackingStatus('recording');
        }
      }
    }, 1000);

    return () => {
      if (autoStopTimerRef.current) {
        clearInterval(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
    };
  }, [trackingStatus]);

  // ── Activity Control ─────────────────────────────────────
  const startTracking = () => {
    // إعادة ضبط كل متغيرات الجلسة
    setRoute([]);
    setDistance(0);
    setTimer(0);
    setPace('--:--');
    lastPointRef.current  = null;
    speedWindowRef.current = [];        // إعادة نافذة السرعة
    silenceCountRef.current = 0;        // إعادة عداد الصمت
    lastStepsForAutoRef.current = 0;    // إعادة مرجع الخطوات
    kalmanRef.current.reset();          // إعادة فلتر كالمان
    smoothBufRef.current = [];          // مسح بافر التنعيم

    // إعادة ضبط عدادات الـ Hook داخلياً
    sensor.resetStepCounter();
    sensor.resetAltitudeBaseline();

    setTrackingStatus('recording');
    webRef.current?.injectJavaScript(`if(window.sac)window.sac(true);`);

    // مؤقت الوقت — يعمل فقط في حالة recording (ال auto-paused يوقفه تلقائياً)
    timerRef.current = setInterval(() => {
      if (statusRef.current === 'recording') setTimer(p => p + 1);
    }, 1000);
  };

  const togglePause = () =>
    setTrackingStatus(s => (s === 'recording' || s === 'auto-paused') ? 'paused' : 'recording');

  const stopAll = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    // useSensorFusion يدير مستشعراته الخاصة — نوقفها عند إنهاء الجلسة
    sensor.cleanup();
  };

  const handleFinish = () => {
    setTrackingStatus('idle');
    stopAll();
    setShowShare(true);   // يظهر modal المشاركة الاختياري
  };

  // ── Supabase Save ─────────────────────────────────────────────────────────
  // 1. يحفظ النشاط في جدول activities (دائماً)
  // 2. إذا أدخل المستخدم caption → ينشئ post في جدول posts ويرتبطان
  // 3. بعد الحفظ: ينتقل إلى Dashboard لعرض الكارت مباشرة
  // ──────────────────────────────────────────────────────────────────────────
  const saveActivity = async (caption: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('غير مسجل الدخول');

      // ── بيانات المستشعرات النهائية ──
      const finalSteps    = sensor.data.totalSessionSteps;
      const finalSpeed    = sensor.data.speed;
      const finalAlt      = sensor.data.altitude;
      const finalPressure = sensor.data.pressure;

      // ── (اختياري) إنشاء Post إذا كتب المستخدم caption ──
      let postId: string | null = null;
      if (caption.trim() !== '') {
        const summary = `${activityType === 'run' ? '🏃 Run' : '🚶 Walk'} · ${distance.toFixed(2)} km · ${formatTime(timer)}\n${caption.trim()}`;
        const { data: p, error: pe } = await supabase
          .from('posts')
          .insert({
            user_id:    user.id,
            title:      activityType === 'run' ? '🏃 ركضة جديدة' : '🚶 مشي اليوم',
            description: summary,
            media_type: 'images',
            media_urls: [] as string[],
          })
          .select('id')
          .single();
        if (pe) throw pe;
        postId = p.id;
      }

      // ── حفظ النشاط (إجباري دائماً) ──
      const { error: ae } = await supabase.from('activities').insert({
        user_id:           user.id,
        activity_type:     activityType,
        total_time:        timer,
        total_distance:    distance,
        total_steps:       finalSteps,
        average_pace:      pace,
        average_speed:     finalSpeed,
        route_coordinates: route,         // المسار المنعّم الكامل
        post_id:           postId,
        altitude:          finalAlt,
        pressure:          finalPressure,
      });
      if (ae) throw ae;

      // ── نجح الحفظ → أغلق المودال وانتقل للـ Dashboard ──
      setShowShare(false);
      // تأخير بسيط يسمح للـ Modal بالإغلاق قبل Navigation
      setTimeout(() => navigation.navigate('Dashboard'), 250);

    } catch (err: any) {
      Alert.alert('خطأ في الحفظ', err.message ?? 'فشل الحفظ، حاول مجدداً.');
    } finally {
      setIsSaving(false);
    }
  };

  // Données dérivées du hook pour l'UI
  const steps    = sensor.data.totalSessionSteps;
  const speed    = sensor.data.speed;
  const altitude = sensor.data.altitude;
  const altitudeDelta = sensor.data.altitudeDelta;
  const gpsStrength   = sensor.data.gpsStrength;

  // ── Leaflet Map ──────────────────────────────────────────
  const mapHtml = useMemo(() => {
    const la  = (sensor.data.latitude  !== 0 ? sensor.data.latitude  : null) || 36.7538;
    const lo  = (sensor.data.longitude !== 0 ? sensor.data.longitude : null) || 3.0588;
    const lc  = activityType === 'run' ? ACCENT_RUN : ACCENT_WALK;

    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
body,html,#map{margin:0;padding:0;height:100vh;width:100vw;background:#000;overflow:hidden}
.leaflet-control-attribution{display:none!important}

/* ══ User Marker Wrapper ══ */
#uhw{
  width:80px;height:80px;
  position:absolute;left:-40px;top:-40px;
  transform-origin:50% 50%;
  will-change:transform;
}

/* ══ مخروط الرؤية (Heading Cone) ══ */
.uhw-cone{
  position:absolute;
  width:80px;height:80px;
  /* التمركز ليكون أسفل المخروط في منتصف الدائرة تماماً */
  top:-40px;
  left:0;
  background:linear-gradient(to bottom, rgba(66,133,244,0.0) 0%, rgba(66,133,244,0.3) 40%, rgba(66,133,244,0.9) 100%);
  clip-path:polygon(50% 100%, 12% 0, 88% 0);
  transform-origin:50% 100%;
  pointer-events:none;
}

/* ══ دائرة النبض (Pulse Ring) ══ */
.uhw-pulse{
  position:absolute;
  left:50%;top:50%;
  width:20px;height:20px;
  margin-left:-10px;margin-top:-10px;
  background:rgba(66,133,244,0.38);
  border-radius:50%;
  animation:gmPulse 2.2s ease-out infinite;
}
@keyframes gmPulse{
  0%  {transform:scale(1);opacity:0.85}
  65% {transform:scale(3.8);opacity:0}
  100%{transform:scale(3.8);opacity:0}
}

/* ══ النواة (Core Dot) ══ */
.uhw-core{
  position:absolute;
  left:50%;top:50%;
  width:20px;height:20px;
  margin-left:-10px;margin-top:-10px;
  background:#4285F4;
  border:3px solid #fff;
  border-radius:50%;
  box-shadow:0 2px 8px rgba(0,0,0,0.5),0 0 0 3px rgba(66,133,244,0.22);
  z-index:2;
}
</style></head><body>
<div id="map"></div>
<script>
const map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${la},${lo}],18);
// window._tl: مرجع لطبقة الخريطة — نستخدمه لتغيير نوعها بدون إعادة تحميل
window._tl=L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',{maxZoom:22,detectRetina:true});
window._tl.addTo(map);
let pl=L.polyline([],{color:'${lc}',weight:7,opacity:.92,lineCap:'round',lineJoin:'round'}).addTo(map);

/* ── المؤشر بثلاث طبقات: مخروط + نبض + نواة ── */
const ico=L.divIcon({className:'',html:\`
<div id="uhw">
  <div class="uhw-cone"></div>
  <div class="uhw-pulse"></div>
  <div class="uhw-core"></div>
</div>\`,iconSize:[0,0]});
let um=L.marker([${la},${lo}],{icon:ico,zIndexOffset:1000}).addTo(map);
let ac=true;

/* ── إشعار React Native عند السحب (postMessage) ── */
map.on('dragstart',()=>{
  ac=false;
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('PANNED');
});

window.rac=()=>{
  ac=true;
  if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('CENTERED');
  map.setView(um.getLatLng(),map.getZoom(),{animate:true,duration:0.6});
};
window.sac=(f)=>{
  ac=f;
  if(f&&window.ReactNativeWebView)window.ReactNativeWebView.postMessage('CENTERED');
};
window.url=(la,lo)=>{const p=[la,lo];um.setLatLng(p);if(ac)map.setView(p,map.getZoom(),{animate:true,duration:.7});};
window.upl=(c)=>{pl.setLatLngs(c.map(x=>[x.latitude,x.longitude]));};

// ═══════════════════════════════════════════════════════════════════
// window.setMapType(type) — محرك تغيير الخريطة (طبقة أساسية + overlay)
// ─ Standard/Satellite/Winter: طبقة واحدة فقط
// ─ Hybrid: قمر صناعي صافي (lyrs=s) + overlay كل الطرق (lyrs=h)
//   lyrs=h = طبقة شفافة تحتوي: طرق رئيسية + ثانوية + مسارات + أسماء
//   بدون إعادة تحميل الخريطة (No Reload) — التبديل فوري ✅
// ═══════════════════════════════════════════════════════════════════
var _ol=null;
window.setMapType=function(type){
  var base={
    standard:  'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    satellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    hybrid:    'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    winter:    'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
  };
  if(window._tl)window._tl.setUrl(base[type]||base.hybrid);
  if(_ol){map.removeLayer(_ol);_ol=null;}
  if(type==='hybrid'){
    _ol=L.tileLayer(
      'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
      {maxZoom:22,detectRetina:true,opacity:0.92}
    );
    _ol.addTo(map);
  }
};
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// window.setHeatmap(type) — طبقة مسارات الجري العالمية (Waymarked Trails)
// type: 'global_run' → يحمّل طبقة hiking (الرابط الصحيح الوحيد في السيرفر)
// type: 'off' / أي قيمة أخرى → يزيل الطبقة من الخريطة
//
// ⚠️ ملاحظة مهمة:
//  • 'running' كـ endpoint غير موجود في waymarkedtrails.org → 404
//  • كل مسارات الجري والمشي والتسلق مجمعة تحت 'hiking' فقط
//  • zIndex: 100 إجباري لضمان رسم الخطوط فوق صور القمر الصناعي (Hybrid)
// ═══════════════════════════════════════════════════════════════════
var _hl=null;
window.setHeatmap=function(type){
  if(_hl){map.removeLayer(_hl);_hl=null;}
  if(type==='global_run'){
    _hl=L.tileLayer(
      'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
      {
        maxZoom: 18,
        opacity: 0.8,
        zIndex:  100,
        attribution: ''
      }
    );
    _hl.addTo(map);
  }
};
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// Smooth Heading Engine — lerp + rAF (60fps, بلا اتصال RN ↔ WV)
// ═══════════════════════════════════════════════════════════════════
var _curH=0,_tgtH=0,_hAnim=false;
function _lerp(a,b,t){return a+(b-a)*t;}
function _shortAngle(from,to){var d=((to-from+540)%360)-180;return from+d;}
function _animH(){
  _curH=_lerp(_curH,_tgtH,0.18);
  var el=document.getElementById('uhw');
  if(el)el.style.transform='rotate('+_curH+'deg)';
  if(Math.abs(_curH-_tgtH)>0.15){requestAnimationFrame(_animH);}
  else{_curH=_tgtH;_hAnim=false;}
}
window.uch=function(deg){
  _tgtH=_shortAngle(_curH,deg);
  if(!_hAnim){_hAnim=true;requestAnimationFrame(_animH);}
};
// ═══════════════════════════════════════════════════════════════════
</script></body></html>`;



  }, [activityType]);

  const accent = activityType === 'run' ? ACCENT_RUN : ACCENT_WALK;

  // طبقة الخريطة — تتغير عند تغيير mapType
  const MAP_TILE_URLS: Record<string, string> = {
    // Standard  — خريطة عادية بشوارع وأسماء فقط (lyrs=m)
    standard:  'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    // Satellite — صور القمر الصناعي الصافي بدون أي تداخلات (lyrs=s)
    satellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    // Hybrid    — قمر صناعي + شوارع وأسماء واضحة (lyrs=y) — الأفضل لللياقة
    hybrid:    'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    // Winter    — خريطة طبوغرافية شتوية (OpenTopoMap — مفتوحة المصدر)
    winter:    'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
  };

  // عند تغيير نوع الخريطة: نستدعي window.setMapType() في WebView
  // Hybrid = قمر صناعي (lyrs=s) + overlay كل الطرق (lyrs=h) — بدون reload
  useEffect(() => {
    if (!webRef.current) return;
    const type = mapSettings.mapType;
    webRef.current.injectJavaScript(
      `if(window.setMapType)window.setMapType('${type}');true;`
    );
  }, [mapSettings.mapType]);

  // عند تفعيل/إيقاف الخريطة الحرارية: نستدعي window.setHeatmap() في WebView
  // نرسل نوع الخريطة كسترينج ('global_run') أو null لإزالتها
  useEffect(() => {
    if (!webRef.current) return;
    const heatmapType = mapSettings.activeHeatmap ?? 'off';
    webRef.current.injectJavaScript(
      `if(window.setHeatmap)window.setHeatmap('${heatmapType}');true;`
    );
  }, [mapSettings.activeHeatmap]);

  // مؤشر قوة GPS للعرض في الـ Header
  const gpsColor = gpsStrength === 'excellent' ? '#00FF88'
    : gpsStrength === 'good'      ? '#FFAA00'
    : gpsStrength === 'poor'      ? '#FF4B2B'
    : '#555';

  // ── Render ───────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ─── Full-screen Map ─── */}
      <View style={StyleSheet.absoluteFillObject}>
        {showMap ? (
          <WebView
            key={activityType}
            ref={webRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={StyleSheet.absoluteFillObject}
            scrollEnabled
            // نستقبل رسائل PANNED/CENTERED من الخريطة لإدارة زر Recenter
            onMessage={(e) => {
              const msg = e.nativeEvent.data;
              if (msg === 'PANNED')   setIsRecenterVisible(true);
              if (msg === 'CENTERED') setIsRecenterVisible(false);
            }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
             <ActivityIndicator color="#FF4B2B" />
          </View>
        )}
      </View>

      {/* ─── Layers FAB (فوق Recenter) ─── */}
      <TouchableOpacity
        style={s.layersFab}
        onPress={() => setShowMapSettings(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="layers-outline" size={22} color="#fff" />
      </TouchableOpacity>

      {/* ─── Recenter FAB ───
           يظهر عند سحب الخريطة — يختفي فور العودة للمركز ─── */}
      {isRecenterVisible && (
        <TouchableOpacity
          style={s.recenterFab}
          onPress={() => {
            webRef.current?.injectJavaScript(`if(window.rac)window.rac();true;`);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="locate" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ─── Top Header Badge ─── */}
      <SafeAreaView style={s.headerSafe} pointerEvents="box-none">
        <View style={s.headerContent} pointerEvents="box-none">
          <TouchableOpacity 
            style={s.backBtn} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <BlurView intensity={65} tint="dark" style={s.headerPill}>
            {trackingStatus === 'recording' && (
              <Animated.View style={[s.recDot, { backgroundColor: accent }, dotStyle]} />
            )}
            {trackingStatus === 'auto-paused' && (
              <View style={[s.recDot, { backgroundColor: '#888' }]} />
            )}
            <Text style={[s.headerText, {
              color: trackingStatus === 'recording'   ? accent
                : trackingStatus === 'auto-paused' ? '#888'
                : trackingStatus === 'paused'      ? '#FFAA00'
                : '#999',
            }]}>
              {trackingStatus === 'idle'        ? 'NOUBLE TRACK'
                : trackingStatus === 'recording'  ? 'RECORDING'
                : trackingStatus === 'auto-paused'? 'AUTO-PAUSED'
                : 'PAUSED'}
            </Text>
          </BlurView>

          <View style={{ width: 44 }} /> 
        </View>
      </SafeAreaView>

      {/* ─── Pull-back Tab (shows on left when card is hidden) ─── */}
      <Animated.View style={[s.pullTabWrap, pullTabStyle]} pointerEvents="box-none">
        <TouchableOpacity
          style={s.pullTabBtn}
          onPress={() => { translateX.value = withSpring(0, { damping: 20, stiffness: 210 }); }}
          activeOpacity={0.82}
        >
          <View style={s.pullGrip}>
            {[0, 1, 2, 3].map(i => <View key={i} style={s.pullGripLine} />)}
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" style={{ marginTop: 5 }} />
        </TouchableOpacity>
      </Animated.View>

      {/* ═══════════════════════════════════════════════════════
          ─── Sliding Info Card ───
          Swipe LEFT to hide → full map view
          ═══════════════════════════════════════════════════════ */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[s.cardOuter, cardStyle]}>
          <BlurView intensity={58} tint="dark" style={s.card}>

            {/* Drag Handle — right edge grip strip */}
            <View style={s.dragHandle} pointerEvents="none">
              {[0, 1, 2, 3, 4].map(i => <View key={i} style={s.dragLine} />)}
            </View>

            {/* ── Activity Toggle (only when idle) ── */}
            {trackingStatus === 'idle' && (
              <View style={s.toggle}>
                <Animated.View style={[s.toggleSlider, toggleSliderStyle]} />
                <TouchableOpacity style={s.toggleBtn} onPress={() => setActivityType('run')} activeOpacity={0.85}>
                  <Ionicons name="body" size={13} color={activityType === 'run' ? ACCENT_RUN : '#3a3a3a'} />
                  <Text style={[s.toggleText, { color: activityType === 'run' ? ACCENT_RUN : '#3a3a3a' }]}>RUN</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.toggleBtn} onPress={() => setActivityType('walk')} activeOpacity={0.85}>
                  <Ionicons name="walk" size={13} color={activityType === 'walk' ? ACCENT_WALK : '#3a3a3a'} />
                  <Text style={[s.toggleText, { color: activityType === 'walk' ? ACCENT_WALK : '#3a3a3a' }]}>WALK</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Paused Banner ── */}
            {(trackingStatus === 'paused' || trackingStatus === 'auto-paused') && (
              <View style={s.pausedRow}>
                {trackingStatus === 'auto-paused' ? (
                  <Text style={[s.pausedText, { color: '#888', borderColor: 'rgba(136,136,136,0.22)', backgroundColor: 'rgba(136,136,136,0.08)' }]}>
                    ⏸  AUTO-PAUSED
                  </Text>
                ) : (
                  <Text style={s.pausedText}>⏸  PAUSED</Text>
                )}
              </View>
            )}

            {/* ── Timer ── */}
            <Text style={s.timer}>{formatTime(timer)}</Text>
            <Text style={s.timerLbl}>TIME ELAPSED</Text>

            {/* ── Stats Row ── */}
            <View style={s.statsRow}>
              {/* KM — المسافة الإجمالية (من Haversine) */}
              <View style={s.stat}>
                <Text style={[s.statVal, { color: accent }]}>{distance.toFixed(2)}</Text>
                <Text style={s.statLbl}>KM</Text>
              </View>
              <View style={s.sep} />
              {/* PACE (run) أو STEPS (walk) — من Pedometer */}
              <View style={s.stat}>
                <Text style={s.statVal}>
                  {activityType === 'run' ? pace : (steps > 0 ? steps.toLocaleString() : '--')}
                </Text>
                <Text style={s.statLbl}>{activityType === 'run' ? 'PACE' : 'STEPS'}</Text>
              </View>
              <View style={s.sep} />
              {/* KM/H — من GPS عبر useSensorFusion */}
              <View style={s.stat}>
                <Text style={s.statVal}>{speed > 0 ? speed.toFixed(1) : '--'}</Text>
                <Text style={s.statLbl}>KM/H</Text>
              </View>
            </View>

            {/* ── Barometer Row (ارتفاع + ضغط) ── */}
            {sensor.hasBarometer && trackingStatus !== 'idle' && (
              <View style={s.baroRow}>
                <View style={s.baroStat}>
                  <Ionicons name="trending-up" size={10} color={altitudeDelta >= 0 ? '#00FF88' : '#FF4B2B'} />
                  <Text style={s.baroVal}>
                    {altitudeDelta >= 0 ? '+' : ''}{altitudeDelta.toFixed(0)}م
                  </Text>
                  <Text style={s.baroLbl}>DÉNIVELÉ</Text>
                </View>
                <View style={s.baroStat}>
                  <Ionicons name="location" size={10} color={gpsColor} />
                  <Text style={[s.baroVal, { color: gpsColor }]}>{gpsStrength.toUpperCase()}</Text>
                  <Text style={s.baroLbl}>GPS</Text>
                </View>
                <View style={s.baroStat}>
                  <Ionicons name="arrow-up" size={10} color="#888" />
                  <Text style={s.baroVal}>{altitude > 0 ? `${altitude.toFixed(0)}م` : '--'}</Text>
                  <Text style={s.baroLbl}>ALT</Text>
                </View>
              </View>
            )}

            {/* ── Action Buttons ── */}
            {trackingStatus === 'idle' ? (
              <TouchableOpacity
                style={[s.startBtn, { backgroundColor: accent }]}
                onPress={startTracking}
                activeOpacity={0.85}
              >
                <Ionicons name="play-sharp" size={18} color="#fff" style={{ marginRight: 10 }} />
                <Text style={s.startText}>START {activityType.toUpperCase()}</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.dual}>
                <TouchableOpacity
                  style={[s.halfBtn,
                    (trackingStatus === 'paused' || trackingStatus === 'auto-paused')
                      ? s.resumeBtn : s.pauseBtn
                  ]}
                  onPress={togglePause}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={(trackingStatus === 'paused' || trackingStatus === 'auto-paused')
                      ? 'play-sharp' : 'pause-sharp'}
                    size={17}
                    color={(trackingStatus === 'paused' || trackingStatus === 'auto-paused')
                      ? '#fff' : '#111'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[s.halfText,
                    trackingStatus === 'recording' && { color: '#111' }
                  ]}>
                    {(trackingStatus === 'paused' || trackingStatus === 'auto-paused')
                      ? 'RESUME' : 'PAUSE'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.halfBtn, s.finishBtn]} onPress={handleFinish} activeOpacity={0.85}>
                  <Ionicons name="stop-sharp" size={17} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={s.halfText}>FINISH</Text>
                </TouchableOpacity>
              </View>
            )}

          </BlurView>
        </Animated.View>
      </GestureDetector>

      {/* Share Modal */}
      <ShareModal
        visible={showShare}
        onClose={() => setShowShare(false)}
        onShare={saveActivity}
        isSaving={isSaving}
        data={{ type: activityType, time: timer, distance, steps: sensor.data.totalSessionSteps, pace }}
      />

      {/* Map Settings Modal */}
      <MapSettingsModal
        visible={showMapSettings}
        settings={mapSettings}
        onClose={() => setShowMapSettings(false)}
        onChange={(s) => setMapSettings(s)}
      />
    </GestureHandlerRootView>
  );
};

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Header
  headerSafe: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 150,
    paddingTop: Platform.OS === 'ios' ? 58 : 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 28, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  headerText: { fontSize: 11, fontWeight: '900', letterSpacing: 2.5 },
  recDot:     { width: 8, height: 8, borderRadius: 4 },

  // Pull Tab — floats at left edge when card is hidden
  pullTabWrap: {
    position: 'absolute', left: 0, bottom: CARD_BOTTOM + 50, zIndex: 200,
  },
  pullTabBtn: {
    width: 42, height: 92,
    borderTopRightRadius: 22, borderBottomRightRadius: 22,
    backgroundColor: 'rgba(16,16,16,0.96)',
    borderWidth: 1, borderLeftWidth: 0,
    borderColor: 'rgba(255,255,255,0.11)',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 10,
  },
  pullGrip:     { gap: 3, alignItems: 'center', marginBottom: 2 },
  pullGripLine: { width: 12, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },

  // ── Card ────────────────────────────────────────────────
  cardOuter: {
    position: 'absolute',
    bottom: CARD_BOTTOM,
    left: 16, right: 16,
    zIndex: 100,
  },
  card: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(8,8,8,0.72)',
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 24,
    paddingLeft: 20,
    paddingRight: 42,  // room for drag handle strip
  },

  // Drag Handle — right edge visual grip
  dragHandle: {
    position: 'absolute', right: 9,
    top: 0, bottom: 0, width: 28,
    alignItems: 'center', justifyContent: 'center',
    gap: 5,
  },
  dragLine: {
    width: 14, height: 2.5, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  // Activity Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 28, padding: 3,
    marginBottom: 14, alignSelf: 'flex-start',
    width: 224,
  },
  toggleSlider: {
    position: 'absolute', left: 3, top: 3, bottom: 3,
    width: 109, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  toggleBtn: {
    width: 109, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 8, gap: 5,
  },
  toggleText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },

  // Paused Banner
  pausedRow:  { marginBottom: 8 },
  pausedText: {
    alignSelf: 'flex-start',
    color: '#FFAA00', fontSize: 11, fontWeight: '900', letterSpacing: 2.5,
    backgroundColor: 'rgba(255,165,0,0.1)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,165,0,0.22)',
    overflow: 'hidden',
  },

  // Timer
  timer:    { color: '#fff', fontSize: 58, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1.5 },
  timerLbl: { color: '#383838', fontSize: 9, fontWeight: '800', letterSpacing: 2.2, marginTop: -2, marginBottom: 14 },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stat:     { flex: 1, alignItems: 'center' },
  statVal:  { color: '#e8e8e8', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLbl:  { color: '#383838', fontSize: 9, fontWeight: '800', letterSpacing: 1.8, marginTop: 3 },
  sep:      { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Barometer Mini Row
  baroRow:  {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: 10, marginTop: 4,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  baroStat: { alignItems: 'center', gap: 2 },
  baroVal:  { color: '#aaa', fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  baroLbl:  { color: '#333', fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },

  // Buttons
  startBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  startText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 2.5 },
  dual:      { flexDirection: 'row', gap: 10 },
  halfBtn:   {
    flex: 1, flexDirection: 'row', height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  halfText:  { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  pauseBtn:  { backgroundColor: '#f0f0f0' },
  resumeBtn: { backgroundColor: '#FF9500' },
  finishBtn: { backgroundColor: '#FF2A2A' },

  // ── Recenter FAB ──
  recenterFab: {
    position: 'absolute',
    right: 16,
    bottom: CARD_BOTTOM + 320,
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.92)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 10,
    zIndex: 900,
  },

  // ── Layers FAB (فوق Recenter بـ 60px) ──
  layersFab: {
    position: 'absolute',
    right: 16,
    bottom: CARD_BOTTOM + 380, // 60px فوق recenterFab
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.92)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 10,
    zIndex: 900,
  },
});

// ─────────────────────────────────────────────────────────────────
// Share Modal Styles
// ─────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  wrap:      { flex: 1, justifyContent: 'flex-end' },
  sheet:     {
    backgroundColor: '#0d0d0d',
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderBottomWidth: 0,
  },
  hdr:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:     { color: '#fff', fontSize: 18, fontWeight: '900' },
  closeBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  statsCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.025)' },
  statsRow:  { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  statItem:  { alignItems: 'center' },
  statV:     { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statL:     { color: '#444', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 3 },
  badge:     { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 18, borderWidth: 1 },
  badgeT:    { fontSize: 12, fontWeight: '700' },
  input:     {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 14, color: '#fff', fontSize: 14,
    minHeight: 72, textAlignVertical: 'top',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 16,
  },
  actions:   { flexDirection: 'row', gap: 10 },
  btn:       { flex: 1, flexDirection: 'row', height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveBtn:   { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)' },
  btnT:      { color: '#fff', fontSize: 14, fontWeight: '900' },
});

export default RecordingScreen;
