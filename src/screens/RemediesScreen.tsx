/**
 * Remedies Library — searchable/filterable list of all bundled content.
 * Search matches remedy title, ailment tags, and ingredient names;
 * filters narrow by category and region.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FilterChips, type ChipOption } from '../components/FilterChips';
import { RemedyCard } from '../components/RemedyCard';
import { SearchBar } from '../components/SearchBar';
import { getRegions, getRemedies } from '../data';
import type { RootStackParamList } from '../navigation/types';
import { usePremium } from '../state/PremiumContext';
import { colors, spacing } from '../theme';
import { ALL_CATEGORIES, type CategoryId, type Remedy } from '../types/content';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function matchesQuery(remedy: Remedy, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (remedy.title.toLowerCase().includes(needle)) return true;
  if (remedy.ailments.some((a) => a.toLowerCase().includes(needle))) {
    return true;
  }
  return remedy.ingredients.some((i) =>
    i.name.toLowerCase().includes(needle)
  );
}

export function RemediesScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const { isLocked } = usePremium();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  const language = i18n.language;
  const remedies = useMemo(() => getRemedies(language), [language]);
  const regions = useMemo(() => getRegions(language), [language]);

  const filtered = useMemo(
    () =>
      remedies.filter(
        (remedy) =>
          (!category || remedy.category === category) &&
          (!region || remedy.region === region) &&
          matchesQuery(remedy, query)
      ),
    [remedies, category, region, query]
  );

  const categoryOptions: ChipOption<CategoryId>[] = [
    { value: null, label: t('categories.all') },
    ...ALL_CATEGORIES.map((id) => ({
      value: id,
      label: t(`categories.${id}`),
    })),
  ];

  const regionOptions: ChipOption<string>[] = [
    { value: null, label: t('remedies.regionAll') },
    ...regions.map((r) => ({ value: r, label: r })),
  ];

  const openRemedy = (remedy: Remedy) => {
    if (isLocked(remedy)) {
      navigation.navigate('Paywall');
    } else {
      navigation.navigate('RemedyDetail', { remedyId: remedy.id });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('remedies.title')}</Text>
      <SearchBar value={query} onChange={setQuery} />
      <FilterChips
        options={categoryOptions}
        selected={category}
        onSelect={setCategory}
      />
      <FilterChips
        options={regionOptions}
        selected={region}
        onSelect={setRegion}
      />
      <Text style={styles.count}>
        {t('remedies.resultsCount', { count: filtered.length })}
      </Text>
      <FlatList
        data={filtered}
        keyExtractor={(remedy) => remedy.id}
        renderItem={({ item }) => (
          <RemedyCard
            remedy={item}
            locked={isLocked(item)}
            onPress={() => openRemedy(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('remedies.empty')}</Text>
        }
        keyboardShouldPersistTaps="handled"
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
  count: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  separator: {
    height: spacing.md,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    padding: spacing.xl,
    textAlign: 'center',
  },
});
