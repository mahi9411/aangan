import { useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { api } from '../src/api'
import { useAuth } from '../src/auth'
import { colors } from '../src/theme'
import { Button, Field, Screen } from '../src/ui'

export default function Name() {
  const { session, setSession } = useAuth()
  const [name, setName] = useState('')
  return (
    <Screen>
      <View style={{ padding: 24, gap: 18 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36, color: colors.ink }}>What should we call you?</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Meera Sharma" />
        <Button label="Continue" onPress={async () => {
          const user = await api<{ id: string; name: string | null; phone: string; role: string }>('/me', { method: 'PATCH', body: JSON.stringify({ name }) })
          if (session) await setSession({ ...session, user })
          router.replace('/home')
        }} />
      </View>
    </Screen>
  )
}
