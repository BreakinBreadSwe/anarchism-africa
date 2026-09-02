import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '../theme';

interface SearchBarProps {
  value: string;
  onChange: (text: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={t('remedies.searchPlaceholder')}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityRole="search"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChange('')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm + 2,
  },
});
