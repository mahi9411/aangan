import { useEffect, useState } from 'react'
import { ScrollView, Text } from 'react-native'
import { api } from '../../src/api'
import { inr, when } from '../../src/format'
import { Screen } from '../../src/ui'

type Earnings = { balancePaise: number; availablePaise: number; entries: Array<{ id: string; memo: string; amountPaise: number; createdAt: string }>; payouts: Array<{ id: string; amountPaise: number; status: string }> }

export default function Earnings() {
  const [data, setData] = useState<Earnings | null>(null)
  useEffect(() => { api<Earnings>('/provider/earnings').then(setData) }, [])
  if (!data) return <Screen><Text style={{ padding: 22 }}>Loading earnings…</Text></Screen>
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 10 }}>
        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 36 }}>Earnings</Text>
        <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 32 }}>{inr(data.availablePaise)}</Text>
        <Text>Available to pay out. Ledger balance {inr(data.balancePaise)}.</Text>
        {data.entries.map((entry) => <Text key={entry.id}>{when(entry.createdAt)} · {entry.memo} · {inr(entry.amountPaise)}</Text>)}
        {data.payouts.map((payout) => <Text key={payout.id}>Payout {inr(payout.amountPaise)} · {payout.status}</Text>)}
      </ScrollView>
    </Screen>
  )
}
