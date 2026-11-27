import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriceRange } from '@/components/ui/PriceRange';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { applicationStatusLabel } from '@/lib/application';
import { reportReasonLabel } from '@/lib/reports';
import type { ApplicationStatus, Professional, Report } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

const FILTERS: { id: ApplicationStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

export default function AdminHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'applications' | 'reports'>('applications');
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('pending');
  const [query, setQuery] = useState('');
  const [applications, setApplications] = useState<Professional[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!user?.is_admin) return;
    let cancelled = false;
    const load = () => {
      api.getState().then((state) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const profile of state.profiles) map[profile.id] = profile.full_name;
        for (const professional of state.professionals) map[professional.id] = professional.name;
        setNames(map);
        setApplications(state.professionals.filter((professional) => professional.application_status !== 'draft'));
        setReports(state.reports);
      });
    };
    load();
    const unsubscribe = api.subscribe(load);
    return () => { cancelled = true; unsubscribe(); };
  }, [user]);
  if (!user) return null;
  const account = user;
  async function closeReport(reportId: string, status: 'resolved' | 'dismissed') {
    try { await api.adminResolveReport(account.id, reportId, status, null); }
    catch (error) { Alert.alert('Could not update', error instanceof Error ? error.message : 'Try again'); }
  }
  if (!user.is_admin) return <Screen><EmptyState title="Admins only" description="This screen is hidden unless your account has the admin role." /></Screen>;
  const q = query.trim().toLowerCase();
  const visible = applications.filter((professional) => {
    if (filter !== 'all' && professional.application_status !== filter) return false;
    if (!q) return true;
    return professional.name.toLowerCase().includes(q) || professional.category.toLowerCase().includes(q) || (professional.licence_number ?? '').toLowerCase().includes(q);
  });
  const openReports = reports.filter((report) => report.status === 'open');
  return (
    <Screen scroll>
      <Text style={styles.title}>Admin</Text>
      <View style={styles.segment}>
        <Pressable onPress={() => setTab('applications')} style={[styles.seg, tab === 'applications' && styles.segActive]}><Text style={styles.segText}>Applications</Text></Pressable>
        <Pressable onPress={() => setTab('reports')} style={[styles.seg, tab === 'reports' && styles.segActive]}><Text style={styles.segText}>Reports ({openReports.length})</Text></Pressable>
      </View>
      {tab === 'applications' ? (
        <>
          <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name, category, or licence" />
          <View style={styles.filters}>
            {FILTERS.map((item) => (
              <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.chip, filter === item.id && styles.chipActive]}>
                <Text style={styles.chipText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          {visible.length === 0 ? <Text style={styles.muted}>No applications in this filter.</Text> : visible.map((professional) => (
            <Pressable key={professional.id} style={styles.card} onPress={() => router.push(`/admin/${professional.id}`)}>
              <Text style={styles.cardTitle}>{professional.name}</Text>
              <Text style={styles.muted}>{professional.category}</Text>
              <Text style={styles.muted}>{applicationStatusLabel(professional.application_status)}</Text>
              <PriceRange professional={professional} />
            </Pressable>
          ))}
        </>
      ) : (
        openReports.length === 0 ? <Text style={styles.muted}>No open reports.</Text> : openReports.map((report) => {
          const targetId = report.target_professional_id ?? report.target_profile_id ?? '';
          return (
            <View key={report.id} style={styles.card}>
              <Text style={styles.cardTitle}>{reportReasonLabel(report.reason)}</Text>
              <Text style={styles.muted}>{names[report.reporter_id] ?? 'A member'} reported {report.target_type} {names[targetId] ?? ''}</Text>
              {report.details ? <Text style={styles.body}>{report.details}</Text> : null}
              <View style={styles.actions}>
                <Button title="Resolve" variant="teal" onPress={() => closeReport(report.id, 'resolved')} style={styles.action} />
                <Button title="Dismiss" variant="secondary" onPress={() => closeReport(report.id, 'dismissed')} style={styles.action} />
              </View>
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.md },
  segment: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  seg: { flex: 1, paddingVertical: 10, borderRadius: radii.md, backgroundColor: colors.surface.muted, alignItems: 'center' },
  segActive: { backgroundColor: colors.brand.purpleSoft },
  segText: { ...typography.label, color: colors.text.primary },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.surface.muted },
  chipActive: { backgroundColor: colors.brand.purpleSoft },
  chipText: { ...typography.caption, color: colors.text.secondary },
  card: { backgroundColor: colors.surface.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.surface.border, padding: spacing.md, marginBottom: spacing.sm, gap: 4 },
  cardTitle: { ...typography.bodyMedium, color: colors.text.primary },
  body: { ...typography.body, color: colors.text.primary },
  muted: { ...typography.caption, color: colors.text.secondary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
});
