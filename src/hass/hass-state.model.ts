export interface HassStateResponse {
  entity_id: string
  state: string
  attributes: HassStateAttributes
  last_changed: Date
  last_updated: Date
  context: HassStateContext
}

export interface HassStateAttributes {
  state_class: string
  unit_of_measurement: string
  device_class: string
  friendly_name: string
}

export interface HassStateContext {
  id: string
  parent_id?: string
  user_id?: string
}
