import * as Linking from 'expo-linking';
import { supabase, requireSupabase } from '@/lib/supabase/client';
import { clearPasswordRecovery } from '@/lib/supabase/linking';
import {
  DEFAULT_PRIVACY, type AppNotification, type Connection, type Conversation, type ConversationMember,
  type IntroductionRequest, type Invitation, type Message, type NotificationType, type PersonalTrust,
  type PrivacySettings, type Professional, type ProfessionalRecommendation, type Profile,
} from '@/types';

const PROFILE_COLUMNS = 'id, email, full_name, avatar_url, bio, city, interests, privacy, onboarding_completed, created_at';
const PROFESSIONAL_COLUMNS = 'id, owner_user_id, created_by, name, category, bio, location, experience, availability, avatar_url, verification_status, created_at';
const CONTACT_COLUMNS = 'professional_id, contact_email, contact_phone, website';

export interface AppSnapshot {
  profiles: Profile[];
  connections: Connection[];
  professionals: Professional[];
  recommendations: ProfessionalRecommendation[];
  personalTrusts: PersonalTrust[];
  introductions: IntroductionRequest[];
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
  messages: Message[];
  invitations: Invitation[];
  notifications: AppNotification[];
}

const listeners = new Set<() => void>();

export function subscribeSupabase(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function emit() { listeners.forEach((listener) => listener()); }

if (supabase) {
  supabase.auth.onAuthStateChange(() => emit());
  supabase
    .channel('lifecircle-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => emit())
    .subscribe();
}

function db() { return requireSupabase(); }

function fail(error: { message: string; code?: string } | null, fallback?: string): void {
  if (!error) return;
  if (error.code === '23505') throw new Error(fallback ?? 'That record already exists.');
  throw new Error(error.message);
}

async function sessionUserId(): Promise<string> {
  const { data, error } = await db().auth.getSession();
  fail(error);
  const id = data.session?.user.id;
  if (!id) throw new Error('Not authenticated');
  return id;
}

async function assertSelf(userId: string): Promise<string> {
  const id = await sessionUserId();
  if (id !== userId) throw new Error('Not authorized');
  return id;
}

function mapProfile(row: Profile): Profile {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    avatar_url: row.avatar_url ?? null,
    bio: row.bio ?? null,
    city: row.city ?? null,
    interests: row.interests ?? [],
    privacy: { ...DEFAULT_PRIVACY, ...(row.privacy ?? {}) } as PrivacySettings,
    onboarding_completed: Boolean(row.onboarding_completed),
    created_at: row.created_at,
  };
}

type ContactRow = { professional_id: string; contact_email: string | null; contact_phone: string | null; website: string | null };

function mapProfessional(row: Omit<Professional, 'website' | 'contact_email' | 'contact_phone'>, contact?: ContactRow | null): Professional {
  return {
    ...row,
    owner_user_id: row.owner_user_id ?? null,
    created_by: row.created_by,
    bio: row.bio ?? null,
    location: row.location ?? null,
    experience: row.experience ?? null,
    availability: row.availability ?? null,
    avatar_url: row.avatar_url ?? null,
    website: contact?.website ?? null,
    contact_email: contact?.contact_email ?? null,
    contact_phone: contact?.contact_phone ?? null,
  };
}

async function loadProfessionals(): Promise<Professional[]> {
  const [{ data: rows, error }, { data: contacts, error: contactError }] = await Promise.all([
    db().from('professionals').select(PROFESSIONAL_COLUMNS),
    db().from('professional_contacts').select(CONTACT_COLUMNS),
  ]);
  fail(error);
  fail(contactError);
  const byId = new Map((contacts as ContactRow[] | null ?? []).map((contact) => [contact.professional_id, contact]));
  return ((rows ?? []) as Omit<Professional, 'website' | 'contact_email' | 'contact_phone'>[]).map((row) => mapProfessional(row, byId.get(row.id)));
}

async function notify(recipientId: string, type: NotificationType, title: string, body: string, referenceId: string | null) {
  const { error } = await db().rpc('create_notification', {
    p_recipient_id: recipientId,
    p_type: type,
    p_title: title,
    p_body: body,
    p_reference_id: referenceId,
  });
  fail(error);
}

async function profileName(userId: string): Promise<string> {
  const profile = await getProfile(userId);
  return profile?.full_name ?? 'Someone';
}

async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db().from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
  fail(error);
  return data ? mapProfile(data as Profile) : null;
}

async function loadSnapshot(): Promise<AppSnapshot> {
  const [
    profiles, connections, professionals, recommendations, personalTrusts, introductions,
    conversations, conversationMembers, messages, invitations, notifications,
  ] = await Promise.all([
    db().from('profiles').select(PROFILE_COLUMNS),
    db().from('connections').select('id, requester_id, recipient_id, status, created_at, updated_at'),
    loadProfessionals().then((rows) => ({ data: rows, error: null })),
    db().from('recommendations').select('id, recommender_id, professional_id, note, visibility, status, created_at'),
    db().from('personal_trusts').select('id, user_id, professional_id, source_introduction_id, created_at'),
    db().from('introductions').select('id, requester_id, intermediary_id, professional_id, message, status, created_at, responded_at'),
    db().from('conversations').select('id, introduction_id, created_at'),
    db().from('conversation_members').select('conversation_id, user_id'),
    db().from('messages').select('id, conversation_id, sender_id, body, created_at').order('created_at', { ascending: true }),
    db().from('invitations').select('id, inviter_id, recipient_email, status, expires_at, created_at'),
    db().from('notifications').select('id, recipient_id, type, title, body, reference_id, read_at, created_at').order('created_at', { ascending: false }),
  ]);
  for (const result of [profiles, connections, recommendations, personalTrusts, introductions, conversations, conversationMembers, messages, invitations, notifications]) {
    fail(result.error);
  }
  return {
    profiles: ((profiles.data ?? []) as Profile[]).map(mapProfile),
    connections: (connections.data ?? []) as Connection[],
    professionals: professionals.data,
    recommendations: (recommendations.data ?? []) as ProfessionalRecommendation[],
    personalTrusts: (personalTrusts.data ?? []) as PersonalTrust[],
    introductions: (introductions.data ?? []) as IntroductionRequest[],
    conversations: (conversations.data ?? []) as Conversation[],
    conversationMembers: (conversationMembers.data ?? []) as ConversationMember[],
    messages: (messages.data ?? []) as Message[],
    invitations: (invitations.data ?? []) as Invitation[],
    notifications: (notifications.data ?? []) as AppNotification[],
  };
}

function acceptedIds(connections: Connection[], userId: string): Set<string> {
  const ids = new Set<string>();
  for (const connection of connections) {
    if (connection.status !== 'accepted') continue;
    if (connection.requester_id === userId) ids.add(connection.recipient_id);
    if (connection.recipient_id === userId) ids.add(connection.requester_id);
  }
  return ids;
}

export const supabaseApi = {
  async getState() { return loadSnapshot(); },
  async getSession() {
    const { data, error } = await db().auth.getSession();
    fail(error);
    if (!data.session?.user) return { user: null };
    return { user: await getProfile(data.session.user.id) };
  },
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await db().auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim() || 'New member' } },
    });
    fail(error);
    if (!data.session || !data.user) {
      throw new Error('Check your email to confirm your account, then sign in.');
    }
    const profile = await getProfile(data.user.id);
    if (!profile) throw new Error('Your profile was not created. Apply the LifeCircle database migration and try again.');
    return profile;
  },
  async signIn(email: string, password: string) {
    const { data, error } = await db().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    fail(error);
    if (!data.user) throw new Error('Invalid email or password.');
    const profile = await getProfile(data.user.id);
    if (!profile) throw new Error('Profile not found.');
    return profile;
  },
  async signOut() {
    clearPasswordRecovery();
    const { error } = await db().auth.signOut();
    fail(error);
  },
  async resetPassword(email: string) {
    const { error } = await db().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: Linking.createURL('reset-password'),
    });
    fail(error);
  },
  async updateProfile(userId: string, patch: Partial<Profile>) {
    await assertSelf(userId);
    const next: Record<string, unknown> = {};
    if (patch.full_name !== undefined) next.full_name = patch.full_name;
    if (patch.avatar_url !== undefined) next.avatar_url = patch.avatar_url;
    if (patch.bio !== undefined) next.bio = patch.bio;
    if (patch.city !== undefined) next.city = patch.city;
    if (patch.interests !== undefined) next.interests = patch.interests;
    if (patch.privacy !== undefined) next.privacy = patch.privacy;
    if (patch.onboarding_completed !== undefined) next.onboarding_completed = patch.onboarding_completed;
    const { data, error } = await db().from('profiles').update(next).eq('id', userId).select(PROFILE_COLUMNS).single();
    fail(error);
    emit();
    return mapProfile(data as Profile);
  },
  async updatePrivacy(userId: string, privacy: PrivacySettings) {
    return this.updateProfile(userId, { privacy });
  },
  async getProfile(userId: string) { return getProfile(userId); },
  async findProfileByEmail(email: string) {
    await sessionUserId();
    const { data, error } = await db().rpc('lookup_profile_by_email', { target_email: email.trim().toLowerCase() });
    fail(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return mapProfile({
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url ?? null,
      bio: null,
      city: null,
      interests: [],
      privacy: { ...DEFAULT_PRIVACY },
      onboarding_completed: false,
      created_at: new Date(0).toISOString(),
    });
  },
  async listConnections(userId: string) {
    await assertSelf(userId);
    const { data, error } = await db().from('connections').select('id, requester_id, recipient_id, status, created_at, updated_at');
    fail(error);
    return (data ?? []) as Connection[];
  },
  async requestConnection(requesterId: string, recipientId: string) {
    await assertSelf(requesterId);
    if (requesterId === recipientId) throw new Error('Cannot connect to yourself.');
    const { data: existingRows, error: existingError } = await db().from('connections').select('id, requester_id, recipient_id, status, created_at, updated_at');
    fail(existingError);
    const existing = ((existingRows ?? []) as Connection[]).find((connection) => (
      (connection.requester_id === requesterId && connection.recipient_id === recipientId)
      || (connection.requester_id === recipientId && connection.recipient_id === requesterId)
    ));
    if (existing?.status === 'blocked') throw new Error('Unable to connect.');
    if (existing?.status === 'accepted') throw new Error('Already connected.');
    if (existing?.status === 'pending') throw new Error('Connection already pending.');
    let connection = existing ?? null;
    if (existing?.status === 'declined' && existing.requester_id === requesterId) {
      const { data, error } = await db().from('connections').update({ status: 'pending' }).eq('id', existing.id).select('id, requester_id, recipient_id, status, created_at, updated_at').single();
      fail(error);
      connection = data as Connection;
    } else if (!existing) {
      const { data, error } = await db().from('connections').insert({ requester_id: requesterId, recipient_id: recipientId, status: 'pending' }).select('id, requester_id, recipient_id, status, created_at, updated_at').single();
      fail(error, 'Connection already pending.');
      connection = data as Connection;
    } else {
      throw new Error('Connection already declined.');
    }
    const name = await profileName(requesterId);
    await notify(recipientId, 'connection_request', 'New connection request', `${name} wants to join your circle.`, connection.id);
    emit();
    return connection;
  },
  async respondConnection(connectionId: string, userId: string, accept: boolean) {
    await assertSelf(userId);
    const existing = await db().from('connections').select('id, recipient_id, status').eq('id', connectionId).maybeSingle();
    fail(existing.error);
    if (!existing.data || existing.data.recipient_id !== userId) throw new Error('Not authorized');
    if (existing.data.status !== 'pending') throw new Error('Request is no longer pending');
    const { data, error } = await db().from('connections').update({ status: accept ? 'accepted' : 'declined' }).eq('id', connectionId).select('id, requester_id, recipient_id, status, created_at, updated_at').single();
    fail(error);
    const connection = data as Connection;
    if (accept) {
      const name = await profileName(userId);
      await notify(connection.requester_id, 'connection_accepted', 'Connection accepted', `${name} accepted your connection.`, connection.id);
    }
    emit();
    return connection;
  },
  async removeConnection(connectionId: string, userId: string) {
    await assertSelf(userId);
    const { error } = await db().from('connections').delete().eq('id', connectionId);
    fail(error);
    emit();
  },
  async blockUser(blockerId: string, otherId: string) {
    await assertSelf(blockerId);
    const { data: rows, error: listError } = await db().from('connections').select('id, requester_id, recipient_id, status, created_at, updated_at');
    fail(listError);
    const existing = ((rows ?? []) as Connection[]).find((connection) => (
      (connection.requester_id === blockerId && connection.recipient_id === otherId)
      || (connection.requester_id === otherId && connection.recipient_id === blockerId)
    ));
    if (!existing) {
      const { data, error } = await db().from('connections').insert({ requester_id: blockerId, recipient_id: otherId, status: 'blocked' }).select('id, requester_id, recipient_id, status, created_at, updated_at').single();
      fail(error);
      emit();
      return data as Connection;
    }
    const { data, error } = await db().from('connections').update({ status: 'blocked' }).eq('id', existing.id).select('id, requester_id, recipient_id, status, created_at, updated_at').single();
    fail(error);
    emit();
    return data as Connection;
  },
  async createProfessional(userId: string, data: Omit<Professional, 'id' | 'created_at' | 'created_by' | 'verification_status' | 'owner_user_id'> & { owner_user_id?: string | null }) {
    await assertSelf(userId);
    const { data: row, error } = await db().from('professionals').insert({
      owner_user_id: data.owner_user_id ?? null,
      created_by: userId,
      name: data.name,
      category: data.category,
      bio: data.bio ?? null,
      location: data.location ?? null,
      experience: data.experience ?? null,
      availability: data.availability ?? null,
      avatar_url: data.avatar_url ?? null,
      verification_status: 'unverified',
    }).select(PROFESSIONAL_COLUMNS).single();
    fail(error);
    if (!row) throw new Error('Could not save professional');
    let contact: ContactRow | null = null;
    if (data.contact_email || data.contact_phone || data.website) {
      const inserted = await db().from('professional_contacts').insert({
        professional_id: row.id,
        contact_email: data.contact_email ?? null,
        contact_phone: data.contact_phone ?? null,
        website: data.website ?? null,
      }).select(CONTACT_COLUMNS).single();
      fail(inserted.error);
      contact = inserted.data as ContactRow;
    }
    emit();
    return mapProfessional(row as Omit<Professional, 'website' | 'contact_email' | 'contact_phone'>, contact);
  },
  async recommendProfessional(recommenderId: string, professionalId: string, note: string | null, visibility: ProfessionalRecommendation['visibility']) {
    await assertSelf(recommenderId);
    const { data, error } = await db().from('recommendations').insert({
      recommender_id: recommenderId,
      professional_id: professionalId,
      note,
      visibility,
      status: 'active',
    }).select('id, recommender_id, professional_id, note, visibility, status, created_at').single();
    fail(error, 'You already recommend this professional.');
    const recommendation = data as ProfessionalRecommendation;
    if (visibility === 'connections' || visibility === 'circle') {
      const snapshot = await loadSnapshot();
      const name = snapshot.profiles.find((profile) => profile.id === recommenderId)?.full_name ?? 'A connection';
      const professional = snapshot.professionals.find((item) => item.id === professionalId);
      for (const recipientId of acceptedIds(snapshot.connections, recommenderId)) {
        await notify(recipientId, 'recommendation_shared', 'New recommendation in your network', `${name} shared ${professional?.name ?? 'a professional'} with you.`, recommendation.id);
      }
    }
    emit();
    return recommendation;
  },
  async withdrawRecommendation(recommendationId: string, userId: string) {
    await assertSelf(userId);
    const { data, error } = await db().from('recommendations').update({ status: 'withdrawn' }).eq('id', recommendationId).select('id, recommender_id, professional_id, note, visibility, status, created_at').single();
    fail(error);
    emit();
    return data as ProfessionalRecommendation;
  },
  async getVisibleRecommendations(userId: string) {
    await assertSelf(userId);
    const { data, error } = await db().from('recommendations').select('id, recommender_id, professional_id, note, visibility, status, created_at');
    fail(error);
    return ((data ?? []) as ProfessionalRecommendation[]).filter((recommendation) => recommendation.status === 'active');
  },
  async addPersonalTrust(userId: string, professionalId: string, sourceIntroductionId: string | null = null) {
    await assertSelf(userId);
    const { data, error } = await db().from('personal_trusts').insert({
      user_id: userId,
      professional_id: professionalId,
      source_introduction_id: sourceIntroductionId,
    }).select('id, user_id, professional_id, source_introduction_id, created_at').single();
    if (error?.code === '23505') {
      const existing = await db().from('personal_trusts').select('id, user_id, professional_id, source_introduction_id, created_at').eq('professional_id', professionalId).maybeSingle();
      fail(existing.error);
      return existing.data as PersonalTrust;
    }
    fail(error);
    emit();
    return data as PersonalTrust;
  },
  async removePersonalTrust(userId: string, professionalId: string) {
    await assertSelf(userId);
    const { error } = await db().from('personal_trusts').delete().eq('user_id', userId).eq('professional_id', professionalId);
    fail(error);
    emit();
  },
  async requestIntroduction(requesterId: string, intermediaryId: string, professionalId: string, message: string | null) {
    await assertSelf(requesterId);
    const { data, error } = await db().from('introductions').insert({
      requester_id: requesterId,
      intermediary_id: intermediaryId,
      professional_id: professionalId,
      message: message?.trim() || null,
      status: 'pending',
    }).select('id, requester_id, intermediary_id, professional_id, message, status, created_at, responded_at').single();
    fail(error);
    const intro = data as IntroductionRequest;
    const snapshot = await loadSnapshot();
    const requester = snapshot.profiles.find((profile) => profile.id === requesterId)?.full_name ?? 'Someone';
    const professional = snapshot.professionals.find((item) => item.id === professionalId)?.name ?? 'a professional';
    await notify(intermediaryId, 'introduction_request', 'Introduction request', `${requester} asked for an introduction to ${professional}.`, intro.id);
    emit();
    return intro;
  },
  async respondIntroduction(introductionId: string, intermediaryId: string, accept: boolean) {
    await assertSelf(intermediaryId);
    const { data, error } = await db().rpc('respond_introduction', { p_id: introductionId, p_accept: accept });
    fail(error);
    emit();
    return data as IntroductionRequest;
  },
  async listIntroductions(userId: string) {
    await assertSelf(userId);
    const { data, error } = await db().from('introductions').select('id, requester_id, intermediary_id, professional_id, message, status, created_at, responded_at');
    fail(error);
    return (data ?? []) as IntroductionRequest[];
  },
  async createInvitation(inviterId: string, recipientEmail: string | null) {
    await assertSelf(inviterId);
    const { data, error } = await db().rpc('create_invitation', { p_recipient_email: recipientEmail });
    fail(error);
    emit();
    const row = data as Omit<Invitation, 'invite_token_hash'>;
    return { ...row, invite_token_hash: '' };
  },
  async acceptInvitation(token: string, userId: string) {
    await assertSelf(userId);
    const { data, error } = await db().rpc('accept_invitation', { token });
    fail(error);
    emit();
    const row = data as Invitation;
    return { ...row, invite_token_hash: '', invite_token_plain: undefined };
  },
  async listNotifications(userId: string) {
    await assertSelf(userId);
    const { data, error } = await db().from('notifications').select('id, recipient_id, type, title, body, reference_id, read_at, created_at').order('created_at', { ascending: false });
    fail(error);
    return (data ?? []) as AppNotification[];
  },
  async markNotificationRead(notificationId: string, userId: string) {
    await assertSelf(userId);
    const { data, error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId).select('id, recipient_id, type, title, body, reference_id, read_at, created_at').single();
    fail(error);
    emit();
    return data as AppNotification;
  },
  async markAllNotificationsRead(userId: string) {
    await assertSelf(userId);
    const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    fail(error);
    emit();
  },
  async listConversations(userId: string) {
    await assertSelf(userId);
    const { data, error } = await db().from('conversations').select('id, introduction_id, created_at');
    fail(error);
    return (data ?? []) as Conversation[];
  },
  async getMessages(conversationId: string, userId: string) {
    await assertSelf(userId);
    const { data: members, error: memberError } = await db().from('conversation_members').select('user_id').eq('conversation_id', conversationId).eq('user_id', userId);
    fail(memberError);
    if (!members?.length) throw new Error('Not authorized to view this conversation');
    const { data, error } = await db().from('messages').select('id, conversation_id, sender_id, body, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    fail(error);
    return (data ?? []) as Message[];
  },
  async sendMessage(conversationId: string, senderId: string, body: string) {
    await assertSelf(senderId);
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Message is empty');
    const { data: members, error: memberError } = await db().from('conversation_members').select('user_id').eq('conversation_id', conversationId);
    fail(memberError);
    if (!(members ?? []).some((member) => member.user_id === senderId)) throw new Error('Not authorized');
    const { data, error } = await db().from('messages').insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed }).select('id, conversation_id, sender_id, body, created_at').single();
    fail(error);
    const name = await profileName(senderId);
    for (const member of members ?? []) {
      if (member.user_id === senderId) continue;
      await notify(member.user_id, 'message', 'New message', `${name}: ${trimmed.slice(0, 80)}`, conversationId);
    }
    emit();
    return data as Message;
  },
  async search(userId: string, query: string, category?: string) {
    await assertSelf(userId);
    const state = await loadSnapshot();
    const q = query.trim().toLowerCase();
    const circle = acceptedIds(state.connections, userId);
    const visibleRecs = state.recommendations.filter((recommendation) => recommendation.status === 'active' && (
      recommendation.recommender_id === userId
      || (recommendation.visibility !== 'private' && circle.has(recommendation.recommender_id))
    ));
    const recommendedProIds = new Set(visibleRecs.map((recommendation) => recommendation.professional_id));
    const people = state.profiles.filter((profile) => {
      if (profile.id === userId || !circle.has(profile.id)) return false;
      if (!q) return true;
      return profile.full_name.toLowerCase().includes(q) || (profile.city ?? '').toLowerCase().includes(q);
    });
    const networkProfessionals = state.professionals.filter((professional) => {
      if (!recommendedProIds.has(professional.id) && !state.personalTrusts.some((trust) => trust.user_id === userId && trust.professional_id === professional.id)) return false;
      if (category && professional.category !== category) return false;
      if (!q) return true;
      return professional.name.toLowerCase().includes(q) || professional.category.toLowerCase().includes(q) || (professional.location ?? '').toLowerCase().includes(q);
    });
    const generalProfessionals = state.professionals.filter((professional) => {
      if (recommendedProIds.has(professional.id)) return false;
      if (state.personalTrusts.some((trust) => trust.user_id === userId && trust.professional_id === professional.id)) return false;
      if (professional.created_by !== userId) return false;
      if (category && professional.category !== category) return false;
      if (!q) return true;
      return professional.name.toLowerCase().includes(q);
    });
    return { people, networkProfessionals, generalProfessionals };
  },
  async deleteAccount(userId: string) {
    await assertSelf(userId);
    const { error } = await db().rpc('delete_own_account');
    fail(error);
    clearPasswordRecovery();
    await db().auth.signOut();
    emit();
  },
  async loadSampleNetwork(_currentUserId: string) {
    throw new Error('Sample network is only available in the on-device demo.');
  },
  async resetDemo() {
    throw new Error('Demo reset is only available in the on-device demo.');
  },
};
