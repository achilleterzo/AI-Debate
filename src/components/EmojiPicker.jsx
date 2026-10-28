import { useEffect, useRef, useState } from 'react'
import { MODE_EMOJI_GROUPS } from '../dataset/ModeEmojis'
import { themeColor as color } from '../theme/Theme'

/**
 * A button showing the current icon that opens a grid of icons to pick from.
 * `value` empty means "the default", which `fallback` shows.
 */
export default function EmojiPicker({ value, fallback, onChange, resetLabel, title }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const onKey = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = emoji => { onChange(emoji); setOpen(false) }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        title={title}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        style={{ width: 56, height: 30, background: color('#0f0f0f'), border: `1px solid ${open ? color('#3f5a8a') : color('#2e2e2e')}`, borderRadius: 6, cursor: 'pointer', fontSize: 16, padding: 0 }}
      >{value || fallback}</button>
      {open && (
        <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 20, width: 252, background: color('#141414'), border: `1px solid ${color('#2e2e2e')}`, borderRadius: 8, padding: 8, boxShadow: `0 8px 24px ${color('#00000099')}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MODE_EMOJI_GROUPS.map((group, index) => (
            <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: 2, paddingBottom: 6, borderBottom: index < MODE_EMOJI_GROUPS.length - 1 ? `1px solid ${color('#242424')}` : 'none' }}>
              {group.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => pick(emoji)}
                  style={{ width: 28, height: 28, fontSize: 17, lineHeight: 1, cursor: 'pointer', borderRadius: 5, padding: 0, background: emoji === value ? color('#1f2a3f') : 'transparent', border: `1px solid ${emoji === value ? color('#3f5a8a') : 'transparent'}` }}
                >{emoji}</button>
              ))}
            </div>
          ))}
          <button
            type="button"
            onClick={() => pick('')}
            style={{ alignSelf: 'flex-start', background: 'transparent', border: `1px solid ${color('#3a3a3a')}`, color: color('#888888'), borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
          >{fallback} {resetLabel}</button>
        </div>
      )}
    </div>
  )
}
