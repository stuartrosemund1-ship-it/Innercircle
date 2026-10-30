import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { isDemoMode } from '@/lib/config';
import { CODE_OF_CONDUCT, applicationIssues, storagePath } from '@/lib/application';
import { PRICE_CURRENCIES, PRICING_UNIT_OPTIONS } from '@/lib/pricing';
import { PROFESSIONAL_CATEGORIES, type PriceCurrency, type PricingUnit, type ProfessionalApplicationInput, type ProfessionalCategory, type Profile } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

const STEPS = ['Practice', 'Credentials', 'Price', 'References', 'Conduct'];

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AddProfessionalScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<Profile[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProfessionalCategory>(PROFESSIONAL_CATEGORIES[0]);
  const [years, setYears] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [licenceIssuer, setLicenceIssuer] = useState('');
  const [photoIdPath, setPhotoIdPath] = useState<string | null>(null);
  const [insurancePath, setInsurancePath] = useState<string | null>(null);
  const [qualificationPath, setQualificationPath] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [currency, setCurrency] = useState<PriceCurrency>('GBP');
  const [pricingUnit, setPricingUnit] = useState<PricingUnit>('per_session');
  const [pricingNotes, setPricingNotes] = useState('');
  const [referees, setReferees] = useState<string[]>([]);
  const [conduct, setConduct] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [listed, state] = await Promise.all([api.listConnections(user.id), api.getState()]);
      if (cancelled) return;
      const ids = listed.filter((connection) => connection.status === 'accepted').map((connection) => (
        connection.requester_id === user.id ? connection.recipient_id : connection.requester_id
      ));
      setConnections(state.profiles.filter((profile) => ids.includes(profile.id)));
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;
  const account = user;

  function input(submit: boolean): ProfessionalApplicationInput {
    return {
      name, category, bio: bio.trim() || null, location: location.trim() || null,
      website: null, contact_email: null, contact_phone: null, experience: years.trim() ? `${years.trim()} years` : null,
      availability: null, avatar_url: null, years_experience: numberOrNull(years),
      licence_number: licenceNumber.trim() || null, licence_issuer: licenceIssuer.trim() || null,
      service_area: serviceArea.trim() || null, photo_id_path: photoIdPath, insurance_doc_path: insurancePath,
      qualification_doc_path: qualificationPath, conduct_accepted: conduct,
      price_min: numberOrNull(priceMin), price_max: numberOrNull(priceMax), currency,
      pricing_unit: pricingUnit, pricing_notes: pricingNotes.trim() || null, referee_ids: referees, submit,
    };
  }

  function stepIssue(): string | null {
    const draft = input(false);
    if (step === 0) {
      if (!draft.name.trim()) return 'Enter the name you practise under.';
      if (draft.years_experience == null || draft.years_experience < 0) return 'Enter years of experience.';
      if (!draft.service_area) return 'Enter the area you cover.';
    }
    if (step === 1) {
      if (!draft.licence_number || !draft.licence_issuer) return 'Enter the licence or registration number and who issued it.';
      if (!draft.photo_id_path) return 'Add a photo ID.';
      if (!draft.insurance_doc_path && !draft.qualification_doc_path) return 'Add insurance or a qualification document.';
    }
    if (step === 2) {
      if (draft.price_min == null || draft.price_max == null) return 'Enter a minimum and maximum price.';
      if (draft.price_min > draft.price_max) return 'The minimum price cannot be higher than the maximum.';
    }
    if (step === 3 && referees.length < 1) return 'Choose 1 or 2 connections who can vouch for you.';
    return null;
  }

  function toggleReferee(id: string) {
    setReferees((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  }

  async function attach(kind: 'photo-id' | 'insurance' | 'qualification') {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo access to attach a document, or use a demo file.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      const fileName = result.assets[0].fileName ?? `${kind}.jpg`;
      const path = storagePath(kind, account.id, fileName);
      if (kind === 'photo-id') setPhotoIdPath(path);
      if (kind === 'insurance') setInsurancePath(path);
      if (kind === 'qualification') setQualificationPath(path);
    } catch (error) {
      Alert.alert('Could not attach', error instanceof Error ? error.message : 'Try the demo file instead.');
    }
  }

  function mockFile(kind: 'photo-id' | 'insurance' | 'qualification') {
    const path = storagePath(kind, account.id, `${kind}.jpg`);
    if (kind === 'photo-id') setPhotoIdPath(path);
    if (kind === 'insurance') setInsurancePath(path);
    if (kind === 'qualification') setQualificationPath(path);
  }

  async function save(submit: boolean) {
    if (submit) {
      const issues = applicationIssues(input(true));
      if (issues.length) { Alert.alert('Application incomplete', issues[0]); return; }
    } else if (!name.trim()) {
      Alert.alert('Name required', 'Add a name before saving a draft.');
      return;
    }
    setLoading(true);
    try {
      const professional = await api.submitProfessionalApplication(account.id, input(submit));
      router.replace(`/professional/${professional.id}`);
    } catch (error) {
      Alert.alert(submit ? 'Could not submit' : 'Could not save draft', error instanceof Error ? error.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Professional application</Text>
      <Text style={styles.step}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</Text>
      <Text style={styles.note}>Approved professionals appear in Discover. A verified badge is only available after approval.</Text>
      {step === 0 ? (
        <>
          <TextField label="Name" value={name} onChangeText={setName} />
          <Text style={styles.label}>Profession</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {PROFESSIONAL_CATEGORIES.map((item) => (
              <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}>
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextField label="Years of experience" value={years} onChangeText={setYears} keyboardType="number-pad" />
          <TextField label="Service area" value={serviceArea} onChangeText={setServiceArea} placeholder="Towns or postcodes you cover" />
          <TextField label="Location" value={location} onChangeText={setLocation} />
          <TextField label="About your practice" value={bio} onChangeText={setBio} multiline />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <TextField label="Licence or registration number" value={licenceNumber} onChangeText={setLicenceNumber} />
          <TextField label="Issuing body" value={licenceIssuer} onChangeText={setLicenceIssuer} placeholder="Who issued the licence" />
          <DocumentRow label="Photo ID" path={photoIdPath} onPick={() => attach('photo-id')} onMock={isDemoMode ? () => mockFile('photo-id') : undefined} />
          <DocumentRow label="Proof of insurance" path={insurancePath} onPick={() => attach('insurance')} onMock={isDemoMode ? () => mockFile('insurance') : undefined} />
          <DocumentRow label="Qualification document" path={qualificationPath} onPick={() => attach('qualification')} onMock={isDemoMode ? () => mockFile('qualification') : undefined} />
          <Text style={styles.note}>Add insurance, a qualification, or both. Only the storage path is saved{isDemoMode ? ', and demo mode does not upload the file' : ''}.</Text>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <TextField label="Minimum price" value={priceMin} onChangeText={setPriceMin} keyboardType="decimal-pad" />
          <TextField label="Maximum price" value={priceMax} onChangeText={setPriceMax} keyboardType="decimal-pad" />
          <Text style={styles.label}>Currency</Text>
          <View style={styles.wrap}>
            {PRICE_CURRENCIES.map((item) => (
              <Pressable key={item} onPress={() => setCurrency(item)} style={[styles.chip, currency === item && styles.chipActive]}>
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Pricing unit</Text>
          <View style={styles.wrap}>
            {PRICING_UNIT_OPTIONS.map((item) => (
              <Pressable key={item.value} onPress={() => setPricingUnit(item.value)} style={[styles.chip, pricingUnit === item.value && styles.chipActive]}>
                <Text style={styles.chipText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextField label="Pricing notes (optional)" value={pricingNotes} onChangeText={setPricingNotes} multiline />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Text style={styles.note}>Pick 1 or 2 people already in your circle. They must confirm before an admin can approve you.</Text>
          {connections.length === 0 ? <Text style={styles.note}>You have no accepted connections yet. Connect with someone, then come back to submit.</Text> : connections.map((profile) => {
            const selected = referees.includes(profile.id);
            return (
              <Pressable key={profile.id} onPress={() => toggleReferee(profile.id)} style={[styles.person, selected && styles.personActive]}>
                <Text style={styles.personName}>{profile.full_name}</Text>
                <Text style={styles.chipText}>{selected ? 'Selected' : 'Ask to vouch'}</Text>
              </Pressable>
            );
          })}
        </>
      ) : null}
      {step === 4 ? (
        <>
          {CODE_OF_CONDUCT.map((line) => <Text key={line} style={styles.conduct}>• {line}</Text>)}
          <Pressable onPress={() => setConduct((value) => !value)} style={[styles.person, conduct && styles.personActive]}>
            <Text style={styles.personName}>{conduct ? 'Agreed' : 'I agree to this code of conduct'}</Text>
          </Pressable>
        </>
      ) : null}
      <View style={styles.actions}>
        {step > 0 ? <Button title="Back" variant="secondary" onPress={() => setStep((value) => value - 1)} style={styles.action} /> : null}
        {step < STEPS.length - 1 ? (
          <Button title="Continue" onPress={() => {
            const issue = stepIssue();
            if (issue) { Alert.alert('Check this step', issue); return; }
            setStep((value) => value + 1);
          }} style={styles.action} />
        ) : (
          <>
            <Button title="Save draft" variant="secondary" loading={loading} onPress={() => save(false)} style={styles.action} />
            <Button title="Submit application" loading={loading} disabled={!conduct} onPress={() => save(true)} style={styles.action} />
          </>
        )}
      </View>
    </Screen>
  );
}

function DocumentRow({ label, path, onPick, onMock }: { label: string; path: string | null; onPick: () => void; onMock?: () => void }) {
  return (
    <View style={styles.doc}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.path} numberOfLines={2}>{path ?? 'No file recorded'}</Text>
      <View style={styles.docActions}>
        <Button title={path ? 'Replace file' : 'Choose file'} variant="secondary" onPress={onPick} style={styles.docBtn} />
        {onMock ? <Button title="Use demo file" variant="ghost" onPress={onMock} style={styles.docBtn} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary },
  step: { ...typography.label, color: colors.brand.purple, marginTop: spacing.xs, marginBottom: spacing.sm },
  note: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing.md },
  label: { ...typography.label, color: colors.text.secondary, marginBottom: spacing.xs },
  chips: { marginBottom: spacing.md, maxHeight: 44 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.surface.muted, marginRight: 8 },
  chipActive: { backgroundColor: colors.brand.purpleSoft },
  chipText: { ...typography.caption, color: colors.text.secondary },
  person: { borderWidth: 1, borderColor: colors.surface.border, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface.card },
  personActive: { borderColor: colors.brand.purple, backgroundColor: colors.brand.purpleSoft },
  personName: { ...typography.bodyMedium, color: colors.text.primary, marginBottom: 2 },
  conduct: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  action: { marginTop: 0 },
  doc: { marginBottom: spacing.md },
  path: { ...typography.caption, color: colors.text.muted, marginBottom: spacing.sm },
  docActions: { flexDirection: 'row', gap: spacing.sm },
  docBtn: { flex: 1 },
});
