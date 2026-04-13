import { assignRandomSlot } from '../domain/assignment'
import { createId } from '../domain/id'
import { createEventInvite, createParticipantFromInvite, validateInviteSlot } from '../domain/invites'
import type {
  AppState,
  CreateEventInput,
  CreateInviteInput,
  EventRecord,
  Participant,
  User,
} from '../domain/models'
import { buildEventTournament, recomputeMatches, setBlockQualifiers, setMatchWinner } from '../domain/tournament'
import { supabase } from '../lib/supabase'
import type { AppRepository } from './appRepository'
import {
  buildEventRecords,
  mapEventToInsert,
  mapInviteToInsert,
  mapMatchToInsert,
  mapParticipantToInsert,
} from './supabaseMappers'

const SESSION_KEY = 'tournament-mvp-session-v2'

interface SessionState {
  users: User[]
  currentUserId: string | null
  joinedParticipantIdsByEventId: Record<string, string>
}

const initialSessionState: SessionState = {
  users: [],
  currentUserId: null,
  joinedParticipantIdsByEventId: {},
}

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

function mergeState(sessionState: SessionState, eventRecords: EventRecord[]): AppState {
  return {
    users: sessionState.users,
    currentUserId: sessionState.currentUserId,
    joinedParticipantIdsByEventId: sessionState.joinedParticipantIdsByEventId,
    eventRecords,
    storageMode: 'supabase',
  }
}

function updateMatchRows(
  eventRecord: EventRecord,
  matches: EventRecord['matches'],
) {
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
  private state: AppState = mergeState(initialSessionState, [])
  private listeners = new Set<() => void>()
  private unsubscribeRealtime: (() => void) | null = null

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
    this.state = mergeState(nextSession, this.state.eventRecords)
    this.emit()
    return nextSession
  }

  private async refreshRemoteState() {
    const client = ensureSupabaseClient()
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

    this.setState(mergeState(readSessionState(), eventRecords))
  }

  async initialize() {
    await this.refreshRemoteState()

    if (this.unsubscribeRealtime) {
      return
    }

    const client = ensureSupabaseClient()
    const channel = client
      .channel('tournament-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        async () => {
          await this.refreshRemoteState()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        async () => {
          await this.refreshRemoteState()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_invites' },
        async () => {
          await this.refreshRemoteState()
        },
      )
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

  async loginHost(name: string) {
    const normalized = name.trim()
    if (!normalized) {
      throw new Error('主催者名を入力してください。')
    }

    const nextSession = this.updateSession((sessionState) => {
      const existing = sessionState.users.find(
        (user) => user.role === 'host' && user.name.toLowerCase() === normalized.toLowerCase(),
      )
      if (existing) {
        return { ...sessionState, currentUserId: existing.id }
      }

      const user: User = {
        id: createId('user'),
        name: normalized,
        role: 'host',
      }
      return {
        ...sessionState,
        users: [...sessionState.users, user],
        currentUserId: user.id,
      }
    })

    const currentUser = nextSession.users.find((user) => user.id === nextSession.currentUserId)
    if (!currentUser) {
      throw new Error('主催者ログインに失敗しました。')
    }
    return currentUser
  }

  async logout() {
    this.updateSession((sessionState) => ({ ...sessionState, currentUserId: null }))
  }

  async createEvent(hostUserId: string, input: CreateEventInput) {
    const client = ensureSupabaseClient()
    const built = buildEventTournament(hostUserId, input)

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

  async getEventRecordById(eventId: string) {
    return this.state.eventRecords.find((record) => record.event.id === eventId) ?? null
  }

  async getEventRecordByShareToken(shareToken: string) {
    return this.state.eventRecords.find((record) => record.event.shareToken === shareToken) ?? null
  }

  async getInviteByToken(inviteToken: string) {
    return (
      this.state.eventRecords
        .flatMap((record) => record.invites)
        .find((invite) => invite.inviteToken === inviteToken) ?? null
    )
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
      const joinedParticipantId = invite.joinedParticipantId
      this.updateSession((sessionState) => ({
        ...sessionState,
        joinedParticipantIdsByEventId: {
          ...sessionState.joinedParticipantIdsByEventId,
          [eventRecord.event.id]: joinedParticipantId,
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

    const joinedParticipantId = nextInvite.joinedParticipantId
    if (!joinedParticipantId) {
      throw new Error('招待参加者の参加IDを確定できませんでした。')
    }

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
