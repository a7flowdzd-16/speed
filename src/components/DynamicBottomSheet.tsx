import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableOpacity,
  PanResponder,
  Animated,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface DynamicBottomSheetRef {
  expand: () => void;
  close: () => void;
}

interface DynamicBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  initialSnap?: number; // 0 to 1
  expandedSnap?: number; // 0 to 1
  keyboardVerticalOffset?: number;
}

export const DynamicBottomSheet = React.forwardRef<DynamicBottomSheetRef, DynamicBottomSheetProps>((
  {
    isVisible,
    onClose,
    title,
    children,
    initialSnap = 0.55,
    expandedSnap = 0.95,
    keyboardVerticalOffset = 90,
  },
  ref
) => {
  const insets = useSafeAreaInsets();

  // translateY: lower value = higher on screen
  const MIN_TRANSLATE_Y = SCREEN_HEIGHT * (1 - expandedSnap); // ~5% from top
  const MAX_TRANSLATE_Y = SCREEN_HEIGHT * (1 - initialSnap); // ~45% from top
  const CLOSED_TRANSLATE_Y = SCREEN_HEIGHT;

  const translateY = useRef(new Animated.Value(CLOSED_TRANSLATE_Y)).current;
  const lastTranslateY = useRef(MAX_TRANSLATE_Y);
  const [isExpanded, setIsExpanded] = useState(false);

  const animateTo = (toValue: number, friction = 9) => {
    lastTranslateY.current = toValue;
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      friction,
      tension: 60,
    }).start();
  };

  // Expose methods to parent
  React.useImperativeHandle(ref, () => ({
    expand: () => {
      animateTo(MIN_TRANSLATE_Y, 10);
      setIsExpanded(true);
    },
    close: () => {
      Keyboard.dismiss();
      onClose();
    }
  }));

  // Keyboard: expand sheet when shown, restoring when hidden
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      animateTo(MIN_TRANSLATE_Y, 10);
      setIsExpanded(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      // Only snap back if we weren't manually expanded or if we want to restore initial snap
      // For now, let's keep it simple: always snap back to initial when keyboard hides
      // unless the user dragged it up.
      animateTo(MAX_TRANSLATE_Y, 9);
      setIsExpanded(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [MIN_TRANSLATE_Y, MAX_TRANSLATE_Y]);

  // Open / close
  useEffect(() => {
    if (isVisible) {
      animateTo(MAX_TRANSLATE_Y);
      setIsExpanded(false);
    } else {
      Keyboard.dismiss();
      animateTo(CLOSED_TRANSLATE_Y, 12);
    }
  }, [isVisible]);

  // PanResponder: handle-zone only
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        const next = lastTranslateY.current + g.dy;
        if (next >= MIN_TRANSLATE_Y) translateY.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const current = (translateY as any)._value;
        const midThreshold = MIN_TRANSLATE_Y + (MAX_TRANSLATE_Y - MIN_TRANSLATE_Y) * 0.4;
        const closeThreshold = MAX_TRANSLATE_Y + (SCREEN_HEIGHT - MAX_TRANSLATE_Y) * 0.35;

        if (g.vy < -0.6 || current < midThreshold) {
          animateTo(MIN_TRANSLATE_Y);
          setIsExpanded(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (g.vy > 1.2 || current > closeThreshold) {
          Keyboard.dismiss();
          onClose();
        } else {
          animateTo(MAX_TRANSLATE_Y);
          setIsExpanded(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
    })
  ).current;

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={() => { Keyboard.dismiss(); onClose(); }}
    >
      <View style={styles.overlay}>
        {/* Tap outside to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => { Keyboard.dismiss(); onClose(); }}
        />

        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY }] }]}>
          {/* Drag Handle Zone */}
          <View {...panResponder.panHandlers} style={styles.handleZone}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); onClose(); }}
                style={styles.closeBtn}
              >
                <Ionicons name="close-circle" size={28} color="#444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content — KeyboardAvoidingView pushes children above the keyboard */}
          <KeyboardAvoidingView
            style={styles.content}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={keyboardVerticalOffset}
          >
            {children}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetContainer: {
    backgroundColor: '#111',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    // Full screen height so the sheet always has room for content
    height: SCREEN_HEIGHT,
    position: 'absolute',
    bottom: 0,
  },
  handleZone: {
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
    width: '100%',
  },
  handle: {
    width: 45,
    height: 5,
    backgroundColor: '#333',
    borderRadius: 10,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  closeBtn: {
    padding: 2,
  },
  content: {
    flex: 1,
  },
});
