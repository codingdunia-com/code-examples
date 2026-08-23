// as const narrows and freezes, satisfies validates. Together you get a config
// that is immutable, literal and shape-checked in one expression.
interface ThemeConfig {
  colors: Record<string, string>;
  spacing: Record<string, number>;
}

export const theme = {
  colors: { primary: '#2563eb', secondary: '#64748b' },
  spacing: { sm: 8, md: 16, lg: 24 },
} as const satisfies ThemeConfig;

function exactBrandColor(color: '#2563eb'): string {
  return color;
}

function spacingStep(step: 8 | 16 | 24): number {
  return step;
}

export const brand = exactBrandColor(theme.colors.primary);
export const medium = spacingStep(theme.spacing.md);
