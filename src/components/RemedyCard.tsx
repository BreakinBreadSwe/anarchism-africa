import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useBookmarks } from '../state/BookmarksContext';
import { colors, radius, spacing } from '../theme';
import type { Remedy } from '../types/content';

interface RemedyCardProps {
  remedy: Remedy;
  locked: boolean;
  onPress: () => void;
}

export function RemedyCard({ remedy, locked, onPress }: RemedyCardProps) {
  const { t } = useTranslation();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(remedy.id);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {remedy.title}
        </Text>
        <TouchableOpacity
          onPress={() => toggleBookmark(remedy.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={bookmarked ? t('detail.saved') : t('detail.save')}
        >
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.tagRow}>
        {remedy.ailments.slice(0, 3).map((ailment) => (
          <View key={ailment} style={styles.tag}>
            <Text style={styles.tagText}>{ailment}</Text>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={styles.meta}>
          {t(`categories.${remedy.category}`)} · {remedy.region}
        </Text>
        {locked && (
          <View style={styles.premiumBadge}>
            <Ionicons name="lock-closed" size={11} color={colors.premium} />
            <Text style={styles.premiumText}>
              {t('remedies.premiumBadge')}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.chipBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  premiumBadge: {
    alignItems: 'center',
    backgroundColor: colors.premiumBg,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  premiumText: {
    color: colors.premium,
    fontSize: 11,
    fontWeight: '600',
  },
});
