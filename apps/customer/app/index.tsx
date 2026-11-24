import { Redirect } from 'expo-router'
import { useAuth } from '../src/auth'

export default function Index() {
  const { ready, session } = useAuth()
  if (!ready) return null
  if (!session) return <Redirect href="/welcome" />
  if (!session.user.name) return <Redirect href="/name" />
  return <Redirect href="/home" />
}
