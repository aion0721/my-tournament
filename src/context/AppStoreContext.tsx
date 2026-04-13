import {
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { createAppRepository } from '../repositories/repositoryFactory'
import { AppService } from '../services/appService'
import { AppStoreContext, type AppStoreValue } from './appStoreContextValue'

const appRepository = createAppRepository()
const appService = new AppService(appRepository)

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false)
  const [state, setState] = useState(() => appRepository.getState())

  useEffect(() => {
    const unsubscribe = appRepository.subscribe(() => setState(appRepository.getState()))

    void appService.initialize().finally(() => {
      setState(appRepository.getState())
      setIsReady(true)
    })

    return unsubscribe
  }, [])

  const value = useMemo<AppStoreValue>(() => {
    const currentUser = state.users.find((user) => user.id === state.currentUserId) ?? null

    return {
      state,
      currentUserName: currentUser?.name ?? null,
      isReady,
      loginHost: async (name) => {
        await appService.loginHost(name)
        setState(appRepository.getState())
      },
      logout: async () => {
        await appService.logout()
        setState(appRepository.getState())
      },
      createEvent: async (hostUserId, input) => {
        const eventRecord = await appService.createEvent(hostUserId, input)
        setState(appRepository.getState())
        return eventRecord.event.id
      },
      deleteEvent: async (eventId) => {
        await appService.deleteEvent(eventId)
        setState(appRepository.getState())
      },
      createInvite: async (input) => {
        await appService.createInvite(input)
        setState(appRepository.getState())
      },
      joinEvent: async (shareToken, participantName) => {
        await appService.joinEvent(shareToken, participantName)
        setState(appRepository.getState())
      },
      joinEventByInvite: async (inviteToken) => {
        await appService.joinEventByInvite(inviteToken)
        setState(appRepository.getState())
      },
      updateParticipantAssignment: async (
        eventId,
        participantId,
        assignedBlockIndex,
        assignedSeed,
      ) => {
        await appService.updateParticipantAssignment(
          eventId,
          participantId,
          assignedBlockIndex,
          assignedSeed,
        )
        setState(appRepository.getState())
      },
      updateBlockQualifiers: async (eventId, blockId, qualifiedParticipantIds) => {
        await appService.updateBlockQualifiers(eventId, blockId, qualifiedParticipantIds)
        setState(appRepository.getState())
      },
      updateMatchWinner: async (eventId, matchId, winnerParticipantId) => {
        await appService.updateMatchWinner(eventId, matchId, winnerParticipantId)
        setState(appRepository.getState())
      },
    }
  }, [isReady, state])

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}
