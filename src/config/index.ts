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
  },
  database: {
    host: '192.168.0.3',
    user: 'homeassistant',
    password: process.env.DB_PASSWORD,
    dbName: 'energy',
  },
})
