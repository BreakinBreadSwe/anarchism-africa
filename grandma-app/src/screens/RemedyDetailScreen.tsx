import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { getRemedyById } from '../data';
import type { RootStackScreenProps } from '../navigation/types';
import { useBookmarks } from '../state/BookmarksContext';
import { usePremium } from '../state/PremiumContext';
import { colors, radius, spacing } from '../theme';

export function RemedyDetailScreen({
  route,
  navigation,
}: RootStackScreenProps<'RemedyDetail'>) {
  const { t, i18n } = useTranslation();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { isLocked } = usePremium();

  const remedy = getRemedyById(i18n.language, route.params.remedyId);
  if (!remedy) {
    return (
      <View style={styles.missing}>
        <Text style={styles.emptyText}>{t('remedies.empty')}</Text>
      </View>
    );
  }

  // Guards deep entry (e.g. from Saved) into premium content.
  if (isLocked(remedy)) {
    return (
      <View style={styles.missing}>
        <Ionicons name="lock-closed" size={32} color={colors.premium} />
        <Text style={styles.emptyText}>{t('paywall.locked')}</Text>
        <TouchableOpacity
          style={styles.unlockButton}
          onPress={() => navigation.navigate('Paywall')}
        >
          <Text style={styles.unlockButtonText}>{t('paywall.title')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bookmarked = isBookmarked(remedy.id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{remedy.title}</Text>
        <TouchableOpacity
          onPress={() => toggleBookmark(remedy.id)}
          accessibilityRole="button"
          accessibilityLabel={bookmarked ? t('detail.saved') : t('detail.save')}
        >
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={26}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.meta}>
        {t(`categories.${remedy.category}`)} · {remedy.region}
        {remedy.preparationTime
          ? ` · ${t('detail.preparationTime')}: ${remedy.preparationTime}`
          : ''}
      </Text>

      <Text style={styles.sectionTitle}>{t('detail.ailments')}</Text>
      <View style={styles.tagRow}>
        {remedy.ailments.map((ailment) => (
          <View key={ailment} style={styles.tag}>
            <Text style={styles.tagText}>{ailment}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t('detail.ingredients')}</Text>
      {remedy.ingredients.map((ingredient) => (
        <Text key={ingredient.name} style={styles.body}>
          •{' '}
          {ingredient.quantity
            ? `${ingredient.name} — ${ingredient.quantity}`
            : ingredient.name}
        </Text>
      ))}

      <Text style={styles.sectionTitle}>{t('detail.instructions')}</Text>
      {remedy.instructions.map((step, index) => (
        <Text key={step} style={styles.body}>
          {index + 1}. {step}
        </Text>
      ))}

      {remedy.origin && (
        <>
          <Text style={styles.sectionTitle}>{t('detail.origin')}</Text>
          <Text style={styles.body}>{remedy.origin}</Text>
        </>
      )}

      {remedy.disclaimer && (
        <View style={styles.safetyBox}>
          <Text style={styles.safetyTitle}>{t('detail.safetyNote')}</Text>
          <Text style={styles.safetyText}>{remedy.disclaimer}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  missing: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  unlockButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.chipBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tagText: {
    color: colors.text,
    fontSize: 13,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  safetyBox: {
    backgroundColor: colors.disclaimerBg,
    borderRadius: radius.md,
    gap: spacing.xs,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  safetyTitle: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  safetyText: {
    color: colors.disclaimerText,
    fontSize: 13,
    lineHeight: 19,
  },
});
