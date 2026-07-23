import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RootStackScreenProps } from '../navigation/types';
import { usePremium } from '../state/PremiumContext';
import { colors, radius, spacing } from '../theme';

export function PaywallScreen({ navigation }: RootStackScreenProps<'Paywall'>) {
  const { t } = useTranslation();
  const { busy, purchase, restore } = usePremium();

  const onPurchase = async () => {
    const success = await purchase();
    if (success) {
      Alert.alert(t('paywall.title'), t('paywall.success'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert(t('paywall.title'), t('paywall.failure'));
    }
  };

  const onRestore = async () => {
    const restored = await restore();
    if (restored) {
      Alert.alert(t('paywall.title'), t('paywall.success'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert(t('paywall.title'), t('settings.restoreNone'));
    }
  };

  return (
    <View style={styles.container}>
      <Ionicons name="sparkles" size={40} color={colors.premium} />
      <Text style={styles.title}>{t('paywall.title')}</Text>
      <Text style={styles.body}>{t('paywall.body')}</Text>
      <Text style={styles.features}>{t('paywall.features')}</Text>

      <TouchableOpacity
        style={styles.cta}
        onPress={onPurchase}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaText}>{t('paywall.cta')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onRestore} disabled={busy}>
        <Text style={styles.restore}>{t('paywall.restore')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  features: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 24,
  },
  cta: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    width: '100%',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  restore: {
    color: colors.primary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
