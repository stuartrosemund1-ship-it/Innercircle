import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppNotification, Connection, Conversation, ConversationMember, DEFAULT_NOTIFICATION_PREFERENCES, DEFAULT_PRIVACY,
  IntroductionRequest, Invitation, JobMedia, Message, PersonalTrust, PrivacySettings,
  LifeTeamAsk, LifeTeamPick, LifeTeamRank, LifeTeamReply, LifeTeamSlot, Professional, ProfessionalApplicationInput, ProfessionalRecommendation, ProfessionalReference, ProfessionalReview, Profile, Report, ReportReason, ReportTargetType, ServiceRequest,
} from '@/types';
import { applicationIssues, assertPriceOrder, isApprovedProfessional } from '@/lib/application';
import { allowsNotification, budgetFits, deliverExternalNotification } from '@/lib/engagement';
import { LIFE_TEAM_ROLES } from '@/lib/lifeTeam';
import { createId, hashToken, nowIso } from '@/lib/id';

const STORAGE_KEY = 'lifecircle.demo.v6';

export interface DemoState {
  version: 6;
  environment: 'development-demo';
  currentUserId: string | null;
  sessionPasswordByEmail: Record<string, string>;
  profiles: Profile[];
  connections: Connection[];
  professionals: Professional[];
  references: ProfessionalReference[];
  recommendations: ProfessionalRecommendation[];
  personalTrusts: PersonalTrust[];
  introductions: IntroductionRequest[];
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
  messages: Message[];
  invitations: Invitation[];
  notifications: AppNotification[];
  reports: Report[];
  serviceRequests: ServiceRequest[];
  reviews: ProfessionalReview[];
  lifeTeamSlots: LifeTeamSlot[];
  lifeTeamPicks: LifeTeamPick[];
  lifeTeamAsks: LifeTeamAsk[];
  lifeTeamReplies: LifeTeamReply[];
  jobMedia: JobMedia[];
  sampleDataLoaded: boolean;
}

function emptyState(): DemoState {
  return {
    version: 6, environment: 'development-demo', currentUserId: null,
    sessionPasswordByEmail: {}, profiles: [], connections: [], professionals: [],
    references: [], recommendations: [], personalTrusts: [], introductions: [], conversations: [],
    conversationMembers: [], messages: [],     invitations: [], notifications: [], reports: [], serviceRequests: [], reviews: [],
    lifeTeamSlots: [], lifeTeamPicks: [], lifeTeamAsks: [], lifeTeamReplies: [], jobMedia: [],
    sampleDataLoaded: false,
  };
}

let memory: DemoState | null = null;
const listeners = new Set<() => void>();
export function subscribeDemo(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function emit() { listeners.forEach((l) => l()); }

export async function loadDemoState(): Promise<DemoState> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === 6) {
        parsed.references = parsed.references ?? [];
        parsed.reports = parsed.reports ?? [];
        parsed.serviceRequests = parsed.serviceRequests ?? [];
        parsed.reviews = parsed.reviews ?? [];
        parsed.lifeTeamSlots = parsed.lifeTeamSlots ?? [];
        parsed.lifeTeamPicks = parsed.lifeTeamPicks ?? [];
        parsed.lifeTeamAsks = parsed.lifeTeamAsks ?? [];
        parsed.lifeTeamReplies = parsed.lifeTeamReplies ?? [];
        parsed.jobMedia = parsed.jobMedia ?? [];
        memory = parsed;
        return memory;
      }
    }
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
  const recipient = state.profiles.find((profile) => profile.id === partial.recipient_id);
  const preferences = recipient?.notification_preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
  if (!allowsNotification(preferences, partial.type)) return;
  deliverExternalNotification(partial.type, partial.recipient_id);
  state.notifications.unshift({ id: createId('notif'), created_at: nowIso(), read_at: null, ...partial });
}

function teamProfessional(name: string, role: string, category: Professional['category'], min: number, max: number, unit: Professional['pricing_unit'], verified: boolean, createdBy: string): Professional {
  const now = nowIso();
  return {
    id: createId('pro'), owner_user_id: createdBy, created_by: createdBy, name, category,
    bio: `${role} based in Bristol.`, location: 'Bristol', website: null, contact_email: null, contact_phone: null,
    experience: null, availability: null, avatar_url: null, years_experience: 8, licence_number: null, licence_issuer: null,
    service_area: 'Bristol', photo_id_path: null, insurance_doc_path: null, qualification_doc_path: null, conduct_accepted_at: now,
    application_status: 'approved', application_rejection_reason: null, application_submitted_at: now, application_reviewed_at: now,
    price_min: min, price_max: max, currency: 'GBP', pricing_unit: unit, pricing_notes: null,
    qualifications: [role], portfolio: [], typical_response_time: 'Usually replies within a day', life_role: role,
    verification_status: verified ? 'verified' : 'unverified', is_verified: verified, verified_at: verified ? now : null, created_at: now,
  };
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
      avatar_url: null, bio: null, city: null, interests: [],       privacy: { ...DEFAULT_PRIVACY },
      onboarding_completed: false, is_admin: false, terms_accepted_at: nowIso(), notification_preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }, created_at: nowIso(),
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
  async resetPassword(_email: string) {
    throw new Error('Password reset emails require Supabase Auth.');
  },
  async findProfileByEmail(email: string) {
    const state = await loadDemoState();
    return state.profiles.find((profile) => profile.email === email.trim().toLowerCase()) ?? null;
  },
  async updateProfile(userId: string, patch: Partial<Profile>) {
    const state = await loadDemoState();
    const idx = state.profiles.findIndex((p) => p.id === userId);
    if (idx < 0) throw new Error('Profile not found');
    const safe = { ...patch };
    delete safe.is_admin;
    state.profiles[idx] = { ...state.profiles[idx], ...safe, id: userId, is_admin: state.profiles[idx].is_admin };
    await save(state);
    return state.profiles[idx];
  },
  async updatePrivacy(userId: string, privacy: PrivacySettings) { return this.updateProfile(userId, { privacy }); },
  async setDemoAdmin(userId: string, enabled: boolean) {
    const state = await loadDemoState();
    if (state.currentUserId !== userId) throw new Error('Not authorized');
    const profile = state.profiles.find((item) => item.id === userId);
    if (!profile) throw new Error('Profile not found');
    profile.is_admin = enabled;
    await save(state);
    return profile;
  },
  async fileReport(userId: string, input: { targetType: ReportTargetType; targetId: string; reason: ReportReason; details: string | null }) {
    const state = await loadDemoState();
    if (input.targetType === 'person' && input.targetId === userId) throw new Error('You cannot report yourself.');
    if (input.targetType === 'person' && !state.profiles.some((profile) => profile.id === input.targetId)) throw new Error('Person not found');
    if (input.targetType === 'professional' && !state.professionals.some((professional) => professional.id === input.targetId)) throw new Error('Professional not found');
    if (input.targetType === 'job_media' && !state.jobMedia.some((item) => item.id === input.targetId)) throw new Error('Media not found');
    const report: Report = {
      id: createId('report'), reporter_id: userId, target_type: input.targetType,
      target_profile_id: input.targetType === 'person' ? input.targetId : null,
      target_professional_id: input.targetType === 'professional' ? input.targetId : (input.targetType === 'job_media' ? state.jobMedia.find((item) => item.id === input.targetId)?.professional_id ?? null : null),
      target_media_id: input.targetType === 'job_media' ? input.targetId : null,
      reason: input.reason, details: input.details?.trim() || null, status: 'open',
      resolution_note: null, created_at: nowIso(), resolved_at: null, resolved_by: null,
    };
    state.reports.push(report);
    await save(state);
    return report;
  },
  async adminDecideApplication(userId: string, professionalId: string, decision: 'approved' | 'rejected', reason: string | null) {
    const state = await loadDemoState();
    const admin = state.profiles.find((profile) => profile.id === userId);
    if (!admin?.is_admin || state.currentUserId !== userId) throw new Error('Not authorized');
    const professional = state.professionals.find((item) => item.id === professionalId);
    if (!professional) throw new Error('Application not found');
    if (decision === 'rejected' && !reason?.trim()) throw new Error('A rejection reason is required');
    if (decision === 'approved') {
      if (professional.price_min == null || professional.price_max == null || !professional.pricing_unit) throw new Error('A price range is required before approval');
      const refs = state.references.filter((reference) => reference.professional_id === professionalId);
      if (!refs.some((reference) => reference.status === 'confirmed')) throw new Error('At least one confirmed reference is required before approval');
      if (refs.some((reference) => reference.status === 'requested')) throw new Error('Outstanding reference requests must be confirmed before approval');
      professional.application_status = 'approved';
      professional.application_rejection_reason = null;
    } else {
      professional.application_status = 'rejected';
      professional.application_rejection_reason = reason!.trim();
      professional.is_verified = false;
      professional.verified_at = null;
      professional.verification_status = 'unverified';
    }
    professional.application_reviewed_at = nowIso();
    await save(state);
    return professional;
  },
  async adminSetVerified(userId: string, professionalId: string, verified: boolean) {
    const state = await loadDemoState();
    const admin = state.profiles.find((profile) => profile.id === userId);
    if (!admin?.is_admin || state.currentUserId !== userId) throw new Error('Not authorized');
    const professional = state.professionals.find((item) => item.id === professionalId);
    if (!professional) throw new Error('Application not found');
    if (verified && professional.application_status !== 'approved') throw new Error('Only approved professionals can be verified');
    professional.is_verified = verified;
    professional.verified_at = verified ? (professional.verified_at ?? nowIso()) : null;
    professional.verification_status = verified ? 'verified' : 'unverified';
    await save(state);
    return professional;
  },
  async adminResolveReport(userId: string, reportId: string, status: 'resolved' | 'dismissed', note: string | null) {
    const state = await loadDemoState();
    const admin = state.profiles.find((profile) => profile.id === userId);
    if (!admin?.is_admin || state.currentUserId !== userId) throw new Error('Not authorized');
    const report = state.reports.find((item) => item.id === reportId);
    if (!report || report.status !== 'open') throw new Error('Open report not found');
    report.status = status;
    report.resolution_note = note?.trim() || null;
    report.resolved_at = nowIso();
    report.resolved_by = userId;
    pushNotification(state, {
      recipient_id: report.reporter_id,
      type: 'report_resolved',
      title: status === 'resolved' ? 'Report resolved' : 'Report dismissed',
      body: 'An admin closed a report you sent.',
      reference_id: report.id,
    });
    await save(state);
    return report;
  },
  async createServiceRequest(userId: string, input: { professionalId: string; serviceNeeded: string; preferredDates: string; location: string; budget: number | null; notes: string | null }) {
    const state = await loadDemoState();
    const professional = state.professionals.find((item) => item.id === input.professionalId);
    if (!professional || !isApprovedProfessional(professional)) throw new Error('You can only request a quote from an approved professional.');
    if (!input.serviceNeeded.trim() || !input.preferredDates.trim() || !input.location.trim()) throw new Error('Service, dates, and location are required.');
    if (input.budget == null || !budgetFits(input.budget, professional.price_min, professional.price_max)) throw new Error('Choose a budget inside the published price range.');
    const request: ServiceRequest = {
      id: createId('req'), professional_id: professional.id, member_id: userId,
      service_needed: input.serviceNeeded.trim(), preferred_dates: input.preferredDates.trim(),
      location: input.location.trim(), budget: input.budget, notes: input.notes?.trim() || null,
      status: 'pending', proposed_time: null, created_at: nowIso(), updated_at: nowIso(),
    };
    state.serviceRequests.push(request);
    const member = state.profiles.find((profile) => profile.id === userId);
    const owner = professional.owner_user_id ?? professional.created_by;
    if (owner && owner !== userId) {
      pushNotification(state, { recipient_id: owner, type: 'service_request', title: 'New quote request', body: `${member?.full_name ?? 'A member'} asked ${professional.name} for a quote.`, reference_id: request.id });
    }
    await save(state);
    return request;
  },
  async respondServiceRequest(userId: string, requestId: string, action: 'accepted' | 'declined' | 'proposed' | 'completed' | 'cancelled', proposedTime: string | null = null) {
    const state = await loadDemoState();
    const request = state.serviceRequests.find((item) => item.id === requestId);
    if (!request) throw new Error('Request not found');
    const professional = state.professionals.find((item) => item.id === request.professional_id);
    if (!professional) throw new Error('Professional not found');
    const owns = professional.created_by === userId || professional.owner_user_id === userId;
    const isMember = request.member_id === userId;
    if (action === 'cancelled') {
      if (!isMember || request.status !== 'pending') throw new Error('Only a waiting request can be cancelled.');
    } else if (action === 'completed') {
      if (!(owns || isMember) || (request.status !== 'accepted' && request.status !== 'proposed')) throw new Error('Complete the request after it has been accepted.');
    } else {
      if (!owns || request.status !== 'pending') throw new Error('Only the professional can reply to a new request.');
      if (action === 'proposed' && !proposedTime?.trim()) throw new Error('Propose a time.');
    }
    request.status = action;
    request.proposed_time = action === 'proposed' ? proposedTime!.trim() : request.proposed_time;
    request.updated_at = nowIso();
    const actor = state.profiles.find((profile) => profile.id === userId);
    const recipient = owns ? request.member_id : (professional.owner_user_id ?? professional.created_by);
    if (recipient && recipient !== userId) {
      pushNotification(state, {
        recipient_id: recipient,
        type: 'service_request_update',
        title: 'Quote request updated',
        body: `${actor?.full_name ?? 'Someone'} marked the request for ${professional.name} as ${action === 'proposed' ? `proposed: ${request.proposed_time}` : action}.`,
        reference_id: request.id,
      });
    }
    await save(state);
    return request;
  },
  async createReview(userId: string, professionalId: string, rating: number, body: string) {
    const state = await loadDemoState();
    const professional = state.professionals.find((item) => item.id === professionalId);
    if (!professional) throw new Error('Professional not found');
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) throw new Error('Choose a rating from 1 to 5.');
    if (!body.trim()) throw new Error('Write a short review.');
    if (state.reviews.some((review) => review.author_id === userId && review.professional_id === professionalId)) throw new Error('You have already reviewed this professional.');
    const completed = state.serviceRequests.some((request) => request.member_id === userId && request.professional_id === professionalId && request.status === 'completed');
    const introduced = state.introductions.some((intro) => intro.requester_id === userId && intro.professional_id === professionalId && intro.status === 'accepted');
    if (!completed && !introduced) throw new Error('A completed booking or an accepted introduction is required before you can review.');
    const review: ProfessionalReview = {
      id: createId('review'), professional_id: professionalId, author_id: userId, rating, body: body.trim(),
      owner_reply: null, replied_at: null, created_at: nowIso(),
    };
    state.reviews.push(review);
    await save(state);
    return review;
  },
  async replyToReview(userId: string, reviewId: string, reply: string) {
    const state = await loadDemoState();
    const review = state.reviews.find((item) => item.id === reviewId);
    if (!review) throw new Error('Review not found');
    const professional = state.professionals.find((item) => item.id === review.professional_id);
    if (!professional || (professional.created_by !== userId && professional.owner_user_id !== userId)) throw new Error('Only the professional can reply.');
    if (!reply.trim()) throw new Error('Write a reply.');
    review.owner_reply = reply.trim();
    review.replied_at = nowIso();
    await save(state);
    return review;
  },
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
  async submitProfessionalApplication(userId: string, input: ProfessionalApplicationInput) {
    const state = await loadDemoState();
    assertPriceOrder(input.price_min, input.price_max);
    const refereeIds = [...new Set(input.referee_ids)];
    if (input.submit) {
      const issues = applicationIssues({ ...input, referee_ids: refereeIds });
      if (issues.length) throw new Error(issues[0]);
    }
    for (const refereeId of refereeIds) {
      if (refereeId === userId) throw new Error('You cannot vouch for your own application.');
      if (!areConnected(state, userId, refereeId)) throw new Error('References must be people you are already connected with.');
    }
    if (refereeIds.length > 2) throw new Error('Choose at most 2 references.');
    const now = nowIso();
    const professional: Professional = {
      id: createId('pro'), owner_user_id: userId, created_by: userId,
      name: input.name.trim(), category: input.category, bio: input.bio, location: input.location,
      website: input.website, contact_email: input.contact_email, contact_phone: input.contact_phone,
      experience: input.experience, availability: input.availability, avatar_url: input.avatar_url,
      years_experience: input.years_experience, licence_number: input.licence_number?.trim() || null,
      licence_issuer: input.licence_issuer?.trim() || null, service_area: input.service_area?.trim() || null,
      photo_id_path: input.photo_id_path, insurance_doc_path: input.insurance_doc_path,
      qualification_doc_path: input.qualification_doc_path,
      conduct_accepted_at: input.conduct_accepted ? now : null,
      application_status: 'draft', application_rejection_reason: null,
      application_submitted_at: null, application_reviewed_at: null,
      qualifications: [], portfolio: [], typical_response_time: null, life_role: null,
      price_min: input.price_min, price_max: input.price_max, currency: input.currency,
      pricing_unit: input.pricing_unit, pricing_notes: input.pricing_notes?.trim() || null,
      verification_status: 'unverified', is_verified: false, verified_at: null, created_at: now,
    };
    state.professionals.push(professional);
    for (const refereeId of refereeIds) {
      const reference: ProfessionalReference = {
        id: createId('ref'), professional_id: professional.id, applicant_id: userId, referee_id: refereeId,
        status: 'requested', note: null, created_at: now, responded_at: null,
      };
      state.references.push(reference);
      pushNotification(state, {
        recipient_id: refereeId, type: 'reference_request', title: 'Reference requested',
        body: `${state.profiles.find((profile) => profile.id === userId)?.full_name ?? 'A connection'} asked you to vouch for ${professional.name}.`,
        reference_id: reference.id,
      });
    }
    if (input.submit) {
      professional.application_status = 'pending';
      professional.application_submitted_at = now;
    }
    await save(state);
    return professional;
  },
  async finalizeProfessionalApplication(userId: string, professionalId: string) {
    const state = await loadDemoState();
    const professional = state.professionals.find((item) => item.id === professionalId);
    if (!professional || (professional.created_by !== userId && professional.owner_user_id !== userId)) throw new Error('Not authorized');
    if (professional.application_status !== 'draft') throw new Error('Only a draft application can be submitted.');
    const refereeIds = state.references.filter((reference) => reference.professional_id === professionalId).map((reference) => reference.referee_id);
    const issues = applicationIssues({
      name: professional.name, category: professional.category, bio: professional.bio, location: professional.location,
      website: professional.website, contact_email: professional.contact_email, contact_phone: professional.contact_phone,
      experience: professional.experience, availability: professional.availability, avatar_url: professional.avatar_url,
      years_experience: professional.years_experience, licence_number: professional.licence_number,
      licence_issuer: professional.licence_issuer, service_area: professional.service_area,
      photo_id_path: professional.photo_id_path, insurance_doc_path: professional.insurance_doc_path,
      qualification_doc_path: professional.qualification_doc_path, conduct_accepted: Boolean(professional.conduct_accepted_at),
      price_min: professional.price_min, price_max: professional.price_max, currency: professional.currency,
      pricing_unit: professional.pricing_unit, pricing_notes: professional.pricing_notes,
      referee_ids: refereeIds, submit: true,
    });
    if (issues.length) throw new Error(issues[0]);
    professional.application_status = 'pending';
    professional.application_submitted_at = nowIso();
    await save(state);
    return professional;
  },
  async respondProfessionalReference(referenceId: string, userId: string, confirm: boolean) {
    const state = await loadDemoState();
    const reference = state.references.find((item) => item.id === referenceId);
    if (!reference || reference.referee_id !== userId) throw new Error('Not authorized');
    if (reference.status !== 'requested') throw new Error('This reference is no longer open.');
    reference.status = confirm ? 'confirmed' : 'declined';
    reference.responded_at = nowIso();
    const professional = state.professionals.find((item) => item.id === reference.professional_id);
    const referee = state.profiles.find((profile) => profile.id === userId);
    pushNotification(state, {
      recipient_id: reference.applicant_id,
      type: 'reference_request',
      title: confirm ? 'Reference confirmed' : 'Reference declined',
      body: `${referee?.full_name ?? 'A connection'} ${confirm ? 'vouched for' : 'declined to vouch for'} ${professional?.name ?? 'your application'}.`,
      reference_id: reference.id,
    });
    await save(state);
    return reference;
  },
  async recommendProfessional(recommenderId: string, professionalId: string, note: string | null, visibility: ProfessionalRecommendation['visibility']) {
    const state = await loadDemoState();
    const professional = state.professionals.find((item) => item.id === professionalId);
    if (!professional || !isApprovedProfessional(professional)) throw new Error('Only approved professionals can be recommended.');
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
    const requested = state.professionals.find((item) => item.id === professionalId);
    if (!requested || !isApprovedProfessional(requested)) throw new Error('Introductions are available once a professional is approved.');
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
      if (!isApprovedProfessional(p)) return false;
      if (!recommendedProIds.has(p.id) && !state.personalTrusts.some((t) => t.user_id === userId && t.professional_id === p.id)) return false;
      if (category && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.location ?? '').toLowerCase().includes(q);
    });
    const generalProfessionals = state.professionals.filter((p) => {
      if (!isApprovedProfessional(p)) return false;
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
    state.references = state.references.filter((r) => r.applicant_id !== userId && r.referee_id !== userId);
    state.personalTrusts = state.personalTrusts.filter((t) => t.user_id !== userId);
    state.introductions = state.introductions.filter((i) => i.requester_id !== userId && i.intermediary_id !== userId);
    state.notifications = state.notifications.filter((n) => n.recipient_id !== userId);
    state.conversationMembers = state.conversationMembers.filter((m) => m.user_id !== userId);
    state.invitations = state.invitations.filter((i) => i.inviter_id !== userId);
    state.reports = state.reports.filter((report) => report.reporter_id !== userId);
    state.professionals = state.professionals.filter((professional) => professional.created_by !== userId && professional.owner_user_id !== userId);
    state.messages = state.messages.filter((message) => message.sender_id !== userId);
    state.serviceRequests = state.serviceRequests.filter((request) => request.member_id !== userId);
    state.reviews = state.reviews.filter((review) => review.author_id !== userId);
    const ownedSlots = new Set(state.lifeTeamSlots.filter((slot) => slot.owner_id === userId).map((slot) => slot.id));
    state.lifeTeamSlots = state.lifeTeamSlots.filter((slot) => slot.owner_id !== userId);
    state.lifeTeamPicks = state.lifeTeamPicks.filter((pick) => !ownedSlots.has(pick.slot_id));
    state.lifeTeamAsks = state.lifeTeamAsks.filter((ask) => ask.asker_id !== userId);
    state.lifeTeamReplies = state.lifeTeamReplies.filter((reply) => reply.replier_id !== userId);
    if (state.currentUserId === userId) state.currentUserId = null;
    await save(state);
  },
  async addJobMedia(userId: string, input: Omit<JobMedia, 'id' | 'uploaded_by' | 'consent_status' | 'created_at' | 'template'> & { template?: JobMedia['template'] }) {
    const state = await loadDemoState();
    const professional = state.professionals.find((item) => item.id === input.professional_id);
    if (!professional) throw new Error('Professional not found');
    const owns = professional.created_by === userId || professional.owner_user_id === userId;
    const request = input.service_request_id ? state.serviceRequests.find((item) => item.id === input.service_request_id) : null;
    if (input.service_request_id && (!request || request.status !== 'completed' || request.professional_id !== professional.id)) throw new Error('Link media to a completed job.');
    const customer = request?.member_id === userId;
    if (!owns && !customer) throw new Error('Not authorized');
    if (input.kind === 'video' && (input.duration_seconds == null || input.duration_seconds > 60)) throw new Error('Videos must be 60 seconds or shorter.');
    if (input.kind === 'summary' && !input.summary_text?.trim()) throw new Error('Write a case summary with no client names.');
    const media: JobMedia = {
      ...input,
      id: createId('media'),
      uploaded_by: userId,
      template: input.template ?? 'portfolio',
      summary_text: input.summary_text?.trim() || null,
      consent_status: customer || !input.service_request_id ? 'approved' : 'pending',
      created_at: nowIso(),
    };
    state.jobMedia.push(media);
    if (media.consent_status === 'pending' && request) {
      pushNotification(state, { recipient_id: request.member_id, type: 'service_request_update', title: 'Approve job photos?', body: `${professional.name} wants to show a completed job. Nothing is public until you agree.`, reference_id: media.id });
    }
    await save(state);
    return media;
  },
  async consentJobMedia(userId: string, mediaId: string, approve: boolean) {
    const state = await loadDemoState();
    const media = state.jobMedia.find((item) => item.id === mediaId);
    if (!media || !media.service_request_id) throw new Error('Nothing to approve');
    const request = state.serviceRequests.find((item) => item.id === media.service_request_id);
    if (!request || request.member_id !== userId) throw new Error('Only the customer can approve this');
    if (media.consent_status !== 'pending') throw new Error('This has already been decided');
    media.consent_status = approve ? 'approved' : 'declined';
    await save(state);
    return media;
  },
  async adminRemoveJobMedia(userId: string, mediaId: string) {
    const state = await loadDemoState();
    const admin = state.profiles.find((profile) => profile.id === userId);
    if (!admin?.is_admin) throw new Error('Not authorized');
    state.jobMedia = state.jobMedia.filter((item) => item.id !== mediaId);
    await save(state);
  },
  async ensureLifeTeam(userId: string) {
    const state = await loadDemoState();
    const mine = state.lifeTeamSlots.filter((slot) => slot.owner_id === userId);
    if (mine.length > 0) return state;
    const now = nowIso();
    for (const profession of LIFE_TEAM_ROLES) {
      state.lifeTeamSlots.push({ id: createId('slot'), owner_id: userId, profession, custom: false, created_at: now });
    }
    await save(state);
    return state;
  },
  async addLifeTeamSlot(userId: string, profession: string) {
    const state = await loadDemoState();
    const name = profession.trim();
    if (!name) throw new Error('Name the profession.');
    if (state.lifeTeamSlots.some((slot) => slot.owner_id === userId && slot.profession.toLowerCase() === name.toLowerCase())) throw new Error('You already have that slot.');
    const slot: LifeTeamSlot = { id: createId('slot'), owner_id: userId, profession: name, custom: true, created_at: nowIso() };
    state.lifeTeamSlots.push(slot);
    await save(state);
    return slot;
  },
  async setLifeTeamPick(userId: string, slotId: string, professionalId: string, rank?: LifeTeamRank) {
    const state = await loadDemoState();
    const slot = state.lifeTeamSlots.find((item) => item.id === slotId);
    if (!slot || slot.owner_id !== userId) throw new Error('Only you can choose who is in your Life Team.');
    const professional = state.professionals.find((item) => item.id === professionalId);
    if (!professional || !isApprovedProfessional(professional)) throw new Error('Only approved professionals can fill a slot.');
    const existing = state.lifeTeamPicks.filter((pick) => pick.slot_id === slotId);
    if (existing.some((pick) => pick.professional_id === professionalId)) throw new Error('They are already in this slot.');
    const nextRank = (rank ?? ((existing.length === 0 ? 1 : Math.max(...existing.map((pick) => pick.rank)) + 1) as LifeTeamRank));
    if (nextRank < 1 || nextRank > 3) throw new Error('A slot holds a #1 and up to two backups.');
    if (existing.some((pick) => pick.rank === nextRank)) throw new Error('That place is already filled.');
    state.lifeTeamPicks.push({ id: createId('pick'), slot_id: slotId, professional_id: professionalId, rank: nextRank as LifeTeamRank, created_at: nowIso() });
    await save(state);
    return state;
  },
  async moveLifeTeamPick(userId: string, slotId: string, professionalId: string, direction: 'up' | 'down') {
    const state = await loadDemoState();
    const slot = state.lifeTeamSlots.find((item) => item.id === slotId);
    if (!slot || slot.owner_id !== userId) throw new Error('Only you can reorder your Life Team.');
    const mine = state.lifeTeamPicks.filter((pick) => pick.slot_id === slotId).sort((a, b) => a.rank - b.rank);
    const index = mine.findIndex((pick) => pick.professional_id === professionalId);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= mine.length) return state;
    const rank = mine[index].rank;
    mine[index].rank = mine[swapWith].rank;
    mine[swapWith].rank = rank;
    await save(state);
    return state;
  },
  async removeLifeTeamPick(userId: string, slotId: string, professionalId: string) {
    const state = await loadDemoState();
    const slot = state.lifeTeamSlots.find((item) => item.id === slotId);
    if (!slot || slot.owner_id !== userId) throw new Error('Only you can change your Life Team.');
    state.lifeTeamPicks = state.lifeTeamPicks.filter((pick) => !(pick.slot_id === slotId && pick.professional_id === professionalId));
    const remaining = state.lifeTeamPicks.filter((pick) => pick.slot_id === slotId).sort((a, b) => a.rank - b.rank);
    remaining.forEach((pick, index) => { pick.rank = (index + 1) as LifeTeamRank; });
    await save(state);
    return state;
  },
  async askLifeTeam(userId: string, slotId: string) {
    const state = await loadDemoState();
    const slot = state.lifeTeamSlots.find((item) => item.id === slotId);
    if (!slot || slot.owner_id !== userId) throw new Error('Only you can ask your circle.');
    if (state.lifeTeamAsks.some((ask) => ask.slot_id === slotId && ask.status === 'open')) throw new Error('You already asked about this slot.');
    const ask: LifeTeamAsk = { id: createId('ask'), slot_id: slotId, asker_id: userId, profession: slot.profession, status: 'open', created_at: nowIso() };
    state.lifeTeamAsks.push(ask);
    const asker = state.profiles.find((profile) => profile.id === userId);
    for (const connection of state.connections) {
      if (connection.status !== 'accepted') continue;
      if (connection.requester_id !== userId && connection.recipient_id !== userId) continue;
      const other = connection.requester_id === userId ? connection.recipient_id : connection.requester_id;
      pushNotification(state, { recipient_id: other, type: 'life_team_ask', title: `Who's your ${slot.profession.toLowerCase()}?`, body: `${asker?.full_name ?? 'A connection'} asked who you trust.`, reference_id: ask.id });
    }
    await save(state);
    return ask;
  },
  async replyLifeTeamAsk(userId: string, askId: string, professionalId: string) {
    const state = await loadDemoState();
    const ask = state.lifeTeamAsks.find((item) => item.id === askId);
    if (!ask || ask.status !== 'open') throw new Error('That ask is closed.');
    const connected = state.connections.some((connection) => connection.status === 'accepted' && ((connection.requester_id === userId && connection.recipient_id === ask.asker_id) || (connection.recipient_id === userId && connection.requester_id === ask.asker_id)));
    if (!connected) throw new Error('Only people in their circle can reply.');
    const professional = state.professionals.find((item) => item.id === professionalId);
    if (!professional || !isApprovedProfessional(professional)) throw new Error('Recommend an approved professional.');
    if (state.lifeTeamReplies.some((reply) => reply.ask_id === askId && reply.replier_id === userId)) throw new Error('You already replied.');
    const reply: LifeTeamReply = { id: createId('reply'), ask_id: askId, replier_id: userId, professional_id: professionalId, note: null, created_at: nowIso() };
    state.lifeTeamReplies.push(reply);
    const replier = state.profiles.find((profile) => profile.id === userId);
    pushNotification(state, { recipient_id: ask.asker_id, type: 'life_team_reply', title: 'A Life Team suggestion', body: `${replier?.full_name ?? 'A connection'} suggested ${professional.name} as their ${ask.profession.toLowerCase()}.`, reference_id: reply.id });
    await save(state);
    return reply;
  },
  async loadSampleNetwork(currentUserId: string) {
    const state = await loadDemoState();
    if (state.sampleDataLoaded) return state;
    const sarah: Profile = { id: createId('user'), email: 'sarah.demo@lifecircle.dev', full_name: 'Sarah Chen', avatar_url: null, bio: 'Friend and neighbour.', city: 'Bristol', interests: ['Fitness', 'Home'], privacy: { ...DEFAULT_PRIVACY }, notification_preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }, onboarding_completed: true, is_admin: false, terms_accepted_at: nowIso(), created_at: nowIso() };
    const james: Profile = { id: createId('user'), email: 'james.demo@lifecircle.dev', full_name: 'James Okonkwo', avatar_url: null, bio: 'Colleague with reliable recommendations.', city: 'Bristol', interests: ['Finance'], privacy: { ...DEFAULT_PRIVACY }, notification_preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }, onboarding_completed: true, is_admin: false, terms_accepted_at: nowIso(), created_at: nowIso() };
    state.profiles.push(sarah, james);
    state.sessionPasswordByEmail[sarah.email] = 'demo-only';
    state.sessionPasswordByEmail[james.email] = 'demo-only';
    state.connections.push(
      { id: createId('conn'), requester_id: currentUserId, recipient_id: sarah.id, status: 'accepted', created_at: nowIso(), updated_at: nowIso() },
      { id: createId('conn'), requester_id: james.id, recipient_id: currentUserId, status: 'accepted', created_at: nowIso(), updated_at: nowIso() },
    );
    const reviewedAt = nowIso();
    const alex: Professional = {
      id: createId('pro'), owner_user_id: null, created_by: sarah.id, name: 'Alex Rivera', category: 'Personal Training and Fitness',
      bio: 'Strength coach focused on sustainable training.', location: 'Bristol', website: null, contact_email: null, contact_phone: null,
      experience: '8 years coaching', availability: 'Weekday mornings', avatar_url: null,
      years_experience: 8, licence_number: 'PT-18420', licence_issuer: 'CIMSPA', service_area: 'Bristol and surrounding towns',
      photo_id_path: 'professionals/sample/photo-id/alex-rivera.jpg', insurance_doc_path: 'professionals/sample/insurance/alex-rivera.pdf',
      qualification_doc_path: 'professionals/sample/qualification/alex-rivera.pdf', conduct_accepted_at: reviewedAt,
      application_status: 'approved', application_rejection_reason: null, application_submitted_at: reviewedAt, application_reviewed_at: reviewedAt,
      price_min: 40, price_max: 60, currency: 'GBP', pricing_unit: 'per_session', pricing_notes: 'First session includes a movement screen.',
      qualifications: ['CIMSPA', 'Level 3 Personal Trainer', 'First aid'],
      portfolio: [
        { title: 'Strength block', caption: 'A twelve-week plan for a home gym in Bristol.' },
        { title: 'Form check', caption: 'Squat and hinge review, with two follow-up sessions.' },
        { title: 'Return to training', caption: 'A gentle restart after a desk-job back flare.' },
      ],
      typical_response_time: 'Usually replies within a day', life_role: 'Personal trainer',
      verification_status: 'verified', is_verified: true, verified_at: reviewedAt, created_at: reviewedAt,
    };
    const morgan: Professional = {
      id: createId('pro'), owner_user_id: currentUserId, created_by: currentUserId, name: 'Morgan Ellis', category: 'Electricians and Plumbers',
      bio: 'Residential electrician applying to join the circle.', location: 'Bristol', website: null, contact_email: null, contact_phone: null,
      experience: '11 years on domestic installs', availability: 'Weekday afternoons', avatar_url: null,
      years_experience: 11, licence_number: 'NICEIC-5521', licence_issuer: 'NICEIC', service_area: 'Bristol',
      photo_id_path: 'professionals/sample/photo-id/morgan-ellis.jpg', insurance_doc_path: null,
      qualification_doc_path: 'professionals/sample/qualification/morgan-ellis.pdf', conduct_accepted_at: reviewedAt,
      application_status: 'pending', application_rejection_reason: null, application_submitted_at: reviewedAt, application_reviewed_at: null,
      price_min: 80, price_max: 120, currency: 'GBP', pricing_unit: 'per_hour', pricing_notes: 'Call-out is included in the first hour.',
      qualifications: ['NICEIC'], portfolio: [{ title: 'Kitchen rewire', caption: 'A full domestic rewire, finished in five days.' }], typical_response_time: 'Usually replies within two days', life_role: 'Electrician',
      verification_status: 'unverified', is_verified: false, verified_at: null, created_at: reviewedAt,
    };
    const priya: Professional = {
      id: createId('pro'), owner_user_id: sarah.id, created_by: sarah.id, name: 'Priya Nair', category: 'Accountants and Financial Advisers',
      bio: 'Chartered accountant for small practices.', location: 'Bristol', website: null, contact_email: null, contact_phone: null,
      experience: '14 years', availability: 'Weekdays', avatar_url: null,
      years_experience: 14, licence_number: 'ICAEW-229184', licence_issuer: 'ICAEW', service_area: 'Bristol and Bath',
      photo_id_path: 'professionals/sample/photo-id/priya-nair.jpg', insurance_doc_path: 'professionals/sample/insurance/priya-nair.pdf',
      qualification_doc_path: 'professionals/sample/qualification/priya-nair.pdf', conduct_accepted_at: reviewedAt,
      application_status: 'pending', application_rejection_reason: null, application_submitted_at: reviewedAt, application_reviewed_at: null,
      price_min: 55, price_max: 90, currency: 'GBP', pricing_unit: 'per_session', pricing_notes: 'A first meeting is charged at the lower rate.',
      qualifications: ['ICAEW'], portfolio: [], typical_response_time: 'Usually replies within a day', life_role: 'Accountant',
      verification_status: 'unverified', is_verified: false, verified_at: null, created_at: reviewedAt,
    };
    const sam: Professional = {
      id: createId('pro'), owner_user_id: james.id, created_by: james.id, name: 'Sam Brooks', category: 'Home Maintenance',
      bio: 'Handyman for small household jobs.', location: 'Bristol', website: null, contact_email: null, contact_phone: null,
      experience: '4 years', availability: null, avatar_url: null,
      years_experience: 4, licence_number: 'HM-1002', licence_issuer: 'Self-declared', service_area: 'South Bristol',
      photo_id_path: 'professionals/sample/photo-id/sam-brooks.jpg', insurance_doc_path: 'professionals/sample/insurance/sam-brooks.pdf',
      qualification_doc_path: null, conduct_accepted_at: reviewedAt,
      application_status: 'rejected',       application_rejection_reason: 'The insurance document did not match the name on the application.', application_submitted_at: reviewedAt, application_reviewed_at: reviewedAt,
      price_min: 30, price_max: 45, currency: 'GBP', pricing_unit: 'per_hour', pricing_notes: null,
      qualifications: [], portfolio: [], typical_response_time: null, life_role: 'Builder',
      verification_status: 'unverified', is_verified: false, verified_at: null, created_at: reviewedAt,
    };
    state.professionals.push(alex, morgan, priya, sam);
    state.references.push(
      { id: createId('ref'), professional_id: priya.id, applicant_id: sarah.id, referee_id: currentUserId, status: 'confirmed', note: 'Priya does our year-end accounts.', created_at: reviewedAt, responded_at: reviewedAt },
      { id: createId('ref'), professional_id: priya.id, applicant_id: sarah.id, referee_id: james.id, status: 'confirmed', note: null, created_at: reviewedAt, responded_at: reviewedAt },
    );
    state.reports.push({
      id: createId('report'), reporter_id: james.id, target_type: 'professional', target_profile_id: null, target_professional_id: morgan.id,
      reason: 'false_credentials', details: 'Please check the registration number before approval.', status: 'open', target_media_id: null,
      resolution_note: null, created_at: reviewedAt, resolved_at: null, resolved_by: null,
    });
    state.references.push(
      { id: createId('ref'), professional_id: alex.id, applicant_id: sarah.id, referee_id: currentUserId, status: 'confirmed', note: 'I have trained with Alex.', created_at: reviewedAt, responded_at: reviewedAt },
      { id: createId('ref'), professional_id: alex.id, applicant_id: sarah.id, referee_id: james.id, status: 'confirmed', note: null, created_at: reviewedAt, responded_at: reviewedAt },
      { id: createId('ref'), professional_id: morgan.id, applicant_id: currentUserId, referee_id: sarah.id, status: 'confirmed', note: 'Morgan rewired our kitchen.', created_at: reviewedAt, responded_at: reviewedAt },
      { id: createId('ref'), professional_id: morgan.id, applicant_id: currentUserId, referee_id: james.id, status: 'requested', note: null, created_at: reviewedAt, responded_at: null },
    );
    state.recommendations.push(
      { id: createId('rec'), recommender_id: sarah.id, professional_id: alex.id, note: 'Helped me rebuild a consistent routine.', visibility: 'connections', status: 'active', created_at: nowIso() },
      { id: createId('rec'), recommender_id: james.id, professional_id: morgan.id, note: 'Fixed our panel upgrade quickly.', visibility: 'connections', status: 'active', created_at: nowIso() },
    );
    state.personalTrusts.push({ id: createId('trust'), user_id: james.id, professional_id: morgan.id, source_introduction_id: null, created_at: nowIso() });
    const completedSarah: ServiceRequest = { id: createId('req'), professional_id: alex.id, member_id: sarah.id, service_needed: 'Twelve-week strength plan', preferred_dates: 'March weekdays', location: 'Bristol', budget: 50, notes: 'Home gym, two sessions a week.', status: 'completed', proposed_time: null, created_at: reviewedAt, updated_at: reviewedAt };
    const completedJames: ServiceRequest = { id: createId('req'), professional_id: alex.id, member_id: james.id, service_needed: 'Return to training', preferred_dates: 'April evenings', location: 'Bristol', budget: 60, notes: null, status: 'completed', proposed_time: null, created_at: reviewedAt, updated_at: reviewedAt };
    const completedMine: ServiceRequest = { id: createId('req'), professional_id: alex.id, member_id: currentUserId, service_needed: 'Form check', preferred_dates: 'Last month', location: 'Bristol', budget: 45, notes: 'Squat and hinge.', status: 'completed', proposed_time: null, created_at: reviewedAt, updated_at: reviewedAt };
    const pendingMine: ServiceRequest = { id: createId('req'), professional_id: alex.id, member_id: currentUserId, service_needed: 'Home strength plan', preferred_dates: 'Next two weeks, mornings', location: 'Bristol', budget: 50, notes: 'I have a completed form check and want a follow-up block.', status: 'pending', proposed_time: null, created_at: nowIso(), updated_at: nowIso() };
    const incoming: ServiceRequest = { id: createId('req'), professional_id: morgan.id, member_id: sarah.id, service_needed: 'Kitchen lighting circuit', preferred_dates: 'A Thursday in the next fortnight', location: 'BS6', budget: 100, notes: 'Two ceiling spots and a new switch.', status: 'pending', proposed_time: null, created_at: nowIso(), updated_at: nowIso() };
    state.serviceRequests.push(completedSarah, completedJames, completedMine, pendingMine, incoming);
    state.reviews.push(
      { id: createId('review'), professional_id: alex.id, author_id: sarah.id, rating: 5, body: 'Alex rebuilt my routine without burning me out. Clear, calm, and worth the fee.', owner_reply: null, replied_at: null, created_at: reviewedAt },
      { id: createId('review'), professional_id: alex.id, author_id: james.id, rating: 4, body: 'Straight coaching and a fair price. I would book again for a form check.', owner_reply: 'Thank you, James. Glad the sessions helped.', replied_at: reviewedAt, created_at: reviewedAt },
    );
    pushNotification(state, { recipient_id: currentUserId, type: 'service_request', title: 'New quote request', body: 'Sarah Chen asked Morgan Ellis for a quote: kitchen lighting circuit.', reference_id: incoming.id });
    pushNotification(state, { recipient_id: currentUserId, type: 'service_request_update', title: 'Quote request sent', body: 'Your quote request to Alex Rivera is waiting for a reply.', reference_id: pendingMine.id });
    pushNotification(state, { recipient_id: currentUserId, type: 'reference_request', title: 'Reference still open', body: 'James Okonkwo has not yet confirmed the reference for Morgan Ellis.', reference_id: null });
    const helen = teamProfessional('Helen Crowe', 'Accountant', 'Accountants and Financial Advisers', 120, 180, 'per_session', true, sarah.id);
    const tom = teamProfessional('Tom Adeyemi', 'Plumber', 'Electricians and Plumbers', 60, 95, 'per_hour', true, sarah.id);
    const anita = teamProfessional('Dr Anita Shah', 'Dentist', 'Health and Wellbeing', 80, 150, 'per_session', true, james.id);
    const maya = teamProfessional('Maya Cole', 'Cleaner', 'Cleaners and Gardeners', 18, 25, 'per_hour', false, sarah.id);
    const owen = teamProfessional('Owen Clarke', 'Solicitor', 'Lawyers', 200, 350, 'per_hour', true, james.id);
    const ibrahim = teamProfessional('Ibrahim Khan', 'Electrician', 'Electricians and Plumbers', 70, 110, 'per_hour', true, sarah.id);
    state.professionals.push(helen, tom, anita, maya, owen, ibrahim);
    const older = new Date(Date.now() - 10 * 86400000).toISOString();
    const ensureSlots = (ownerId: string) => {
      const existing = state.lifeTeamSlots.filter((slot) => slot.owner_id === ownerId);
      if (existing.length > 0) return existing;
      const created = LIFE_TEAM_ROLES.map((profession) => ({ id: createId('slot'), owner_id: ownerId, profession, custom: false as const, created_at: reviewedAt }));
      state.lifeTeamSlots.push(...created);
      return created;
    };
    const mine = ensureSlots(currentUserId);
    const sarahSlots = ensureSlots(sarah.id);
    const jamesSlots = ensureSlots(james.id);
    const byRole = (list: LifeTeamSlot[], profession: string) => list.find((slot) => slot.profession === profession)!;
    const place = (slotId: string, professionalId: string, rank: LifeTeamRank, when: string) => {
      state.lifeTeamPicks.push({ id: createId('pick'), slot_id: slotId, professional_id: professionalId, rank, created_at: when });
    };
    place(byRole(mine, 'Personal trainer').id, alex.id, 1, nowIso());
    place(byRole(mine, 'Accountant').id, helen.id, 1, nowIso());
    place(byRole(mine, 'Plumber').id, tom.id, 1, nowIso());
    place(byRole(mine, 'Dentist').id, anita.id, 1, nowIso());
    place(byRole(mine, 'Cleaner').id, maya.id, 1, nowIso());
    place(byRole(mine, 'Solicitor').id, owen.id, 1, nowIso());
    place(byRole(sarahSlots, 'Personal trainer').id, alex.id, 1, older);
    place(byRole(jamesSlots, 'Personal trainer').id, alex.id, 2, older);
    place(byRole(sarahSlots, 'Electrician').id, ibrahim.id, 1, older);
    const electricianAsk: LifeTeamAsk = { id: createId('ask'), slot_id: byRole(mine, 'Electrician').id, asker_id: currentUserId, profession: 'Electrician', status: 'open', created_at: nowIso() };
    state.lifeTeamAsks.push(electricianAsk);
    state.lifeTeamReplies.push({ id: createId('reply'), ask_id: electricianAsk.id, replier_id: sarah.id, professional_id: ibrahim.id, note: 'Ibrahim rewired our landing and left it tidy.', created_at: nowIso() });
    pushNotification(state, { recipient_id: sarah.id, type: 'life_team_ask', title: "Who's your electrician?", body: 'Your connection asked who you trust.', reference_id: electricianAsk.id });
    pushNotification(state, { recipient_id: james.id, type: 'life_team_ask', title: "Who's your electrician?", body: 'Your connection asked who you trust.', reference_id: electricianAsk.id });
    pushNotification(state, { recipient_id: currentUserId, type: 'life_team_reply', title: 'Sarah suggested an electrician', body: 'Sarah Chen suggested Ibrahim Khan. Add him in one tap.', reference_id: electricianAsk.id });
    const tomJob: ServiceRequest = { id: createId('req'), professional_id: tom.id, member_id: sarah.id, service_needed: 'Basin waste', preferred_dates: 'Last month', location: 'BS6', budget: 80, notes: null, status: 'completed', proposed_time: null, created_at: reviewedAt, updated_at: reviewedAt };
    const owenJob: ServiceRequest = { id: createId('req'), professional_id: owen.id, member_id: james.id, service_needed: 'Shop lease review', preferred_dates: 'February', location: 'Bristol', budget: 250, notes: null, status: 'completed', proposed_time: null, created_at: reviewedAt, updated_at: reviewedAt };
    state.serviceRequests.push(tomJob, owenJob);
    state.jobMedia.push(
      { id: createId('media'), professional_id: alex.id, service_request_id: completedMine.id, review_id: null, uploaded_by: sarah.id, kind: 'image', template: 'progress', title: 'Squat form check', location_area: 'Bristol', job_date: '2026-09-12', summary_text: null, media_path: 'jobs/alex-form.jpg', before_path: null, duration_seconds: null, consent_status: 'approved', created_at: reviewedAt },
      { id: createId('media'), professional_id: alex.id, service_request_id: completedMine.id, review_id: null, uploaded_by: currentUserId, kind: 'image', template: 'progress', title: 'Photo from my review', location_area: 'Bristol', job_date: '2026-09-12', summary_text: null, media_path: 'jobs/alex-customer.jpg', before_path: null, duration_seconds: null, consent_status: 'approved', created_at: reviewedAt },
      { id: createId('media'), professional_id: alex.id, service_request_id: completedSarah.id, review_id: null, uploaded_by: sarah.id, kind: 'video', template: 'progress', title: 'Twelve-week check-in', location_area: 'Bristol', job_date: '2026-10-02', summary_text: null, media_path: 'jobs/alex-checkin.mp4', before_path: null, duration_seconds: 8, consent_status: 'approved', created_at: reviewedAt },
      { id: createId('media'), professional_id: alex.id, service_request_id: null, review_id: null, uploaded_by: sarah.id, kind: 'image', template: 'portfolio', title: 'Home gym layout', location_area: 'Bristol', job_date: null, summary_text: null, media_path: 'jobs/alex-gym.jpg', before_path: null, duration_seconds: null, consent_status: 'approved', created_at: reviewedAt },
      { id: createId('media'), professional_id: tom.id, service_request_id: tomJob.id, review_id: null, uploaded_by: sarah.id, kind: 'image', template: 'before_after', title: 'Basin waste replaced', location_area: 'BS6', job_date: '2026-08-20', summary_text: null, media_path: 'jobs/plumber-after.jpg', before_path: 'jobs/plumber-before.jpg', duration_seconds: null, consent_status: 'approved', created_at: reviewedAt },
      { id: createId('media'), professional_id: owen.id, service_request_id: owenJob.id, review_id: null, uploaded_by: james.id, kind: 'summary', template: 'case_summary', title: 'High-street shop lease', location_area: 'Bristol', job_date: '2026-02-11', summary_text: 'A lease review for a small high-street shop. The client and the other party are not named. Repair terms were rewritten and the break clause was shortened.', media_path: null, before_path: null, duration_seconds: null, consent_status: 'approved', created_at: reviewedAt },
    );
    state.sampleDataLoaded = true;
    await save(state);
    return state;
  },
  async resetDemo() { return resetDemoState(); },
};
