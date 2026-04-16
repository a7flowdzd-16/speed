/**
 * ┌─────────────────────────────────────────────────────────────────┐
 * │   useSensorFusion — دمج المستشعرات (Sensor Fusion)              │
 * │                                                                  │
 * │  يجمع 3 مستشعرات في hook واحد نظيف:                            │
 * │  1. GPS (expo-location)    → lat, lng, accuracy, altitude       │
 * │  2. Pedometer (expo-sensors) → steps (كاشف الكذب للـ GPS)      │
 * │  3. Barometer (expo-sensors) → pressure → altitude حقيقي        │
 * │                                                                  │
 * │  مبدأ العمل:                                                     │
 * │  ─ GPS يعطينا الموقع لكنه يرتجف                                 │
 * │  ─ Pedometer "يكشف الكذب": لو GPS قال تحركت لكن Pedometer      │
 * │    قال 0 خطوات → نرفض القراءة (GPS Jitter)                      │
 * │  ─ Barometer أدق من GPS في حساب الارتفاع بمعدل 10-50x          │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { Pedometer, Barometer } from 'expo-sensors';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/** حالة الصلاحيات */
export type PermissionStatus = 'pending' | 'granted' | 'denied';

/** قراءة GPS خام */
export interface GPSReading {
  latitude:  number;
  longitude: number;
  accuracy:  number;    // بالمتر — كلما كان أصغر، كلما كان أدق
  altitude:  number;    // ارتفاع GPS (أقل دقة)
  speed:     number;    // م/ث
  heading:   number;    // الاتجاه بالدرجات (0-360)
  timestamp: number;
}

/** قراءة البارومتر المحولة إلى ارتفاع */
export interface BarometerReading {
  pressure:        number;   // الضغط الجوي بـ hPa
  relativeAltitude: number;  // الارتفاع النسبي عن نقطة البداية
  absoluteAltitude: number;  // الارتفاع المحسوب من الضغط المطلق
}

/** بيانات المستشعرات المدموجة */
export interface SensorFusionData {
  // ── GPS ──
  latitude:  number;
  longitude: number;
  accuracy:  number;
  speed:     number;
  heading:   number;
  timestamp: number;

  // ── Pedometer ──
  steps:             number;
  totalSessionSteps: number;

  // ── Barometer (أدق من GPS في الارتفاع) ──
  altitude:          number;    // يفضل Barometer على GPS altitude
  altitudeDelta:     number;    // الفرق عن نقطة البداية
  pressure:          number;    // hPa

  // ── Fusion Status ──
  isGPSJitter:       boolean;   // true إذا GPS يرتجف (تحرك بدون خطوات)
  hasValidFix:       boolean;   // true إذا accuracy < maxAccuracyMeters
  gpsStrength:       'excellent' | 'good' | 'poor' | 'none';
}

export interface SensorFusionState {
  data:        SensorFusionData;
  permissions: {
    foreground: PermissionStatus;
    background: PermissionStatus;
    motion:     PermissionStatus;
  };
  isReady:        boolean;   // true بعد منح الصلاحيات وتهيئة المستشعرات
  hasBarometer:   boolean;   // بعض الأجهزة لا تملك بارومتر
  hasPedometer:   boolean;
  error:          string | null;
}

export interface UseSensorFusionOptions {
  /** الدقة الجغرافية المطلوبة للـ GPS (default: BestForNavigation) */
  gpsAccuracy?: Location.Accuracy;
  /** الحد الأقصى للدقة المقبولة بالمتر. فوق هذا الحد = قراءة مرفوضة (default: 25م) */
  maxAccuracyMeters?: number;
  /** الحد الأدنى للمسافة بالمتر كي تُقبل القراءة (default: 1م) */
  minDistanceFilter?: number;
  /** الفترة الزمنية بين قراءات GPS بالمللي ثانية (default: 1000ms) */
  gpsInterval?: number;
  /** تفعيل وضع الخلفية (default: true) */
  enableBackground?: boolean;
}

// القيم الافتراضية
const DEFAULT_DATA: SensorFusionData = {
  latitude:          0,
  longitude:         0,
  accuracy:          0,
  speed:             0,
  heading:           0,
  timestamp:         0,
  steps:             0,
  totalSessionSteps: 0,
  altitude:          0,
  altitudeDelta:     0,
  pressure:          0,
  isGPSJitter:       false,
  hasValidFix:       false,
  gpsStrength:       'none',
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** تحويل ضغط جوي (hPa) إلى ارتفاع (م) باستخدام معادلة بارومترية */
const pressureToAltitude = (pressure: number): number => {
  // معادلة هايبسومترية (Hypsometric formula)
  // الضغط عند مستوى البحر = 1013.25 hPa
  return 44307.69 * (1 - Math.pow(pressure / 1013.25, 0.190284));
};

/** تحويل دقة GPS إلى مستوى نصي */
const getGPSStrength = (accuracy: number): SensorFusionData['gpsStrength'] => {
  if (accuracy <= 0)   return 'none';
  if (accuracy <= 5)   return 'excellent';
  if (accuracy <= 15)  return 'good';
  if (accuracy <= 30)  return 'poor';
  return 'none';
};

// ─────────────────────────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────────────────────────

export const useSensorFusion = (options: UseSensorFusionOptions = {}) => {
  const {
    gpsAccuracy        = Location.Accuracy.BestForNavigation,
    maxAccuracyMeters  = 25,
    minDistanceFilter  = 1,
    gpsInterval        = 1000,
    enableBackground   = true,
  } = options;

  // ── State ─────────────────────────────────────────────────────
  const [state, setState] = useState<SensorFusionState>({
    data:        { ...DEFAULT_DATA },
    permissions: { foreground: 'pending', background: 'pending', motion: 'pending' },
    isReady:     false,
    hasBarometer: false,
    hasPedometer: false,
    error:       null,
  });

  // ── Internal Refs (لتجنب stale closures في callbacks) ─────────
  const locSubscription  = useRef<Location.LocationSubscription | null>(null);
  const pedSubscription  = useRef<ReturnType<typeof Pedometer.watchStepCount> | null>(null);
  const baroSubscription = useRef<ReturnType<typeof Barometer.addListener> | null>(null);

  // بيانات حية بدون re-render — لكشف الـ Jitter
  const liveStepsRef          = useRef<number>(0);       // الخطوات منذ آخر قراءة GPS
  const baseStepsRef          = useRef<number>(0);       // خطوات بداية الجلسة
  const lastGPSPositionRef    = useRef<{ lat: number; lng: number } | null>(null);
  const baseBaroPressureRef   = useRef<number | null>(null); // ضغط نقطة البداية
  const baseBaroAltitudeRef   = useRef<number>(0);           // ارتفاع نقطة البداية

  // ── Permission Request ────────────────────────────────────────
  const requestPermissions = useCallback(async () => {
    const perms = { foreground: 'pending' as PermissionStatus, background: 'pending' as PermissionStatus, motion: 'pending' as PermissionStatus };

    // 1. Foreground Location
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    perms.foreground = fgStatus === 'granted' ? 'granted' : 'denied';

    // 2. Background Location (اختاري)
    if (perms.foreground === 'granted' && enableBackground) {
      try {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        perms.background = bgStatus === 'granted' ? 'granted' : 'denied';
      } catch {
        perms.background = 'denied';
      }
    }

    // 3. Pedometer Permissions (iOS يحتاج إلى إذن خاص)
    try {
      const motionAvailable = await Pedometer.isAvailableAsync();
      perms.motion = motionAvailable ? 'granted' : 'denied';
    } catch {
      perms.motion = 'denied';
    }

    return perms;
  }, [enableBackground]);

  // ── GPS Subscription ──────────────────────────────────────────
  const startGPS = useCallback(async () => {
    if (locSubscription.current) {
      locSubscription.current.remove();
      locSubscription.current = null;
    }

    locSubscription.current = await Location.watchPositionAsync(
      {
        accuracy:        gpsAccuracy,
        timeInterval:    gpsInterval,
        distanceInterval: minDistanceFilter,
      },
      (location) => {
        const { latitude, longitude, accuracy, altitude, speed, heading } = location.coords;

        // ═══════════════════════════════════════════════════
        // نقطة دمج GPS × Pedometer (Anti-Jitter Logic)
        // ═══════════════════════════════════════════════════
        const currentSteps    = liveStepsRef.current;
        const stepsSinceCheck = currentSteps - baseStepsRef.current;

        // احسب المسافة عن آخر نقطة
        let movedDistance = 0;
        if (lastGPSPositionRef.current) {
          const dLat = (latitude - lastGPSPositionRef.current.lat) * 111000;
          const dLng = (longitude - lastGPSPositionRef.current.lng) * 111000;
          movedDistance = Math.sqrt(dLat * dLat + dLng * dLng);
        }

        /**
         * ─ منطق كشف الاهتزاز (GPS Jitter Detection) ─
         * إذا ادعى GPS أنك تحركت أكثر من 3 أمتار
         * لكن Pedometer يقول 0 خطوات خلال نفس الفترة
         * → الحركة وهمية (GPS Jitter) — نمررها لكن نضع العلم
         */
        const movedButNoSteps = movedDistance > 3 && stepsSinceCheck === 0;
        const isJitter        = movedButNoSteps && accuracy > 10;

        // تحديث نقطة المرجع
        lastGPSPositionRef.current = { lat: latitude, lng: longitude };
        baseStepsRef.current       = currentSteps;

        // ═══════════════════════════════════════════════════
        // دمج البارومتر مع GPS للحصول على ارتفاع أدق
        // ═══════════════════════════════════════════════════
        // (سيتم تحديثه عبر listener البارومتر لكن نحتفظ بـ fallback)
        const fallbackAltitude = altitude ?? 0;

        setState(prev => ({
          ...prev,
          data: {
            ...prev.data,
            latitude,
            longitude,
            accuracy:    accuracy ?? 0,
            speed:       Math.max(0, (speed ?? 0) * 3.6),  // تحويل م/ث → كم/س
            heading:     heading ?? prev.data.heading,
            timestamp:   location.timestamp,
            isGPSJitter: isJitter,
            hasValidFix: (accuracy ?? 999) <= maxAccuracyMeters,
            gpsStrength: getGPSStrength(accuracy ?? 999),
            // نحدث الارتفاع فقط إذا لم يكن البارومتر نشطاً
            altitude:    prev.data.pressure > 0 ? prev.data.altitude : fallbackAltitude,
          },
        }));
      }
    );
  }, [gpsAccuracy, gpsInterval, minDistanceFilter, maxAccuracyMeters]);

  // ── Pedometer Subscription ────────────────────────────────────
  const startPedometer = useCallback((available: boolean) => {
    if (!available) return;
    if (pedSubscription.current) { pedSubscription.current.remove(); }

    let sessionBase = 0; // عداد بداية الجلسة

    pedSubscription.current = Pedometer.watchStepCount((result) => {
      // عند أول قراءة، نضبط خط القاعدة
      if (sessionBase === 0) sessionBase = result.steps;

      const sessionSteps = result.steps - sessionBase;

      // نحفظ الخطوات في ref (بدون render) لكشف الـ GPS Jitter
      liveStepsRef.current = result.steps;

      setState(prev => ({
        ...prev,
        data: {
          ...prev.data,
          steps:             sessionSteps,
          totalSessionSteps: sessionSteps,
        },
      }));
    });
  }, []);

  // ── Barometer Subscription ────────────────────────────────────
  const startBarometer = useCallback(async (): Promise<boolean> => {
    try {
      const available = await Barometer.isAvailableAsync();
      if (!available) return false;

      // ضبط حساسية الـ listener (كل 200ms كافية)
      Barometer.setUpdateInterval(200);

      baroSubscription.current = Barometer.addListener((data) => {
        const { pressure } = data;
        if (!pressure || pressure < 800 || pressure > 1100) return; // تصفية قراءات غير منطقية

        const absoluteAltitude = pressureToAltitude(pressure);

        // في أول قراءة: نضبط خط قاعدة الارتفاع النسبي
        if (baseBaroPressureRef.current === null) {
          baseBaroPressureRef.current = pressure;
          baseBaroAltitudeRef.current = absoluteAltitude;
        }

        // الارتفاع النسبي = الفرق عن نقطة البداية (مفيد لتحليل المنحدرات)
        const relativeAltitude = absoluteAltitude - baseBaroAltitudeRef.current;

        setState(prev => ({
          ...prev,
          data: {
            ...prev.data,
            // ═══════════════════════════════════════════════
            // دمج البارومتر: نستبدل GPS altitude بدقة أعلى
            // البارومتر أدق من GPS في الارتفاع بمعدل 10-50x
            // ═══════════════════════════════════════════════
            altitude:      absoluteAltitude,
            altitudeDelta: relativeAltitude,
            pressure,
          },
        }));
      });

      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Master Initialization ─────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        // 1. طلب الصلاحيات
        const permissions = await requestPermissions();
        if (!mounted) return;

        if (permissions.foreground !== 'granted') {
          setState(prev => ({
            ...prev,
            permissions,
            error: 'الرجاء منح صلاحية الموقع لتشغيل نظام التتبع',
          }));
          return;
        }

        // 2. تشغيل المستشعرات بالتوازي
        const [, hasBarometer] = await Promise.all([
          startGPS(),
          startBarometer(),
        ]);

        // 3. Pedometer (يبدأ بعد تأكيد الصلاحية)
        startPedometer(permissions.motion === 'granted');

        if (!mounted) return;

        // 4. اجلب الموقع الحالي بسرعة (نقطة بداية فورية)
        try {
          const initial = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (mounted) {
            setState(prev => ({
              ...prev,
              data: {
                ...prev.data,
                latitude:   initial.coords.latitude,
                longitude:  initial.coords.longitude,
                accuracy:   initial.coords.accuracy ?? 0,
                altitude:   initial.coords.altitude ?? 0,
                hasValidFix: (initial.coords.accuracy ?? 999) <= maxAccuracyMeters,
                gpsStrength: getGPSStrength(initial.coords.accuracy ?? 999),
              },
            }));
          }
        } catch {
          // الموقع الحالي اختياري — GPS listener سيعوضه لاحقاً
        }

        if (!mounted) return;

        setState(prev => ({
          ...prev,
          permissions,
          isReady:     true,
          hasBarometer: !!hasBarometer,
          hasPedometer: permissions.motion === 'granted',
          error:       null,
        }));

      } catch (err: any) {
        if (!mounted) return;
        setState(prev => ({
          ...prev,
          error: err.message ?? 'خطأ غير معروف في تهيئة المستشعرات',
        }));
      }
    };

    initialize();

    // ── Cleanup: نطفئ كل المستشعرات عند إيقاف الـ hook ─────────
    return () => {
      mounted = false;
      cleanup();
    };
  }, []); // mount مرة واحدة فقط

  // ── Cleanup Function (قابلة للاستدعاء يدوياً عند إيقاف التسجيل) ──
  const cleanup = useCallback(() => {
    // 1. إيقاف GPS
    if (locSubscription.current) {
      locSubscription.current.remove();
      locSubscription.current = null;
    }

    // 2. إيقاف Pedometer
    if (pedSubscription.current) {
      pedSubscription.current.remove();
      pedSubscription.current = null;
    }

    // 3. إيقاف Barometer
    if (baroSubscription.current) {
      baroSubscription.current.remove();
      baroSubscription.current = null;
    }

    // 4. إعادة ضبط المراجع الداخلية
    liveStepsRef.current        = 0;
    baseStepsRef.current        = 0;
    lastGPSPositionRef.current  = null;
    baseBaroPressureRef.current = null;
    baseBaroAltitudeRef.current = 0;
  }, []);

  /** إعادة ضبط خط قاعدة الارتفاع (يُستدعى عند بداية جلسة جديدة) */
  const resetAltitudeBaseline = useCallback(() => {
    baseBaroPressureRef.current = null;
    baseBaroAltitudeRef.current = 0;
    setState(prev => ({
      ...prev,
      data: { ...prev.data, altitudeDelta: 0 },
    }));
  }, []);

  /** إعادة ضبط عداد الخطوات (يُستدعى عند بداية جلسة جديدة) */
  const resetStepCounter = useCallback(() => {
    liveStepsRef.current = 0;
    baseStepsRef.current = 0;
    setState(prev => ({
      ...prev,
      data: { ...prev.data, steps: 0, totalSessionSteps: 0 },
    }));
  }, []);

  return {
    ...state,
    cleanup,
    resetAltitudeBaseline,
    resetStepCounter,
  };
};

export default useSensorFusion;
