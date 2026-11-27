import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { LEGAL_DRAFT_BANNER } from '@/lib/legal';
import { colors, radii, spacing, typography } from '@/constants/theme';

export function LegalDocument({ title, sections }: { title: string; sections: { heading: string; body: string }[] }) {
  return (
    <Screen scroll>
      <Text style={styles.banner}>{LEGAL_DRAFT_BANNER}</Text>
      <Text style={styles.title}>{title}</Text>
      {sections.map((section) => (
        <Text key={section.heading} style={styles.block}>
          <Text style={styles.heading}>{section.heading}{'\n'}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </Text>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { ...typography.caption, color: colors.demo.bannerText, backgroundColor: colors.demo.banner, padding: spacing.sm, borderRadius: radii.md, overflow: 'hidden', marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.md },
  block: { marginBottom: spacing.md },
  heading: { ...typography.h3, color: colors.text.primary },
  body: { ...typography.body, color: colors.text.secondary },
});
