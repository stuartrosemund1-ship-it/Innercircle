import { LegalDocument } from '@/components/legal/LegalDocument';
import { TERMS_SECTIONS } from '@/lib/legal';

export default function TermsScreen() {
  return <LegalDocument title="Terms of Use" sections={TERMS_SECTIONS} />;
}
