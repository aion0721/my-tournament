import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AppStoreProvider } from './context/AppStoreContext'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { EventCreatePage } from './pages/EventCreatePage'
import { EventLobbyPage } from './pages/EventLobbyPage'
import { InviteJoinPage } from './pages/InviteJoinPage'
import { ParticipantJoinPage } from './pages/ParticipantJoinPage'

function App() {
  return (
    <AppStoreProvider>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<EventCreatePage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/events/:eventId" element={<EventLobbyPage />} />
          <Route path="/join/:shareToken" element={<ParticipantJoinPage />} />
          <Route path="/invite/:inviteToken" element={<InviteJoinPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AppStoreProvider>
  )
}

export default App
