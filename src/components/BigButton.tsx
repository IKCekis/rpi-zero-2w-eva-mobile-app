import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Haptics } from '../services/Haptics';

interface Props {
  children:  React.ReactNode;
  onPress:   () => void;
  primary?:  boolean;
  accent?:   string;
  disabled?: boolean;
  style?:    ViewStyle;
}

export function BigButton({ children, onPress, primary, accent = '#7BD3B8', disabled, style }: Props) {
  const handlePress = () => { Haptics.tap(); onPress(); };
  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.btn,
        primary ? { backgroundColor: accent, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 3 }, elevation: 3 }
                : styles.secondary,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={styles.txt}>{children as string}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%', paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#1d2733',
  },
  secondary: { backgroundColor: '#fff', borderColor: '#00000022' },
  disabled:  { opacity: 0.45 },
  txt:       { fontSize: 15, fontWeight: '800', color: '#1d2733', letterSpacing: 0.2 },
});
