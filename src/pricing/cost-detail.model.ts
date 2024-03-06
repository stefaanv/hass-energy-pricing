export interface CostCalc {
  amount: number
  unitPrice: number | undefined
  price: number
}

export interface CostDetail {
  consumption: CostCalc
  injection: CostCalc
  other: CostCalc
}

export function costStarter(otherTotalUnitPrice: number): CostDetail {
  return {
    consumption: {
      amount: 0,
      unitPrice: undefined,
      price: 0,
    },
    injection: {
      amount: 0,
      unitPrice: undefined,
      price: 0,
    },
    other: {
      amount: 0,
      unitPrice: otherTotalUnitPrice,
      price: 0,
    },
  }
}
