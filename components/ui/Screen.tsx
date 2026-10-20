import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { DemoBanner } from './DemoBanner';
export function Screen({ children, scroll, style, contentStyle, refreshing, onRefresh, edges = ['top'] }: {
  children: ReactNode; scroll?: boolean; style?: ViewStyle; contentStyle?: ViewStyle; refreshing?: boolean; onRefresh?: () => void; edges?: ('top' | 'right' | 'bottom' | 'left')[];
}) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>{children}</ScrollView>
  ) : (
    <View style={[styles.content, contentStyle, { flex: 1 }]}>{children}</View>
  );
  return <SafeAreaView style={[styles.safe, style]} edges={edges}><DemoBanner />{body}</SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
});
