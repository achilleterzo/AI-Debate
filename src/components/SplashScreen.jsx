import { useEffect } from 'react'
import { useUiStrings } from '../i18n/UiStringsContext'
import { APP_VERSION } from '../hooks/useUpdateCheck'

// The app icon, inlined so the screen has no asset to resolve: the build uses
// a relative base and the desktop bundle is loaded over file://.
function SplashLogo() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="12" width="34" height="24" rx="6" fill="#e6e6e6" />
      <path d="M10 34h10v10z" fill="#e6e6e6" />
      <circle cx="15" cy="24" r="3" fill="#b4b4b4" />
      <circle cx="23" cy="24" r="3" fill="#b4b4b4" />
      <circle cx="31" cy="24" r="3" fill="#b4b4b4" />
      <rect x="26" y="28" width="34" height="24" rx="6" fill="#1b1b1b" />
      <path d="M54 50h-10v10z" fill="#1b1b1b" />
      <circle cx="37" cy="40" r="3" fill="#a78bfa" />
      <circle cx="45" cy="40" r="3" fill="#a78bfa" />
      <circle cx="53" cy="40" r="3" fill="#a78bfa" />
    </svg>
  )
}

/**
 * Welcome screen shown at startup, with the toggle that decides whether it
 * comes back next time. The steps are kept as plain data so this can grow
 * into the setup wizard without reworking the layout.
 */
export default function SplashScreen({ showOnStartup, onShowOnStartupChange, onClose, onStart }) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.splash
  const common = UI_STRINGS.common

  useEffect(() => {
    const handler = event => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const steps = [
    { title: ui.step1Title, text: ui.step1Text },
    { title: ui.step2Title, text: ui.step2Text },
    { title: ui.step3Title, text: ui.step3Text },
  ]

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
          width: 'min(94vw, 520px)',
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 18px 48px #000a',
        }}
      >
        <div style={{ padding: '26px 24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <SplashLogo />
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0' }}>{ui.title}</div>
          <div style={{ fontSize: 11, color: '#777', fontFamily: 'var(--mono)' }}>{ui.version(APP_VERSION)}</div>
          <p style={{ fontSize: 13, color: '#9a9a9a', lineHeight: 1.6, maxWidth: 400 }}>{ui.tagline}</p>
        </div>

        <div style={{ padding: '0 24px 20px', overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#777', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
            {ui.stepsTitle}
          </div>
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none' }}>
            {steps.map((step, index) => (
              <li key={step.title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                  background: '#2a2440', border: '1px solid #4c3f7a', color: '#c4b5fd',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {index + 1}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: '#8d8d8d', lineHeight: 1.5 }}>{step.text}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '12px 24px', borderTop: '1px solid #2e2e2e', background: '#141414', flexWrap: 'wrap',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#999', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={event => onShowOnStartupChange(event.target.checked)}
              style={{ width: 14, height: 14, accentColor: '#7c6aff', cursor: 'pointer' }}
            />
            {ui.showOnStartup}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onStart ?? onClose}
              autoFocus
              style={{
                background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff',
                borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {ui.start}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: '1px solid #3a3a3a', color: '#888',
                borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer',
              }}
            >
              {common.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
