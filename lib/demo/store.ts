import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppNotification, Connection, Conversation, ConversationMember, DEFAULT_PRIVACY,
  IntroductionRequest, Invitation, Message, PersonalTrust, PrivacySettings,
  Professional, ProfessionalRecommendation, Profile,
} from '@/types';
import { createId, hashToken, nowIso } from '@/lib/id';

const STORAGE_KEY = 'lifecircle.demo.v1';

export interface DemoState {
  version: 1;
  environment: 'development-demo';
  currentUserId: string | null;
  sessionPasswordByEmail: Record<string, string>;
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
  sampleDataLoaded: boolean;
}

function emptyState(): DemoState {
  return {
    version: 1, environment: 'development-demo', currentUserId: null,
    sessionPasswordByEmail: {}, profiles: [], connections: [], professionals: [],
    recommendations: [], personalTrusts: [], introductions: [], conversations: [],
    conversationMembers: [], messages: [], invitations: [], notifications: [],
    sampleDataLoaded: false,
  };
}

let memory: DemoState | null = null;
const listeners = new Set<() => void>();
export function subscribeDemo(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function emit() { listeners.forEach((l) => l()); }

export async function loadDemoState(): Promise<DemoState> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) { memory = JSON.parse(raw) as DemoState; return memory; }
  } catch {}
  memory = emptyState();
  return memory;
}

async function save(state: DemoState): Promise<DemoState> {
  memory = state;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emit();
  return state;
}

export async function resetDemoState(): Promise<DemoState> { return save(emptyState()); }

function acceptedConnectionIds(state: DemoState, userId: string): Set<string> {
  const ids = new Set<string>();
  for (const c of state.connections) {
    if (c.status !== 'accepted') continue;
    if (c.requester_id === userId) ids.add(c.recipient_id);
    if (c.recipient_id === userId) ids.add(c.requester_id);
  }
  return ids;
}

function areConnected(state: DemoState, a: string, b: string): boolean {
  return state.connections.some((c) => c.status === 'accepted' && ((c.requester_id === a && c.recipient_id === b) || (c.requester_id === b && c.recipient_id === a)));
}

function pushNotification(state: DemoState, partial: Omit<AppNotification, 'id' | 'created_at' | 'read_at'>) {
  state.notifications.unshift({ id: createId('notif'), created_at: nowIso(), read_at: null, ...partial });
}

export const demoApi = {
  async getState() { return loadDemoState(); },
  async getSession() {
    const state = await loadDemoState();
    if (!state.currentUserId) return { user: null };
    return { user: state.profiles.find((p) => p.id === state.currentUserId) ?? null };
  },
  async signUp(email: string, password: string, fullName: string) {
    const state = await loadDemoState();
    const normalized = email.trim().toLowerCase();
    if (state.profiles.some((p) => p.email === normalized)) throw new Error('An account with this email already exists.');
    const profile: Profile = {
      id: createId('user'), email: normalized, full_name: fullName.trim() || 'New member',
      avatar_url: null, bio: null, city: null, interests: [], privacy: { ...DEFAULT_PRIVACY },
      onboarding_completed: false, created_at: nowIso(),
    };
    state.profiles.push(profile);
    state.sessionPasswordByEmail[normalized] = password;
    state.currentUserId = profile.id;
    await save(state);
    return profile;
  },
  async signIn(email: string, password: string) {
    const state = await loadDemoState();
    const normalized = email.trim().toLowerCase();
    const profile = state.profiles.find((p) => p.email === normalized);
    if (!profile || state.sessionPasswordByEmail[normalized] !== password) throw new Error('Invalid email or password.');
    state.currentUserId = profile.id;
    await save(state);
    return profile;
  },
  async signOut() { const state = await loadDemoState(); state.currentUserId = null; await save(state); },
  async updateProfile(userId: string, patch: Partial<Profile>) {
    const state = await loadDemoState();
    const idx = state.profiles.findIndex((p) => p.id === userId);
    if (idx < 0) throw new Error('Profile not found');
    state.profiles[idx] = { ...state.profiles[idx], ...patch, id: userId };
    await save(state);
    return state.profiles[idx];
  },
  async updatePrivacy(userId: string, privacy: PrivacySettings) { return this.updateProfile(userId, { privacy }); },
  async listConnections(userId: string) {
    const state = await loadDemoState();
    return state.connections.filter((c) => c.requester_id === userId || c.recipient_id === userId);
  },
  async getProfile(userId: string) {
    const state = await loadDemoState();
    return state.profiles.find((p) => p.id === userId) ?? null;
  },
  async requestConnection(requesterId: string, recipientId: string) {
    const state = await loadDemoState();
    if (requesterId === recipientId) throw new Error('Cannot connect to yourself.');
    const existing = state.connections.find((c) => (c.requester_id === requesterId && c.recipient_id === recipientId) || (c.requester_id === recipientId && c.recipient_id === requesterId));
    if (existing) {
      if (existing.status === 'blocked') throw new Error('Unable to connect.');
      if (existing.status === 'accepted') throw new Error('Already connected.');
      if (existing.status === 'pending') throw new Error('Connection already pending.');
    }
    const connection: Connection = { id: createId('conn'), requester_id: requesterId, recipient_id: recipientId, status: 'pending', created_at: nowIso(), updated_at: nowIso() };
    state.connections.push(connection);
    const requester = state.profiles.find((p) => p.id === requesterId);
    pushNotification(state, { recipient_id: recipientId, type: 'connection_request', title: 'New connection request', body: `${requester?.full_name ?? 'Someone'} wants to join your circle.`, reference_id: connection.id });
    await save(state);
    return connection;
  },
  async respondConnection(connectionId: string, userId: string, accept: boolean) {
    const state = await loadDemoState();
    const conn = state.connections.find((c) => c.id === connectionId);
    if (!conn) throw new Error('Connection not found');
    if (conn.recipient_id !== userId) throw new Error('Not authorized');
    if (conn.status !== 'pending') throw new Error('Request is no longer pending');
    conn.status = accept ? 'accepted' : 'declined';
    conn.updated_at = nowIso();
    if (accept) {
      const recipient = state.profiles.find((p) => p.id === userId);
      pushNotification(state, { recipient_id: conn.requester_id, type: 'connection_accepted', title: 'Connection accepted', body: `${recipient?.full_name ?? 'Someone'} accepted your connection.`, reference_id: conn.id });
    }
    await save(state);
    return conn;
  },
  async removeConnection(connectionId: string, userId: string) {
    const state = await loadDemoState();
    const conn = state.connections.find((c) => c.id === connectionId);
    if (!conn) throw new Error('Connection not found');
    if (conn.requester_id !== userId && conn.recipient_id !== userId) throw new Error('Not authorized');
    state.connections = state.connections.filter((c) => c.id !== connectionId);
    await save(state);
  },
  async blockUser(blockerId: string, otherId: string) {
    const state = await loadDemoState();
    let conn = state.connections.find((c) => (c.requester_id === blockerId && c.recipient_id === otherId) || (c.requester_id === otherId && c.recipient_id === blockerId));
    if (!conn) {
      conn = { id: createId('conn'), requester_id: blockerId, recipient_id: otherId, status: 'blocked', created_at: nowIso(), updated_at: nowIso() };
      state.connections.push(conn);
    } else { conn.status = 'blocked'; conn.updated_at = nowIso(); }
    await save(state);
    return conn;
  },
  async createProfessional(userId: string, data: Omit<Professional, 'id' | 'created_at' | 'created_by' | 'verification_status' | 'owner_user_id'> & { owner_user_id?: string | null }) {
    const state = await loadDemoState();
    const professional: Professional = {
      id: createId('pro'), owner_user_id: data.owner_user_id ?? null, created_by: userId,
      name: data.name, category: data.category, bio: data.bio ?? null, location: data.location ?? null,
      website: data.website ?? null, contact_email: data.contact_email ?? null, contact_phone: data.contact_phone ?? null,
      experience: data.experience ?? null, availability: data.availability ?? null, avatar_url: data.avatar_url ?? null,
      verification_status: 'unverified', created_at: nowIso(),
    };
    state.professionals.push(professional);
    await save(state);
    return professional;
  },
  async recommendProfessional(recommenderId: string, professionalId: string, note: string | null, visibility: ProfessionalRecommendation['visibility']) {
    const state = await loadDemoState();
    if (state.recommendations.some((r) => r.recommender_id === recommenderId && r.professional_id === professionalId && r.status === 'active')) {
      throw new Error('You already recommend this professional.');
    }
    const rec: ProfessionalRecommendation = { id: createId('rec'), recommender_id: recommenderId, professional_id: professionalId, note, visibility, status: 'active', created_at: nowIso() };
    state.recommendations.push(rec);
    if (visibility === 'connections' || visibility === 'circle') {
      const circle = acceptedConnectionIds(state, recommenderId);
      const recommender = state.profiles.find((p) => p.id === recommenderId);
      const pro = state.professionals.find((p) => p.id === professionalId);
      for (const recipientId of circle) {
        pushNotification(state, { recipient_id: recipientId, type: 'recommendation_shared', title: 'New recommendation in your network', body: `${recommender?.full_name ?? 'A connection'} shared ${pro?.name ?? 'a professional'} with you.`, reference_id: rec.id });
      }
    }
    await save(state);
    return rec;
  },
  async withdrawRecommendation(recommendationId: string, userId: string) {
    const state = await loadDemoState();
    const rec = state.recommendations.find((r) => r.id === recommendationId);
    if (!rec || rec.recommender_id !== userId) throw new Error('Not authorized');
    rec.status = 'withdrawn';
    await save(state);
    return rec;
  },
  async getVisibleRecommendations(userId: string) {
    const state = await loadDemoState();
    const circle = acceptedConnectionIds(state, userId);
    return state.recommendations.filter((r) => {
      if (r.status !== 'active') return false;
      if (r.recommender_id === userId) return true;
      if (r.visibility === 'private') return false;
      return circle.has(r.recommender_id);
    });
  },
  async addPersonalTrust(userId: string, professionalId: string, sourceIntroductionId: string | null = null) {
    const state = await loadDemoState();
    const existing = state.personalTrusts.find((t) => t.user_id === userId && t.professional_id === professionalId);
    if (existing) return existing;
    const trust: PersonalTrust = { id: createId('trust'), user_id: userId, professional_id: professionalId, source_introduction_id: sourceIntroductionId, created_at: nowIso() };
    state.personalTrusts.push(trust);
    await save(state);
    return trust;
  },
  async removePersonalTrust(userId: string, professionalId: string) {
    const state = await loadDemoState();
    state.personalTrusts = state.personalTrusts.filter((t) => !(t.user_id === userId && t.professional_id === professionalId));
    await save(state);
  },
  async requestIntroduction(requesterId: string, intermediaryId: string, professionalId: string, message: string | null) {
    const state = await loadDemoState();
    if (!areConnected(state, requesterId, intermediaryId)) throw new Error('You can only request introductions through people in your circle.');
    const intermediary = state.profiles.find((p) => p.id === intermediaryId);
    if (intermediary && !intermediary.privacy.acceptIntroductions) throw new Error('This person is not accepting introduction requests.');
    const recommends = state.recommendations.some((r) => r.recommender_id === intermediaryId && r.professional_id === professionalId && r.status === 'active');
    if (!recommends) throw new Error('That connection does not currently recommend this professional.');
    const intro: IntroductionRequest = { id: createId('intro'), requester_id: requesterId, intermediary_id: intermediaryId, professional_id: professionalId, message, status: 'pending', created_at: nowIso(), responded_at: null };
    state.introductions.push(intro);
    const requester = state.profiles.find((p) => p.id === requesterId);
    const pro = state.professionals.find((p) => p.id === professionalId);
    pushNotification(state, { recipient_id: intermediaryId, type: 'introduction_request', title: 'Introduction request', body: `${requester?.full_name ?? 'Someone'} asked for an introduction to ${pro?.name ?? 'a professional'}.`, reference_id: intro.id });
    await save(state);
    return intro;
  },
  async respondIntroduction(introductionId: string, intermediaryId: string, accept: boolean) {
    const state = await loadDemoState();
    const intro = state.introductions.find((i) => i.id === introductionId);
    if (!intro) throw new Error('Introduction not found');
    if (intro.intermediary_id !== intermediaryId) throw new Error('Not authorized');
    if (intro.status !== 'pending') throw new Error('Already responded');
    intro.status = accept ? 'accepted' : 'declined';
    intro.responded_at = nowIso();
    const intermediary = state.profiles.find((p) => p.id === intermediaryId);
    const pro = state.professionals.find((p) => p.id === intro.professional_id);
    if (accept) {
      const conversation: Conversation = { id: createId('conv'), introduction_id: intro.id, created_at: nowIso() };
      state.conversations.push(conversation);
      state.conversationMembers.push({ conversation_id: conversation.id, user_id: intro.requester_id }, { conversation_id: conversation.id, user_id: intro.intermediary_id });
      if (pro?.owner_user_id) state.conversationMembers.push({ conversation_id: conversation.id, user_id: pro.owner_user_id });
      state.messages.push({ id: createId('msg'), conversation_id: conversation.id, sender_id: intermediaryId, body: `I've introduced you to ${pro?.name ?? 'this professional'}. You can decide independently whether to add them to your circle.`, created_at: nowIso() });
      pushNotification(state, { recipient_id: intro.requester_id, type: 'introduction_accepted', title: 'Introduction accepted', body: `${intermediary?.full_name ?? 'Someone'} introduced you to ${pro?.name ?? 'a professional'}.`, reference_id: intro.id });
    } else {
      pushNotification(state, { recipient_id: intro.requester_id, type: 'introduction_declined', title: 'Introduction declined', body: `${intermediary?.full_name ?? 'Someone'} declined your introduction request.`, reference_id: intro.id });
    }
    await save(state);
    return intro;
  },
  async listIntroductions(userId: string) {
    const state = await loadDemoState();
    return state.introductions.filter((i) => i.requester_id === userId || i.intermediary_id === userId);
  },
  async createInvitation(inviterId: string, recipientEmail: string | null) {
    const state = await loadDemoState();
    const plain = createId('invite');
    const invitation: Invitation = { id: createId('inv'), inviter_id: inviterId, invite_token_hash: await hashToken(plain), invite_token_plain: plain, recipient_email: recipientEmail?.trim().toLowerCase() || null, status: 'pending', expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(), created_at: nowIso() };
    state.invitations.push(invitation);
    await save(state);
    return invitation;
  },
  async acceptInvitation(token: string, userId: string) {
    const state = await loadDemoState();
    const hash = await hashToken(token);
    const invitation = state.invitations.find((i) => i.invite_token_hash === hash || i.invite_token_plain === token);
    if (!invitation) throw new Error('Invitation not found');
    if (invitation.status !== 'pending') throw new Error('Invitation is no longer valid');
    if (new Date(invitation.expires_at).getTime() < Date.now()) { invitation.status = 'expired'; await save(state); throw new Error('Invitation has expired'); }
    invitation.status = 'accepted';
    const existing = state.connections.find((c) => (c.requester_id === invitation.inviter_id && c.recipient_id === userId) || (c.requester_id === userId && c.recipient_id === invitation.inviter_id));
    if (!existing) state.connections.push({ id: createId('conn'), requester_id: invitation.inviter_id, recipient_id: userId, status: 'accepted', created_at: nowIso(), updated_at: nowIso() });
    else if (existing.status === 'pending') { existing.status = 'accepted'; existing.updated_at = nowIso(); }
    const invitee = state.profiles.find((p) => p.id === userId);
    pushNotification(state, { recipient_id: invitation.inviter_id, type: 'invitation_accepted', title: 'Invitation accepted', body: `${invitee?.full_name ?? 'Someone'} joined via your invite.`, reference_id: invitation.id });
    await save(state);
    return invitation;
  },
  async listNotifications(userId: string) {
    const state = await loadDemoState();
    return state.notifications.filter((n) => n.recipient_id === userId);
  },
  async markNotificationRead(notificationId: string, userId: string) {
    const state = await loadDemoState();
    const n = state.notifications.find((x) => x.id === notificationId);
    if (!n || n.recipient_id !== userId) throw new Error('Not authorized');
    n.read_at = nowIso();
    await save(state);
    return n;
  },
  async markAllNotificationsRead(userId: string) {
    const state = await loadDemoState();
    for (const n of state.notifications) if (n.recipient_id === userId && !n.read_at) n.read_at = nowIso();
    await save(state);
  },
  async listConversations(userId: string) {
    const state = await loadDemoState();
    const ids = new Set(state.conversationMembers.filter((m) => m.user_id === userId).map((m) => m.conversation_id));
    return state.conversations.filter((c) => ids.has(c.id));
  },
  async getMessages(conversationId: string, userId: string) {
    const state = await loadDemoState();
    if (!state.conversationMembers.some((m) => m.conversation_id === conversationId && m.user_id === userId)) throw new Error('Not authorized to view this conversation');
    return state.messages.filter((m) => m.conversation_id === conversationId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  async sendMessage(conversationId: string, senderId: string, body: string) {
    const state = await loadDemoState();
    if (!state.conversationMembers.some((m) => m.conversation_id === conversationId && m.user_id === senderId)) throw new Error('Not authorized');
    const message: Message = { id: createId('msg'), conversation_id: conversationId, sender_id: senderId, body: body.trim(), created_at: nowIso() };
    state.messages.push(message);
    const sender = state.profiles.find((p) => p.id === senderId);
    for (const o of state.conversationMembers.filter((m) => m.conversation_id === conversationId && m.user_id !== senderId)) {
      pushNotification(state, { recipient_id: o.user_id, type: 'message', title: 'New message', body: `${sender?.full_name ?? 'Someone'}: ${body.slice(0, 80)}`, reference_id: conversationId });
    }
    await save(state);
    return message;
  },
  async search(userId: string, query: string, category?: string) {
    const state = await loadDemoState();
    const q = query.trim().toLowerCase();
    const circle = acceptedConnectionIds(state, userId);
    const visibleRecs = await this.getVisibleRecommendations(userId);
    const recommendedProIds = new Set(visibleRecs.map((r) => r.professional_id));
    const people = state.profiles.filter((p) => {
      if (p.id === userId || !circle.has(p.id)) return false;
      if (!q) return true;
      return p.full_name.toLowerCase().includes(q) || (p.city ?? '').toLowerCase().includes(q);
    });
    const networkProfessionals = state.professionals.filter((p) => {
      if (!recommendedProIds.has(p.id) && !state.personalTrusts.some((t) => t.user_id === userId && t.professional_id === p.id)) return false;
      if (category && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.location ?? '').toLowerCase().includes(q);
    });
    const generalProfessionals = state.professionals.filter((p) => {
      if (recommendedProIds.has(p.id)) return false;
      if (state.personalTrusts.some((t) => t.user_id === userId && t.professional_id === p.id)) return false;
      if (p.created_by !== userId) return false;
      if (category && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q);
    });
    return { people, networkProfessionals, generalProfessionals };
  },
  async deleteAccount(userId: string) {
    const state = await loadDemoState();
    const profile = state.profiles.find((p) => p.id === userId);
    if (profile) delete state.sessionPasswordByEmail[profile.email];
    state.profiles = state.profiles.filter((p) => p.id !== userId);
    state.connections = state.connections.filter((c) => c.requester_id !== userId && c.recipient_id !== userId);
    state.recommendations = state.recommendations.filter((r) => r.recommender_id !== userId);
    state.personalTrusts = state.personalTrusts.filter((t) => t.user_id !== userId);
    state.introductions = state.introductions.filter((i) => i.requester_id !== userId && i.intermediary_id !== userId);
    state.notifications = state.notifications.filter((n) => n.recipient_id !== userId);
    state.conversationMembers = state.conversationMembers.filter((m) => m.user_id !== userId);
    state.invitations = state.invitations.filter((i) => i.inviter_id !== userId);
    if (state.currentUserId === userId) state.currentUserId = null;
    await save(state);
  },
  async loadSampleNetwork(currentUserId: string) {
    const state = await loadDemoState();
    if (state.sampleDataLoaded) return state;
    const sarah: Profile = { id: createId('user'), email: 'sarah.demo@lifecircle.dev', full_name: 'Sarah Chen', avatar_url: null, bio: 'Friend and neighbour.', city: 'Austin', interests: ['Fitness', 'Home'], privacy: { ...DEFAULT_PRIVACY }, onboarding_completed: true, created_at: nowIso() };
    const james: Profile = { id: createId('user'), email: 'james.demo@lifecircle.dev', full_name: 'James Okonkwo', avatar_url: null, bio: 'Colleague with reliable recommendations.', city: 'Austin', interests: ['Finance'], privacy: { ...DEFAULT_PRIVACY }, onboarding_completed: true, created_at: nowIso() };
    state.profiles.push(sarah, james);
    state.sessionPasswordByEmail[sarah.email] = 'demo-only';
    state.sessionPasswordByEmail[james.email] = 'demo-only';
    state.connections.push(
      { id: createId('conn'), requester_id: currentUserId, recipient_id: sarah.id, status: 'accepted', created_at: nowIso(), updated_at: nowIso() },
      { id: createId('conn'), requester_id: james.id, recipient_id: currentUserId, status: 'accepted', created_at: nowIso(), updated_at: nowIso() },
    );
    const alex: Professional = { id: createId('pro'), owner_user_id: null, created_by: sarah.id, name: 'Alex Rivera', category: 'Personal Training and Fitness', bio: 'Strength coach focused on sustainable training.', location: 'Austin', website: null, contact_email: null, contact_phone: null, experience: 'Self-reported: 8 years coaching', availability: 'Weekday mornings', avatar_url: null, verification_status: 'unverified', created_at: nowIso() };
    const morgan: Professional = { id: createId('pro'), owner_user_id: null, created_by: james.id, name: 'Morgan Ellis', category: 'Electricians and Plumbers', bio: 'Residential electrician.', location: 'Austin', website: null, contact_email: null, contact_phone: null, experience: null, availability: null, avatar_url: null, verification_status: 'unverified', created_at: nowIso() };
    state.professionals.push(alex, morgan);
    state.recommendations.push(
      { id: createId('rec'), recommender_id: sarah.id, professional_id: alex.id, note: 'Helped me rebuild a consistent routine.', visibility: 'connections', status: 'active', created_at: nowIso() },
      { id: createId('rec'), recommender_id: james.id, professional_id: morgan.id, note: 'Fixed our panel upgrade quickly.', visibility: 'connections', status: 'active', created_at: nowIso() },
    );
    state.personalTrusts.push({ id: createId('trust'), user_id: james.id, professional_id: morgan.id, source_introduction_id: null, created_at: nowIso() });
    state.sampleDataLoaded = true;
    await save(state);
    return state;
  },
};
