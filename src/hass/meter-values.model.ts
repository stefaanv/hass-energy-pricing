interface MeterValues {
  timestamp: Date
  consPeak: number
  consOffPeak: number
  injPeak: number
  injOffPeak: number
  batCharge: number
  batDischarge: number
  gas: number
}

interface MeteringResume {
  from: Date
  till: Date
  consumption: number
  injection: number
  batCharge: number
  batDischarge: number
  gas: number
  tariff: 'peak' | 'off-peak'
}
