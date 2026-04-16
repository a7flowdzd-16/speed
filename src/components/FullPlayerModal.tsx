import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');

interface NowPlaying {
  title: string;
  artist: string;
  thumbnail: string | null;
  duration: number; // in milliseconds
}

interface FullPlayerModalProps {
  visible: boolean;
  onClose: () => void;
  nowPlaying: NowPlaying | null;
  isPlaying: boolean;
  soundObj: Audio.Sound | null;
  onTogglePlay: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export const FullPlayerModal: React.FC<FullPlayerModalProps> = ({
  visible,
  onClose,
  nowPlaying,
  isPlaying,
  soundObj,
  onTogglePlay,
  onNext,
  onPrev,
}) => {
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(1); // avoid 0 div
  const [isSliding, setIsSliding] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (visible && soundObj && isPlaying && !isSliding) {
      interval = setInterval(async () => {
        try {
          const status = await soundObj.getStatusAsync();
          if (status.isLoaded) {
            setPosition(status.positionMillis);
            setDuration(status.durationMillis || 1);
          }
        } catch (e) {
          // Ignore
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [visible, soundObj, isPlaying, isSliding]);

  const handleSliderValueChange = (val: number) => {
    setIsSliding(true);
    setPosition(val);
  };

  const handleSlidingComplete = async (val: number) => {
    if (soundObj) {
      await soundObj.setPositionAsync(val);
    }
    setIsSliding(false);
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!nowPlaying) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Background Gradient */}
        <LinearGradient
          colors={['#1a1010', '#000000']} // Extract color dynamically in real app, hardcode dark for now
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={32} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>قيد التشغيل من البحث</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Cover Art */}
        <View style={styles.coverWrapper}>
          {nowPlaying.thumbnail ? (
            <Image
              source={{ uri: nowPlaying.thumbnail }}
              style={styles.coverImage}
            />
          ) : (
            <View style={[styles.coverImage, styles.placeholderCover]}>
              <Ionicons name="musical-notes" size={80} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>

        {/* Info & Controls */}
        <View style={styles.bottomSection}>
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.songTitle} numberOfLines={1}>{nowPlaying.title}</Text>
              <Text style={styles.artistName} numberOfLines={1}>{nowPlaying.artist}</Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="heart-outline" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Slider Layout */}
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            onValueChange={handleSliderValueChange}
            onSlidingComplete={handleSlidingComplete}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor="rgba(255,255,255,0.2)"
            thumbTintColor="#FFF"
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>

          {/* Player Buttons */}
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlIconBtn}>
              <Ionicons name="shuffle" size={26} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={onPrev} style={styles.controlIconBtn}>
              <Ionicons name="play-skip-back" size={36} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity onPress={onTogglePlay} style={styles.playPauseBtn}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={40}
                color="#000"
                style={{ marginLeft: isPlaying ? 0 : 4 }} // center the play icon
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={onNext} style={styles.controlIconBtn}>
              <Ionicons name="play-skip-forward" size={36} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlIconBtn}>
              <Ionicons name="repeat" size={26} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

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
    paddingTop: 50, // safe area approx
    marginBottom: 40,
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  coverWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  coverImage: {
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    paddingHorizontal: 30,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  songTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'left',
  },
  artistName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'left',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -10,
  },
  timeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  controlIconBtn: {
    padding: 10,
  },
  playPauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
