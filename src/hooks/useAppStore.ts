import { useContext } from 'react'
import { AppStoreContext } from '../context/appStoreContextValue'

export function useAppStore() {
  const context = useContext(AppStoreContext)
  if (!context) {
    throw new Error('useAppStore must be used within AppStoreProvider.')
  }
  return context
}
