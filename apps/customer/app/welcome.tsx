import { useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { devBase, setBase } from '../src/api'
import { colors } from '../src/theme'
import { Arch, Button, Field, Screen } from '../src/ui'

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
      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ gap: 18, paddingTop: 28 }}>
          <Arch />
          <Text style={{ fontFamily: 'Outfit_500Medium', letterSpacing: 2, color: colors.gold, fontSize: 12 }}>JAIPUR</Text>
          <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 48, lineHeight: 52, color: colors.ink }}>Skilled help,{'\n'}at your door.</Text>
          <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 16, lineHeight: 24, color: colors.mute }}>Electricians, plumbers, water fitting, RO, and the rest of the house. Pay after the work is done.</Text>
        </View>
        <View style={{ gap: 12 }}>
          <Field label="API server, only if auto-detect fails" value={server} onChangeText={setServer} placeholder={devBase()} returnKeyType="go" onSubmitEditing={next} />
          <Button label="Continue with mobile" onPress={next} />
        </View>
      </View>
    </Screen>
  )
}
