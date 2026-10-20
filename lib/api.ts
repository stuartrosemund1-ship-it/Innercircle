import { isDemoMode } from '@/lib/config';
import { demoApi, subscribeDemo } from '@/lib/demo/store';
import { supabaseApi, subscribeSupabase } from '@/lib/supabase/api';
import type { PrivacySettings, Professional, ProfessionalRecommendation, Profile } from '@/types';

const backend = isDemoMode ? demoApi : supabaseApi;

export const api = {
  isDemoMode,
  subscribe: isDemoMode ? subscribeDemo : subscribeSupabase,
  getSession: () => backend.getSession(),
  signUp: (email: string, password: string, fullName: string) => backend.signUp(email, password, fullName),
  signIn: (email: string, password: string) => backend.signIn(email, password),
  signOut: () => backend.signOut(),
  resetPassword: (email: string) => backend.resetPassword(email),
  updateProfile: (userId: string, patch: Partial<Profile>) => backend.updateProfile(userId, patch),
  updatePrivacy: (userId: string, privacy: PrivacySettings) => backend.updatePrivacy(userId, privacy),
  getProfile: (userId: string) => backend.getProfile(userId),
  findProfileByEmail: (email: string) => backend.findProfileByEmail(email),
  listConnections: (userId: string) => backend.listConnections(userId),
  requestConnection: (requesterId: string, recipientId: string) => backend.requestConnection(requesterId, recipientId),
  respondConnection: (connectionId: string, userId: string, accept: boolean) => backend.respondConnection(connectionId, userId, accept),
  removeConnection: (connectionId: string, userId: string) => backend.removeConnection(connectionId, userId),
  blockUser: (blockerId: string, otherId: string) => backend.blockUser(blockerId, otherId),
  createProfessional: (userId: string, data: Omit<Professional, 'id' | 'created_at' | 'created_by' | 'verification_status' | 'owner_user_id'> & { owner_user_id?: string | null }) => backend.createProfessional(userId, data),
  recommendProfessional: (recommenderId: string, professionalId: string, note: string | null, visibility: ProfessionalRecommendation['visibility']) => backend.recommendProfessional(recommenderId, professionalId, note, visibility),
  withdrawRecommendation: (recommendationId: string, userId: string) => backend.withdrawRecommendation(recommendationId, userId),
  getVisibleRecommendations: (userId: string) => backend.getVisibleRecommendations(userId),
  addPersonalTrust: (userId: string, professionalId: string, sourceIntroductionId?: string | null) => backend.addPersonalTrust(userId, professionalId, sourceIntroductionId ?? null),
  removePersonalTrust: (userId: string, professionalId: string) => backend.removePersonalTrust(userId, professionalId),
  requestIntroduction: (requesterId: string, intermediaryId: string, professionalId: string, message: string | null) => backend.requestIntroduction(requesterId, intermediaryId, professionalId, message),
  respondIntroduction: (introductionId: string, intermediaryId: string, accept: boolean) => backend.respondIntroduction(introductionId, intermediaryId, accept),
  listIntroductions: (userId: string) => backend.listIntroductions(userId),
  createInvitation: (inviterId: string, recipientEmail: string | null) => backend.createInvitation(inviterId, recipientEmail),
  acceptInvitation: (token: string, userId: string) => backend.acceptInvitation(token, userId),
  listNotifications: (userId: string) => backend.listNotifications(userId),
  markNotificationRead: (notificationId: string, userId: string) => backend.markNotificationRead(notificationId, userId),
  markAllNotificationsRead: (userId: string) => backend.markAllNotificationsRead(userId),
  listConversations: (userId: string) => backend.listConversations(userId),
  getMessages: (conversationId: string, userId: string) => backend.getMessages(conversationId, userId),
  sendMessage: (conversationId: string, senderId: string, body: string) => backend.sendMessage(conversationId, senderId, body),
  search: (userId: string, query: string, category?: string) => backend.search(userId, query, category),
  deleteAccount: (userId: string) => backend.deleteAccount(userId),
  loadSampleNetwork: (currentUserId: string) => backend.loadSampleNetwork(currentUserId),
  getState: () => backend.getState(),
  resetDemo: () => backend.resetDemo(),
};
