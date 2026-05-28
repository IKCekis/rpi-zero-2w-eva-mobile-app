import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';

import HomeScreen      from '../screens/HomeScreen';
import WorldScreen     from '../screens/WorldScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ProfileScreen   from '../screens/ProfileScreen';
import { OnboardingFlow }  from '../onboarding/OnboardingFlow';
import { DeathScreen }     from '../screens/DeathScreen';
import { ConnectScreen }   from '../screens/ConnectScreen';
import { useEvaStore }     from '../store/useEvaStore';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠', World: '🗺', Inventory: '🎒', Profile: '👤',
  };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{icons[name]}</Text>;
}

function MainTabs() {
  const { accent = '#7BD3B8' } = useEvaStore();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#eee5d4', paddingBottom: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      })}
    >
      <Tab.Screen name="Home"      component={HomeScreen}      options={{ title: 'Ana Sayfa' }} />
      <Tab.Screen name="World"     component={WorldScreen}     options={{ title: 'Dünya' }} />
      <Tab.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Çanta' }} />
      <Tab.Screen name="Profile"   component={ProfileScreen}   options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const [loading,   setLoading]   = useState(true);
  const [onboarded, setOnboarded] = useState(false);

  const { isDead, revive, reviveSoft, restoreFromDisk, bleStatus } = useEvaStore();

  useEffect(() => {
    (async () => {
      await restoreFromDisk();
      const val = await AsyncStorage.getItem('eva_onboarded');
      setOnboarded(val === 'true');
      setLoading(false);
    })();
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('eva_onboarded', 'true');
    setOnboarded(true);
  };

  // Correct revival code: stats reset to 50%, profile/level/coins preserved, no re-onboarding.
  const handleReviveSoft = () => {
    reviveSoft();
  };

  // New Eva: full reset + trigger fresh onboarding.
  const handleReviveNew = () => {
    revive();
    setOnboarded(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf6f0' }}>
        <ActivityIndicator size="large" color="#7BD3B8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!onboarded ? (
          <Stack.Screen name="Onboarding">
            {() => <OnboardingFlow onComplete={completeOnboarding} />}
          </Stack.Screen>
        ) : bleStatus !== 'connected' ? (
          // Always pair first — isDead is checked only after BLE is up so the
          // Pi can confirm the actual state. A stale local dead-flag must not
          // block pairing with a new (or revived) device.
          <Stack.Screen name="Connect" component={ConnectScreen} />
        ) : isDead ? (
          <Stack.Screen name="Death">
            {() => <DeathScreen onReviveSoft={handleReviveSoft} onReviveNew={handleReviveNew} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
