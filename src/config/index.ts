export default () => ({
  timeZone: 'Europe/Brussels',
  port: parseInt(process.env.PORT || '3000'),
  belpexSpot: {
    url: 'https://spot.56k.guru/api/v2/hass',
    params: {
      currency: 'EUR',
      area: 'BE',
      multiplier: 1000,
      extra: 0,
      factor: 1,
      decimals: 5,
    },
  },
  peakPeriods: {
    days: [1, 2, 3, 4, 5], //ma-vr,feestdagen spelen geen rol 1
    hours: { from: 6, till: 20 }, // Kortrijk is in lijst uitzonderingen: dag van 6:00 tot 21:00
  },
  homeAssistant: {
    baseUrl: 'http://192.168.0.3:8123/api',
    bearerToken: process.env.HASS_AUTH_TOKEN,
    entityNames: {
      // van slimmemeter
      consPeak: 'sensor.energy_consumed_tariff_1',
      consOffPeak: 'sensor.energy_consumed_tariff_2',
      injPeak: 'sensor.energy_produced_tariff_1',
      injOffPeak: 'sensor.energy_produced_tariff_2',
      gas: 'sensor.gas_consumed_belgium',
      // van inverter
      batCharge: 'sensor.battery_total_charge',
      batDischarge: 'sensor.battery_total_discharge',
      batSOC: 'sensor.battery_state_of_capacity',
    },
  },
  database: {
    host: '192.168.0.3',
    user: 'homeassistant',
    password: process.env.DB_PASSWORD,
    dbName: 'energy',
  },
})
