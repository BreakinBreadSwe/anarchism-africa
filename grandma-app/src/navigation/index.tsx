import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BookmarksScreen } from '../screens/BookmarksScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { RemediesScreen } from '../screens/RemediesScreen';
import { RemedyDetailScreen } from '../screens/RemedyDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StoriesScreen } from '../screens/StoriesScreen';
import { StoryDetailScreen } from '../screens/StoryDetailScreen';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, string> = {
  Remedies: 'leaf',
  Stories: 'chatbubbles',
  Saved: 'bookmark',
  Settings: 'settings',
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
  },
};

function Tabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size, focused }) => {
          const base = TAB_ICONS[route.name];
          const name = (focused ? base : `${base}-outline`) as keyof typeof Ionicons.glyphMap;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Remedies"
        component={RemediesScreen}
        options={{ title: t('tabs.remedies') }}
      />
      <Tab.Screen
        name="Stories"
        component={StoriesScreen}
        options={{ title: t('tabs.stories') }}
      />
      <Tab.Screen
        name="Saved"
        component={BookmarksScreen}
        options={{ title: t('tabs.saved') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('tabs.settings') }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { t } = useTranslation();
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
        }}
      >
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RemedyDetail"
          component={RemedyDetailScreen}
          options={{ title: '' }}
        />
        <Stack.Screen
          name="StoryDetail"
          component={StoryDetailScreen}
          options={{ title: '' }}
        />
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{ presentation: 'modal', title: t('paywall.title') }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
