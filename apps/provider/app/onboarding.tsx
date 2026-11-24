import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { api, uploadImage } from '../src/api'
import { colors, localities } from '../src/theme'
import { Button, Field, Screen } from '../src/ui'

type Service = { id: string; name: string; category: { name: string } }

export default function Onboarding() {
  const [name, setName] = useState('')
  const [years, setYears] = useState('5')
  const [selected, setSelected] = useState<string[]>([])
  const [area, setArea] = useState(localities[0])
  const [docs, setDocs] = useState<Partial<Record<'AADHAAR' | 'PAN' | 'SELFIE', string>>>({})
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [upi, setUpi] = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [cityId, setCityId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const cities = await api<Array<{ id: string }>>('/cities')
      const nextCity = cities[0]?.id
      if (!nextCity) return
      setCityId(nextCity)
      setServices(await api<Service[]>(`/catalog/services?cityId=${nextCity}`))
    })().catch((err) => setError(err instanceof Error ? err.message : 'Could not load skills'))
  }, [])

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function pick(type: 'AADHAAR' | 'PAN' | 'SELFIE') {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 })
    if (result.canceled) return
    const uploaded = await uploadImage(result.assets[0].uri, 'kyc')
    if (uploaded.fileId) setDocs((current) => ({ ...current, [type]: uploaded.fileId }))
  }

  const ready = name.trim().length >= 2 && selected.length > 0 && docs.AADHAAR && docs.PAN && docs.SELFIE && accountNumber.length >= 9 && ifsc.trim().length === 11

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      const position = permission.status === 'granted' ? await Location.getCurrentPositionAsync({}) : null
      await api('/provider/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          bio: `${name.trim()} takes home-service jobs around ${area.name}.`,
          experienceYears: Number(years) || 0,
          serviceIds: selected,
          cityId,
          areaLabel: area.name,
          baseLat: position?.coords.latitude ?? area.lat,
          baseLng: position?.coords.longitude ?? area.lng,
          radiusKm: 12,
          accountName: (accountName || name).trim(),
          accountNumber,
          ifsc: ifsc.trim().toUpperCase(),
          upiId: upi.trim() || undefined,
          documents: (['AADHAAR', 'PAN', 'SELFIE'] as const).map((type) => ({ type, fileId: docs[type] })),
        }),
      })
      router.replace('/jobs')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit')
    } finally {
      setBusy(false)
    }
  }

  const groups = [...new Set(services.map((service) => service.category.name))]

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 14, paddingBottom: 48 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 34, color: colors.ink }}>Verification</Text>
        <Text style={{ color: colors.mute, fontFamily: 'Outfit_400Regular' }}>Tell us what you do, where you work, and where earnings should go. Ops reviews the documents before jobs arrive.</Text>
        <Field label="Name on the app" value={name} onChangeText={setName} placeholder="Raju Verma" />
        <Field label="Years of experience" value={years} onChangeText={setYears} placeholder="5" />
        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.ink }}>Skills</Text>
        {groups.map((group) => (
          <View key={group} style={{ gap: 8 }}>
            <Text style={{ color: colors.gold, fontSize: 12, fontFamily: 'Outfit_500Medium' }}>{group}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {services.filter((service) => service.category.name === group).map((service) => {
                const on = selected.includes(service.id)
                return (
                  <Pressable key={service.id} onPress={() => toggle(service.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? colors.pine : colors.card, borderWidth: 1, borderColor: on ? colors.pine : colors.line }}>
                    <Text style={{ color: on ? '#fff' : colors.ink, fontFamily: 'Outfit_500Medium' }}>{service.name}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ))}
        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.ink }}>Base area</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {localities.map((item) => (
            <Pressable key={item.name} onPress={() => setArea(item)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: area.name === item.name ? colors.ink : colors.card }}>
              <Text style={{ color: area.name === item.name ? '#fff' : colors.ink }}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        {(['AADHAAR', 'PAN', 'SELFIE'] as const).map((type) => (
          <Button key={type} label={docs[type] ? `${type} added` : `Upload ${type}`} tone="ghost" onPress={() => pick(type)} />
        ))}
        <Field label="Account name" value={accountName} onChangeText={setAccountName} placeholder="Same as your name" />
        <Field label="Account number" value={accountNumber} onChangeText={setAccountNumber} placeholder="9 to 18 digits" />
        <Field label="IFSC" value={ifsc} onChangeText={setIfsc} placeholder="SBIN0001234" />
        <Field label="UPI (optional)" value={upi} onChangeText={setUpi} placeholder="name@oksbi" />
        {error ? <Text style={{ color: colors.clay }}>{error}</Text> : null}
        <Button label={busy ? 'Sending' : 'Submit for review'} disabled={!ready || busy} onPress={submit} />
      </ScrollView>
    </Screen>
  )
}
