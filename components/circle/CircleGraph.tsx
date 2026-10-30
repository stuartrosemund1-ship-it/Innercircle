import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors, typography } from '@/constants/theme';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import type { Profile, Professional } from '@/types';

export function CircleGraph({ me, people, professionals, mode, onSelectPerson, onSelectProfessional }: {
  me: Profile; people: Profile[]; professionals: Professional[]; mode: 'people' | 'professionals' | 'shared';
  onSelectPerson: (id: string) => void; onSelectProfessional: (id: string) => void;
}) {
  const size = 320, cx = size / 2, cy = size / 2, radius = 118;
  const nodes = mode === 'professionals'
    ? professionals.map((p) => ({ id: p.id, name: p.name, kind: 'professional' as const, uri: p.avatar_url, verified: p.application_status === 'approved' && p.is_verified }))
    : people.map((p) => ({ id: p.id, name: p.full_name, kind: 'person' as const, uri: p.avatar_url, verified: false }));
  return (
    <View style={styles.wrap} accessibilityLabel="My Circle visualization">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={radius + 18} stroke={colors.brand.purpleSoft} strokeWidth={2} fill="none" />
        {nodes.map((_, i) => {
          const angle = (Math.PI * 2 * i) / Math.max(nodes.length, 1) - Math.PI / 2;
          return <Line key={`line-${i}`} x1={cx} y1={cy} x2={cx + radius * Math.cos(angle)} y2={cy + radius * Math.sin(angle)} stroke={colors.surface.border} strokeWidth={1.5} />;
        })}
        <Circle cx={cx} cy={cy} r={36} fill={colors.brand.purpleSoft} />
      </Svg>
      <View style={[styles.node, { left: cx - 28, top: cy - 28 }]}>
        <Avatar name={me.full_name} uri={me.avatar_url} size={56} />
        <Text style={styles.meLabel} numberOfLines={1}>You</Text>
      </View>
      {nodes.map((node, i) => {
        const angle = (Math.PI * 2 * i) / Math.max(nodes.length, 1) - Math.PI / 2;
        return (
          <Pressable key={node.id} onPress={() => node.kind === 'person' ? onSelectPerson(node.id) : onSelectProfessional(node.id)} style={[styles.node, { left: cx + radius * Math.cos(angle) - 44, top: cy + radius * Math.sin(angle) - 28 }]} accessibilityRole="button" accessibilityLabel={node.verified ? `${node.name}, verified` : node.name}>
            <Avatar name={node.name} uri={node.uri} size={56} />
            <Text style={styles.nodeLabel} numberOfLines={1}>{node.name.split(' ')[0]}</Text>
            {node.verified ? <VerifiedBadge /> : null}
          </Pressable>
        );
      })}
      {nodes.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyText}>{mode === 'professionals' ? 'Professionals you trust will appear here' : 'People you connect with will appear here'}</Text>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { width: 320, height: 320, alignSelf: 'center', marginVertical: 8 },
  node: { position: 'absolute', width: 88, alignItems: 'center', gap: 2 },
  meLabel: { ...typography.caption, color: colors.brand.purpleDeep, marginTop: 4, fontFamily: 'PlusJakartaSans_600SemiBold' },
  nodeLabel: { ...typography.caption, color: colors.text.secondary, marginTop: 4, maxWidth: 72, textAlign: 'center' },
  emptyOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 },
  emptyText: { ...typography.caption, color: colors.text.muted, textAlign: 'center' },
});
