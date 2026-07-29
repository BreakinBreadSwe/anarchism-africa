import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  SUPPORTED_LANGUAGES,
  setLanguage,
  type SupportedLanguage,
} from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { usePremium } from '../state/PremiumContext';
import { colors, radius, spacing } from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const { isPremium, busy, restore } = usePremium();

  const onRestore = async () => {
    const restored = await restore();
    Alert.alert(
      t('settings.premium'),
      restored ? t('settings.unlocked') : t('settings.restoreNone')
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('settings.title')}</Text>

      <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
      <View style={styles.card}>
        {SUPPORTED_LANGUAGES.map((code: SupportedLanguage) => {
          const active = i18n.language === code;
          return (
            <TouchableOpacity
              key={code}
              style={styles.row}
              onPress={() => setLanguage(code)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                {t(`languages.${code}`)}
              </Text>
              {active && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>{t('settings.premium')}</Text>
      <View style={styles.card}>
        {isPremium ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.unlocked')}</Text>
            <Ionicons name="checkmark-circle" size={20} color={colors.premium} />
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('Paywall')}
              accessibilityRole="button"
            >
              <Text style={styles.rowLabel}>{t('settings.unlock')}</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.row}
              onPress={onRestore}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.rowLabel}>{t('settings.restore')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
      <View style={styles.card}>
        <Text style={styles.aboutText}>{t('settings.aboutText')}</Text>
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
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
  },
  rowLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  aboutText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    padding: spacing.lg,
  },
});
