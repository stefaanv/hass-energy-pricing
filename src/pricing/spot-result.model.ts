export interface DataPoint {
  st: string
  p: string
}

export interface PriceDetail {
  from: Date
  till: Date
  index: number
  energie: number
  injectie: number
  andereTotaalDag: number
  andereTotaalNacht: number
  andereDetail: Record<string, number>
}

export interface SpotResult {
  updated: string
  data: Array<DataPoint>
}
