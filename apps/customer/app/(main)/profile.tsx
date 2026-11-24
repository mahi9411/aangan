import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { api } from '../../src/api'
import { useAuth } from '../../src/auth'
import { colors } from '../../src/theme'
import { Button, Screen } from '../../src/ui'

export default function Profile() {
  const { session, setSession } = useAuth()
  return (
    <Screen>
      <View style={{ padding: 22, gap: 16 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36 }}>{session?.user.name}</Text>
        <Text style={{ color: colors.mute }}>{session?.user.phone}</Text>
        <Button label="Notifications" tone="ghost" onPress={async () => {
          const items = await api<Array<{ title: string }>>('/notifications')
          alert(items.slice(0, 5).map((item) => item.title).join('\n') || 'No updates yet')
        }} />
        <Button label="Sign out" tone="ghost" onPress={async () => { await setSession(null); router.replace('/welcome') }} />
      </View>
    </Screen>
  )
}
