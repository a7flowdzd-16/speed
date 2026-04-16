/**
 * MapSettingsModal.tsx
 * ─────────────────────────────────────────────────────────────────
 * نافذة "إعدادات الخريطة" بنمط Strava:
 *  - 4 أقسام: Map Type / Heatmaps / Layers / Terrain
 *  - كروت أفقية قابلة للتمرير
 *  - إطار برتقالي للخيار المحدد
 *  - أيقونة قفل للميزات المدفوعة
 *  - الخيار المُختار يُرسَل للخريطة عبر callback
 */

import React, { useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';

// ── Tipos ──────────────────────────────────────────────────────────
export type MapType = 'standard' | 'satellite' | 'hybrid' | 'winter';
export type HeatmapType = 'global_run' | null;

export interface MapSettings {
  mapType:      MapType;
  activeHeatmap: HeatmapType;  // null = aucune heatmap active
  showWaymarks: boolean;
  showTerrain:  boolean;
}

interface Props {
  visible: boolean;
  settings: MapSettings;
  onClose: () => void;
  onChange: (s: MapSettings) => void;
}

// ── Données des options ────────────────────────────────────────────
const MAP_TYPES: {
  key: MapType;
  label: string;
  icon: string;
  iconLib: 'ion' | 'mci';
  bg: string;
  locked?: boolean;
}[] = [
  {
    key: 'standard',
    label: 'Standard',
    icon: 'map-outline',
    iconLib: 'ion',
    bg: '#1E3A2A',   // vert foncé
  },
  {
    key: 'satellite',
    label: 'Satellite',
    icon: 'planet-outline',
    iconLib: 'ion',
    bg: '#0D1B2A',   // bleu nuit
  },
  {
    key: 'hybrid',
    label: 'Hybrid',
    icon: 'globe-outline',
    iconLib: 'ion',
    bg: '#1A1A3A',   // indigo
  },
  {
    key: 'winter',
    label: 'Winter',
    icon: 'snow-outline',
    iconLib: 'ion',
    bg: '#1A2E3A',   // bleu glacier
  },
];

const HEATMAP_OPTS = [
  { key: 'global_run', label: 'Global Run', icon: 'trail-sign-outline', iconLib: 'ion' as const, bg: '#2A1400', locked: false },
  { key: 'rides',      label: 'Rides',      icon: 'bicycle',            iconLib: 'ion' as const, bg: '#1A1A3A', locked: true  },
  { key: 'walks',      label: 'Walks',      icon: 'walk',               iconLib: 'ion' as const, bg: '#1A2D1A', locked: true  },
];

const LAYER_OPTS = [
  { key: 'waymarks', label: 'Waymarks',    icon: 'location-outline',     iconLib: 'ion' as const, bg: '#2A2A2A', locked: false },
  { key: 'photos',   label: 'Photos',      icon: 'image-outline',        iconLib: 'ion' as const, bg: '#2A1A2D', locked: true },
  { key: 'segments', label: 'Segments',    icon: 'stats-chart-outline',  iconLib: 'ion' as const, bg: '#1A2A2D', locked: true },
];

// ── Option Card ────────────────────────────────────────────────────
interface CardProps {
  label:      string;
  icon:       string;
  iconLib:    'ion' | 'mci';
  bg:         string;
  selected:   boolean;
  locked?:    boolean;
  onPress:    () => void;
}

const MapOptionCard: React.FC<CardProps> = ({
  label, icon, iconLib, bg, selected, locked, onPress,
}) => (
  <TouchableOpacity
    onPress={locked ? undefined : onPress}
    activeOpacity={locked ? 1 : 0.75}
    style={[
      cs.card,
      selected && cs.cardSelected,
      locked  && cs.cardLocked,
    ]}
  >
    {/* Thumbnail */}
    <View style={[cs.thumb, { backgroundColor: bg }]}>
      {iconLib === 'ion' ? (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={26}
          color={selected ? '#FF5A00' : '#8A9BA8'}
        />
      ) : (
        <MaterialCommunityIcons
          name={icon as any}
          size={26}
          color={selected ? '#FF5A00' : '#8A9BA8'}
        />
      )}
    </View>

    {/* Label */}
    <Text style={[cs.cardLabel, selected && cs.cardLabelSelected]}>
      {label}
    </Text>

    {/* Checkmark */}
    {selected && (
      <View style={cs.checkBadge}>
        <Ionicons name="checkmark" size={10} color="#fff" />
      </View>
    )}

    {/* Lock */}
    {locked && (
      <View style={cs.lockBadge}>
        <Ionicons name="lock-closed" size={10} color="#fff" />
      </View>
    )}
  </TouchableOpacity>
);

// ── Main Component ─────────────────────────────────────────────────
const MapSettingsModal: React.FC<Props> = ({
  visible, settings, onClose, onChange,
}) => {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['55%', '85%'], []);

  // Ouvre / ferme le BottomSheet selon `visible`
  React.useEffect(() => {
    if (visible) sheetRef.current?.snapToIndex(0);
    else         sheetRef.current?.close();
  }, [visible]);

  const set = useCallback(
    (patch: Partial<MapSettings>) => onChange({ ...settings, ...patch }),
    [settings, onChange]
  );

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={cs.sheetBg}
      handleIndicatorStyle={cs.handle}
    >
      <BottomSheetScrollView
        contentContainerStyle={cs.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={cs.header}>
          <Text style={cs.headerTitle}>Map Settings</Text>
          <TouchableOpacity style={cs.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color="#333" />
          </TouchableOpacity>
        </View>

        {/* ── Section: Map Type ── */}
        <Text style={cs.sectionTitle}>MAP TYPE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={cs.hScroll}
        >
          {MAP_TYPES.map(opt => (
            <MapOptionCard
              key={opt.key}
              label={opt.label}
              icon={opt.icon}
              iconLib={opt.iconLib}
              bg={opt.bg}
              selected={settings.mapType === opt.key}
              locked={opt.locked}
              onPress={() => set({ mapType: opt.key })}
            />
          ))}
        </ScrollView>

        <View style={cs.divider} />

        {/* ── Section: Heatmaps ── */}
        <View style={cs.sectionRow}>
          <Text style={cs.sectionTitle}>HEATMAPS</Text>
          <View style={cs.proBadge}><Text style={cs.proText}>BETA</Text></View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={cs.hScroll}
        >
          {HEATMAP_OPTS.map(opt => (
            <MapOptionCard
              key={opt.key}
              label={opt.label}
              icon={opt.icon}
              iconLib={opt.iconLib}
              bg={opt.bg}
              selected={settings.activeHeatmap === opt.key}
              locked={opt.locked}
              onPress={() =>
                set({
                  activeHeatmap:
                    settings.activeHeatmap === opt.key
                      ? null
                      : opt.key,
                })
              }
            />
          ))}
        </ScrollView>

        <View style={cs.divider} />

        {/* ── Section: Layers ── */}
        <Text style={cs.sectionTitle}>LAYERS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={cs.hScroll}
        >
          {LAYER_OPTS.map(opt => (
            <MapOptionCard
              key={opt.key}
              label={opt.label}
              icon={opt.icon}
              iconLib={opt.iconLib}
              bg={opt.bg}
              selected={opt.key === 'waymarks' && settings.showWaymarks}
              locked={opt.locked}
              onPress={() => set({ showWaymarks: !settings.showWaymarks })}
            />
          ))}
        </ScrollView>

        <View style={cs.divider} />

        {/* ── Section: Terrain ── */}
        <Text style={cs.sectionTitle}>TERRAIN</Text>
        <View style={cs.terrainRow}>
          <Text style={cs.terrainDesc}>
            Show 3D-style elevation shading on the map.
          </Text>
          <TouchableOpacity
            style={[cs.toggle, settings.showTerrain && cs.toggleOn]}
            onPress={() => set({ showTerrain: !settings.showTerrain })}
          >
            <View style={[cs.toggleThumb, settings.showTerrain && cs.toggleThumbOn]} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

export default MapSettingsModal;

// ── Styles ─────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  // Sheet
  sheetBg:  { backgroundColor: '#F7F7F7', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle:   { backgroundColor: '#CCCCCC', width: 40 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111', letterSpacing: 0.3 },
  closeBtn:    {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Sections
  sectionRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1.4, marginBottom: 10 },
  divider:      { height: 1, backgroundColor: 'rgba(0,0,0,0.07)', marginVertical: 18 },

  // PRO badge
  proBadge:  {
    marginLeft: 8, marginBottom: 10,
    backgroundColor: '#FF5A00',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  proText:   { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 1 },

  // Horizontal scroll
  hScroll: { paddingRight: 8, gap: 12, flexDirection: 'row' },

  // Card
  card: {
    width: 82, alignItems: 'center',
    borderRadius: 14, padding: 6,
    borderWidth: 2, borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#FF5A00' },
  cardLocked:   { opacity: 0.55 },

  thumb: {
    width: 70, height: 70, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  cardLabel:         { fontSize: 11, fontWeight: '700', color: '#555', textAlign: 'center' },
  cardLabelSelected: { color: '#FF5A00' },

  // Badges
  checkBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FF5A00',
    alignItems: 'center', justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Terrain toggle
  terrainRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 4,
  },
  terrainDesc: { flex: 1, fontSize: 13, color: '#555', marginRight: 16 },
  toggle: {
    width: 50, height: 28, borderRadius: 14,
    backgroundColor: '#CCC', justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleOn:      { backgroundColor: '#FF5A00' },
  toggleThumb:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
