import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

export const GridVideoThumbnail = ({ uri }: { uri: string }) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 0,
          quality: 0.5,
        });
        setImage(thumbUri);
      } catch (e) {
        console.warn('Thumbnail extraction failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [uri]);

  return (
    <View style={styles.container}>
      {image ? (
        <Image source={{ uri: image }} style={styles.img} contentFit="cover" />
      ) : (
        <View style={styles.fallback}>
          {loading ? (
            <ActivityIndicator color="#333" size="small" />
          ) : (
            <Ionicons name="play" size={24} color="#222" />
          )}
        </View>
      )}
      <View style={styles.playBadge}>
        <Ionicons name="play" size={12} color="#FFF" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  img: { width: '100%', height: '100%' },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 },
});
