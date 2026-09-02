import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RemedyCard } from '../components/RemedyCard';
import { getRemedies } from '../data';
import type { RootStackParamList } from '../navigation/types';
import { useBookmarks } from '../state/BookmarksContext';
import { usePremium } from '../state/PremiumContext';
import { colors, spacing } from '../theme';
import type { Remedy } from '../types/content';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function BookmarksScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const { bookmarkIds } = useBookmarks();
  const { isLocked } = usePremium();

  const saved = useMemo(() => {
    const all = getRemedies(i18n.language);
    // Preserve the order bookmarks were added in.
    return bookmarkIds
      .map((id) => all.find((remedy) => remedy.id === id))
      .filter((remedy): remedy is Remedy => remedy !== undefined);
  }, [bookmarkIds, i18n.language]);

  const openRemedy = (remedy: Remedy) => {
    if (isLocked(remedy)) {
      navigation.navigate('Paywall');
    } else {
      navigation.navigate('RemedyDetail', { remedyId: remedy.id });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('saved.title')}</Text>
      <FlatList
        style={styles.list}
        data={saved}
        keyExtractor={(remedy) => remedy.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('saved.empty')}</Text>}
        renderItem={({ item }) => (
          <RemedyCard
            remedy={item}
            locked={isLocked(item)}
            onPress={() => openRemedy(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  separator: {
    height: spacing.md,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.xl,
    textAlign: 'center',
  },
});
