import { useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { devBase, setBase } from '../src/api'
import { Button, Field, Screen } from '../src/ui'

export default function Welcome() {
  const [server, setServer] = useState('')
  async function next() {
    const value = server.trim()
    if (/^[6-9]\d{9}$/.test(value)) {
      router.push({ pathname: '/phone', params: { phone: value } })
      return
    }
    if (value) await setBase(value)
    router.push('/phone')
  }
  return (
    <Screen>
      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between', backgroundColor: '#1F4F45' }}>
        <View style={{ gap: 12, paddingTop: 36 }}>
          <Text style={{ color: '#E7C98A', letterSpacing: 2 }}>AANGAN PRO</Text>
          <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 46, color: '#F4EFE6' }}>Jobs near you.{'\n'}You take the first one.</Text>
        </View>
        <View style={{ gap: 12 }}>
          <Field label="API server, only if auto-detect fails" value={server} onChangeText={setServer} placeholder={devBase()} returnKeyType="go" onSubmitEditing={next} />
          <Button label="Continue" onPress={next} />
        </View>
      </View>
    </Screen>
  )
}
