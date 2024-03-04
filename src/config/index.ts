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
  pricing: {
    energie: /** in c€/kWh */ (index: number) => 0.204 + index / 10,
    andere: /** telkens in c€/kWh */ {
      'distributie-dag': 5.2295,
      'distributie-nacht': 5.2295,
      transport: 0.4792,
      'groene-stroom': 1.1643,
      wkk: 0.4144,
      accijnzen: 5.0322,
      energiebijdrage: 0.203,
      'vlaamse-energiebijdrage': 0.45,
    },
    injectie: (index: number) => index / 10,
  },
})
