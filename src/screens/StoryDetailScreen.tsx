import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getStoryById } from '../data';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

export function StoryDetailScreen({
  route,
}: RootStackScreenProps<'StoryDetail'>) {
  const { t, i18n } = useTranslation();
  const story = getStoryById(i18n.language, route.params.storyId);

  if (!story) {
    return (
      <View style={styles.missing}>
        <Text style={styles.metaText}>{t('stories.empty')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{story.title}</Text>
      <Text style={styles.metaText}>
        {story.author ? `${story.author} · ` : ''}
        {story.region ?? ''}
      </Text>
      <Text style={styles.body}>{story.body}</Text>
      <View style={styles.infoBox}>
        <Text style={styles.infoLine}>
          <Text style={styles.infoLabel}>{t('stories.ailment')}: </Text>
          {story.ailment}
        </Text>
        <Text style={styles.infoLine}>
          <Text style={styles.infoLabel}>{t('stories.outcome')}: </Text>
          {story.outcome}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  missing: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  infoBox: {
    backgroundColor: colors.chipBg,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  infoLine: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  infoLabel: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
