import { React, ReactDOM, hooks, classNames, type AllWidgetProps, WidgetState } from 'jimu-core'
import { useTheme } from 'jimu-theme'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { Button, Loading, LoadingType, Paper, Slider, Switch } from 'jimu-ui'
import 'arcgis-map-components'
import { LeftOutlined } from 'jimu-icons/outlined/directional/left'
import { RightOutlined } from 'jimu-icons/outlined/directional/right'
import { InfoOutlined } from 'jimu-icons/outlined/suggested/info'
import { CloseOutlined } from 'jimu-icons/outlined/editor/close'
import { ImageryLayerOutlined } from 'jimu-icons/outlined/gis/imagery-layer'
import WebTileLayer from 'esri/layers/WebTileLayer'
import TileInfo from 'esri/layers/support/TileInfo'
import SpatialReference from 'esri/geometry/SpatialReference'
import * as reactiveUtils from 'esri/core/reactiveUtils'
import type { IMConfig } from '../config'
import {
  CoverageError, type CoverageErrorReason, fetchCaptureDates, formatDate, latToTileY, lonToTileX, nearestDate, tileUrlTemplate
} from './nearmap-api'
import { mapLabelStyle, widgetStyle } from './style'
import defaultMessages from './translations/default'

type Slot = 'a' | 'b'
interface DateChange { slot: Slot, from: string, to: string }
type Status = 'idle' | 'loading' | 'ready' | 'error'

interface SwipeElement extends HTMLElement {
  view: __esri.MapView | null
  startLayers: any
  endLayers: any
  position: number
  autoDestroyDisabled: boolean
  destroy: () => Promise<void>
}

const LAYER_ID_PREFIX = 'nearmap-imagery-'
const COVERAGE_DEBOUNCE_MS = 400
const SWAP_TIMEOUT_MS = 5000
const NOTICE_MS = 8000
// Hide a map label when the swipe line is closer than this to the map edge.
const LABEL_ROOM_PX = 150

const ERROR_KEYS: { [K in CoverageErrorReason]: string } = {
  invalidKey: 'nmInvalidKey', notAuthorised: 'nmNotAuthorised', noCoverage: 'nmNoCoverage', network: 'nmNetwork'
}

const isWebMercator = (sr: __esri.SpatialReference | null | undefined) => !!sr?.isWebMercator

export default function Widget (props: AllWidgetProps<IMConfig>) {
  const { config, id: widgetId } = props
  const translate = hooks.useTranslation(defaultMessages)
  const theme = useTheme()
  const darkTheme = theme?.sys?.color?.mode === 'dark'
  const locale = props.intl?.locale || 'en'

  const apiKey = (config.apiKey || '').trim()
  const tileUrl = config.tileUrl || 'https://api.nearmap.com/tiles/v3'
  const coverageUrl = config.coverageUrl || 'https://api.nearmap.com/coverage/v2/coord'
  const tileType = config.tileType || 'Vert'
  const coverageZoom = config.coverageZoom ?? 14
  const maxZoom = config.maxZoom ?? 24
  const allowCompare = config.allowCompare ?? true

  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const [active, setActive] = React.useState<boolean>(!!config.activeOnLoad)
  const [tileKey, setTileKey] = React.useState<string>(null)
  const [dates, setDates] = React.useState<string[]>([])
  const [status, setStatus] = React.useState<Status>('idle')
  const [errorReason, setErrorReason] = React.useState<CoverageErrorReason>(null)
  const [retry, setRetry] = React.useState(0)
  const [dateA, setDateA] = React.useState<string>(null)
  const [dateB, setDateB] = React.useState<string>(null)
  const [compare, setCompare] = React.useState(false)
  const [target, setTarget] = React.useState<Slot>('a')
  const [opacity, setOpacity] = React.useState<number>(Math.round((config.opacity ?? 1) * 100))
  const [notice, setNotice] = React.useState<DateChange[]>(null)
  const [swipePos, setSwipePos] = React.useState(50)
  const [viewWidth, setViewWidth] = React.useState(0)
  const [labelHost, setLabelHost] = React.useState<HTMLDivElement>(null)

  const view = jimuMapView?.view
  const is2d = view?.type === '2d'
  const projectionOk = !view || isWebMercator(view.spatialReference)
  const canShow = !!view && !!apiKey && projectionOk
  const compareOn = compare && allowCompare && is2d

  // Layers per slot; the last one is current, earlier ones are fading out while the new date loads.
  const slotLayers = React.useRef<{ [K in Slot]: WebTileLayer[] }>({ a: [], b: [] })
  const slotDates = React.useRef<{ [K in Slot]: string }>({ a: null, b: null })
  const swipeRef = React.useRef<SwipeElement>(null)
  const [layersVersion, setLayersVersion] = React.useState(0)
  const opacityRef = React.useRef(opacity)
  opacityRef.current = opacity
  const activeRef = React.useRef(active)
  activeRef.current = active
  const compareOnRef = React.useRef(compareOn)
  compareOnRef.current = compareOn
  const dateARef = React.useRef(dateA)
  dateARef.current = dateA
  const dateBRef = React.useRef(dateB)
  dateBRef.current = dateB

  // Layer list title, e.g. "Nearmap 15 Mar 2026" or "Nearmap B · 18 Jun 2011" while comparing.
  const layerTitle = React.useCallback((slot: Slot, date: string) => {
    const label = formatDate(date, locale, { day: 'numeric', month: 'short', year: 'numeric' })
    return compareOnRef.current ? `Nearmap ${slot.toUpperCase()} · ${label}` : `Nearmap ${label}`
  }, [locale])

  const tileInfo = React.useMemo(
    () => TileInfo.create({ size: 256, numLODs: maxZoom + 1, spatialReference: SpatialReference.WebMercator }),
    [maxZoom]
  )

  const syncSwipe = React.useCallback(() => {
    const swipe = swipeRef.current
    if (!swipe) return
    swipe.startLayers = [...slotLayers.current.a]
    swipe.endLayers = [...slotLayers.current.b]
  }, [])

  const removeLayer = React.useCallback((v: __esri.MapView | __esri.SceneView, slot: Slot, layer: WebTileLayer) => {
    slotLayers.current[slot] = slotLayers.current[slot].filter(l => l !== layer)
    syncSwipe()
    v.map?.remove(layer)
    layer.destroy()
    setLayersVersion(n => n + 1)
  }, [syncSwipe])

  /** Show `date` in a slot, or clear it with null. The old layer stays until the new one has drawn, so the map doesn't flash. */
  const setSlotDate = React.useCallback((v: __esri.MapView | __esri.SceneView, slot: Slot, date: string | null) => {
    if (slotDates.current[slot] === date) return
    slotDates.current[slot] = date
    const previous = [...slotLayers.current[slot]]

    if (!date) {
      previous.forEach(l => { removeLayer(v, slot, l) })
      return
    }

    const layer = new WebTileLayer({
      id: `${LAYER_ID_PREFIX}${widgetId}-${slot}-${date}`,
      title: layerTitle(slot, date),
      urlTemplate: tileUrlTemplate(tileUrl, tileType, apiKey, date),
      copyright: 'Nearmap',
      tileInfo,
      opacity: opacityRef.current / 100,
      visible: activeRef.current
    })
    // Only the newest layer per slot appears in the layer list while the old one fades out.
    previous.forEach(l => { l.listMode = 'hide' })
    const current = previous[previous.length - 1]
    const index = current ? v.map.layers.indexOf(current) : 0
    v.map.add(layer, Math.max(0, index))
    slotLayers.current[slot] = [...previous, layer]
    syncSwipe()
    setLayersVersion(n => n + 1)

    if (previous.length === 0) return
    let done = false
    const finish = () => {
      if (done) return
      done = true
      previous.forEach(l => { if (slotLayers.current[slot].includes(l)) removeLayer(v, slot, l) })
    }
    const timer = setTimeout(finish, SWAP_TIMEOUT_MS)
    v.whenLayerView(layer)
      .then((lv: __esri.LayerView) => reactiveUtils.whenOnce(() => !lv.updating))
      .then(finish, finish)
      .finally(() => { clearTimeout(timer) })
  }, [apiKey, layerTitle, removeLayer, syncSwipe, tileInfo, tileType, tileUrl, widgetId])

  // Close in a Widget Controller turns imagery off, matching the original widget.
  React.useEffect(() => {
    if ((config.hideWhenClosed ?? true) && props.state === WidgetState.Closed) setActive(false)
  }, [props.state, config.hideWhenClosed])

  // Track the coverage tile under the map centre; only a new tile triggers a coverage lookup.
  React.useEffect(() => {
    if (!view || !active || !canShow) return
    const handle = reactiveUtils.watch(
      () => [view.stationary, view.center] as const,
      ([stationary, center]) => {
        if (!stationary || !center) return
        const lon = center.longitude
        const lat = center.latitude
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
        setTileKey(`${lonToTileX(lon, coverageZoom)}/${latToTileY(lat, coverageZoom)}`)
      },
      { initial: true }
    )
    return () => { handle.remove() }
  }, [view, active, canShow, coverageZoom])

  // Coverage lookup, debounced and cancelled when the map moves again.
  React.useEffect(() => {
    if (!active || !canShow || !tileKey) return
    const controller = new AbortController()
    const [x, y] = tileKey.split('/').map(Number)
    setStatus('loading')
    const timer = setTimeout(() => {
      fetchCaptureDates({ coverageUrl, apiKey, zoom: coverageZoom, x, y, tileType, signal: controller.signal })
        .then(list => {
          const prevA = dateARef.current
          const prevB = dateBRef.current
          const nextA = nearestDate(list, prevA)
          const nextB = nearestDate(list, prevB ?? list[1] ?? list[0])
          // Tell the user when a date they chose isn't captured in the new area.
          const changes: DateChange[] = []
          if (prevA && nextA !== prevA) changes.push({ slot: 'a', from: prevA, to: nextA })
          if (compareOnRef.current && prevB && nextB !== prevB) changes.push({ slot: 'b', from: prevB, to: nextB })
          setDates(list)
          setDateA(nextA)
          setDateB(nextB)
          if (changes.length > 0) setNotice(changes)
          setErrorReason(null)
          setStatus('ready')
        })
        .catch(err => {
          if (controller.signal.aborted) return
          setDates([])
          setErrorReason(err instanceof CoverageError ? err.reason : 'network')
          setStatus('error')
        })
    }, COVERAGE_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [active, canShow, tileKey, coverageUrl, apiKey, coverageZoom, tileType, retry])

  // Allow zooming past the basemap's last level while imagery is on.
  React.useEffect(() => {
    if (!view || !is2d || !active || !canShow) return
    const mapView = view as __esri.MapView
    const original = { lods: mapView.constraints.lods, maxZoom: mapView.constraints.maxZoom }
    mapView.constraints.lods = tileInfo.lods
    mapView.constraints.maxZoom = maxZoom
    return () => {
      if (mapView.destroyed) return
      mapView.constraints.lods = original.lods
      mapView.constraints.maxZoom = original.maxZoom
    }
  }, [view, is2d, active, canShow, tileInfo, maxZoom])

  // Layers stay on the map (and in the layer list) when imagery is switched off; they are only hidden.
  const hasDates = dates.length > 0
  const showA = canShow ? dateA : null
  const showB = canShow && compareOn ? dateB : null

  React.useEffect(() => { if (view) setSlotDate(view, 'a', showA) }, [view, showA, setSlotDate])
  React.useEffect(() => { if (view) setSlotDate(view, 'b', showB) }, [view, showB, setSlotDate])

  React.useEffect(() => {
    [...slotLayers.current.a, ...slotLayers.current.b].forEach(l => { l.opacity = opacity / 100 })
  }, [opacity])

  // While the widget is off, each layer's visibility belongs to the Layers widget; the swipe only returns when the widget is switched on again.
  React.useEffect(() => {
    [...slotLayers.current.a, ...slotLayers.current.b].forEach(l => { l.visible = active })
  }, [active, layersVersion])

  React.useEffect(() => {
    (['a', 'b'] as Slot[]).forEach(slot => {
      const layer = slotLayers.current[slot][slotLayers.current[slot].length - 1]
      if (layer) layer.title = layerTitle(slot, slotDates.current[slot])
    })
  }, [compareOn, layerTitle, layersVersion])

  // Swipe divider while both dates are on the map.
  const swipeOn = active && !!showA && !!showB
  React.useEffect(() => {
    if (!view || !swipeOn) return
    const swipe = document.createElement('arcgis-swipe') as SwipeElement
    swipe.autoDestroyDisabled = true
    swipe.position = 50
    swipe.view = view as __esri.MapView
    swipeRef.current = swipe
    syncSwipe()
    view.ui.add(swipe)
    setSwipePos(50)
    const onMove = () => { setSwipePos(Number(swipe.position) || 50) }
    swipe.addEventListener('arcgisSwipeInput', onMove)
    swipe.addEventListener('arcgisSwipeChange', onMove)

    // ExB 1.21 maps are <arcgis-map> components whose UI lives in shadow DOM, where widget styles don't reach.
    // The labels go in the component's default slot instead: light DOM, positioned by us over the map.
    const host = document.createElement('div')
    host.className = 'nm-map-labels-host'
    host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;'
    const mapElement = jimuMapView?.mapComponent as HTMLElement
    if (mapElement) mapElement.appendChild(host); else view.ui.add(host, 'manual')
    const resize = new ResizeObserver(() => { setViewWidth(host.clientWidth || view.width || 0) })
    resize.observe(host)
    setViewWidth(host.clientWidth || view.width || 0)
    setLabelHost(host)
    return () => {
      swipe.removeEventListener('arcgisSwipeInput', onMove)
      swipe.removeEventListener('arcgisSwipeChange', onMove)
      resize.disconnect()
      setLabelHost(null)
      if (mapElement) host.remove(); else if (!view.destroyed) view.ui.remove(host)
      swipeRef.current = null
      if (!view.destroyed) view.ui.remove(swipe)
      void swipe.destroy()
    }
  }, [view, jimuMapView, swipeOn, syncSwipe])

  // Clear everything when the map view changes or the widget unmounts.
  React.useEffect(() => {
    if (!view) return
    const layers = slotLayers.current
    const shown = slotDates.current
    return () => {
      (['a', 'b'] as Slot[]).forEach(slot => {
        layers[slot].forEach(l => { if (!view.destroyed) view.map?.remove(l); l.destroy() })
        layers[slot] = []
        shown[slot] = null
      })
    }
  }, [view])

  React.useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => { setNotice(null) }, NOTICE_MS)
    return () => { clearTimeout(timer) }
  }, [notice])

  const toggleActive = (on: boolean) => {
    setActive(on)
    if (!on) setNotice(null)
  }

  const toggleCompare = (on: boolean) => {
    setCompare(on)
    setTarget(on ? 'b' : 'a')
  }

  const step = (slot: Slot, dir: 1 | -1) => {
    const current = slot === 'a' ? dateA : dateB
    const next = dates[dates.indexOf(current) + dir]
    if (!next) return
    if (slot === 'a') setDateA(next); else setDateB(next)
    setTarget(slot)
    setNotice(null)
  }

  const pick = (date: string) => {
    if (compareOn && target === 'b') setDateB(date); else setDateA(date)
    setNotice(null)
  }

  const longDate = (d: string) => formatDate(d, locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const shortDate = (d: string) => formatDate(d, locale, { day: 'numeric', month: 'short' })
  const weekday = (d: string) => formatDate(d, locale, { weekday: 'long' })

  const subtitle = !active
    ? translate('nmImageryOff')
    : status === 'loading'
      ? translate('nmSearching')
      : status === 'ready'
        ? (dates.length === 1 ? translate('nmOneCapture') : translate('nmCaptureCount', { count: dates.length }))
        : ''

  const renderSlot = (slot: Slot) => {
    const date = slot === 'a' ? dateA : dateB
    if (!date) return null
    const index = dates.indexOf(date)
    const label = slot.toUpperCase()
    const body = (
      <React.Fragment>
        {compareOn && <span className={classNames('nm-badge', { 'is-b': slot === 'b' })} aria-hidden='true'>{label}</span>}
        <span className='d-flex flex-column' style={{ minWidth: 0 }}>
          <span className='nm-slot-date nm-num'>{longDate(date)}</span>
          <span className='nm-slot-day'>{weekday(date)}</span>
        </span>
      </React.Fragment>
    )
    return (
      <div className={classNames('nm-slot', `is-${slot}`, { 'is-compare': compareOn, 'is-active': compareOn && target === slot })}>
        {compareOn
          ? <button type='button' className='nm-slot-pick' aria-pressed={target === slot}
              aria-label={`${translate('nmChooseSlot', { slot: label })}: ${longDate(date)}`}
              onClick={() => { setTarget(slot) }}>{body}</button>
          : <div className='nm-slot-pick'>{body}</div>}
        <Button icon size='sm' type='tertiary' className='nm-square' aria-label={translate('nmEarlier')} title={translate('nmEarlier')}
          disabled={index < 0 || index >= dates.length - 1} onClick={() => { step(slot, 1) }}>
          <LeftOutlined size={16} />
        </Button>
        <Button icon size='sm' type='tertiary' className='nm-square' aria-label={translate('nmLater')} title={translate('nmLater')}
          disabled={index <= 0} onClick={() => { step(slot, -1) }}>
          <RightOutlined size={16} />
        </Button>
      </div>
    )
  }

  // A and B labels either side of the swipe line, only while comparing.
  const renderMapLabels = () => {
    const x = (viewWidth * swipePos) / 100
    // Until the overlay has been measured, show both labels rather than neither.
    const measured = viewWidth > 0
    return (
      <div css={mapLabelStyle} aria-hidden='true'>
        {(!measured || x >= LABEL_ROOM_PX) && (
          <div className='nm-map-label' style={{ right: `calc(${100 - swipePos}% + 10px)` }}>
            <span className='nm-map-badge'>A</span>{longDate(dateA)}
          </div>
        )}
        {(!measured || viewWidth - x >= LABEL_ROOM_PX) && (
          <div className='nm-map-label' style={{ left: `calc(${swipePos}% + 10px)` }}>
            <span className='nm-map-badge is-b'>B</span>{longDate(dateB)}
          </div>
        )}
      </div>
    )
  }

  const renderList = () => {
    const years = Array.from(new Set(dates.map(d => d.slice(0, 4))))
    const hintSlot: Slot = compareOn ? target : 'a'
    const other: Slot = target === 'a' ? 'b' : 'a'
    return (
      <div className={classNames('nm-list', { 'has-choosing': compareOn })} role='group' aria-label={translate('nmCaptureDates')}>
        {compareOn && (
          <div className='nm-choosing' aria-live='polite'>
            <span>{translate('nmChoosingFor')}</span>
            <span className={classNames('nm-badge', { 'is-b': target === 'b' })}>{target.toUpperCase()}</span>
            <button type='button' className='nm-link' onClick={() => { setTarget(other) }}>
              {translate('nmChangeInstead', { slot: other.toUpperCase() })}
            </button>
          </div>
        )}
        {years.map(year => {
          const inYear = dates.filter(d => d.startsWith(year))
          return (
            <React.Fragment key={year}>
              <div className='nm-year' aria-hidden='true'><span>{year}</span><span className='nm-num'>{inYear.length}</span></div>
              {inYear.map(d => {
                const isA = d === dateA
                const isB = compareOn && d === dateB
                const selected = hintSlot === 'b' ? isB : isA
                return (
                  <button key={d} type='button' className={classNames('nm-item', { 'is-a': isA, 'is-b': isB })}
                    aria-pressed={selected} aria-label={`${longDate(d)}, ${weekday(d)}`} onClick={() => { pick(d) }}>
                    <span className='nm-item-date nm-num'>{shortDate(d)}</span>
                    <span className='nm-item-day'>{weekday(d)}</span>
                    {isA && compareOn && <span className='nm-badge' aria-hidden='true'>A</span>}
                    {isB && <span className='nm-badge is-b' aria-hidden='true'>B</span>}
                    {!isA && !isB && (
                      <span className='nm-item-hint' aria-hidden='true'>
                        {compareOn
                          ? <React.Fragment>→<span className={classNames('nm-ghost', { 'is-b': hintSlot === 'b' })}>{hintSlot.toUpperCase()}</span></React.Fragment>
                          : translate('nmShow')}
                      </span>
                    )}
                  </button>
                )
              })}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  const renderBody = () => {
    const hasMap = !!props.useMapWidgetIds?.[0]
    if (!hasMap) return <div className='nm-state'>{translate('nmNoMap')}</div>
    if (!apiKey) return <div className='nm-state'>{translate('nmNoKey')}</div>
    if (!projectionOk) return <div className='nm-state is-error' role='alert'>{translate('nmWrongProjection')}</div>
    if (!active) return <div className='nm-state'>{translate('nmOffHint')}</div>
    if (status === 'error') {
      return (
        <div className='nm-state is-error' role='alert'>
          <span>{translate(ERROR_KEYS[errorReason] ?? 'nmNetwork')}</span>
          {errorReason === 'network' && <Button size='sm' onClick={() => { setRetry(r => r + 1) }}>{translate('nmRetry')}</Button>}
        </div>
      )
    }
    if (!hasDates) {
      return <div className='nm-state' aria-live='polite'><div className='nm-loading'><Loading type={LoadingType.Donut} width={24} height={24} /></div>{translate('nmSearching')}</div>
    }
    return (
      <React.Fragment>
        <div className='nm-sec'>
          {renderSlot('a')}
          {compareOn && renderSlot('b')}
          {allowCompare && (
            <div className='nm-row'>
              <label htmlFor={`nm-compare-${widgetId}`}>{translate('nmSwipeCompare')}</label>
              <Switch id={`nm-compare-${widgetId}`} checked={compareOn} disabled={!is2d}
                aria-label={translate('nmSwipeCompare')} onChange={(_e, checked) => { toggleCompare(checked) }} />
            </div>
          )}
          {allowCompare && !is2d && <div className='nm-note'>{translate('nmSceneNoSwipe')}</div>}
        </div>
        {notice && (
          <div className='nm-notice' role='status'>
            <InfoOutlined size={16} className='nm-notice-icon' />
            <span className='nm-notice-text'>
              {notice.map(c => (
                <span key={c.slot} className='d-block'>
                  {compareOn && `${c.slot.toUpperCase()}: `}
                  {translate('nmDateChanged', { from: longDate(c.from), to: longDate(c.to) })}
                </span>
              ))}
            </span>
            <Button icon size='sm' type='tertiary' className='nm-notice-close' aria-label={translate('nmDismiss')} title={translate('nmDismiss')}
              onClick={() => { setNotice(null) }}>
              <CloseOutlined size={12} />
            </Button>
          </div>
        )}
        {renderList()}
        <div className='nm-foot'>
          <label htmlFor={`nm-opacity-${widgetId}`}>{translate('nmOpacity')}</label>
          <Slider id={`nm-opacity-${widgetId}`} min={10} max={100} step={5} value={opacity}
            aria-label={translate('nmOpacity')} aria-valuetext={`${opacity}%`}
            onChange={e => { setOpacity(Number(e.target.value)) }} />
          <span className='nm-foot-value nm-num'>{opacity}%</span>
        </div>
      </React.Fragment>
    )
  }

  return (
    <Paper variant='flat' shape='none' className='jimu-widget widget-nearmap-imagery' css={widgetStyle(darkTheme)}>
      {props.useMapWidgetIds?.length === 1 && (
        <JimuMapViewComponent useMapWidgetId={props.useMapWidgetIds[0]} onActiveViewChange={jmv => { setJimuMapView(jmv) }} />
      )}
      <header className='nm-head'>
        <span className='nm-mark' aria-hidden='true'><ImageryLayerOutlined size={16} /></span>
        <div className='nm-head-text'>
          <div className='nm-title'>{translate('nmTitle')}</div>
          {subtitle && <div className='nm-sub nm-num' aria-live='polite'>{subtitle}</div>}
        </div>
        <Switch checked={active} disabled={!canShow} aria-label={translate('nmShowImagery')}
          onChange={(_e, checked) => { toggleActive(checked) }} />
      </header>
      {renderBody()}
      {swipeOn && labelHost && ReactDOM.createPortal(renderMapLabels(), labelHost)}
    </Paper>
  )
}
