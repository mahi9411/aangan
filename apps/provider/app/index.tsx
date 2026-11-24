import { Redirect } from 'expo-router'
import { useAuth } from '../src/auth'

export default function Index() {
  const { ready, session } = useAuth()
  if (!ready) return null
  if (!session) return <Redirect href="/welcome" />
  return <Redirect href="/jobs" />
}
