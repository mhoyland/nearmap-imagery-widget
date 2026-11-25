import { css } from 'jimu-core'

// A follows the theme's primary colour; B is a fixed amber so it never clashes with a theme's warning colour.
const AMBER = {
  light: { main: '#9a5b00', text: '#ffffff' },
  dark: { main: '#f0b04a', text: '#2a1b00' }
}

export const widgetStyle = (dark: boolean) => css`
  --nm-a: var(--sys-color-primary-main);
  --nm-a-text: var(--sys-color-primary-text);
  --nm-b: ${dark ? AMBER.dark.main : AMBER.light.main};
  --nm-b-text: ${dark ? AMBER.dark.text : AMBER.light.text};
  --nm-a-tint: color-mix(in srgb, var(--nm-a) ${dark ? 22 : 11}%, var(--sys-color-surface-paper));
  --nm-b-tint: color-mix(in srgb, var(--nm-b) ${dark ? 20 : 13}%, var(--sys-color-surface-paper));

  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 0.8125rem;
  /* Set explicitly: templates such as Tab give the page white text for their coloured background. */
  color: var(--sys-color-surface-paper-text);

  .nm-num {
    font-variant-numeric: tabular-nums;
  }

  /* ---- header ---- */
  .nm-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-3);
    padding: var(--sys-spacing-3) var(--sys-spacing-3) var(--sys-spacing-3) var(--sys-spacing-4);
    border-bottom: 1px solid var(--sys-color-divider-secondary);
  }
  .nm-mark {
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border-radius: var(--sys-shape-2);
    display: grid;
    place-items: center;
    /* Tint of the brand colour so the primary-coloured icon stays visible on it. */
    background: color-mix(in srgb, var(--sys-color-primary-main) 14%, transparent);
    color: var(--sys-color-primary-main);
  }
  .nm-mark svg {
    display: block;
  }
  .nm-head-text {
    flex: 1 1 auto;
    min-width: 0;
    line-height: 1.25;
  }
  .nm-title {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .nm-sub {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }

  /* ---- selected dates ---- */
  .nm-sec {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-3) var(--sys-spacing-4);
    border-bottom: 1px solid var(--sys-color-divider-secondary);
  }
  .nm-slot {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    border-radius: var(--sys-shape-2);
    border: 1px solid transparent;
  }
  .nm-slot.is-compare {
    padding: 2px 4px 2px 2px;
  }
  .nm-slot.is-active.is-a {
    border-color: var(--nm-a);
    background: var(--nm-a-tint);
  }
  .nm-slot.is-active.is-b {
    border-color: var(--nm-b);
    background: var(--nm-b-tint);
  }
  .nm-slot-pick {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding: 4px 6px;
    border: 0;
    background: none;
    color: inherit;
    text-align: start;
    font: inherit;
    border-radius: var(--sys-shape-1);
    line-height: 1.2;
  }
  button.nm-slot-pick {
    cursor: pointer;
  }
  .nm-slot:not(.is-compare) .nm-slot-pick {
    padding-inline-start: 0;
  }
  .nm-slot-date {
    font-weight: 600;
    font-size: 0.9375rem;
  }
  .nm-slot:not(.is-compare) .nm-slot-date {
    font-size: 1.0625rem;
  }
  .nm-slot-day {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .nm-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sys-spacing-3);
    min-height: 28px;
  }
  .nm-row label {
    margin: 0;
    font-weight: 600;
  }
  .nm-note {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }

  /* Doubled class beats jimu-ui's own button padding so the icon sits dead centre. */
  .nm-square.nm-square {
    flex: 0 0 auto;
    width: 32px;
    min-width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .nm-square.nm-square svg {
    margin: 0;
  }

  .nm-badge {
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: var(--sys-shape-1);
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1;
    background: var(--nm-a);
    color: var(--nm-a-text);
  }
  .nm-badge.is-b {
    background: var(--nm-b);
    color: var(--nm-b-text);
  }
  /* Outlined badge for the hover preview, so it can't be mistaken for a date that is already set. */
  .nm-ghost {
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: var(--sys-shape-1);
    border: 1.5px dashed var(--nm-a);
    color: var(--nm-a);
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1;
  }
  .nm-ghost.is-b {
    border-color: var(--nm-b);
    color: var(--nm-b);
  }

  /* ---- date list ---- */
  .nm-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: var(--sys-spacing-2);
  }
  /* Pinned above the year headers while comparing; the headers stick just below it. */
  .nm-choosing {
    position: sticky;
    top: 0;
    z-index: 2;
    height: 36px;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding: 0 var(--sys-spacing-4);
    background: var(--sys-color-surface-paper);
    border-bottom: 1px solid var(--sys-color-divider-secondary);
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .nm-link {
    margin-inline-start: auto;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-weight: 600;
    color: var(--nm-a);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .nm-link:focus-visible {
    outline: 2px solid var(--sys-color-action-focus);
    outline-offset: 2px;
  }
  .nm-list.has-choosing .nm-year {
    top: 36px;
  }
  .nm-notice {
    flex: 0 0 auto;
    display: flex;
    align-items: flex-start;
    gap: var(--sys-spacing-2);
    margin: var(--sys-spacing-2) var(--sys-spacing-4) 0;
    padding: 6px 4px 6px 10px;
    border-radius: var(--sys-shape-2);
    background: color-mix(in srgb, var(--sys-color-info-main) 10%, var(--sys-color-surface-paper));
    font-size: 0.75rem;
    line-height: 1.35;
  }
  .nm-notice-icon {
    flex: 0 0 auto;
    margin-top: 1px;
    color: var(--sys-color-info-main);
  }
  .nm-notice-text {
    flex: 1 1 auto;
    min-width: 0;
    padding-top: 1px;
  }
  .nm-notice-close.nm-notice-close {
    flex: 0 0 auto;
    width: 22px;
    min-width: 22px;
    height: 22px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .nm-year {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    padding: var(--sys-spacing-2) var(--sys-spacing-4) var(--sys-spacing-1);
    background: var(--sys-color-surface-paper);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--sys-color-surface-paper-hint);
  }
  .nm-item {
    width: 100%;
    min-height: 36px;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-3);
    padding: 6px var(--sys-spacing-4);
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .nm-item:hover,
  .nm-item:focus-visible {
    background: var(--sys-color-action-hover);
  }
  .nm-item:focus-visible,
  .nm-slot-pick:focus-visible {
    outline: 2px solid var(--sys-color-action-focus);
    outline-offset: -2px;
  }
  .nm-item-date {
    width: 56px;
    font-weight: 600;
  }
  .nm-item-day {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.8125rem;
    color: var(--sys-color-surface-paper-hint);
  }
  /* Dates already set: tint and coloured date. */
  .nm-item.is-a,
  .nm-item.is-a:hover {
    background: var(--nm-a-tint);
  }
  .nm-item.is-b,
  .nm-item.is-b:hover {
    background: var(--nm-b-tint);
  }
  .nm-item.is-a .nm-item-date {
    color: var(--nm-a);
    font-weight: 700;
  }
  .nm-item.is-b .nm-item-date {
    color: var(--nm-b);
    font-weight: 700;
  }
  /* Hint stays hidden until the row is hovered or focused. */
  .nm-item-hint {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sys-color-surface-paper-hint);
    opacity: 0;
  }
  .nm-item:hover .nm-item-hint,
  .nm-item:focus-visible .nm-item-hint {
    opacity: 1;
  }

  /* ---- states ---- */
  .nm-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sys-spacing-3);
    padding: var(--sys-spacing-6) var(--sys-spacing-4);
    text-align: center;
    color: var(--sys-color-surface-paper-hint);
  }
  .nm-state.is-error {
    color: var(--sys-color-error-dark);
  }
  .nm-loading {
    position: relative;
    height: 40px;
    width: 100%;
  }

  /* ---- footer ---- */
  .nm-foot {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-3);
    padding: var(--sys-spacing-2) var(--sys-spacing-4);
    border-top: 1px solid var(--sys-color-divider-secondary);
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .nm-foot label {
    margin: 0;
  }
  .nm-foot .jimu-slider {
    flex: 1 1 auto;
  }
  .nm-foot-value {
    width: 36px;
    text-align: end;
  }
`

// Rendered into the map's own container, outside the widget, so it can't use the widget's --nm-* variables.
// The labels sit on top of imagery, so they keep a light chip in both themes.
export const mapLabelStyle = css`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;

  .nm-map-label {
    position: absolute;
    top: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 5px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.94);
    color: #1f1d22;
    font-size: 0.8125rem;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  }
  .nm-map-badge {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1;
    background: var(--sys-color-primary-main);
    color: var(--sys-color-primary-text);
  }
  .nm-map-badge.is-b {
    background: ${AMBER.light.main};
    color: ${AMBER.light.text};
  }
`
