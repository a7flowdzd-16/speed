import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

interface NativeMapProps {
  initialRegion: any;
  coords: any[];
  style?: any;
}

const NativeMap: React.FC<NativeMapProps> = ({ initialRegion, coords, style }) => {
  return (
    <MapView
      style={style || styles.map}
      initialRegion={initialRegion}
      liteMode={true}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      mapType="standard"
    >
      <Polyline
        coordinates={coords}
        strokeColor="#FF5A00"
        strokeWidth={4}
        lineJoin="round"
        lineCap="round"
      />
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default NativeMap;
