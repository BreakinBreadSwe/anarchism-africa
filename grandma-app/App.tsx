import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { DisclaimerBanner } from './src/components/DisclaimerBanner';
import { loadPersistedLanguage } from './src/i18n';
import { RootNavigator } from './src/navigation';
import { BookmarksProvider } from './src/state/BookmarksContext';
import { PremiumProvider } from './src/state/PremiumContext';
import { colors } from './src/theme';

function AppShell() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Legal/safety banner stays visible on every screen. */}
      <DisclaimerBanner />
      <RootNavigator />
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadPersistedLanguage().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <PremiumProvider>
        <BookmarksProvider>
          <StatusBar style="dark" />
          <AppShell />
        </BookmarksProvider>
      </PremiumProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
