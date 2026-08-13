import { useEffect } from 'react'
import { useUiStrings } from '../i18n/UiStringsContext'

// A page with an arrow coming into it: the file went in, not out.
function ImportIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="14" y="8" width="36" height="48" rx="7" fill="#1b1b1b" stroke="#3a3a3a" strokeWidth="2" />
      <path d="M24 22h16M24 30h16M24 38h10" stroke="#4a4a4a" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="44" cy="44" r="13" fill="#221c3a" stroke="#4c3f7a" strokeWidth="2" />
      <path d="M44 38v12m0 0-5-5m5 5 5-5" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Column({ title, items, marker, markerColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 200px', minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#777', textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</div>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none' }}>
        {items.map(item => (
          <li key={item} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, color: markerColor, fontSize: 12, lineHeight: 1.5 }}>{marker}</span>
            <span style={{ fontSize: 12, color: '#8d8d8d', lineHeight: 1.5 }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Shown after a JSON export is loaded through the snapshot picker.
 *
 * An export is a reading format: it resolves state into labels and leaves the
 * debate setup out entirely. The load still succeeds, so without this the two
 * formats would look interchangeable right up until someone pressed start with
 * a roster that has no models and no constraints. The two columns are the
 * whole point — what came back, and what an export never had to give.
 */
export default function ImportNoticeModal({ showAgain, onShowAgainChange, onClose }) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.importNotice
  const common = UI_STRINGS.common

  useEffect(() => {
    const handler = event => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: '#000000cc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ui.title}
        onClick={event => event.stopPropagation()}
        style={{
          background: 'radial-gradient(120% 120% at 50% 0%, #221c3a 0%, #141414 55%)',
          border: '1px solid #2e2e2e',
          borderRadius: 14,
          width: 'min(94vw, 540px)',
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 18px 48px #000a',
        }}
      >
        <div style={{ padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <ImportIcon />
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f0f0' }}>{ui.title}</div>
          <p style={{ fontSize: 13, color: '#9a9a9a', lineHeight: 1.6, maxWidth: 420 }}>{ui.tagline}</p>
        </div>

        <div style={{ padding: '0 24px 20px', overflowY: 'auto', display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <Column title={ui.restoredTitle} items={ui.restored} marker="✓" markerColor="#4ade80" />
          <Column title={ui.missingTitle} items={ui.missing} marker="✕" markerColor="#f87171" />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '12px 24px', borderTop: '1px solid #2e2e2e', background: '#141414', flexWrap: 'wrap',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#999', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!showAgain}
              onChange={event => onShowAgainChange(!event.target.checked)}
              style={{ width: 14, height: 14, accentColor: '#7c6aff', cursor: 'pointer' }}
            />
            {ui.dontShowAgain}
          </label>
          <button
            onClick={onClose}
            autoFocus
            style={{
              background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff',
              borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {common.close}
          </button>
        </div>
      </div>
    </div>
  )
}
