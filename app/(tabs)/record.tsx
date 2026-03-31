import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity, SafeAreaView, StatusBar, Platform, Alert, DeviceEventEmitter } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

const LOCATION_TASK_NAME = 'background-location-task';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const POS_FULL = Platform.OS === 'ios' ? 80 : 60;
const POS_NORMAL = SCREEN_HEIGHT - 280;
const POS_MINIMIZED = SCREEN_HEIGHT - 130;

// معادلة حساب المسافة الجغرافية (Haversine Formula) بين نقطتين
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // المسافة بالكيلومتر
};

// 🌟 تسجيل مهمة الخلفية (Background Task) للـ GPS لتستمر حتى لو أُغلق التطبيق
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background location task error:", error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    if (locations && locations.length > 0) {
      // إرسال الموقع الجديد للواجهة عبر Emitter ليتم تحديث المسار فورياً
      DeviceEventEmitter.emit('background-location-update', locations[0]);
    }
  }
});

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export default function HomeScreen() {
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isBackgroundSupported, setIsBackgroundSupported] = useState(true);
  const [distance, setDistance] = useState(0); 
  const [timer, setTimer] = useState(0); 
  const [pace, setPace] = useState('--:--');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const headingSubscription = useRef<Location.LocationSubscription | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const router = useRouter();

  // 🌟 إعدادات وعمليات السحب (Draggable Bottom Sheet)
  const translateY = useSharedValue(POS_NORMAL);
  const context = useSharedValue({ y: 0 });

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      let nextY = event.translationY + context.value.y;
      nextY = Math.max(POS_FULL, Math.min(POS_MINIMIZED + 50, nextY)); // حدود السحب (مسموح بالتجاوز قليلاً للأسفل)
      translateY.value = nextY;
    })
    .onEnd((event) => {
      const dest = translateY.value + event.velocityY * 0.2; // محاكاة الاندفاع (Momentum)
      const dFull = Math.abs(dest - POS_FULL);
      const dNormal = Math.abs(dest - POS_NORMAL);
      const dMin = Math.abs(dest - POS_MINIMIZED);
      
      let target = POS_NORMAL;
      if (dFull < dNormal && dFull < dMin) target = POS_FULL;
      else if (dMin < dNormal && dMin < dFull) target = POS_MINIMIZED;

      translateY.value = withSpring(target, { damping: 15, stiffness: 100, mass: 0.5 });
    });

  const animatedSheetStyle = useAnimatedStyle(() => {
    return { transform: [{ translateY: translateY.value }] };
  });

  const animatedButtonStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateY.value, [POS_NORMAL, POS_MINIMIZED], [1, 0], Extrapolation.CLAMP);
    const height = interpolate(translateY.value, [POS_NORMAL, POS_MINIMIZED], [70, 0], Extrapolation.CLAMP);
    const marginTop = interpolate(translateY.value, [POS_NORMAL, POS_MINIMIZED], [25, 0], Extrapolation.CLAMP);
    return { opacity, height, marginTop, overflow: 'hidden' };
  });

  const normalStatsStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateY.value, [POS_FULL + 100, POS_NORMAL - 50], [0, 1], Extrapolation.CLAMP);
    return { opacity };
  });

  const fullStatsStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateY.value, [POS_FULL + 50, POS_NORMAL - 50], [1, 0], Extrapolation.CLAMP);
    return { 
      opacity, 
      position: 'absolute', 
      top: 60, left: 20, right: 20,
      pointerEvents: opacity === 0 ? 'none' : 'auto' 
    };
  });

  useEffect(() => {
    (async () => {
      // 1. طلب الصلاحيات الأساسية (Foreground)
      let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('صلاحية الموقع', 'نحتاج الوصول للموقع لتتمكن من تتبع مسارك.');
        return;
      }

      // 2. محاولة طلب صلاحية التتبع في الخلفية (صامتة لتفادي إزعاج Expo Go)
      try {
        let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') setIsBackgroundSupported(false);
      } catch (err) {
        // Fallback silently if background isn't supported (e.g., Expo Go)
        setIsBackgroundSupported(false);
      }

      // 🌟 3. تهيئة فورية فائقة السرعة (Instant Map Init)
      // نستخدم آخر موقع معروف لفتح الخريطة فوراً بدون أي تأخير انتظاراً لـ GPS
      let lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        setCurrentLocation(lastKnown.coords);
        if (webViewRef.current) updateMapPath([{ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude }]);
      }

      // 🌟 4. جلب الموقع الدقيق (High Accuracy Lock)
      let initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setCurrentLocation(initialLocation.coords);
      if (webViewRef.current) {
        updateMapPath([{ latitude: initialLocation.coords.latitude, longitude: initialLocation.coords.longitude }]);
      }

      // 🧭 تتبع اتجاه البوصلة (Heading) بنعومة
      let lastHeading = -1;
      headingSubscription.current = await Location.watchHeadingAsync((headingData) => {
          const heading = headingData.trueHeading >= 0 ? headingData.trueHeading : headingData.magHeading;
          if (lastHeading === -1 || Math.abs(heading - lastHeading) > 3) {
             lastHeading = heading;
             if (webViewRef.current) {
                 webViewRef.current.injectJavaScript(`
                   var el = document.getElementById('user-heading-wrapper');
                   if(el) { el.style.transform = 'rotate(' + ${heading} + 'deg)'; }
                 `);
             }
          }
      });
    })();

    // الاستماع لتحديثات الموقع من الخلفية لربطها بالواجهة
    const subscription = DeviceEventEmitter.addListener('background-location-update', (location) => {
        handleNewLocation(location);
    });

    return () => {
      stopTracking();
      subscription.remove();
      if (headingSubscription.current) headingSubscription.current.remove();
    };
  }, []);

  // دالة موحدة لمعالجة الموقع الجديد (من الأمام أو الخلف)
  const handleNewLocation = (location: any) => {
    // 🌟 تصفية ضجيج الموقع (GPS Noise Filtering - المستوى الاحترافي)
    // نرفض الإحداثيات الضعيفة (دقة أسوأ من 15 متر)
    if (location.coords.accuracy && location.coords.accuracy > 15) return;

    const newCoords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    
    setCurrentLocation(location.coords);
    
    setRouteCoordinates(prev => {
      if (prev.length > 0) {
        const lastCoord = prev[prev.length - 1];
        const newDistance = getDistance(lastCoord.latitude, lastCoord.longitude, newCoords.latitude, newCoords.longitude);
        
        // منع تسجيل الاهتزازات أثناء الوقوف (Drift Filtering): 
        // لا نحتسب مسافة إلا إذا تحركت أكثر من 2 متر (0.002 كم)
        if (newDistance > 0.002) { 
          setDistance(current => current + newDistance);
          const nextRoute = [...prev, newCoords];
          updateMapPath(nextRoute);
          return nextRoute;
        }
      } else {
        updateMapPath([newCoords]);
        return [newCoords];
      }
      return prev;
    });
  };

  // تحديث سرعة الجري (Pace)
  useEffect(() => {
    if (distance > 0 && timer > 0) {
      const paceInMinutes = (timer / 60) / distance; 
      const formattedPace = formatTime(Math.round(paceInMinutes * 60));
      setPace(formattedPace);
    } else {
      setPace('--:--');
    }
  }, [distance, timer]);

  // 🏃‍♂️ بدء التتبع وحفظ إحداثيات المسار
  const startTracking = async () => {
    setRouteCoordinates([]);
    setDistance(0);
    setTimer(0);
    setIsTracking(true);

    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);

    // 🌟 بدء تحديثات الموقع
    try {
      if (!isBackgroundSupported) throw new Error("Fallback to foreground");
      
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation, 
        timeInterval: 1000,
        distanceInterval: 1,                          
        showsBackgroundLocationIndicator: true,       
        foregroundService: {                          
          notificationTitle: "A7 Flow Runner",
          notificationBody: "جاري تتبع مسار جريك الآن...",
          notificationColor: "#FF4B2B",
        }
      });
    } catch (e) {
      // 🌟 تتبع بديل في الواجهة الأمامية فقط (في حالة العمل على Expo Go)
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => handleNewLocation(location)
      );
    }
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    // إيقاف مهمة التتبع الأمامية (الخطة البديلة)
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    
    // إيقاف مهمة التتبع في الخلفية الأساسية
    Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).then(hasStarted => {
      if (hasStarted) Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    });
  };

  const toggleTracking = () => isTracking ? stopTracking() : startTracking();

  // إرسال البيانات للمتصفح الداخلي (Leaflet)
  const updateMapPath = (coords: {latitude: number, longitude: number}[]) => {
    if (!webViewRef.current) return;
    const js = `if (window.updateRoute) window.updateRoute(${JSON.stringify(coords)});`;
    webViewRef.current.injectJavaScript(js);
  };

  // 🌍 خريطة Satellite احترافية قوية
  const getLeafletSource = () => {
    const lat = currentLocation?.latitude || 36.7538;
    const lon = currentLocation?.longitude || 3.0588;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { margin: 0; padding: 0; width: 100vw; height: 100vh; background: #000; overflow: hidden; }
          .leaflet-control-attribution { display: none !important; } /* 🎉 إخفاء أي Watermarks مزعجة */
          .custom-user-marker { position: absolute; }
          /* 🌟 تنعيم حركة النقطة الزرقاء (Movement) ودوران السهم (Heading) بنعومة فائقة */
          .leaflet-marker-icon { 
            transition: transform 0.5s ease-out, top 0.5s linear, left 0.5s linear !important; 
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', { 
            zoomControl: false, 
            attributionControl: false // تعطيل شريط المصدر
          }).setView([${lat}, ${lon}], 18);

          // 🌟 1. خريطة أقمار صناعية + شوارع (Real Satellite Hybrid) فائقة الدقة 🌟
          // وضعنا detectRetina: true لضمان وضوح الشوارع والمباني 100% دون أن تبدو ضبابية
          L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 22,
            detectRetina: true 
          }).addTo(map);

          // 🌟 3. خط التتبع المباشر (Polyline) باللون البرتقالي الساطع
          let polyline = L.polyline([], { 
            color: '#FF4B2B', 
            weight: 7, 
            opacity: 1, 
            lineJoin: 'round', 
            lineCap: 'round' 
          }).addTo(map);

          // 🌟 2. مؤشر موقع احترافي مع زاوية النظر (GPS Marker + Direction Cone)
          // صممنا أيقونة مخصصة (SVG) تحتوي على النقطة الزرقاء وشعاع زاوية النظر
          const userIcon = L.divIcon({
            className: 'custom-user-marker',
            html: \`
              <div id="user-heading-wrapper" style="width: 80px; height: 80px; position: absolute; left: -40px; top: -40px; transition: transform 0.5s ease-out, top 0.5s linear, left 0.5s linear; transform: rotate(0deg);">
                <svg viewBox="0 0 100 100" width="100%" height="100%">
                  <!-- Cone: مجال الرؤية (شعاع بوصلة) -->
                  <path d="M 50 50 L 25 10 Q 50 -5 75 10 Z" fill="url(#cone-grad)" opacity="0.6" />
                  <defs>
                    <radialGradient id="cone-grad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stop-color="#00A2FF"/>
                      <stop offset="100%" stop-color="#00A2FF" stop-opacity="0"/>
                    </radialGradient>
                  </defs>
                  <!-- النقطة الزرقاء الجوهرية (Center Dot) -->
                  <circle cx="50" cy="50" r="10" fill="#007AFF" stroke="#fff" stroke-width="4" filter="drop-shadow(0 0 6px rgba(0,0,0,0.6))" />
                </svg>
              </div>
            \`,
            iconSize: [0, 0] // ليتمركز تماماً فوق إحداثيات المشي بدقة متناهية
          });

          let userMarker = L.marker([${lat}, ${lon}], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

          // هذه الدالة يناديها كود الـ React Native ليرسل الإحداثيات كلما تحركت خطوة
          window.updateRoute = function(coords) {
            const latlngs = coords.map(c => [c.latitude, c.longitude]);
            polyline.setLatLngs(latlngs); // رسم الخط البرتقالي الجديد
            
            if (latlngs.length > 0) {
              const last = latlngs[latlngs.length - 1];
              userMarker.setLatLng(last); // تحريك النقطة الزرقاء لموقعك الجديد
              map.setView(last, map.getZoom(), { animate: true, duration: 1.5 }); // تحريك الكاميرا خلفك بسلاسة (Smooth panning)
            }
          };

          window.updateRoute(${JSON.stringify(routeCoordinates)});
        </script>
      </body>
      </html>
    `;
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* FULL SCREEN MAP */}
      <View style={StyleSheet.absoluteFillObject}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: getLeafletSource() }}
          style={StyleSheet.absoluteFillObject}
          scrollEnabled={true}
          onLoadEnd={() => updateMapPath(routeCoordinates)}
        />
      </View>

      {/* 🔙 BACK BUTTON */}
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <BlurView intensity={80} tint="dark" style={styles.backContainer}>
          <Ionicons name="close" size={28} color="#fff" />
        </BlurView>
      </TouchableOpacity>

      {/* DRAGGABLE GLASS BOTTOM SHEET */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.bottomSheet, animatedSheetStyle]}>
          <BlurView intensity={80} tint="dark" style={styles.glassCard}>
            <View style={styles.dragIndicator} />
            
            {/* 1. NORMAL / MINIMIZED STATS (Row) */}
            <Animated.View style={[styles.metricsRow, normalStatsStyle]}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>الوقت</Text>
                <Text style={styles.metricValue}>{formatTime(timer)}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>المسافة (كم)</Text>
                <Text style={styles.metricValue}>{distance.toFixed(2)}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>البيس</Text>
                <Text style={styles.metricValue}>{pace}</Text>
              </View>
            </Animated.View>

            {/* 2. FULL SCREEN STATS (Column / Large Grid) */}
            <Animated.View style={fullStatsStyle}>
              <Text style={styles.fullTitle}>سجل الجري المباشر</Text>
              
              <View style={styles.fullMetricBlock}>
                <Text style={styles.fullMetricLabel}>الوقت المنقضي</Text>
                <Text style={[styles.fullMetricValue, { fontSize: 75, color: '#FF4B2B' }]}>{formatTime(timer)}</Text>
              </View>

              <View style={styles.fullGrid}>
                 <View style={styles.fullGridItem}>
                    <Text style={styles.fullMetricLabel}>المسافة المقطوعة</Text>
                    <Text style={[styles.fullMetricValue, { fontSize: 40 }]}>{distance.toFixed(2)} <Text style={{fontSize: 20, color: '#aaa'}}>كم</Text></Text>
                 </View>
                 <View style={styles.fullGridItem}>
                    <Text style={styles.fullMetricLabel}>متوسط السرعة (Pace)</Text>
                    <Text style={[styles.fullMetricValue, { fontSize: 40 }]}>{pace}</Text>
                 </View>
              </View>
            </Animated.View>

            {/* Start/Stop Button */}
            <Animated.View style={[styles.buttonContainer, animatedButtonStyle]}>
              <TouchableOpacity
                style={[styles.button, isTracking ? styles.stopButton : styles.startButton]}
                onPress={toggleTracking}
                activeOpacity={0.8}
              >
                <Ionicons name={isTracking ? "stop" : "play"} size={30} color="#fff" />
                <Text style={styles.buttonText}>{isTracking ? "إنهاء" : "بدء الجري"}</Text>
              </TouchableOpacity>
            </Animated.View>

          </BlurView>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 45,
    left: 20,
    zIndex: 20,
  },
  backContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bottomSheet: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: SCREEN_HEIGHT,
    zIndex: 10,
  },
  glassCard: {
    borderRadius: 40, // زوايا دائرية أكثر نعومة
    padding: 20,
    height: SCREEN_HEIGHT, // ليملأ الشاشة عند السحب لأعلى
    overflow: 'hidden', // ضروري جداً لقص حدود الـ BlurView وجعلها دائرية
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)', // لمعان الزجاج
  },
  dragIndicator: {
    width: 45,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 5,
    alignSelf: 'center',
    marginBottom: 25,
    marginTop: -5,
  },
  metricsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 25,
  },
  metricItem: { 
    alignItems: 'center', 
    flex: 1 
  },
  metricDivider: { 
    width: 1, 
    height: 40, 
    backgroundColor: 'rgba(255, 255, 255, 0.2)' 
  },
  metricLabel: { 
    color: '#CCC', 
    fontSize: 12, 
    fontWeight: '700', 
    marginBottom: 8 
  },
  metricValue: { 
    color: '#fff', 
    fontSize: 27, 
    fontWeight: '900',
    fontVariant: ['tabular-nums']
  },
  buttonContainer: {
    alignItems: 'center',
  },
  button: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: '100%', 
    height: 70, 
    borderRadius: 35,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  startButton: { 
    backgroundColor: '#FF4B2B' // برتقالي احترافي Strava
  },
  stopButton: { 
    backgroundColor: '#E53935'
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '900', 
    marginLeft: 10 
  },
  // أنماط واجهة الإحصائيات المكبرة (Full Screen)
  fullTitle: {
    color: '#CCC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 1,
  },
  fullMetricBlock: {
    alignItems: 'center',
    marginBottom: 50,
  },
  fullGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  fullGridItem: {
    alignItems: 'center',
    flex: 1,
  },
  fullMetricLabel: {
    color: '#888',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
  fullMetricValue: {
    color: '#fff',
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  }
});
