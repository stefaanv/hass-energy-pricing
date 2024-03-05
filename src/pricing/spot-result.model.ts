export interface DataPoint {
  st: string
  p: string
}

export interface SpotResult {
  updated: string
  data: Array<DataPoint>
}
