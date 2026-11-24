import { createContext, useContext, useEffect, useState } from 'react'
import { clearSession, getSession, saveSession, Session } from './api'

type AuthValue = {
  ready: boolean
  session: Session | null
  setSession: (session: Session | null) => Promise<void>
}

const AuthContext = createContext<AuthValue>({ ready: false, session: null, setSession: async () => {} })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    getSession().then((value) => {
      setSessionState(value)
      setReady(true)
    })
  }, [])
  async function setSession(value: Session | null) {
    if (value) await saveSession(value)
    else await clearSession()
    setSessionState(value)
  }
  return <AuthContext.Provider value={{ ready, session, setSession }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
