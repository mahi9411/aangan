import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import * as Location from 'expo-location'
import { router, useFocusEffect } from 'expo-router'
import { io } from 'socket.io-client'
import { api, getBase, getSession } from '../../src/api'
import { inr } from '../../src/format'
import { Button, Screen } from '../../src/ui'

type Offer = { id: string; serviceName: string; areaLabel: string; pricePaise: number | null; pricingType: string; distanceM: number | null; mode: string }
type Profile = { profile: { kycStatus: string; isOnline: boolean } | null }

export default function Jobs() {
  const [me, setMe] = useState<Profile | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [active, setActive] = useState<Offer[]>([])

  const load = useCallback(async () => {
    const profile = await api<Profile>('/provider/me')
    setMe(profile)
    if (profile.profile?.kycStatus === 'APPROVED') {
      const jobs = await api<{ offers: Offer[]; active: Offer[] }>('/provider/jobs')
      setOffers(jobs.offers)
      setActive(jobs.active)
    }
  }, [])
  useFocusEffect(useCallback(() => { load() }, [load]))
  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null
    ;(async () => {
      const session = await getSession()
      if (!session) return
      socket = io((await getBase()).replace(/\/v1$/, ''), { path: '/realtime', auth: { token: session.accessToken } })
      socket.on('job:offer', load)
      socket.on('job:closed', load)
      socket.on('booking:updated', load)
    })()
    return () => { socket?.disconnect() }
  }, [load])

  async function toggle() {
    if (!me?.profile?.isOnline) {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') return
      const position = await Location.getCurrentPositionAsync({})
      await api('/provider/presence', { method: 'PATCH', body: JSON.stringify({ isOnline: true, lat: position.coords.latitude, lng: position.coords.longitude }) })
    } else {
      await api('/provider/presence', { method: 'PATCH', body: JSON.stringify({ isOnline: false }) })
    }
    load()
  }

  if (me && !me.profile) {
    return <Screen><View style={{ padding: 22, gap: 12 }}><Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36 }}>Set up your practice</Text><Button label="Start verification" onPress={() => router.push('/onboarding')} /></View></Screen>
  }
  if (me?.profile && me.profile.kycStatus !== 'APPROVED') {
    return <Screen><View style={{ padding: 22, gap: 12 }}><Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36 }}>Verification is {me.profile.kycStatus.toLowerCase()}</Text><Text>You will receive jobs after ops approves the documents.</Text></View></Screen>
  }
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 12 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36 }}>Jobs</Text>
        <Button label={me?.profile?.isOnline ? 'You are online' : 'Go online'} tone={me?.profile?.isOnline ? 'pine' : 'clay'} onPress={toggle} />
        <Text style={{ fontFamily: 'Outfit_500Medium' }}>Offers</Text>
        {offers.map((offer) => (
          <Pressable key={offer.id} onPress={() => router.push({ pathname: '/job/[id]', params: { id: offer.id } })} style={{ backgroundColor: '#fff', padding: 14, borderRadius: 16 }}>
            <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 22 }}>{offer.serviceName}</Text>
            <Text>{offer.areaLabel} · {offer.distanceM != null ? `${(offer.distanceM / 1000).toFixed(1)} km` : ''} · {offer.pricingType === 'FIXED' ? inr(offer.pricePaise) : 'Quote'}</Text>
          </Pressable>
        ))}
        {offers.length === 0 ? <Text>No open offers.</Text> : null}
        <Text style={{ fontFamily: 'Outfit_500Medium' }}>Active</Text>
        {active.map((job) => (
          <Pressable key={job.id} onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })} style={{ padding: 14, borderRadius: 16, backgroundColor: '#E7F0EC' }}>
            <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 20 }}>{job.serviceName}</Text>
            <Text>{job.areaLabel}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  )
}
