import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PALETTES: Record<string, [string, string, string]> = {
  restaurant: ['#FFE8D6', '#E6A86B', '#8B5A2B'],
  bedroom:    ['#1E2742', '#3D5A80', '#0A0E1A'],
  playground: ['#BFE6FF', '#7BD3B8', '#5BB89B'],
  kitchen:    ['#E0F4E5', '#A8E6CF', '#5BB89B'],
  market:     ['#FFEBD0', '#FFB877', '#C47A3D'],
  cinema:     ['#1A0F1F', '#4A1F2E', '#0A0510'],
  gym:        ['#FFDBC9', '#FF9D7A', '#C45A3D'],
  cafe:       ['#F5E6D3', '#B5895E', '#5C3A1F'],
};

interface Props {
  scene?:  string;
  label?:  string;
  height?: number;
}

export function ScenePlaceholder({ scene = 'bedroom', label, height = 200 }: Props) {
  const [bg, mid] = PALETTES[scene] ?? PALETTES.bedroom;
  return (
    <View style={[styles.container, { height, backgroundColor: bg }]}>
      {/* stripe overlay */}
      <View style={[StyleSheet.absoluteFill, styles.stripes, { opacity: 0.3 }]} />
      {label && (
        <View style={styles.labelBox}>
          <Text style={styles.labelTxt}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-start' },
  stripes:   {
    backgroundImage: undefined, // not supported in RN, use a subtle pattern
    backgroundColor: 'transparent',
    // On RN we just leave it as flat color; full stripes need an SVG overlay
  },
  labelBox: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  labelTxt: { color: '#fff', fontSize: 10, letterSpacing: 1, fontWeight: '700' },
});

export { PALETTES as SCENE_PALETTES };
