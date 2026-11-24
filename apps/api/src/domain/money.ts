const MAX_COMMISSION_BPS = 5000

export type AmountSplit = {
  commissionPaise: number
  gstPaise: number
  netCommissionPaise: number
  providerPaise: number
}

/** Commission is GST-inclusive. Customer price does not change. */
export function splitAmount(amountPaise: number, commissionBps: number): AmountSplit {
  if (!Number.isInteger(amountPaise) || amountPaise < 0) {
    throw new Error('Amount must be a non-negative integer in paise')
  }
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > MAX_COMMISSION_BPS) {
    throw new Error('Commission must be an integer between 0 and 5000 basis points')
  }
  const commissionPaise = Math.round((amountPaise * commissionBps) / 10000)
  const gstPaise = Math.round((commissionPaise * 18) / 118)
  const providerPaise = amountPaise - commissionPaise
  return {
    commissionPaise,
    gstPaise,
    netCommissionPaise: commissionPaise - gstPaise,
    providerPaise,
  }
}

export function rupeesToPaise(input: string): number {
  const normalized = input.replace(/,/g, '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter an amount with up to 2 decimal places')
  }
  const [rupees, fraction = ''] = normalized.split('.')
  return Number(rupees) * 100 + Number(fraction.padEnd(2, '0'))
}
