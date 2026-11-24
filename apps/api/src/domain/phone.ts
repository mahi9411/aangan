export function normalizeIndianMobile(input: string): string {
  const digits = input.replace(/\D/g, '')
  const national =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits
  if (!/^[6-9]\d{9}$/.test(national)) {
    throw new Error('Enter a valid Indian mobile number')
  }
  return `+91${national}`
}

export function formatIndianMobile(e164: string): string {
  const national = e164.replace('+91', '')
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`
}
