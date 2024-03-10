export function getEmbracingQuarter(date = new Date()): Date[] {
  const minutes = date.getMinutes()
  const minStart = minutes - (minutes % 15)
  const minEnd = minStart + 15
  const year = date.getFullYear()
  const month = date.getMonth()
  const dayOfMOnth = date.getDate()
  const hours = date.getHours()
  return [
    new Date(year, month, dayOfMOnth, hours, minStart, 0),
    new Date(year, month, dayOfMOnth, hours, minEnd, 0),
  ]
}

export function roundTime15m(date = new Date()): Date {
  const seconds = Math.round(date.getSeconds() / 5) * 5
  const minutes = date.getMinutes()
  const year = date.getFullYear()
  const month = date.getMonth()
  const dayOfMOnth = date.getDate()
  const hours = date.getHours()
  return new Date(year, month, dayOfMOnth, hours, minutes, seconds)
}

export function isQuarter(date = new Date()): boolean {
  return date.getMinutes() % 15 === 0 && date.getSeconds() === 0
}
