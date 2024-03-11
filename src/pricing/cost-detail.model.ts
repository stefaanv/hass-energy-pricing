export class CostCalc {
  amount = 0
  amountUnit = 'kWh'
  unitPrice: number | undefined = undefined
  unitPriceUnit = 'c€/kWh'
  price = 0
  priceUnit = '€'

  add(amount: number, unitPrice: number) {
    this.amount += amount
    this.price += (amount * unitPrice) / 100
  }

  round() {
    return {
      amount: round3d(this.amount),
      amountUnit: this.amountUnit,
      unitPrice: round2d(this.unitPrice ?? 0),
      unitPriceUnit: this.unitPriceUnit,
      price: round2d(this.price ?? 0),
      priceUnit: this.priceUnit,
    }
  }
}

export class CostDetail {
  consumption = new CostCalc()
  injection = new CostCalc()
  other = new CostCalc()

  add(
    consumption: number,
    injection: number,
    consumptionPrice: number,
    injectionPrice: number,
    otherPrice: number,
  ) {
    this.consumption.add(consumption, consumptionPrice)
    this.injection.add(injection, injectionPrice)
    this.other.add(consumption, otherPrice)
  }

  round() {
    return {
      consumption: this.consumption.round(),
      injection: this.injection.round(),
      other: this.other.round(),
    }
  }
}

function round3d(x: number) {
  return Math.round(1000 * x) / 1000
}

function round2d(x: number) {
  return Math.round(100 * x) / 100
}
