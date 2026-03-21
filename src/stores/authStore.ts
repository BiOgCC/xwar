import { create } from 'zustand'
import { getAuthToken, setAuthToken } from '../api/client'
import { usePlayerStore } from './playerStore'

interface AuthState {
  isAuthenticated: boolean
  setAuthenticated: (auth: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!getAuthToken(),
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),
  logout: () => {
    setAuthToken(null)
    set({ isAuthenticated: false })
    // Optionally reset player store on logout
  }
}))
