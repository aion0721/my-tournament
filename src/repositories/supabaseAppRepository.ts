import { assignRandomSlot } from '../domain/assignment'
import { createId } from '../domain/id'
import { createEventInvite, createParticipantFromInvite, validateInviteSlot } from '../domain/invites'
import { reassignParticipantSlot } from '../domain/participants'
import type {
  AppState,
  CreateEventInput,
  CreateInviteInput,
  EventRecord,
  Participant,
  UserProfile,
  UserRole,
} from '../domain/models'
import { buildEventTournament, recomputeMatches, setBlockQualifiers, setMatchWinner } from '../domain/tournament'
import { supabase, type Database } from '../lib/supabase'
import type { AppRepository } from './appRepository'
import {
  buildEventRecords,
  mapEventToInsert,
  mapInviteToInsert,
  mapMatchToInsert,
  mapParticipantToInsert,
} from './supabaseMappers'

const SESSION_KEY = 'tournament-mvp-session-v3'

interface SessionState {
  joinedParticipantIdsByEventId: Record<string, string>
}

const initialSessionState: SessionState = {
  joinedParticipantIdsByEventId: {},
}

type ProfileRow = Database['public']['Tables']['profiles']['Row']

function readSessionState() {
  if (typeof window === 'undefined') {
    return initialSessionState
  }

  const value = window.localStorage.getItem(SESSION_KEY)
  if (!value) {
    return initialSessionState
  }

  try {
    return JSON.parse(value) as SessionState
  } catch {
    return initialSessionState
  }
}

function writeSessionState(sessionState: SessionState) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionState))
}

function ensureSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase の設定が不足しています。.env.local を確認してください。')
  }

  return supabase
}

function getFallbackDisplayName(email: string | undefined, userId: string) {
  const localPart = email?.split('@')[0]?.trim()
  return localPart || `user-${userId.slice(0, 8)}`
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
  }
}

function mergeState(params: {
  sessionState: SessionState
  eventRecords: EventRecord[]
  profiles: UserProfile[]
  currentUser: UserProfile | null
  currentAuthUserId: string | null
}): AppState {
  return {
    profiles: params.profiles,
    currentUser: params.currentUser,
    currentAuthUserId: params.currentAuthUserId,
    joinedParticipantIdsByEventId: params.sessionState.joinedParticipantIdsByEventId,
    eventRecords: params.eventRecords,
    storageMode: 'supabase',
  }
}

function updateMatchRows(eventRecord: EventRecord, matches: EventRecord['matches']) {
  const currentMap = new Map(eventRecord.matches.map((match) => [match.id, match]))
  return matches.filter((match) => {
    const current = currentMap.get(match.id)
    return (
      !current ||
      JSON.stringify(current.participantIds) !== JSON.stringify(match.participantIds) ||
      JSON.stringify(current.qualifiedParticipantIds) !== JSON.stringify(match.qualifiedParticipantIds) ||
      current.player1ParticipantId !== match.player1ParticipantId ||
      current.player2ParticipantId !== match.player2ParticipantId ||
      current.winnerParticipantId !== match.winnerParticipantId
    )
  })
}

export class SupabaseAppRepository implements AppRepository {
  readonly mode = 'supabase' as const
  private state: AppState = mergeState({
    sessionState: initialSessionState,
    eventRecords: [],
    profiles: [],
    currentUser: null,
    currentAuthUserId: null,
  })
  private listeners = new Set<() => void>()
  private unsubscribeRealtime: (() => void) | null = null
  private unsubscribeAuth: (() => void) | null = null

  private emit() {
    for (const listener of this.listeners) {
      listener()
    }
  }

  private setState(state: AppState) {
    this.state = state
    this.emit()
  }

  private updateSession(mutator: (current: SessionState) => SessionState) {
    const nextSession = mutator(readSessionState())
    writeSessionState(nextSession)
    this.state = mergeState({
      sessionState: nextSession,
      eventRecords: this.state.eventRecords,
      profiles: this.state.profiles,
      currentUser: this.state.currentUser,
      currentAuthUserId: this.state.currentAuthUserId,
    })
    this.emit()
    return nextSession
  }

  private async readCurrentAuthContext() {
    const client = ensureSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await client.auth.getUser()
    if (authError) {
      throw authError
    }

    if (!authUser) {
      return {
        authUser: null,
        profiles: [] as UserProfile[],
        currentUser: null as UserProfile | null,
      }
    }

    const ownProfileResult = await client.from('profiles').select('*').eq('id', authUser.id).maybeSingle()
    if (ownProfileResult.error) {
      throw ownProfileResult.error
    }

    const ownProfile = ownProfileResult.data ? mapProfileRow(ownProfileResult.data) : null
    const currentUser: UserProfile = ownProfile ?? {
      id: authUser.id,
      displayName: getFallbackDisplayName(authUser.email, authUser.id),
      role: 'host',
    }

    if (currentUser.role === 'admin') {
      const profilesResult = await client.from('profiles').select('*').order('created_at', { ascending: true })
      if (profilesResult.error) {
        throw profilesResult.error
      }

      return {
        authUser,
        profiles: (profilesResult.data ?? []).map(mapProfileRow),
        currentUser,
      }
    }

    return {
      authUser,
      profiles: ownProfile ? [ownProfile] : [currentUser],
      currentUser,
    }
  }

  private async refreshRemoteState() {
    const client = ensureSupabaseClient()
    const authContext = await this.readCurrentAuthContext()
    const [eventsResult, participantsResult, invitesResult, matchesResult] = await Promise.all([
      client.from('events').select('*').order('created_at', { ascending: false }),
      client.from('participants').select('*').order('joined_at', { ascending: true }),
      client.from('event_invites').select('*').order('created_at', { ascending: false }),
      client.from('matches').select('*').order('round_index', { ascending: true }),
    ])

    if (eventsResult.error) throw eventsResult.error
    if (participantsResult.error) throw participantsResult.error
    if (invitesResult.error) throw invitesResult.error
    if (matchesResult.error) throw matchesResult.error

    const eventRecords = buildEventRecords(
      eventsResult.data ?? [],
      participantsResult.data ?? [],
      invitesResult.data ?? [],
      matchesResult.data ?? [],
    )

    this.setState(
      mergeState({
        sessionState: readSessionState(),
        eventRecords,
        profiles: authContext.profiles,
        currentUser: authContext.currentUser,
        currentAuthUserId: authContext.authUser?.id ?? null,
      }),
    )
  }

  async initialize() {
    await this.refreshRemoteState()

    if (!this.unsubscribeAuth) {
      const client = ensureSupabaseClient()
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange(() => {
        void this.refreshRemoteState()
      })
      this.unsubscribeAuth = () => {
        subscription.unsubscribe()
      }
    }

    if (this.unsubscribeRealtime) {
      return
    }

    const client = ensureSupabaseClient()
    const channel = client
      .channel('tournament-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, async () => {
        await this.refreshRemoteState()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, async () => {
        await this.refreshRemoteState()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, async () => {
        await this.refreshRemoteState()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_invites' }, async () => {
        await this.refreshRemoteState()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
        await this.refreshRemoteState()
      })
      .subscribe()

    this.unsubscribeRealtime = () => {
      void client.removeChannel(channel)
    }
  }

  getState() {
    return this.state
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async signInWithOtp(email: string) {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      throw new Error('メールアドレスを入力してください。')
    }

    const client = ensureSupabaseClient()
    const result = await client.auth.signInWithOtp({
      email: normalized,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    if (result.error) {
      throw result.error
    }
  }

  async logout() {
    const client = ensureSupabaseClient()
    const result = await client.auth.signOut()
    if (result.error) {
      throw result.error
    }

    await this.refreshRemoteState()
  }

  async logoutParticipant(eventId: string) {
    this.updateSession((sessionState) => ({
      ...sessionState,
      joinedParticipantIdsByEventId: Object.fromEntries(
        Object.entries(sessionState.joinedParticipantIdsByEventId).filter(([key]) => key !== eventId),
      ),
    }))
  }

  async selectParticipantSession(eventId: string, participantId: string) {
    this.updateSession((sessionState) => ({
      ...sessionState,
      joinedParticipantIdsByEventId: {
        ...sessionState.joinedParticipantIdsByEventId,
        [eventId]: participantId,
      },
    }))
  }

  async createEvent(input: CreateEventInput) {
    const client = ensureSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await client.auth.getUser()
    if (authError) {
      throw authError
    }
    if (!authUser) {
      throw new Error('イベント作成には主催者ログインが必要です。')
    }

    const built = buildEventTournament(authUser.id, authUser.id, input)

    const eventResult = await client.from('events').insert(mapEventToInsert(built.event)).select().single()
    if (eventResult.error) {
      throw eventResult.error
    }

    const matchesResult = await client.from('matches').insert(built.matches.map(mapMatchToInsert))
    if (matchesResult.error) {
      throw matchesResult.error
    }

    await this.refreshRemoteState()
    const createdRecord = this.state.eventRecords.find((record) => record.event.id === built.event.id)
    if (!createdRecord) {
      throw new Error('イベント作成後の再取得に失敗しました。')
    }
    return createdRecord
  }

  async deleteEvent(eventId: string) {
    const client = ensureSupabaseClient()
    const result = await client.from('events').delete().eq('id', eventId)
    if (result.error) {
      throw result.error
    }

    this.updateSession((sessionState) => ({
      ...sessionState,
      joinedParticipantIdsByEventId: Object.fromEntries(
        Object.entries(sessionState.joinedParticipantIdsByEventId).filter(([key]) => key !== eventId),
      ),
    }))

    await this.refreshRemoteState()
  }

  async createInvite(input: CreateInviteInput) {
    const client = ensureSupabaseClient()
    const eventRecord = this.state.eventRecords.find((record) => record.event.id === input.eventId)
    if (!eventRecord) {
      throw new Error('イベントが見つかりません。')
    }

    const invite = createEventInvite(input)
    validateInviteSlot(invite, eventRecord.participants, eventRecord.blocks)

    const result = await client.from('event_invites').insert(mapInviteToInsert(invite)).select().single()
    if (result.error) {
      throw result.error
    }

    await this.refreshRemoteState()
    return invite
  }

  async listProfiles() {
    await this.refreshRemoteState()
    return this.state.profiles
  }

  async updateUserRole(userId: string, role: UserRole) {
    if (this.state.currentUser?.role !== 'admin') {
      throw new Error('管理者のみユーザー権限を更新できます。')
    }

    const client = ensureSupabaseClient()
    const result = await client.from('profiles').update({ role }).eq('id', userId)
    if (result.error) {
      throw result.error
    }

    await this.refreshRemoteState()
  }

  async getEventRecordById(eventId: string) {
    return this.state.eventRecords.find((record) => record.event.id === eventId) ?? null
  }

  async getEventRecordByShareToken(shareToken: string) {
    return this.state.eventRecords.find((record) => record.event.shareToken === shareToken) ?? null
  }

  async getInviteByToken(inviteToken: string) {
    return this.state.eventRecords.flatMap((record) => record.invites).find((invite) => invite.inviteToken === inviteToken) ?? null
  }

  async joinEvent(shareToken: string, participantName: string) {
    const client = ensureSupabaseClient()
    const normalized = participantName.trim()
    if (!normalized) {
      throw new Error('参加者名を入力してください。')
    }

    const eventRecord = this.state.eventRecords.find((record) => record.event.shareToken === shareToken)
    if (!eventRecord) {
      throw new Error('イベントが見つかりません。')
    }
    if (eventRecord.participants.length >= eventRecord.event.capacity) {
      throw new Error('このイベントは満員です。')
    }

    const assignedSlot = assignRandomSlot(
      eventRecord.participants,
      eventRecord.event.blockCount,
      eventRecord.event.participantsPerBlock,
    )
    if (!assignedSlot) {
      throw new Error('空き枠がありません。')
    }

    const participant: Participant = {
      id: createId('participant'),
      eventId: eventRecord.event.id,
      name: normalized,
      sourceType: 'open',
      inviteId: null,
      assignedBlockIndex: assignedSlot.blockIndex,
      assignedSeed: assignedSlot.seed,
      joinedAt: new Date().toISOString(),
    }

    const nextParticipants = [...eventRecord.participants, participant]
    const nextMatches = recomputeMatches(eventRecord.blocks, nextParticipants, eventRecord.matches)

    const insertResult = await client.from('participants').insert(mapParticipantToInsert(participant))
    if (insertResult.error) {
      throw insertResult.error
    }

    const changedMatches = updateMatchRows(eventRecord, nextMatches)
    const matchUpdates = await Promise.all(
      changedMatches.map((match) =>
        client
          .from('matches')
          .update({
            player1_participant_id: match.player1ParticipantId,
            player2_participant_id: match.player2ParticipantId,
            winner_participant_id: match.winnerParticipantId,
            participant_ids: match.participantIds,
            qualified_participant_ids: match.qualifiedParticipantIds,
          })
          .eq('id', match.id),
      ),
    )
    const matchUpdateError = matchUpdates.find((result) => result.error)?.error
    if (matchUpdateError) {
      throw matchUpdateError
    }

    this.updateSession((sessionState) => ({
      ...sessionState,
      joinedParticipantIdsByEventId: {
        ...sessionState.joinedParticipantIdsByEventId,
        [eventRecord.event.id]: participant.id,
      },
    }))

    await this.refreshRemoteState()
    return this.state.eventRecords.find((record) => record.event.id === eventRecord.event.id) ?? eventRecord
  }

  async joinEventByInvite(inviteToken: string) {
    const client = ensureSupabaseClient()
    const invite = await this.getInviteByToken(inviteToken)
    if (!invite) {
      throw new Error('招待が見つかりません。')
    }

    const eventRecord = this.state.eventRecords.find((record) => record.event.id === invite.eventId)
    if (!eventRecord) {
      throw new Error('イベントが見つかりません。')
    }

    if (invite.status === 'joined' && invite.joinedParticipantId) {
      this.updateSession((sessionState) => ({
        ...sessionState,
        joinedParticipantIdsByEventId: {
          ...sessionState.joinedParticipantIdsByEventId,
          [eventRecord.event.id]: invite.joinedParticipantId!,
        },
      }))
      return eventRecord
    }

    if (eventRecord.participants.length >= eventRecord.event.capacity) {
      throw new Error('このイベントは満員です。')
    }

    validateInviteSlot(invite, eventRecord.participants, eventRecord.blocks)
    const { participant, nextInvite } = createParticipantFromInvite(
      invite,
      eventRecord.participants,
      eventRecord.event.blockCount,
      eventRecord.event.participantsPerBlock,
    )

    const nextParticipants = [...eventRecord.participants, participant]
    const nextMatches = recomputeMatches(eventRecord.blocks, nextParticipants, eventRecord.matches)

    const participantResult = await client.from('participants').insert(mapParticipantToInsert(participant))
    if (participantResult.error) {
      throw participantResult.error
    }

    const inviteResult = await client
      .from('event_invites')
      .update({
        status: nextInvite.status,
        joined_participant_id: nextInvite.joinedParticipantId,
      })
      .eq('id', invite.id)
    if (inviteResult.error) {
      throw inviteResult.error
    }

    const changedMatches = updateMatchRows(eventRecord, nextMatches)
    const matchUpdates = await Promise.all(
      changedMatches.map((match) =>
        client
          .from('matches')
          .update({
            player1_participant_id: match.player1ParticipantId,
            player2_participant_id: match.player2ParticipantId,
            winner_participant_id: match.winnerParticipantId,
            participant_ids: match.participantIds,
            qualified_participant_ids: match.qualifiedParticipantIds,
          })
          .eq('id', match.id),
      ),
    )
    const matchUpdateError = matchUpdates.find((result) => result.error)?.error
    if (matchUpdateError) {
      throw matchUpdateError
    }

    if (!nextInvite.joinedParticipantId) {
      throw new Error('招待参加者の参加IDを確定できませんでした。')
    }

    const joinedParticipantId = nextInvite.joinedParticipantId

    this.updateSession((sessionState) => ({
      ...sessionState,
      joinedParticipantIdsByEventId: {
        ...sessionState.joinedParticipantIdsByEventId,
        [eventRecord.event.id]: joinedParticipantId,
      },
    }))

    await this.refreshRemoteState()
    return this.state.eventRecords.find((record) => record.event.id === eventRecord.event.id) ?? eventRecord
  }

  async updateParticipantAssignment(eventId: string, participantId: string, assignedBlockIndex: number, assignedSeed: number) {
    const client = ensureSupabaseClient()
    const eventRecord = this.state.eventRecords.find((record) => record.event.id === eventId)
    if (!eventRecord) {
      throw new Error('イベントが見つかりません。')
    }

    const participants = reassignParticipantSlot(
      eventRecord.participants,
      eventRecord.blocks,
      participantId,
      assignedBlockIndex,
      assignedSeed,
    )
    const nextMatches = recomputeMatches(eventRecord.blocks, participants, eventRecord.matches)
    const changedParticipants = participants.filter((nextParticipant) => {
      const currentParticipant = eventRecord.participants.find((participant) => participant.id === nextParticipant.id)
      return (
        currentParticipant &&
        (currentParticipant.assignedBlockIndex !== nextParticipant.assignedBlockIndex ||
          currentParticipant.assignedSeed !== nextParticipant.assignedSeed)
      )
    })

    if (changedParticipants.length === 2) {
      const movingParticipant = participants.find((participant) => participant.id === participantId)
      const swappedParticipant = changedParticipants.find((participant) => participant.id !== participantId)
      const originalParticipant = eventRecord.participants.find((participant) => participant.id === participantId)

      if (!movingParticipant || !swappedParticipant || !originalParticipant) {
        throw new Error('参加者配置の更新対象を特定できませんでした。')
      }

      const temporarySeed = eventRecord.event.participantsPerBlock + 1

      const temporaryResult = await client
        .from('participants')
        .update({
          assigned_block_index: originalParticipant.assignedBlockIndex,
          assigned_seed: temporarySeed,
        })
        .eq('id', participantId)
      if (temporaryResult.error) {
        throw temporaryResult.error
      }

      const swapResult = await client
        .from('participants')
        .update({
          assigned_block_index: swappedParticipant.assignedBlockIndex,
          assigned_seed: swappedParticipant.assignedSeed,
        })
        .eq('id', swappedParticipant.id)
      if (swapResult.error) {
        throw swapResult.error
      }

      const finalResult = await client
        .from('participants')
        .update({
          assigned_block_index: movingParticipant.assignedBlockIndex,
          assigned_seed: movingParticipant.assignedSeed,
        })
        .eq('id', participantId)
      if (finalResult.error) {
        throw finalResult.error
      }
    } else {
      const participantResults = await Promise.all(
        changedParticipants.map((participant) =>
          client
            .from('participants')
            .update({
              assigned_block_index: participant.assignedBlockIndex,
              assigned_seed: participant.assignedSeed,
            })
            .eq('id', participant.id),
        ),
      )
      const participantUpdateError = participantResults.find((result) => result.error)?.error
      if (participantUpdateError) {
        throw participantUpdateError
      }
    }

    const changedMatches = updateMatchRows(eventRecord, nextMatches)
    const results = await Promise.all(
      changedMatches.map((match) =>
        client
          .from('matches')
          .update({
            player1_participant_id: match.player1ParticipantId,
            player2_participant_id: match.player2ParticipantId,
            winner_participant_id: match.winnerParticipantId,
            participant_ids: match.participantIds,
            qualified_participant_ids: match.qualifiedParticipantIds,
          })
          .eq('id', match.id),
      ),
    )
    const updateError = results.find((result) => result.error)?.error
    if (updateError) {
      throw updateError
    }

    await this.refreshRemoteState()
    return this.state.eventRecords.find((record) => record.event.id === eventId) ?? eventRecord
  }

  async updateParticipantName(eventId: string, participantId: string, name: string) {
    const client = ensureSupabaseClient()
    const normalized = name.trim()
    if (!normalized) {
      throw new Error('参加者名を入力してください。')
    }

    const eventRecord = this.state.eventRecords.find((record) => record.event.id === eventId)
    if (!eventRecord) {
      throw new Error('イベントが見つかりません。')
    }

    const participant = eventRecord.participants.find((item) => item.id === participantId)
    if (!participant) {
      throw new Error('参加者が見つかりません。')
    }

    const participantResult = await client.from('participants').update({ name: normalized }).eq('id', participantId)
    if (participantResult.error) {
      throw participantResult.error
    }

    if (participant.inviteId) {
      const inviteResult = await client.from('event_invites').update({ display_name: normalized }).eq('id', participant.inviteId)
      if (inviteResult.error) {
        throw inviteResult.error
      }
    }

    await this.refreshRemoteState()
    return this.state.eventRecords.find((record) => record.event.id === eventId) ?? eventRecord
  }

  async deleteParticipant(eventId: string, participantId: string) {
    const client = ensureSupabaseClient()
    const eventRecord = this.state.eventRecords.find((record) => record.event.id === eventId)
    if (!eventRecord) {
      throw new Error('イベントが見つかりません。')
    }

    const participant = eventRecord.participants.find((item) => item.id === participantId)
    if (!participant) {
      throw new Error('参加者が見つかりません。')
    }

    const participants = eventRecord.participants.filter((item) => item.id !== participantId)
    const nextMatches = recomputeMatches(eventRecord.blocks, participants, eventRecord.matches)

    if (participant.inviteId) {
      const inviteResult = await client
        .from('event_invites')
        .update({
          status: 'pending',
          joined_participant_id: null,
        })
        .eq('id', participant.inviteId)
      if (inviteResult.error) {
        throw inviteResult.error
      }
    }

    const participantResult = await client.from('participants').delete().eq('id', participantId)
    if (participantResult.error) {
      throw participantResult.error
    }

    const changedMatches = updateMatchRows(eventRecord, nextMatches)
    const results = await Promise.all(
      changedMatches.map((match) =>
        client
          .from('matches')
          .update({
            player1_participant_id: match.player1ParticipantId,
            player2_participant_id: match.player2ParticipantId,
            winner_participant_id: match.winnerParticipantId,
            participant_ids: match.participantIds,
            qualified_participant_ids: match.qualifiedParticipantIds,
          })
          .eq('id', match.id),
      ),
    )
    const updateError = results.find((result) => result.error)?.error
    if (updateError) {
      throw updateError
    }

    this.updateSession((sessionState) => ({
      ...sessionState,
      joinedParticipantIdsByEventId: Object.fromEntries(
        Object.entries(sessionState.joinedParticipantIdsByEventId).filter(
          ([key, value]) => !(key === eventId && value === participantId),
        ),
      ),
    }))

    await this.refreshRemoteState()
    return this.state.eventRecords.find((record) => record.event.id === eventId) ?? eventRecord
  }

  async updateMatchWinner(eventId: string, matchId: string, winnerParticipantId: string | null) {
    const client = ensureSupabaseClient()
    const eventRecord = this.state.eventRecords.find((record) => record.event.id === eventId)
    if (!eventRecord) {
      throw new Error('イベントが見つかりません。')
    }

    const targetMatch = eventRecord.matches.find((match) => match.id === matchId)
    if (!targetMatch) {
      throw new Error('試合が見つかりません。')
    }

    const validWinnerIds = [targetMatch.player1ParticipantId, targetMatch.player2ParticipantId]
    if (winnerParticipantId && !validWinnerIds.includes(winnerParticipantId)) {
      throw new Error('試合に含まれない参加者は勝者に設定できません。')
    }

    const nextMatches = setMatchWinner(
      eventRecord.blocks,
      eventRecord.participants,
      eventRecord.matches,
      matchId,
      winnerParticipantId,
    )

    const changedMatches = updateMatchRows(eventRecord, nextMatches)
    const results = await Promise.all(
      changedMatches.map((match) =>
        client
          .from('matches')
          .update({
            player1_participant_id: match.player1ParticipantId,
            player2_participant_id: match.player2ParticipantId,
            winner_participant_id: match.winnerParticipantId,
            participant_ids: match.participantIds,
            qualified_participant_ids: match.qualifiedParticipantIds,
          })
          .eq('id', match.id),
      ),
    )
    const updateError = results.find((result) => result.error)?.error
    if (updateError) {
      throw updateError
    }

    await this.refreshRemoteState()
    return this.state.eventRecords.find((record) => record.event.id === eventId) ?? eventRecord
  }

  async getJoinedParticipantId(eventId: string) {
    return readSessionState().joinedParticipantIdsByEventId[eventId] ?? null
  }

  async updateBlockQualifiers(eventId: string, blockId: string, qualifiedParticipantIds: string[]) {
    const client = ensureSupabaseClient()
    const eventRecord = this.state.eventRecords.find((record) => record.event.id === eventId)
    if (!eventRecord) {
      throw new Error('イベントが見つかりません。')
    }

    const nextMatches = setBlockQualifiers(
      eventRecord.blocks,
      eventRecord.participants,
      eventRecord.matches,
      blockId,
      qualifiedParticipantIds,
    )

    const changedMatches = updateMatchRows(eventRecord, nextMatches)
    const results = await Promise.all(
      changedMatches.map((match) =>
        client
          .from('matches')
          .update({
            player1_participant_id: match.player1ParticipantId,
            player2_participant_id: match.player2ParticipantId,
            winner_participant_id: match.winnerParticipantId,
            participant_ids: match.participantIds,
            qualified_participant_ids: match.qualifiedParticipantIds,
          })
          .eq('id', match.id),
      ),
    )
    const updateError = results.find((result) => result.error)?.error
    if (updateError) {
      throw updateError
    }

    await this.refreshRemoteState()
    return this.state.eventRecords.find((record) => record.event.id === eventId) ?? eventRecord
  }
}
