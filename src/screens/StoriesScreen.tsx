/**
 * Stories — read-only, locally bundled user testimonials (v1 has no
 * submission backend).
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { getStories } from '../data';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function StoriesScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const stories = useMemo(() => getStories(i18n.language), [i18n.language]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('stories.title')}</Text>
      <Text style={styles.subtitle}>{t('stories.subtitle')}</Text>
      <FlatList
        data={stories}
        keyExtractor={(story) => story.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('stories.empty')}</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('StoryDetail', { storyId: item.id })
            }
            accessibilityRole="button"
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.preview} numberOfLines={3}>
              {item.body}
            </Text>
            <Text style={styles.meta}>
              {t('stories.ailment')}: {item.ailment}
              {item.author ? ` · ${item.author}` : ''}
            </Text>
          </TouchableOpacity>
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
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  separator: {
    height: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  preview: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: colors.accent,
    fontSize: 12,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    padding: spacing.xl,
    textAlign: 'center',
  },
});
