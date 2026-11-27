import { LegalDocument } from '@/components/legal/LegalDocument';
import { PRIVACY_SECTIONS } from '@/lib/legal';

export default function PrivacyPolicyScreen() {
  return <LegalDocument title="Privacy Policy" sections={PRIVACY_SECTIONS} />;
}
