import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../src/api'
import { inr } from '../../src/format'
import { colors } from '../../src/theme'
import { Button, Screen } from '../../src/ui'

type Detail = {
  id: string
  name: string
  description: string
  highlights: string[]
  pricePaise: number | null
  pricingType: string
  estimatedMinutes: number
  pros: Array<{ id: string; name: string | null; ratingAvg: number; jobsCompleted: number; areas: string[] }>
}

export default function Service() {
  const { id, cityId } = useLocalSearchParams<{ id: string; cityId: string }>()
  const [service, setService] = useState<Detail | null>(null)
  useEffect(() => { api<Detail>(`/catalog/services/${id}?cityId=${cityId}`).then(setService) }, [id, cityId])
  if (!service) return <Screen><Text style={{ padding: 24 }}>Loading…</Text></Screen>
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 14, paddingBottom: 40 }}>
        <Text style={{ color: colors.gold, fontFamily: 'Outfit_500Medium' }}>{service.estimatedMinutes} min visit</Text>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 38, color: colors.ink }}>{service.name}</Text>
        <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 28, color: colors.pine }}>{service.pricingType === 'FIXED' ? inr(service.pricePaise) : 'Quote after acceptance'}</Text>
        <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 16, lineHeight: 24, color: colors.mute }}>{service.description}</Text>
        {service.highlights.map((item) => <Text key={item} style={{ fontFamily: 'Outfit_400Regular' }}>· {item}</Text>)}
        <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 24, marginTop: 8 }}>Verified in this city</Text>
        {service.pros.map((pro) => (
          <View key={pro.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: colors.line }}>
            <Text style={{ fontFamily: 'Outfit_500Medium' }}>{pro.name}</Text>
            <Text style={{ color: colors.mute }}>{pro.ratingAvg.toFixed(1)} · {pro.jobsCompleted} jobs · {pro.areas.join(', ')}</Text>
          </View>
        ))}
        <Button label="Book this visit" onPress={() => router.push({ pathname: '/book/[serviceId]', params: { serviceId: service.id, cityId } })} />
      </ScrollView>
    </Screen>
  )
}
