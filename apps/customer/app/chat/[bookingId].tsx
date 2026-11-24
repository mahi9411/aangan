import { useEffect, useState } from 'react'
import { FlatList, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { io } from 'socket.io-client'
import { api, getBase, getSession } from '../../src/api'
import { colors } from '../../src/theme'
import { Button, Screen } from '../../src/ui'

type Message = { id: string; body: string; mine: boolean; kind: string }

export default function Chat() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  async function load() { setMessages(await api<Message[]>(`/bookings/${bookingId}/messages`)) }
  useEffect(() => {
    load()
    let socket: ReturnType<typeof io> | null = null
    ;(async () => {
      const session = await getSession()
      if (!session) return
      socket = io((await getBase()).replace(/\/v1$/, ''), { path: '/realtime', auth: { token: session.accessToken } })
      socket.emit('booking:join', { bookingId })
      socket.on('chat:message', load)
    })()
    return () => { socket?.disconnect() }
  }, [bookingId])
  return (
    <Screen>
      <FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={{ padding: 16, gap: 8 }} renderItem={({ item }) => (
        <View style={{ alignSelf: item.kind === 'SYSTEM' ? 'center' : item.mine ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: item.kind === 'SYSTEM' ? 'transparent' : item.mine ? colors.ink : colors.card, borderRadius: 14, padding: 10 }}>
          <Text style={{ color: item.mine && item.kind !== 'SYSTEM' ? '#fff' : colors.mute }}>{item.body}</Text>
        </View>
      )} />
      <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
        <TextInput value={text} onChangeText={setText} placeholder="Message" style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12 }} />
        <Button label="Send" onPress={async () => { if (!text.trim()) return; await api(`/bookings/${bookingId}/messages`, { method: 'POST', body: JSON.stringify({ body: text }) }); setText(''); load() }} />
      </View>
    </Screen>
  )
}
