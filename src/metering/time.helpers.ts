import { addMinutes } from 'date-fns'

export function getEmbracingQuarter(date = new Date()): Date[] {
  const start = roundTime15m(date)
  return [start, addMinutes(start, 15)]
}

export function roundTime15m(date = new Date()): Date {
  const minutes = date.getMinutes()
  const minRounded = minutes - (minutes % 15)
  const year = date.getFullYear()
  const month = date.getMonth()
  const dayOfMOnth = date.getDate()
  const hours = date.getHours()
  return new Date(year, month, dayOfMOnth, hours, minRounded, 0)
}

export function roundTime5s(date = new Date()): Date {
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

export function isBeginningOfMonth(date = new Date()): boolean {
  const rounded = roundTime5s(date)
  return rounded.getDay() == 1 && rounded.getHours() == 0 && rounded.getMinutes() == 0
}
