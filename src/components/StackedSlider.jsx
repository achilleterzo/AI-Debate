import { useEffect, useState } from 'react'

/**
 * A slider with its reading centred above it. Every slider on a participant's
 * card uses this one layout, so the text sits in the same place whichever
 * value it describes; the fixed width keeps the control from moving when the
 * words change.
 *
 * The value follows the thumb locally and is handed up when the gesture ends:
 * committing every tick rewrote the whole participant list, and with it the
 * panel, dozens of times a second. `text` and `color` may be functions of the
 * value being dragged. A double click goes to `resetValue`, when there is one.
 */
export default function StackedSlider({
  value,
  onCommit,
  text,
  color = 'var(--c-666666, #666)',
  accent = 'var(--c-f59e0b, #f59e0b)',
  width = 96,
  title,
  resetValue,
  ...inputProps
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])

  const commit = next => { if (next !== value) onCommit(next) }
  const resolve = prop => (typeof prop === 'function' ? prop(draft) : prop)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2, width, flexShrink: 0 }} title={title}>
      <span style={{ fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center', color: resolve(color) }}>{resolve(text)}</span>
      <input
        type="range"
        {...inputProps}
        value={draft}
        onChange={event => setDraft(Number(event.target.value))}
        onPointerUp={event => commit(Number(event.currentTarget.value))}
        onKeyUp={event => commit(Number(event.currentTarget.value))}
        onBlur={event => commit(Number(event.currentTarget.value))}
        onDoubleClick={resetValue === undefined ? undefined : () => { setDraft(resetValue); commit(resetValue) }}
        style={{ width: '100%', margin: 0, accentColor: accent, cursor: 'pointer' }}
      />
    </div>
  )
}
