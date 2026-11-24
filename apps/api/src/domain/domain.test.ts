import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertTransition, nextProviderStatus, TransitionError } from './booking-state'
import { haversineKm } from './geo'
import { rupeesToPaise, splitAmount } from './money'
import { normalizeIndianMobile } from './phone'
import { zonedParts } from './time'

test('commission split keeps the customer total intact', () => {
  const split = splitAmount(34900, 1500)
  assert.equal(split.commissionPaise, 5235)
  assert.equal(split.gstPaise, 799)
  assert.equal(split.providerPaise, 29665)
  assert.equal(split.commissionPaise + split.providerPaise, 34900)
  assert.equal(split.netCommissionPaise + split.gstPaise, split.commissionPaise)
})

test('commission rejects unsafe rates', () => {
  assert.throws(() => splitAmount(10000, 5001), /5000/)
  assert.throws(() => splitAmount(-1, 1500), /non-negative/)
})

test('rupee strings convert without binary drift', () => {
  assert.equal(rupeesToPaise('349'), 34900)
  assert.equal(rupeesToPaise('349.5'), 34950)
  assert.equal(rupeesToPaise('349.50'), 34950)
  assert.equal(rupeesToPaise('1,299.25'), 129925)
  assert.throws(() => rupeesToPaise('12.345'))
})

test('booking transitions follow the job lifecycle', () => {
  assert.doesNotThrow(() => assertTransition('SEARCHING', 'ACCEPTED'))
  assert.throws(() => assertTransition('PAID', 'CANCELLED'), TransitionError)
  assert.equal(nextProviderStatus('ACCEPTED', 'FIXED'), 'EN_ROUTE')
  assert.equal(nextProviderStatus('ACCEPTED', 'QUOTATION'), null)
  assert.equal(nextProviderStatus('QUOTATION_APPROVED', 'QUOTATION'), 'EN_ROUTE')
  assert.equal(nextProviderStatus('IN_PROGRESS', 'FIXED'), 'AWAITING_PAYMENT')
})

test('indian mobiles normalise to E.164', () => {
  assert.equal(normalizeIndianMobile('9000000002'), '+919000000002')
  assert.equal(normalizeIndianMobile('+91 90000 00002'), '+919000000002')
  assert.equal(normalizeIndianMobile('09000000003'), '+919000000003')
  assert.throws(() => normalizeIndianMobile('12345'))
})

test('jaipur localities are a few kilometres apart', () => {
  const km = haversineKm(26.9053, 75.8073, 26.8547, 75.804)
  assert.ok(km > 4 && km < 8, `expected about 6km, got ${km}`)
})

test('kolkata wall time is used for provider hours', () => {
  const parts = zonedParts(new Date('2026-11-25T10:30:00+05:30'))
  assert.equal(parts.dayOfWeek, 3)
  assert.equal(parts.minuteOfDay, 630)
})
