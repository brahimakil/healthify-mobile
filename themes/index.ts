import { config } from '@tamagui/config/v3'
import { createMedia, createTamagui } from '@tamagui/core'
import { createInterFont } from '@tamagui/font-inter'
import { shorthands } from '@tamagui/shorthands'
import { themes, tokens } from '@tamagui/themes'

const headingFont = createInterFont()
const bodyFont = createInterFont()

const customTokens = {
  ...tokens,
  color: {
    ...tokens.color,
    // Health-focused color palette
    primary: '#10B981', // Green for health/wellness
    primaryDark: '#059669',
    secondary: '#3B82F6', // Blue for water/hydration
    secondaryDark: '#2563EB',
    accent: '#F59E0B', // Orange for energy/calories
    accentDark: '#D97706',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    background: '#FFFFFF',
    backgroundDark: '#1F2937',
    surface: '#F9FAFB',
    surfaceDark: '#374151',
    text: '#111827',
    textDark: '#F9FAFB',
    textSecondary: '#6B7280',
    textSecondaryDark: '#D1D5DB',
    border: '#E5E7EB',
    borderDark: '#4B5563',
  }
}

const customThemes = {
  ...themes,
  light: {
    ...themes.light,
    background: customTokens.color.background,
    backgroundStrong: customTokens.color.surface,
    color: customTokens.color.text,
    colorPress: customTokens.color.textSecondary,
    primary: customTokens.color.primary,
    secondary: customTokens.color.secondary,
    accent: customTokens.color.accent,
    success: customTokens.color.success,
    warning: customTokens.color.warning,
    error: customTokens.color.error,
    borderColor: customTokens.color.border,
  },
  dark: {
    ...themes.dark,
    background: customTokens.color.backgroundDark,
    backgroundStrong: customTokens.color.surfaceDark,
    color: customTokens.color.textDark,
    colorPress: customTokens.color.textSecondaryDark,
    primary: customTokens.color.primary,
    secondary: customTokens.color.secondary,
    accent: customTokens.color.accent,
    success: customTokens.color.success,
    warning: customTokens.color.warning,
    error: customTokens.color.error,
    borderColor: customTokens.color.borderDark,
  }
}

const media = createMedia({
  xs: { maxWidth: 660 },
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
  xl: { maxWidth: 1420 },
  xxl: { maxWidth: 1600 },
  gtXs: { minWidth: 660 + 1 },
  gtSm: { minWidth: 800 + 1 },
  gtMd: { minWidth: 1020 + 1 },
  gtLg: { minWidth: 1280 + 1 },
  short: { maxHeight: 820 },
  tall: { minHeight: 820 },
  hoverNone: { hover: 'none' },
  pointerCoarse: { pointer: 'coarse' },
})

export const tamaguiConfig = createTamagui({
  animations: config.animations,
  shouldAddPrefersColorThemes: true,
  themeClassNameOnRoot: true,
  shorthands,
  fonts: {
    heading: headingFont,
    body: bodyFont,
  },
  themes: customThemes,
  tokens: customTokens,
  media,
})

export default tamaguiConfig

export type Conf = typeof tamaguiConfig

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
} 