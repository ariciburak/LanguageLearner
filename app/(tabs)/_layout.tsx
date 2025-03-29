import React from 'react';
import { TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { HapticTab } from '@/components/HapticTab';
import * as Haptics from 'expo-haptics';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={24} color={color} />,
          tabBarButton: HapticTab,
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="word-pool"
        options={{
          title: 'Kelime Havuzu',
          tabBarIcon: ({ color }) => <MaterialIcons name="list" size={24} color={color} />,
          tabBarButton: HapticTab,
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                global.openNotificationModal?.();
              }}
              style={{ marginRight: 16 }}
            >
              <MaterialIcons name="notifications" size={24} color="#0284c7" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="notification-words"
        options={{
          title: 'Bildirim Kelimeleri',
          tabBarIcon: ({ color }) => <MaterialIcons name="notifications" size={24} color={color} />,
          tabBarButton: HapticTab,
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="learned-words"
        options={{
          title: 'Öğrenilen Kelimeler',
          tabBarIcon: ({ color }) => <MaterialIcons name="done-all" size={24} color={color} />,
          tabBarButton: HapticTab,
          headerShown: true,
        }}
      />
    </Tabs>
  );
}
