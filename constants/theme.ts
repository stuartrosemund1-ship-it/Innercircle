export const colors = {
  brand: { purple: '#5B4BDF', purpleDeep: '#3F33B0', purpleSoft: '#EDE9FF', blue: '#3B82F6', blueSoft: '#E8F1FF', teal: '#0D9488', tealSoft: '#E0F7F4' },
  text: { primary: '#1A1A2E', secondary: '#5C5C75', muted: '#8B8BA3', inverse: '#FFFFFF', link: '#5B4BDF' },
  surface: { background: '#F7F8FC', card: '#FFFFFF', elevated: '#FFFFFF', muted: '#EEF0F7', border: '#E4E6F0', overlay: 'rgba(26, 26, 46, 0.45)' },
  state: { success: '#0D9488', warning: '#D97706', error: '#DC2626', info: '#3B82F6' },
  trust: { recommended: '#5B4BDF', introduced: '#3B82F6', personallyTrusted: '#0D9488' },
  demo: { banner: '#FEF3C7', bannerText: '#92400E' },
  gradient: { start: '#5B4BDF', mid: '#4F6AED', end: '#3B82F6' },
} as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radii = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;
export const shadows = {
  soft: { shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
} as const;
export const typography = {
  brand: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, letterSpacing: -0.5 },
  h1: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, letterSpacing: -0.4 },
  h2: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 22, letterSpacing: -0.3 },
  h3: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18 },
  body: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 18 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, letterSpacing: 0.2 },
  button: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
} as const;
export const tagline = 'Your Circle. Better Life.';
export const brandName = 'LifeCircle';
