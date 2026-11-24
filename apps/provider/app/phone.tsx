import { useState } from 'react'
import { Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../src/api'
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
      const result = await api<{ devCode?: string }>('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone, role: 'PROVIDER' }) })
      router.push({ pathname: '/otp', params: { phone, devCode: result.devCode ?? '' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Screen>
      <View style={{ padding: 24, gap: 16 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36 }}>Work number</Text>
        <Field label="Mobile" value={phone} onChangeText={setPhone} placeholder="9000000011" keyboardType="phone-pad" returnKeyType="done" onSubmitEditing={send} />
        {error ? <Text>{error}</Text> : null}
        <Button label={busy ? 'Sending' : 'Send code'} disabled={busy} onPress={send} />
      </View>
    </Screen>
  )
}
