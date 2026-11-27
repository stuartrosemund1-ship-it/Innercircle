import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriceRange } from '@/components/ui/PriceRange';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { applicationStatusLabel, isVerifiedProfessional } from '@/lib/application';
import type { Professional, ProfessionalReference, Profile } from '@/types';
import { colors, spacing, typography } from '@/constants/theme';

function when(value: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB');
}

export default function AdminApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [references, setReferences] = useState<ProfessionalReference[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?.is_admin || !id) return;
    let cancelled = false;
    const load = () => {
      api.getState().then((state) => {
        if (cancelled) return;
        setProfessional(state.professionals.find((item) => item.id === id) ?? null);
        setReferences(state.references.filter((reference) => reference.professional_id === id));
        setProfiles(state.profiles);
        setLoading(false);
      });
    };
    load();
    const unsubscribe = api.subscribe(load);
    return () => { cancelled = true; unsubscribe(); };
  }, [user, id]);
  if (!user?.is_admin) return <Screen><EmptyState title="Admins only" description="This screen is hidden unless your account has the admin role." /></Screen>;
  if (loading) return <Screen><Text style={styles.body}>Loading application…</Text></Screen>;
  if (!professional) return <Screen><EmptyState title="Application not found" description="It may have been removed." /></Screen>;
  const name = (profileId: string | null) => profiles.find((profile) => profile.id === profileId)?.full_name ?? 'Unknown member';
  return (
    <Screen scroll>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{professional.name}</Text>
        {isVerifiedProfessional(professional) ? <VerifiedBadge /> : null}
      </View>
      <Text style={styles.status}>{applicationStatusLabel(professional.application_status)}</Text>
      {professional.application_rejection_reason ? <Text style={styles.body}>Reason: {professional.application_rejection_reason}</Text> : null}
      <Field label="Category" value={professional.category} />
      <Field label="Years of experience" value={professional.years_experience == null ? 'Not recorded' : String(professional.years_experience)} />
      <Field label="Licence" value={professional.licence_number ?? 'Not recorded'} />
      <Field label="Issuing body" value={professional.licence_issuer ?? 'Not recorded'} />
      <Field label="Service area" value={professional.service_area ?? 'Not recorded'} />
      <Field label="Location" value={professional.location ?? 'Not recorded'} />
      <Field label="About" value={professional.bio ?? 'Not recorded'} />
      <Text style={styles.label}>Price</Text>
      <PriceRange professional={professional} />
      <Text style={styles.caption}>{professional.pricing_notes ?? 'No pricing notes'}</Text>
      <Field label="Photo ID" value={professional.photo_id_path ?? 'Not provided'} />
      <Field label="Insurance" value={professional.insurance_doc_path ?? 'Not provided'} />
      <Field label="Qualification" value={professional.qualification_doc_path ?? 'Not provided'} />
      <Field label="Code of conduct agreed" value={when(professional.conduct_accepted_at)} />
      <Field label="Submitted" value={when(professional.application_submitted_at)} />
      <Field label="Applicant" value={name(professional.owner_user_id ?? professional.created_by)} />
      <Text style={styles.label}>References</Text>
      {references.length === 0 ? <Text style={styles.caption}>None requested.</Text> : references.map((reference) => (
        <Text key={reference.id} style={styles.body}>{name(reference.referee_id)} · {reference.status}{reference.note ? ` · ${reference.note}` : ''}</Text>
      ))}
      {professional.application_status !== 'approved' ? (
        <Button title="Approve" onPress={async () => {
          try { await api.adminDecideApplication(user.id, professional.id, 'approved', null); }
          catch (error) { Alert.alert('Could not approve', error instanceof Error ? error.message : 'Try again'); }
        }} style={styles.gap} />
      ) : null}
      {rejecting ? (
        <View style={styles.gap}>
          <TextField label="Rejection reason" value={reason} onChangeText={setReason} multiline />
          <Button title="Confirm rejection" variant="danger" disabled={!reason.trim()} onPress={async () => {
            try {
              await api.adminDecideApplication(user.id, professional.id, 'rejected', reason.trim());
              setRejecting(false);
            } catch (error) { Alert.alert('Could not reject', error instanceof Error ? error.message : 'Try again'); }
          }} />
        </View>
      ) : (
        <Button title="Reject" variant="danger" onPress={() => setRejecting(true)} style={styles.gap} />
      )}
      <Button
        title={professional.is_verified ? 'Remove Verified badge' : 'Grant Verified badge'}
        variant="teal"
        onPress={async () => {
          try { await api.adminSetVerified(user.id, professional.id, !professional.is_verified); }
          catch (error) { Alert.alert('Could not update badge', error instanceof Error ? error.message : 'Try again'); }
        }}
        style={styles.gap}
      />
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h2, color: colors.text.primary },
  status: { ...typography.label, color: colors.brand.purple, marginBottom: spacing.md },
  label: { ...typography.label, color: colors.text.secondary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.text.primary },
  caption: { ...typography.caption, color: colors.text.secondary },
  field: { marginBottom: spacing.xs },
  gap: { marginTop: spacing.md },
});
