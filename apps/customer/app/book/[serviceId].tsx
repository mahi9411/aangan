import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router, useLocalSearchParams } from 'expo-router'
import { api, uploadImage } from '../../src/api'
import { kolkataSlot } from '../../src/format'
import { colors, localities } from '../../src/theme'
import { Button, Field, Screen } from '../../src/ui'

const slots = ['09:00', '11:00', '13:00', '15:00', '17:00']

export default function Book() {
  const { serviceId, cityId } = useLocalSearchParams<{ serviceId: string; cityId: string }>()
  const [issue, setIssue] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [mode, setMode] = useState<'INSTANT' | 'SCHEDULED'>('INSTANT')
  const [day, setDay] = useState(1)
  const [slot, setSlot] = useState('11:00')
  const [locality, setLocality] = useState(localities[1])
  const [line, setLine] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function addPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    if (result.canceled) return
    const uploaded = await uploadImage(result.assets[0].uri, 'booking')
    if (uploaded.url) setPhotos((current) => [...current, uploaded.url!].slice(0, 4))
  }

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const address = await api<{ id: string }>('/addresses', {
        method: 'POST',
        body: JSON.stringify({ label: 'Visit', line1: line, areaLabel: locality.name, lat: locality.lat, lng: locality.lng, cityId }),
      })
      const booking = await api<{ id: string }>('/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': `${Date.now()}-${serviceId}` },
        body: JSON.stringify({
          serviceId,
          addressId: address.id,
          mode,
          scheduledAt: mode === 'SCHEDULED' ? kolkataSlot(day, slot) : undefined,
          issueDescription: issue,
          photoUrls: photos,
        }),
      })
      router.replace({ pathname: '/booking/[id]', params: { id: booking.id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 14, paddingBottom: 40 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36 }}>Tell us the problem</Text>
        <Field label="What is going on?" value={issue} onChangeText={setIssue} multiline placeholder="The ceiling fan hums but will not turn." />
        <Button label={photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} added` : 'Add a photo'} tone="ghost" onPress={addPhoto} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['INSTANT', 'SCHEDULED'] as const).map((item) => (
            <Pressable key={item} onPress={() => setMode(item)} style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: mode === item ? colors.ink : colors.card }}>
              <Text style={{ color: mode === item ? '#fff' : colors.ink, textAlign: 'center', fontFamily: 'Outfit_500Medium' }}>{item === 'INSTANT' ? 'As soon as possible' : 'Schedule'}</Text>
            </Pressable>
          ))}
        </View>
        {mode === 'SCHEDULED' ? (
          <View style={{ gap: 8 }}>
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {[1, 2, 3, 4, 5].map((offset) => (
                <Pressable key={offset} onPress={() => setDay(offset)} style={{ padding: 10, borderRadius: 12, backgroundColor: day === offset ? colors.pine : colors.card }}>
                  <Text style={{ color: day === offset ? '#fff' : colors.ink }}>Day {offset}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {slots.map((item) => (
                <Pressable key={item} onPress={() => setSlot(item)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: slot === item ? colors.clay : colors.card }}>
                  <Text style={{ color: slot === item ? '#fff' : colors.ink }}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <Text style={{ fontFamily: 'Outfit_500Medium' }}>Where in Jaipur?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {localities.map((item) => (
            <Pressable key={item.name} onPress={() => setLocality(item)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: locality.name === item.name ? colors.pine : colors.card }}>
              <Text style={{ color: locality.name === item.name ? '#fff' : colors.ink }}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="House or flat" value={line} onChangeText={setLine} placeholder="42, Malviya Nagar" />
        {error ? <Text style={{ color: colors.clay }}>{error}</Text> : null}
        <Button label={busy ? 'Sending' : 'Request a professional'} disabled={busy || issue.trim().length < 10 || line.trim().length < 3} onPress={submit} />
      </ScrollView>
    </Screen>
  )
}
