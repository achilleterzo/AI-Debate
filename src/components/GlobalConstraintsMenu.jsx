import { useEffect, useRef, useState } from 'react'
import { useUiStrings } from '../i18n/UiStringsContext'
import RemoveButton from './RemoveButton'

/**
 * The global constraints, behind their own button.
 *
 * They used to sit as a chip row above the topic box, between the transcript
 * and the field being typed into — close enough to the composer to read as part
 * of the message being written, so users took them for something attached to
 * this turn rather than rules already in force for the whole table. They now
 * live in a list that opens from the button that already counts them, which is
 * where someone goes when they want to know what the rules are.
 */
export default function GlobalConstraintsMenu({ constraints = [], onAdd, onEdit, onDelete }) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.app
  const participantsUi = UI_STRINGS.participants
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const active = constraints.length > 0

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutside = event => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        title={active ? ui.globalConstraintsTitle : ui.addGlobalConstraint}
        aria-expanded={open}
        onClick={() => setOpen(previous => !previous)}
        style={{
          background: active ? '#24192d' : '#161616',
          border: `1px solid ${open ? '#8f5bb3' : active ? '#6a3b87' : '#2e2e2e'}`,
          borderRadius: 8,
          width: 44,
          height: 44,
          padding: 0,
          cursor: 'pointer',
          color: active ? '#caa9ee' : '#555',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
          position: 'relative',
          transition: 'all 0.15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h10M3 8h10M3 12h10"/>
          <circle cx="6" cy="4" r="1.4" fill="currentColor" stroke="none"/>
          <circle cx="10" cy="8" r="1.4" fill="currentColor" stroke="none"/>
          <circle cx="7" cy="12" r="1.4" fill="currentColor" stroke="none"/>
        </svg>
        {active && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 999,
            background: '#6a3b87', border: '1px solid #8f5bb3',
            color: '#f3e8ff', fontSize: 10, lineHeight: '14px', fontWeight: 700,
            padding: '0 4px',
          }}>{constraints.length}</span>
        )}
      </button>

      {open && (
        // Opens upward: the button lives on the bottom bar, and there is
        // nothing below it to open into.
        <div style={{
          position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, zIndex: 200,
          width: 420, maxWidth: '80vw',
          background: '#1a141f', border: '1px solid #4a2f63', borderRadius: 10,
          boxShadow: '0 -6px 24px #000a',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '9px 12px', borderBottom: '1px solid #33224a', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: '#a382c9' }}>
            {ui.globalConstraintsTitle}
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {constraints.length === 0 ? (
              <div style={{ padding: '14px 12px', fontSize: 12, color: '#6d6d6d' }}>{ui.noGlobalConstraints}</div>
            ) : constraints.map((constraint, index) => (
              <div
                key={`${constraint}-${index}`}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderBottom: index < constraints.length - 1 ? '1px solid #2a1f38' : 'none' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#7f629d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}>
                  <path d="M4 4h4M3.5 6h5M4 8h4"/><rect x="1.5" y="1.5" width="9" height="9" rx="1.5"/>
                </svg>
                <button
                  onClick={() => { onEdit(index); setOpen(false) }}
                  title={participantsUi.editConstraint}
                  style={{
                    flex: 1, minWidth: 0, textAlign: 'left',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: '#caa9ee', fontSize: 12, lineHeight: 1.45,
                  }}
                >
                  {constraint}
                </button>
                {/* Removing asks for confirmation in a modal, and the panel
                    would be left open behind its overlay. */}
                <RemoveButton onClick={() => { onDelete(index); setOpen(false) }} title={participantsUi.removeConstraint} />
              </div>
            ))}
          </div>

          <button
            onClick={() => { onAdd(); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, width: '100%',
              background: '#24192d', border: 'none', borderTop: '1px solid #33224a',
              padding: '10px 12px', cursor: 'pointer',
              color: '#caa9ee', fontSize: 12, fontWeight: 600, textAlign: 'left',
            }}
            onMouseEnter={event => { event.currentTarget.style.background = '#2e2039' }}
            onMouseLeave={event => { event.currentTarget.style.background = '#24192d' }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M7 3v8M3 7h8"/>
            </svg>
            {ui.addGlobalConstraint}
          </button>
        </div>
      )}
    </div>
  )
}
