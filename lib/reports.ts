import type { ReportReason } from '@/types';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'spam_or_scam', label: 'Spam or scam' },
  { value: 'false_credentials', label: 'False credentials' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'other', label: 'Something else' },
];

export function reportReasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((item) => item.value === reason)?.label ?? reason;
}
