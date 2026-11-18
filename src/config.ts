import type { ImmutableObject } from 'jimu-core'

export interface Config {
  /** Nearmap API key. It is sent with every tile and coverage request, so anyone who can open the app can read it. */
  apiKey: string
  tileUrl: string
  coverageUrl: string
  /** Nearmap tile resource type. Only 'Vert' lines up with a Web Mercator map. */
  tileType: string
  /** Zoom level of the tile used to look up captures at the map centre. */
  coverageZoom: number
  maxZoom: number
  /** 0 to 1. */
  opacity: number
  activeOnLoad: boolean
  allowCompare: boolean
  /** Turn imagery off when the widget is closed in a Widget Controller. */
  hideWhenClosed: boolean
}

export type IMConfig = ImmutableObject<Config>
