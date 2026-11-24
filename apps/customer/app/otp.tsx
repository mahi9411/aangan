import { useState } from 'react'
import { Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../src/api'
import { useAuth } from '../src/auth'
import { colors } from '../src/theme'
import { Button, Field, Screen } from '../src/ui'

export default function Otp() {
  const { phone, devCode } = useLocalSearchParams<{ phone: string; devCode?: string }>()
  const { setSession } = useAuth()
  const [code, setCode] = useState(devCode ?? '')
  const [error, setError] = useState('')
  return (
    <Screen>
      <View style={{ padding: 24, gap: 18 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36, color: colors.ink }}>Enter the code</Text>
        <Text style={{ color: colors.mute, fontFamily: 'Outfit_400Regular' }}>Sent to {phone}{devCode ? ` · dev ${devCode}` : ''}</Text>
        <Field label="6-digit code" value={code} onChangeText={setCode} />
        {error ? <Text style={{ color: colors.clay }}>{error}</Text> : null}
        <Button label="Verify" onPress={async () => {
          try {
            const session = await api<{ accessToken: string; refreshToken: string; user: { id: string; name: string | null; phone: string; role: string } }>('/auth/otp/verify', {
              method: 'POST',
              body: JSON.stringify({ phone, role: 'CUSTOMER', code }),
            })
            await setSession(session)
            router.replace(session.user.name ? '/home' : '/name')
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Incorrect code')
          }
        }} />
      </View>
    </Screen>
  )
}
