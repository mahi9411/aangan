import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { api } from '../../src/api'
import { useAuth } from '../../src/auth'
import { Button, Screen } from '../../src/ui'

export default function Profile() {
  const { setSession } = useAuth()
  const [name, setName] = useState('')
  useEffect(() => { api<{ user: { name: string | null } }>('/provider/me').then((result) => setName(result.user.name ?? '')) }, [])
  return (
    <Screen>
      <View style={{ padding: 22, gap: 12 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36 }}>{name}</Text>
        <Button label="Update profile" tone="ghost" onPress={() => router.push('/onboarding')} />
        <Button label="Sign out" tone="ghost" onPress={async () => { await setSession(null); router.replace('/welcome') }} />
      </View>
    </Screen>
  )
}
