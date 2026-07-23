/**
 * Horizontal row of selectable filter chips (single-select with an
 * "all" option represented by value `null`).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors, radius, spacing } from '../theme';

export interface ChipOption<T extends string> {
  value: T | null;
  label: string;
}

interface FilterChipsProps<T extends string> {
  options: ChipOption<T>[];
  selected: T | null;
  onSelect: (value: T | null) => void;
}

export function FilterChips<T extends string>({
  options,
  selected,
  onSelect,
}: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <TouchableOpacity
            key={option.value ?? '__all__'}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  chip: {
    backgroundColor: colors.chipBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: {
    backgroundColor: colors.chipActiveBg,
  },
  label: {
    color: colors.text,
    fontSize: 13,
  },
  labelActive: {
    color: colors.chipActiveText,
    fontWeight: '600',
  },
});
