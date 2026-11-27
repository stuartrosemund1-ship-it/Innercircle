import type { JobMedia, JobMediaTemplate, Professional } from '@/types';

const CONFIDENTIAL = ['solicitor', 'accountant', 'financial adviser', 'gp/doctor', 'dentist'];
const PROGRESS = ['personal trainer', 'beauty', 'hair'];
const BEFORE_AFTER = ['plumber', 'electrician', 'builder', 'cleaner', 'decorator', 'mechanic'];

export function templateFor(professional: Pick<Professional, 'life_role' | 'category'>): JobMediaTemplate {
  const role = (professional.life_role ?? '').toLowerCase();
  const category = professional.category.toLowerCase();
  if (CONFIDENTIAL.some((item) => role.includes(item)) || category.includes('lawyer') || category.includes('accountant') || category.includes('financial') || category.includes('health')) return 'case_summary';
  if (PROGRESS.some((item) => role.includes(item)) || category.includes('fitness') || category.includes('beauty') || category.includes('hair')) return 'progress';
  if (BEFORE_AFTER.some((item) => role.includes(item)) || category.includes('plumb') || category.includes('electric') || category.includes('clean') || category.includes('home maintenance') || category.includes('mechanic')) return 'before_after';
  return 'portfolio';
}

export function templateLabel(template: JobMediaTemplate): string {
  if (template === 'before_after') return 'Before and after';
  if (template === 'progress') return 'Progress';
  if (template === 'case_summary') return 'Case summary';
  return 'Portfolio';
}

export function isPublicJobMedia(item: JobMedia): boolean {
  return item.consent_status === 'approved';
}

export function jobMediaBadge(item: JobMedia): 'Verified job' | 'Portfolio' {
  return item.service_request_id && item.consent_status === 'approved' ? 'Verified job' : 'Portfolio';
}

export const MEDIA_LIMITS = {
  imageBytes: 20 * 1024 * 1024,
  videoBytes: 50 * 1024 * 1024,
  videoSeconds: 60,
  imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  videoTypes: ['video/mp4'],
};
