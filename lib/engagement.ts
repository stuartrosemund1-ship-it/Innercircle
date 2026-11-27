import type { NotificationPreferences, NotificationType, ProfessionalReview, ServiceRequest } from '@/types';

export function preferenceFor(type: NotificationType): keyof NotificationPreferences | null {
  if (type === 'service_request' || type === 'service_request_update') return 'requests';
  if (type === 'introduction_request' || type === 'introduction_accepted' || type === 'introduction_declined') return 'introductions';
  if (type === 'reference_request') return 'references';
  if (type === 'application_update') return 'applications';
  if (type === 'report_resolved') return 'reports';
  return null;
}

export function allowsNotification(preferences: NotificationPreferences, type: NotificationType): boolean {
  const key = preferenceFor(type);
  return key ? preferences[key] : true;
}

// TODO: Deliver push (Expo Notifications) and email when the member's preferences allow it.
// This prototype only stores the in-app notification. Do not send push or email from here yet.
export function deliverExternalNotification(_type: NotificationType, _recipientId: string): void {
  return;
}

export function averageRating(reviews: Pick<ProfessionalReview, 'rating'>[]): { average: number; count: number } | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}

export function budgetFits(budget: number, min: number | null, max: number | null): boolean {
  if (min != null && budget < min) return false;
  if (max != null && budget > max) return false;
  return budget >= 0;
}

export function requestStatusLabel(status: ServiceRequest['status']): string {
  if (status === 'pending') return 'Waiting for a reply';
  if (status === 'accepted') return 'Accepted';
  if (status === 'declined') return 'Declined';
  if (status === 'proposed') return 'New time proposed';
  if (status === 'completed') return 'Completed';
  return 'Cancelled';
}
