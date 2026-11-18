import { React, Immutable, hooks } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import { Slider, Switch, TextInput } from 'jimu-ui'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import type { Config, IMConfig } from '../config'
import defaultMessages from './translations/default'

const hintStyle = { fontSize: '0.75rem', color: 'var(--sys-color-surface-paper-hint)' }

export default function Setting (props: AllWidgetSettingProps<IMConfig>) {
  const translate = hooks.useTranslation(defaultMessages)
  const config = (props.config?.asMutable?.({ deep: true }) ?? {}) as Config
  const [apiKey, setApiKey] = React.useState(config.apiKey ?? '')
  const opacity = Math.round((config.opacity ?? 1) * 100)

  React.useEffect(() => { setApiKey(props.config?.apiKey ?? '') }, [props.config?.apiKey])

  const update = (patch: Partial<Config>) => {
    props.onSettingChange({ id: props.id, config: Immutable({ ...config, ...patch }) as IMConfig })
  }

  const saveKey = () => {
    const trimmed = apiKey.trim()
    if (trimmed !== (config.apiKey ?? '')) update({ apiKey: trimmed })
  }

  return (
    <div className='widget-setting-nearmap-imagery'>
      <SettingSection title={translate('nmsMap')}>
        <SettingRow>
          <MapWidgetSelector
            useMapWidgetIds={props.useMapWidgetIds}
            onSelect={(useMapWidgetIds: string[]) => { props.onSettingChange({ id: props.id, useMapWidgetIds }) }}
          />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('nmsMapHint')}</div>
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('nmsApiKey')}>
        <SettingRow>
          <TextInput className='w-100' size='sm' type='password' autoComplete='off' value={apiKey}
            aria-label={translate('nmsApiKey')} placeholder={translate('nmsApiKeyPlaceholder')}
            onChange={e => { setApiKey(e.target.value) }} onBlur={saveKey}
            onKeyDown={e => { if (e.key === 'Enter') saveKey() }} />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('nmsApiKeyHint')}</div>
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('nmsBehaviour')}>
        <SettingRow tag='label' label={translate('nmsActiveOnLoad')}>
          <Switch checked={!!config.activeOnLoad} aria-label={translate('nmsActiveOnLoad')}
            onChange={(_e, checked) => { update({ activeOnLoad: checked }) }} />
        </SettingRow>
        <SettingRow tag='label' label={translate('nmsAllowCompare')}>
          <Switch checked={config.allowCompare ?? true} aria-label={translate('nmsAllowCompare')}
            onChange={(_e, checked) => { update({ allowCompare: checked }) }} />
        </SettingRow>
        <SettingRow tag='label' label={translate('nmsHideWhenClosed')}>
          <Switch checked={config.hideWhenClosed ?? true} aria-label={translate('nmsHideWhenClosed')}
            onChange={(_e, checked) => { update({ hideWhenClosed: checked }) }} />
        </SettingRow>
        <SettingRow flow='wrap' label={`${translate('nmsOpacity')} (${opacity}%)`}>
          <Slider className='w-100' min={10} max={100} step={5} value={opacity}
            aria-label={translate('nmsOpacity')} aria-valuetext={`${opacity}%`}
            onChange={e => { update({ opacity: Number(e.target.value) / 100 }) }} />
        </SettingRow>
      </SettingSection>
    </div>
  )
}
