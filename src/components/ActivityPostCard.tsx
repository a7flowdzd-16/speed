import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import NativeMap from './NativeMap';

const { width } = Dimensions.get('window');

const formatTime = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`
    : `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  }) + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const calculateRegion = (coords: any[]) => {
  if (!coords || coords.length === 0) return undefined;
  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;

  coords.forEach((coord: any) => {
    if (coord.latitude < minLat) minLat = coord.latitude;
    if (coord.latitude > maxLat) maxLat = coord.latitude;
    if (coord.longitude < minLng) minLng = coord.longitude;
    if (coord.longitude > maxLng) maxLng = coord.longitude;
  });

  const latDelta = (maxLat - minLat) * 1.2 || 0.01;
  const lngDelta = (maxLng - minLng) * 1.2 || 0.01;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
};

export const ActivityPostCard = ({ activity, profile }: any) => {
  const isRun = activity.activity_type === 'run';
  
  const getTitle = () => {
    const d = new Date(activity.created_at);
    const hour = d.getHours();
    let timeOfDay = 'Morning';
    if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';
    else if (hour >= 21 || hour < 5) timeOfDay = 'Night';
    
    return `${timeOfDay} ${isRun ? 'Run' : 'Walk'}`;
  };

  const coords = activity.route_coordinates || [];
  const hasRoute = coords.length > 1;

  const initialRegion = useMemo(() => hasRoute ? calculateRegion(coords) : undefined, [coords, hasRoute]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.fallbackAvatar]}>
            <Ionicons name="person" size={16} color="#888" />
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{profile?.full_name || 'Runner'}</Text>
          <View style={styles.dateRow}>
            {isRun ? (
              <Ionicons name="footsteps-outline" size={12} color="#888" />
            ) : (
              <Ionicons name="walk-outline" size={12} color="#888" />
            )}
            <Text style={styles.dateText}>
              {formatDate(activity.created_at)} · Strava App
            </Text>
          </View>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>{getTitle()}</Text>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{(activity.total_distance || 0).toFixed(2)} km</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Pace</Text>
          <Text style={styles.statValue}>{activity.average_pace || '--:--'} /km</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Time</Text>
          <Text style={styles.statValue}>{formatTime(activity.total_time || 0)}s</Text>
        </View>
      </View>

      {/* Map Snapshot */}
      {hasRoute && initialRegion && (
        <View style={styles.mapContainer} pointerEvents="none">
          <NativeMap 
            initialRegion={initialRegion}
            coords={coords}
            style={styles.map}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0a0a0a',
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  fallbackAvatar: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: '#888',
    fontSize: 12,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 30,
  },
  statCol: {
    flexDirection: 'column',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  mapContainer: {
    marginHorizontal: 16,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
