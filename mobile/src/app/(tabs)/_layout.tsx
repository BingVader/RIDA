import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTheme } from '../../lib/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Books',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="library-outline" size={size} color={focused ? colors.accent : colors.muted} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="compass-outline" size={size} color={focused ? colors.accent : colors.muted} />
          ),
        }}
      />
    </Tabs>
  );
}
