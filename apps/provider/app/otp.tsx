import { useState } from 'react'
import { Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../src/api'
import { useAuth } from '../src/auth'
import { Button, Field, Screen } from '../src/ui'

export default function Otp() {
  const { phone, devCode } = useLocalSearchParams<{ phone: string; devCode?: string }>()
  const { setSession } = useAuth()
  const [code, setCode] = useState(devCode ?? '')
  const [error, setError] = useState('')
  return (
    <Screen>
      <View style={{ padding: 24, gap: 16 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36 }}>Code</Text>
        <Text>{devCode ? `Dev ${devCode}` : phone}</Text>
        <Field label="Code" value={code} onChangeText={setCode} />
        {error ? <Text>{error}</Text> : null}
        <Button label="Verify" onPress={async () => {
          try {
            const session = await api<{ accessToken: string; refreshToken: string; user: { id: string; name: string | null; phone: string; role: string } }>('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, role: 'PROVIDER', code }) })
            await setSession(session)
            router.replace('/jobs')
          } catch (err) { setError(err instanceof Error ? err.message : 'Failed') }
        }} />
      </View>
    </Screen>
  )
}
