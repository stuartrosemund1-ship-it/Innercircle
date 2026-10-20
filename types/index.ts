export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
export type RecommendationVisibility = 'private' | 'connections' | 'circle';
export type RecommendationStatus = 'active' | 'withdrawn';
export type IntroductionStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type NotificationType =
  | 'connection_request' | 'connection_accepted' | 'recommendation_shared'
  | 'introduction_request' | 'introduction_accepted' | 'introduction_declined'
  | 'message' | 'invitation_accepted';
export type ProfessionalCategory =
  | 'Personal Training and Fitness' | 'Health and Wellbeing'
  | 'Accountants and Financial Advisers' | 'Lawyers' | 'Electricians and Plumbers'
  | 'Home Maintenance' | 'Cleaners and Gardeners' | 'Hairdressers and Beauty'
  | 'Mechanics and Automotive' | 'Childcare and Family Services' | 'Pet Care'
  | 'Technology Support' | 'Other Services';
export type TrustLabel = 'recommended' | 'introduced' | 'personally_trusted';
export interface PrivacySettings {
  profileVisibility: 'connections' | 'circle' | 'private';
  showNameOnRecommendations: boolean;
  acceptIntroductions: boolean;
  showProfessionalRelationships: 'connections' | 'none';
}
export interface Profile {
  id: string; email: string; full_name: string; avatar_url: string | null;
  bio: string | null; city: string | null; interests: string[];
  privacy: PrivacySettings; onboarding_completed: boolean; created_at: string;
}
export interface Connection {
  id: string; requester_id: string; recipient_id: string; status: ConnectionStatus;
  created_at: string; updated_at: string;
}
export interface Professional {
  id: string; owner_user_id: string | null; created_by: string; name: string;
  category: ProfessionalCategory; bio: string | null; location: string | null;
  website: string | null; contact_email: string | null; contact_phone: string | null;
  experience: string | null; availability: string | null; avatar_url: string | null;
  verification_status: 'unverified' | 'pending' | 'verified'; created_at: string;
}
export interface ProfessionalRecommendation {
  id: string; recommender_id: string; professional_id: string; note: string | null;
  visibility: RecommendationVisibility; status: RecommendationStatus; created_at: string;
}
export interface PersonalTrust {
  id: string; user_id: string; professional_id: string;
  source_introduction_id: string | null; created_at: string;
}
export interface IntroductionRequest {
  id: string; requester_id: string; intermediary_id: string; professional_id: string;
  message: string | null; status: IntroductionStatus; created_at: string; responded_at: string | null;
}
export interface Conversation { id: string; introduction_id: string | null; created_at: string; }
export interface ConversationMember { conversation_id: string; user_id: string; }
export interface Message { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; }
export interface Invitation {
  id: string; inviter_id: string; invite_token_hash: string; invite_token_plain?: string;
  recipient_email: string | null; status: InvitationStatus; expires_at: string; created_at: string;
}
export interface AppNotification {
  id: string; recipient_id: string; type: NotificationType; title: string; body: string;
  reference_id: string | null; read_at: string | null; created_at: string;
}
export const DEFAULT_PRIVACY: PrivacySettings = {
  profileVisibility: 'connections', showNameOnRecommendations: true,
  acceptIntroductions: true, showProfessionalRelationships: 'connections',
};
export const PROFESSIONAL_CATEGORIES: ProfessionalCategory[] = [
  'Personal Training and Fitness','Health and Wellbeing','Accountants and Financial Advisers',
  'Lawyers','Electricians and Plumbers','Home Maintenance','Cleaners and Gardeners',
  'Hairdressers and Beauty','Mechanics and Automotive','Childcare and Family Services',
  'Pet Care','Technology Support','Other Services',
];
