import { assignRandomSlot } from '../domain/assignment'
import { createBlocksForEvent } from '../domain/blocks'
import { createId, createStableHostUserId, normalizeHostIdentity } from '../domain/id'
import { createEventInvite, createParticipantFromInvite, validateInviteSlot } from '../domain/invites'
import { reassignParticipantSlot } from '../domain/participants'
import type {
  AppState,
  CreateEventInput,
  CreateInviteInput,
  EventInvite,
  EventRecord,
  Participant,
  UserProfile,
  UserRole,
} from '../domain/models'
import { buildEventTournament, recomputeMatches, setBlockQualifiers, setMatchWinner } from '../domain/tournament'
import type { AppRepository } from './appRepository'

const STORAGE_KEY = 'tournament-mvp-state-v3'
const CHANGE_EVENT = 'tournament-mvp-state-updated'

const initialState: AppState = {
  profiles: [],
  currentUser: null,
  currentAuthUserId: null,
  joinedParticipantIdsByEventId: {},
  eventRecords: [],
  storageMode: 'local',
}

function readState() {
  if (typeof window === 'undefined') {
    return initialState
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY)
  if (!storedValue) {
    return initialState
  }

  try {
    const parsed = JSON.parse(storedValue) as AppState
    return { ...parsed, storageMode: 'local' as const }
  } catch {
    return initialState
  }
}

function writeState(state: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

function updateState(updater: (state: AppState) => AppState) {
  const nextState = updater(readState())
  writeState(nextState)
  return nextState
}

function findEventRecordById(state: AppState, eventId: string) {
  return state.eventRecords.find((record) => record.event.id === eventId) ?? null
}

function findEventRecordByToken(state: AppState, shareToken: string) {
  return state.eventRecords.find((record) => record.event.shareToken === shareToken) ?? null
}

function findInviteByToken(state: AppState, inviteToken: string) {
  return (
    state.eventRecords
      .flatMap((record) => record.invites)
      .find((invite) => invite.inviteToken === inviteToken) ?? null
  )
}

function replaceEventRecord(state: AppState, eventRecord: EventRecord) {
  return {
    ...state,
    eventRecords: state.eventRecords.map((record) =>
      record.event.id === eventRecord.event.id ? eventRecord : record,
    ),
  }
}

function normalizeLegacyState(state: AppState) {
  return {
    ...state,
    storageMode: 'local' as const,
    eventRecords: state.eventRecords.map((record) => ({
      ...record,
      blocks: record.blocks?.length ? record.blocks : createBlocksForEvent(record.event),
      invites: record.invites ?? [],
      matches: record.matches.map((match) => ({
        ...match,
        participantSources: match.participantSources ?? [match.slot1Source, match.slot2Source].filter(Boolean),
        advanceCount: match.advanceCount ?? (match.isFinalStage ? 1 : record.event.winnersPerBlock),
        isFinalStage: match.isFinalStage ?? false,
        participantIds: match.participantIds ?? [],
        qualifiedParticipantIds: match.qualifiedParticipantIds ?? [],
      })),
      participants: record.participants.map((participant) => ({
        sourceType: participant.sourceType ?? 'open',
        inviteId: participant.inviteId ?? null,
        ...participant,
      })),
    })),
  }
}

export class LocalStorageAppRepository implements AppRepository {
  readonly mode = 'local' as const

  async initialize() {
    const state = normalizeLegacyState(readState())
    writeState(state)
  }

  getState() {
    return normalizeLegacyState(readState())
  }

  subscribe(listener: () => void) {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        listener()
      }
    }
    const handleLocalChange = () => listener()

    window.addEventListener('storage', handleStorage)
    window.addEventListener(CHANGE_EVENT, handleLocalChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(CHANGE_EVENT, handleLocalChange)
    }
  }

  async signInWithOtp(email: string) {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      throw new Error('メールアドレスを入力してください。')
    }

    const stableUserId = createStableHostUserId(normalized)
    const normalizedIdentity = normalizeHostIdentity(normalized)

    const nextState = updateState((state) => {
      const sameProfiles = state.profiles.filter(
        (profile) => normalizeHostIdentity(profile.displayName) === normalizedIdentity,
      )
      const nextProfile: UserProfile = {
        id: stableUserId,
        displayName: sameProfiles[0]?.displayName ?? normalized,
        role: 'host',
      }
      const sameProfileIds = new Set(sameProfiles.map((profile) => profile.id))
      sameProfileIds.add(stableUserId)

      return {
        ...state,
        profiles: [
          ...state.profiles.filter((profile) => !sameProfileIds.has(profile.id)),
          nextProfile,
        ],
        currentUser: nextProfile,
        currentAuthUserId: stableUserId,
        eventRecords: state.eventRecords.map((record) =>
          sameProfileIds.has(record.event.hostUserId)
            ? {
                ...record,
                event: {
                  ...record.event,
                  hostUserId: stableUserId,
                  hostAuthUserId: stableUserId,
                },
              }
            : record,
        ),
        storageMode: 'local' as const,
      }
    })

    if (!nextState.currentUser) {
      throw new Error('主催者ログインに失敗しました。')
    }
  }

  async logout() {
    updateState((state) => ({
      ...state,
      currentUser: null,
      currentAuthUserId: null,
      storageMode: 'local' as const,
    }))
  }

  async logoutParticipant(eventId: string) {
    updateState((state) => ({
      ...state,
      joinedParticipantIdsByEventId: Object.fromEntries(
        Object.entries(state.joinedParticipantIdsByEventId).filter(([key]) => key !== eventId),
      ),
      storageMode: 'local' as const,
    }))
  }

  async selectParticipantSession(eventId: string, participantId: string) {
    updateState((state) => ({
      ...state,
      joinedParticipantIdsByEventId: {
        ...state.joinedParticipantIdsByEventId,
        [eventId]: participantId,
      },
      storageMode: 'local' as const,
    }))
  }

  async createEvent(input: CreateEventInput) {
    let createdRecord: EventRecord | null = null

    updateState((state) => {
      if (!state.currentAuthUserId) {
        throw new Error('イベント作成には主催者ログインが必要です。')
      }

      const built = buildEventTournament(state.currentAuthUserId, state.currentAuthUserId, input)
      createdRecord = {
        event: built.event,
        blocks: built.blocks,
        participants: [],
        invites: [],
        matches: built.matches,
      }

      return {
        ...state,
        eventRecords: [createdRecord, ...state.eventRecords],
        storageMode: 'local' as const,
      }
    })

    if (!createdRecord) {
      throw new Error('イベントを作成できませんでした。')
    }
    return createdRecord
  }

  async deleteEvent(eventId: string) {
    updateState((state) => ({
      ...state,
      eventRecords: state.eventRecords.filter((record) => record.event.id !== eventId),
      joinedParticipantIdsByEventId: Object.fromEntries(
        Object.entries(state.joinedParticipantIdsByEventId).filter(([key]) => key !== eventId),
      ),
      storageMode: 'local' as const,
    }))
  }

  async createInvite(input: CreateInviteInput) {
    let createdInvite: EventInvite | null = null

    updateState((state) => {
      const eventRecord = findEventRecordById(state, input.eventId)
      if (!eventRecord) {
        throw new Error('イベントが見つかりません。')
      }

      const invite = createEventInvite(input)
      validateInviteSlot(invite, eventRecord.participants, eventRecord.blocks)
      createdInvite = invite

      return replaceEventRecord(state, {
        ...eventRecord,
        invites: [invite, ...eventRecord.invites],
      })
    })

    if (!createdInvite) {
      throw new Error('招待作成に失敗しました。')
    }
    return createdInvite
  }

  async listProfiles() {
    return this.getState().profiles
  }

  async updateUserRole(userId: string, role: UserRole) {
    updateState((state) => {
      if (state.currentUser?.role !== 'admin') {
        throw new Error('管理者のみユーザー権限を更新できます。')
      }

      return {
        ...state,
        profiles: state.profiles.map((profile) =>
          profile.id === userId ? { ...profile, role } : profile,
        ),
        currentUser:
          state.currentUser.id === userId
            ? { ...state.currentUser, role }
            : state.currentUser,
        storageMode: 'local' as const,
      }
    })
  }

  async getEventRecordById(eventId: string) {
    return findEventRecordById(this.getState(), eventId)
  }

  async getEventRecordByShareToken(shareToken: string) {
    return findEventRecordByToken(this.getState(), shareToken)
  }

  async getInviteByToken(inviteToken: string) {
    return findInviteByToken(this.getState(), inviteToken)
  }

  async joinEvent(shareToken: string, participantName: string) {
    const normalized = participantName.trim()
    if (!normalized) {
      throw new Error('参加者名を入力してください。')
    }

    let updatedRecord: EventRecord | null = null

    updateState((state) => {
      const eventRecord = findEventRecordByToken(state, shareToken)
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

      const participants = [...eventRecord.participants, participant]
      const matches = recomputeMatches(eventRecord.blocks, participants, eventRecord.matches)

      updatedRecord = {
        ...eventRecord,
        participants,
        matches,
      }

      return {
        ...replaceEventRecord(state, updatedRecord),
        joinedParticipantIdsByEventId: {
          ...state.joinedParticipantIdsByEventId,
          [eventRecord.event.id]: participant.id,
        },
        storageMode: 'local' as const,
      }
    })

    if (!updatedRecord) {
      throw new Error('参加登録に失敗しました。')
    }
    return updatedRecord
  }

  async joinEventByInvite(inviteToken: string) {
    let updatedRecord: EventRecord | null = null

    updateState((state) => {
      const invite = findInviteByToken(state, inviteToken)
      if (!invite) {
        throw new Error('招待が見つかりません。')
      }
      if (invite.status === 'joined' && invite.joinedParticipantId) {
        const eventId = invite.eventId
        return {
          ...state,
          joinedParticipantIdsByEventId: {
            ...state.joinedParticipantIdsByEventId,
            [eventId]: invite.joinedParticipantId,
          },
        }
      }

      const eventRecord = findEventRecordById(state, invite.eventId)
      if (!eventRecord) {
        throw new Error('イベントが見つかりません。')
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

      const participants = [...eventRecord.participants, participant]
      const invites = eventRecord.invites.map((candidate) =>
        candidate.id === invite.id ? nextInvite : candidate,
      )
      const matches = recomputeMatches(eventRecord.blocks, participants, eventRecord.matches)

      updatedRecord = {
        ...eventRecord,
        participants,
        invites,
        matches,
      }

      return {
        ...replaceEventRecord(state, updatedRecord),
        joinedParticipantIdsByEventId: {
          ...state.joinedParticipantIdsByEventId,
          [eventRecord.event.id]: participant.id,
        },
        storageMode: 'local' as const,
      }
    })

    if (!updatedRecord) {
      throw new Error('招待参加に失敗しました。')
    }
    return updatedRecord
  }

  async updateParticipantAssignment(
    eventId: string,
    participantId: string,
    assignedBlockIndex: number,
    assignedSeed: number,
  ) {
    let updatedRecord: EventRecord | null = null

    updateState((state) => {
      const eventRecord = findEventRecordById(state, eventId)
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

      updatedRecord = {
        ...eventRecord,
        participants,
        matches: recomputeMatches(eventRecord.blocks, participants, eventRecord.matches),
      }

      return {
        ...replaceEventRecord(state, updatedRecord),
        storageMode: 'local' as const,
      }
    })

    if (!updatedRecord) {
      throw new Error('参加者配置更新に失敗しました。')
    }

    return updatedRecord
  }

  async updateParticipantName(eventId: string, participantId: string, name: string) {
    const normalized = name.trim()
    if (!normalized) {
      throw new Error('参加者名を入力してください。')
    }

    let updatedRecord: EventRecord | null = null

    updateState((state) => {
      const eventRecord = findEventRecordById(state, eventId)
      if (!eventRecord) {
        throw new Error('イベントが見つかりません。')
      }

      const exists = eventRecord.participants.some((participant) => participant.id === participantId)
      if (!exists) {
        throw new Error('参加者が見つかりません。')
      }

      const participants = eventRecord.participants.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              name: normalized,
            }
          : participant,
      )

      const invites = eventRecord.invites.map((invite) =>
        invite.id === eventRecord.participants.find((participant) => participant.id === participantId)?.inviteId
          ? { ...invite, displayName: normalized }
          : invite,
      )

      const nextRecord: EventRecord = {
        ...eventRecord,
        participants,
        invites,
      }
      updatedRecord = nextRecord

      return {
        ...replaceEventRecord(state, nextRecord),
        storageMode: 'local' as const,
      }
    })

    if (!updatedRecord) {
      throw new Error('参加者名の更新に失敗しました。')
    }

    return updatedRecord
  }

  async deleteParticipant(eventId: string, participantId: string) {
    let updatedRecord: EventRecord | null = null

    updateState((state) => {
      const eventRecord = findEventRecordById(state, eventId)
      if (!eventRecord) {
        throw new Error('イベントが見つかりません。')
      }

      const participant = eventRecord.participants.find((item) => item.id === participantId)
      if (!participant) {
        throw new Error('参加者が見つかりません。')
      }

      const participants = eventRecord.participants.filter((item) => item.id !== participantId)
      const invites = eventRecord.invites.map((invite) =>
        invite.id === participant.inviteId
          ? { ...invite, status: 'pending' as const, joinedParticipantId: null }
          : invite,
      )

      const nextRecord: EventRecord = {
        ...eventRecord,
        participants,
        invites,
        matches: recomputeMatches(eventRecord.blocks, participants, eventRecord.matches),
      }
      updatedRecord = nextRecord

      return {
        ...replaceEventRecord(state, nextRecord),
        joinedParticipantIdsByEventId: Object.fromEntries(
          Object.entries(state.joinedParticipantIdsByEventId).filter(
            ([key, value]) => !(key === eventId && value === participantId),
          ),
        ),
        storageMode: 'local' as const,
      }
    })

    if (!updatedRecord) {
      throw new Error('参加者の削除に失敗しました。')
    }

    return updatedRecord
  }

  async updateMatchWinner(eventId: string, matchId: string, winnerParticipantId: string | null) {
    let updatedRecord: EventRecord | null = null

    updateState((state) => {
      const eventRecord = findEventRecordById(state, eventId)
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

      updatedRecord = {
        ...eventRecord,
        matches: setMatchWinner(
          eventRecord.blocks,
          eventRecord.participants,
          eventRecord.matches,
          matchId,
          winnerParticipantId,
        ),
      }

      return {
        ...replaceEventRecord(state, updatedRecord),
        storageMode: 'local' as const,
      }
    })

    if (!updatedRecord) {
      throw new Error('勝者更新に失敗しました。')
    }

    return updatedRecord
  }

  async updateBlockQualifiers(eventId: string, blockId: string, qualifiedParticipantIds: string[]) {
    let updatedRecord: EventRecord | null = null

    updateState((state) => {
      const eventRecord = findEventRecordById(state, eventId)
      if (!eventRecord) {
        throw new Error('イベントが見つかりません。')
      }

      updatedRecord = {
        ...eventRecord,
        matches: setBlockQualifiers(
          eventRecord.blocks,
          eventRecord.participants,
          eventRecord.matches,
          blockId,
          qualifiedParticipantIds,
        ),
      }

      return {
        ...replaceEventRecord(state, updatedRecord),
        storageMode: 'local' as const,
      }
    })

    if (!updatedRecord) {
      throw new Error('ブロック結果更新に失敗しました。')
    }

    return updatedRecord
  }

  async getJoinedParticipantId(eventId: string) {
    return this.getState().joinedParticipantIdsByEventId[eventId] ?? null
  }
}
