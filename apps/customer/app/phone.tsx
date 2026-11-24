import { useState } from 'react'
import { Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../src/api'
import { colors } from '../src/theme'
import { Button, Field, Screen } from '../src/ui'

export default function Phone() {
  const params = useLocalSearchParams<{ phone?: string }>()
  const [phone, setPhone] = useState(params.phone ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function send() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await api<{ devCode?: string }>('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone, role: 'CUSTOMER' }) })
      router.push({ pathname: '/otp', params: { phone, devCode: result.devCode ?? '' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Screen>
      <View style={{ padding: 24, gap: 18 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36, color: colors.ink }}>Your mobile</Text>
        <Text style={{ fontFamily: 'Outfit_400Regular', color: colors.mute }}>We will send a one-time code. Demo numbers use 123456.</Text>
        <Field label="Indian mobile" value={phone} onChangeText={setPhone} placeholder="9000000002" keyboardType="phone-pad" returnKeyType="done" onSubmitEditing={send} />
        {error ? <Text style={{ color: colors.clay }}>{error}</Text> : null}
        <Button label={busy ? 'Sending' : 'Send code'} disabled={busy} onPress={send} />
      </View>
    </Screen>
  )
}
