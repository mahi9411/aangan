import { useCallback, useEffect, useState } from 'react'
import { Linking, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { api } from '../../src/api'
import { inr } from '../../src/format'
import { Button, Field, Screen } from '../../src/ui'

type Job = {
  id: string
  status: string
  serviceName: string
  issueDescription: string
  pricePaise: number | null
  areaLabel: string
  photos: Array<{ url: string }>
  address: { line: string | null; area: string; mapsUrl: string | null }
  permissions: { canAccept: boolean; canDecline: boolean; canAdvance: boolean; canQuote: boolean; canRelease: boolean; canCall: boolean }
}

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [label, setLabel] = useState('Labour and parts')
  const [rupees, setRupees] = useState('1200')
  const [error, setError] = useState('')
  const load = useCallback(() => { api<Job>(`/bookings/${id}`).then(setJob).catch((err) => setError(err.message)) }, [id])
  useEffect(() => { load() }, [load])
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 12 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 32 }}>{job?.serviceName ?? 'Job'}</Text>
        <Text>{job?.status} · {job?.areaLabel}</Text>
        <Text>{job?.issueDescription}</Text>
        <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 26 }}>{inr(job?.pricePaise)}</Text>
        {job?.permissions.canAccept ? <Button label="Accept job" onPress={async () => { await api(`/provider/jobs/${id}/accept`, { method: 'POST' }); load() }} /> : null}
        {job?.permissions.canDecline ? <Button label="Decline" tone="ghost" onPress={async () => { await api(`/provider/jobs/${id}/decline`, { method: 'POST' }); load() }} /> : null}
        {job?.permissions.canAdvance ? <Button label="Next step" tone="pine" onPress={async () => { await api(`/provider/jobs/${id}/advance`, { method: 'POST' }); load() }} /> : null}
        {job?.permissions.canQuote ? (
          <View style={{ gap: 8 }}>
            <Field label="Line" value={label} onChangeText={setLabel} />
            <Field label="Rupees" value={rupees} onChangeText={setRupees} />
            <Button label="Send quotation" onPress={async () => {
              const amountPaise = Math.round(Number(rupees) * 100)
              await api(`/provider/jobs/${id}/quotation`, { method: 'POST', body: JSON.stringify({ lineItems: [{ label, amountPaise }], notes: 'Valid for 4 hours' }) })
              load()
            }} />
          </View>
        ) : null}
        {job?.address.mapsUrl ? <Button label="Navigate with Google Maps" tone="ghost" onPress={() => Linking.openURL(job.address.mapsUrl!)} /> : null}
        {job?.permissions.canCall ? <Button label="Call customer" tone="ghost" onPress={async () => { const result = await api<{ phone: string }>(`/bookings/${id}/call`, { method: 'POST' }); Linking.openURL(`tel:${result.phone}`) }} /> : null}
        {job?.permissions.canRelease ? <Button label="Release job" tone="ghost" onPress={async () => { await api(`/provider/jobs/${id}/release`, { method: 'POST', body: JSON.stringify({ reason: 'Cannot reach in time' }) }); load() }} /> : null}
        {error ? <Text>{error}</Text> : null}
        <Button label="Refresh" tone="ghost" onPress={load} />
      </ScrollView>
    </Screen>
  )
}
