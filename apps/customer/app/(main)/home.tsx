import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { api } from '../../src/api'
import { inr } from '../../src/format'
import { colors, localities } from '../../src/theme'
import { Screen } from '../../src/ui'

type City = { id: string; name: string }
type Service = { id: string; name: string; pricePaise: number | null; pricingType: string; category: { name: string } }

export default function Home() {
  const [city, setCity] = useState<City | null>(null)
  const [note, setNote] = useState('Finding your city')
  const [services, setServices] = useState<Service[]>([])
  const [category, setCategory] = useState('All')

  async function useCity(next: City, label: string) {
    setCity(next)
    setNote(label)
    setServices(await api<Service[]>(`/catalog/services?cityId=${next.id}`))
  }

  useEffect(() => {
    ;(async () => {
      const cities = await api<City[]>('/cities')
      const jaipur = cities.find((item) => item.name === 'Jaipur') ?? cities[0]
      if (!jaipur) return
      try {
        const permission = await Location.requestForegroundPermissionsAsync()
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({})
          const resolved = await api<{ serviceable: boolean; city: City | null; areaLabel: string | null }>(`/geo/resolve?lat=${position.coords.latitude}&lng=${position.coords.longitude}`)
          if (resolved.serviceable && resolved.city) {
            await useCity(resolved.city, resolved.areaLabel ?? resolved.city.name)
            return
          }
        }
      } catch { /* location is optional */ }
      await useCity(jaipur, 'Browsing the Jaipur launch')
    })()
  }, [])

  const categories = ['All', ...new Set(services.map((service) => service.category.name))]
  const visible = services.filter((service) => category === 'All' || service.category.name === category)
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 18 }}>
        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.gold, letterSpacing: 1.5, fontSize: 12 }}>AANGAN · {city?.name ?? '…'}</Text>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 40, lineHeight: 44, color: colors.ink }}>What needs fixing?</Text>
        <Text style={{ fontFamily: 'Outfit_400Regular', color: colors.mute }}>{note}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {categories.map((item) => (
            <Pressable key={item} onPress={() => setCategory(item)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: category === item ? colors.ink : colors.card, borderWidth: 1, borderColor: colors.line }}>
              <Text style={{ color: category === item ? '#fff' : colors.ink, fontFamily: 'Outfit_500Medium' }}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {visible.map((service) => (
          <Pressable key={service.id} onPress={() => router.push({ pathname: '/service/[id]', params: { id: service.id, cityId: city?.id ?? '' } })} style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.gold, fontSize: 12, fontFamily: 'Outfit_500Medium' }}>{service.category.name}</Text>
              <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 22, color: colors.ink }}>{service.name}</Text>
            </View>
            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.pine }}>{service.pricingType === 'FIXED' ? inr(service.pricePaise) : 'Quote'}</Text>
          </Pressable>
        ))}
        <Text style={{ color: colors.mute, fontSize: 12 }}>Visit pins: {localities.map((item) => item.name).join(' · ')}</Text>
      </ScrollView>
    </Screen>
  )
}
