import { useCallback, useEffect, useState } from 'react'
import { Linking, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { io } from 'socket.io-client'
import { api, getBase, getSession } from '../../src/api'
import { inr, when } from '../../src/format'
import { colors } from '../../src/theme'
import { Button, Screen } from '../../src/ui'
import * as WebBrowser from 'expo-web-browser'

type Booking = {
  id: string
  status: string
  serviceName: string
  issueDescription: string
  pricePaise: number | null
  searchExpiresAt: string
  notifiedCount: number
  address: { line: string | null; area: string; mapsUrl: string | null }
  provider: { name: string | null; ratingAvg: number; jobsCompleted: number } | null
  quote: { id: string; amountPaise: number; notes: string | null; status: string } | null
  review: { rating: number; comment: string | null } | null
  events: Array<{ id: string; message: string; createdAt: string }>
  permissions: { canCancel: boolean; canPay: boolean; canReview: boolean; canChat: boolean; canCall: boolean; canApproveQuote: boolean }
}

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(() => { api<Booking>(`/bookings/${id}`).then(setBooking).catch((err) => setError(err.message)) }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null
    ;(async () => {
      const session = await getSession()
      if (!session) return
      const origin = (await getBase()).replace(/\/v1$/, '')
      socket = io(origin, { path: '/realtime', auth: { token: session.accessToken } })
      socket.emit('booking:join', { bookingId: id })
      socket.on('booking:updated', load)
    })()
    const timer = setInterval(load, 4000)
    return () => { clearInterval(timer); socket?.disconnect() }
  }, [id, load])

  async function pay() {
    const order = await api<{ mock: boolean; checkoutUrl?: string }>(`/bookings/${id}/pay`, { method: 'POST' })
    if (order.mock) await api('/payments/mock-capture', { method: 'POST', body: JSON.stringify({ bookingId: id }) })
    else if (order.checkoutUrl) await WebBrowser.openAuthSessionAsync(order.checkoutUrl, 'aangan-customer://payment-return')
    load()
  }

  if (!booking) return <Screen><Text style={{ padding: 24 }}>{error || 'Loading the visit…'}</Text></Screen>
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 12, paddingBottom: 48 }}>
        <Text style={{ color: colors.gold, fontFamily: 'Outfit_500Medium' }}>{booking.status.replaceAll('_', ' ')}</Text>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 34 }}>{booking.serviceName}</Text>
        <Text style={{ color: colors.mute }}>{booking.issueDescription}</Text>
        {booking.status === 'SEARCHING' ? <Text>Notifying {booking.notifiedCount} professionals until {when(booking.searchExpiresAt)}.</Text> : null}
        {booking.provider ? <Text style={{ fontFamily: 'Outfit_500Medium' }}>{booking.provider.name} · {booking.provider.ratingAvg.toFixed(1)} · {booking.provider.jobsCompleted} jobs</Text> : null}
        <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 28 }}>{inr(booking.pricePaise)}</Text>
        {booking.quote && booking.permissions.canApproveQuote ? (
          <View style={{ gap: 8, backgroundColor: colors.card, padding: 14, borderRadius: 16 }}>
            <Text>Quote {inr(booking.quote.amountPaise)}</Text>
            <Text style={{ color: colors.mute }}>{booking.quote.notes}</Text>
            <Button label="Approve quote" onPress={async () => { await api(`/bookings/${id}/quotes/${booking.quote!.id}/approve`, { method: 'POST' }); load() }} />
            <Button label="Decline quote" tone="ghost" onPress={async () => { await api(`/bookings/${id}/quotes/${booking.quote!.id}/reject`, { method: 'POST' }); load() }} />
          </View>
        ) : null}
        {booking.permissions.canPay ? <Button label={`Pay ${inr(booking.pricePaise)}`} onPress={pay} /> : null}
        {booking.permissions.canCall ? <Button label="Call" tone="pine" onPress={async () => { const result = await api<{ phone: string }>(`/bookings/${id}/call`, { method: 'POST' }); Linking.openURL(`tel:${result.phone}`) }} /> : null}
        {booking.permissions.canChat ? <Button label="Chat" tone="ghost" onPress={() => router.push({ pathname: '/chat/[bookingId]', params: { bookingId: id } })} /> : null}
        {booking.address.mapsUrl ? <Button label="Open in Google Maps" tone="ghost" onPress={() => Linking.openURL(booking.address.mapsUrl!)} /> : null}
        {booking.permissions.canReview && !booking.review ? (
          <View style={{ gap: 8 }}>
            <Text>Rate the visit</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>{[1, 2, 3, 4, 5].map((value) => <Text key={value} onPress={() => setRating(value)} style={{ fontSize: 24 }}>{value <= rating ? '●' : '○'}</Text>)}</View>
            <TextInput value={comment} onChangeText={setComment} placeholder="How did it go?" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, backgroundColor: colors.card }} />
            <Button label="Send review" onPress={async () => { await api(`/bookings/${id}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) }); load() }} />
          </View>
        ) : null}
        {booking.permissions.canCancel ? <Button label="Cancel request" tone="ghost" onPress={async () => { await api(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Plans changed' }) }); load() }} /> : null}
        {booking.events.map((event) => <Text key={event.id} style={{ color: colors.mute }}>{when(event.createdAt)} · {event.message}</Text>)}
        {error ? <Text style={{ color: colors.clay }}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  )
}
