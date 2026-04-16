/**
 * InAppToast — مكون إشعار منسدل مخصص (بدون مكتبة خارجية)
 * يُستخدم عبر ToastManager.show() من أي مكان في التطبيق
 */

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

// ─── Global reference ─────────────────────────────────────────────────────────
type ToastRef = {
  show: (opts: ToastOptions) => void;
};

type ToastOptions = {
  title: string;
  subtitle?: string;
  icon?: string;
  onPress?: () => void;
  duration?: number;
};

let _toastRef: ToastRef | null = null;

export const ToastManager = {
  show: (opts: ToastOptions) => {
    _toastRef?.show(opts);
  },
};

// ─── Toast Component ─────────────────────────────────────────────────────────
export const InAppToast = forwardRef<ToastRef>((_, ref) => {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ToastOptions>({ title: '' });
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    show: (opts: ToastOptions) => {
      // Clear any existing timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setOptions(opts);
      setVisible(true);

      // Slide in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 220,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss
      timeoutRef.current = setTimeout(() => {
        dismiss();
      }, opts.duration || 4000);
    },
  }));

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toast}
        activeOpacity={0.92}
        onPress={() => {
          dismiss();
          options.onPress?.();
        }}
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons
            name={(options.icon as any) || 'chatbubble-ellipses'}
            size={22}
            color={colors.primary}
          />
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {options.title}
          </Text>
          {options.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {options.subtitle}
            </Text>
          ) : null}
        </View>

        {/* Close */}
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Setup function: call once in App root ────────────────────────────────────
export const setupToast = (ref: ToastRef) => {
  _toastRef = ref;
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28,28,30,0.97)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
      android: {
        elevation: 20,
      },
      web: {
        boxShadow: '0px 8px 16px rgba(0,0,0,0.5)',
      },
    }),
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,200,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 2,
  },
});
