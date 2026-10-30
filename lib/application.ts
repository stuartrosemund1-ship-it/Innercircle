import type { ApplicationStatus, Professional, ProfessionalApplicationInput } from '@/types';

export const CODE_OF_CONDUCT = [
  'Describe your qualifications honestly.',
  'Offer only services you are licensed or qualified to provide.',
  'Keep client information private.',
  'Do not ask members to misrepresent a recommendation.',
];

export function isApprovedProfessional(professional: Pick<Professional, 'application_status'>): boolean {
  return professional.application_status === 'approved';
}

export function isVerifiedProfessional(professional: Pick<Professional, 'application_status' | 'is_verified'>): boolean {
  return professional.application_status === 'approved' && professional.is_verified;
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  if (status === 'pending') return 'Application pending review';
  if (status === 'rejected') return 'Application rejected';
  if (status === 'approved') return 'Approved';
  return 'Draft application';
}

export function storagePath(kind: 'photo-id' | 'insurance' | 'qualification', userId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '') || 'document';
  return `professionals/${userId}/${kind}/${Date.now()}-${safe}`;
}

export function applicationIssues(input: ProfessionalApplicationInput): string[] {
  const issues: string[] = [];
  if (!input.name.trim()) issues.push('Name is required.');
  if (input.years_experience == null || input.years_experience < 0 || input.years_experience > 80) issues.push('Enter years of experience.');
  if (!input.licence_number?.trim() || !input.licence_issuer?.trim()) issues.push('Enter a licence or registration number and the issuing body.');
  if (!input.service_area?.trim()) issues.push('Enter the service area.');
  if (!input.photo_id_path) issues.push('Add a photo ID. Demo mode stores the storage path only.');
  if (!input.insurance_doc_path && !input.qualification_doc_path) issues.push('Add proof of insurance or a qualification document.');
  if (input.price_min == null || input.price_max == null || !input.pricing_unit) issues.push('Enter a price range and pricing unit.');
  if (input.price_min != null && input.price_max != null && input.price_min > input.price_max) issues.push('The minimum price cannot be higher than the maximum.');
  if (input.price_min != null && input.price_min < 0) issues.push('Prices cannot be negative.');
  if (!input.conduct_accepted) issues.push('Agree to the code of conduct.');
  const referees = new Set(input.referee_ids.filter(Boolean));
  if (referees.size < 1 || referees.size > 2) issues.push('Choose 1 or 2 connections to vouch for you.');
  return issues;
}

export function assertPriceOrder(min: number | null, max: number | null): void {
  if (min != null && max != null && min > max) throw new Error('The minimum price cannot be higher than the maximum.');
}
