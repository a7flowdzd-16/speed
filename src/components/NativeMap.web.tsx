import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NativeMapProps {
  initialRegion: any;
  coords: any[];
  style?: any;
}

const NativeMap: React.FC<NativeMapProps> = ({ style }) => {
  return (
    <View style={[style || styles.map, styles.placeholder]}>
      <Ionicons name="map-outline" size={32} color="rgba(255,255,255,0.2)" />
      <Text style={styles.text}>Map view is not available on web</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  placeholder: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  }
});

export default NativeMap;
