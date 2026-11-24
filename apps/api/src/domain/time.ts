const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function zonedParts(date: Date, timeZone = 'Asia/Kolkata') {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  const dayOfWeek = WEEKDAY[parts.weekday]
  if (dayOfWeek === undefined) {
    throw new Error(`Unrecognised weekday ${parts.weekday}`)
  }
  return {
    dayOfWeek,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  }
}
