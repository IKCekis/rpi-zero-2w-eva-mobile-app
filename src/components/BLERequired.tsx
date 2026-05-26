import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BigButton } from './BigButton';
import { useBLE } from '../ble/BLEContext';

export function BLERequired() {
  const { reconnect } = useBLE();
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🎮</Text>
      <Text style={styles.title}>Pi Bağlı Değil</Text>
      <Text style={styles.body}>
        Bu özelliği kullanmak için EVA-001 anahtarlığınla bağlantı gerekiyor.
        Pi'nin açık ve yakında olduğundan emin ol.
      </Text>
      <BigButton primary accent="#7BD3B8" onPress={reconnect}>
        Yeniden Bağlan
      </BigButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12,
  },
  icon:  { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: '#3a3530', textAlign: 'center' },
  body:  { fontSize: 14, color: '#7a6f5e', textAlign: 'center', lineHeight: 20 },
});
