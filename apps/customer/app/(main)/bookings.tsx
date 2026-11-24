import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { api } from '../../src/api'
import { inr, when } from '../../src/format'
import { colors } from '../../src/theme'
import { Screen } from '../../src/ui'

type Card = { id: string; serviceName: string; status: string; areaLabel: string; pricePaise: number | null; createdAt: string }

export default function Bookings() {
  const [items, setItems] = useState<Card[]>([])
  const load = useCallback(() => { api<{ items: Card[] }>('/bookings').then((result) => setItems(result.items)) }, [])
  useFocusEffect(useCallback(() => { load() }, [load]))
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 12 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36, color: colors.ink }}>Your visits</Text>
        {items.length === 0 ? <Text style={{ color: colors.mute }}>Nothing booked yet.</Text> : null}
        {items.map((item) => (
          <Pressable key={item.id} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.id } })} style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.line, gap: 6 }}>
            <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 22 }}>{item.serviceName}</Text>
            <Text style={{ color: colors.mute }}>{item.areaLabel} · {when(item.createdAt)}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.clay, fontFamily: 'Outfit_500Medium' }}>{item.status.replaceAll('_', ' ')}</Text>
              <Text>{inr(item.pricePaise)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  )
}
