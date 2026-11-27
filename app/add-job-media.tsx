import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { isDemoMode } from '@/lib/config';
import { MEDIA_LIMITS, templateFor, templateLabel } from '@/lib/jobMedia';
import type { JobMediaTemplate, Professional, ServiceRequest } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function AddJobMediaScreen() {
  const { professionalId, reviewId } = useLocalSearchParams<{ professionalId: string; reviewId?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [jobs, setJobs] = useState<ServiceRequest[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('Bristol');
  const [summary, setSummary] = useState('');
  const [beforePath, setBeforePath] = useState<string | null>(null);
  const [afterPath, setAfterPath] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [kind, setKind] = useState<'image' | 'video' | 'summary'>('image');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!professionalId) return;
    api.getState().then((state) => {
      const found = state.professionals.find((item) => item.id === professionalId) ?? null;
      setProfessional(found);
      setJobs(state.serviceRequests.filter((request) => request.professional_id === professionalId && request.status === 'completed'));
      if (found && templateFor(found) === 'case_summary') setKind('summary');
    });
  }, [professionalId]);
  if (!user || !professional) return null;
  const template: JobMediaTemplate = reviewId ? 'progress' : templateFor(professional);
  async function pick(which: 'before' | 'after', video = false) {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: video ? ['videos'] : ['images'], videoMaxDuration: MEDIA_LIMITS.videoSeconds, quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const seconds = asset.duration ? asset.duration / 1000 : null;
    if (video && seconds != null && seconds > MEDIA_LIMITS.videoSeconds) {
      Alert.alert('Too long', 'Videos must be 60 seconds or shorter.');
      return;
    }
    const path = isDemoMode ? (video ? 'jobs/alex-checkin.mp4' : which === 'before' ? 'jobs/plumber-before.jpg' : 'jobs/plumber-after.jpg') : asset.uri;
    if (video) { setAfterPath(path); setKind('video'); setDuration(seconds ? Math.ceil(seconds) : 8); }
    else if (which === 'before') setBeforePath(path);
    else { setAfterPath(path); setKind('image'); }
  }
  return (
    <Screen scroll>
      <Text style={styles.title}>Add a completed job</Text>
      <Text style={styles.sub}>{templateLabel(template)} is the template for this profession. A linked job stays private until the customer agrees. Unlinked uploads are labelled Portfolio.</Text>
      <TextField label="Job title" value={title} onChangeText={setTitle} />
      <TextField label="Area" value={area} onChangeText={setArea} placeholder="Bristol, not a full address" />
      {template === 'case_summary' ? (
        <TextField label="Case summary" value={summary} onChangeText={setSummary} multiline placeholder="No client names, addresses, or case numbers." />
      ) : (
        <>
          {template === 'before_after' ? <Button title={beforePath ? 'Replace before photo' : 'Add before photo'} variant="secondary" onPress={() => pick('before')} /> : null}
          <Button title={kind === 'video' ? 'Replace video' : 'Add photo'} variant="secondary" onPress={() => pick('after')} style={{ marginTop: spacing.sm }} />
          <Button title="Add short video" variant="ghost" onPress={() => pick('after', true)} style={{ marginTop: spacing.sm }} />
          {isDemoMode ? <Text style={styles.hint}>Demo mode stores a local sample file, not a cloud upload. Real mode uses the job-media bucket: JPEG, PNG, WebP, or MP4 up to 60 seconds.</Text> : null}
        </>
      )}
      <Text style={styles.label}>Link a completed booking</Text>
      <Pressable onPress={() => setRequestId(null)} style={[styles.option, !requestId && styles.optionOn]}><Text style={styles.optionText}>No link · Portfolio</Text></Pressable>
      {jobs.map((job) => (
        <Pressable key={job.id} onPress={() => setRequestId(job.id)} style={[styles.option, requestId === job.id && styles.optionOn]}>
          <Text style={styles.optionText}>{job.service_needed} · {job.location}</Text>
        </Pressable>
      ))}
      <Button title="Save" loading={saving} onPress={async () => {
        if (!title.trim()) { Alert.alert('Add a title', 'Say what the job was, without a client’s name.'); return; }
        setSaving(true);
        try {
          await api.addJobMedia(user.id, {
            professional_id: professional.id,
            service_request_id: requestId,
            review_id: reviewId ?? null,
            kind: template === 'case_summary' ? 'summary' : kind,
            template: requestId ? template : 'portfolio',
            title: title.trim(),
            location_area: area.trim() || null,
            job_date: new Date().toISOString().slice(0, 10),
            summary_text: summary.trim() || null,
            media_path: template === 'case_summary' ? null : afterPath,
            before_path: template === 'before_after' ? beforePath : null,
            duration_seconds: kind === 'video' ? duration : null,
          });
          Alert.alert(requestId ? 'Sent for agreement' : 'Added to the portfolio', requestId ? 'The customer must approve before this is public.' : 'Unlinked work is labelled Portfolio.');
          router.back();
        } catch (error) {
          Alert.alert('Could not save', error instanceof Error ? error.message : 'Try again');
        } finally { setSaving(false); }
      }} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary },
  sub: { ...typography.body, color: colors.text.secondary, marginVertical: spacing.md },
  hint: { ...typography.caption, color: colors.text.muted, marginTop: spacing.sm },
  label: { ...typography.label, color: colors.text.secondary, marginTop: spacing.md, marginBottom: spacing.sm },
  option: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.surface.border, marginBottom: spacing.sm },
  optionOn: { borderColor: colors.brand.purple, backgroundColor: colors.brand.purpleSoft },
  optionText: { ...typography.body, color: colors.text.primary },
});
