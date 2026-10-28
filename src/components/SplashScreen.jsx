import { useEffect } from 'react'
import { useUiStrings } from '../i18n/UiStringsContext'
import { APP_VERSION } from '../hooks/useUpdateCheck'

// The app icon, inlined so the screen has no asset to resolve: the build uses
// a relative base and the desktop bundle is loaded over file://.
function SplashLogo() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="12" width="34" height="24" rx="6" fill="var(--c-e6e6e6, #e6e6e6)" />
      <path d="M10 34h10v10z" fill="var(--c-e6e6e6, #e6e6e6)" />
      <circle cx="15" cy="24" r="3" fill="var(--c-b4b4b4, #b4b4b4)" />
      <circle cx="23" cy="24" r="3" fill="var(--c-b4b4b4, #b4b4b4)" />
      <circle cx="31" cy="24" r="3" fill="var(--c-b4b4b4, #b4b4b4)" />
      <rect x="26" y="28" width="34" height="24" rx="6" fill="var(--c-1b1b1b, #1b1b1b)" />
      <path d="M54 50h-10v10z" fill="var(--c-1b1b1b, #1b1b1b)" />
      <circle cx="37" cy="40" r="3" fill="var(--c-a78bfa, #a78bfa)" />
      <circle cx="45" cy="40" r="3" fill="var(--c-a78bfa, #a78bfa)" />
      <circle cx="53" cy="40" r="3" fill="var(--c-a78bfa, #a78bfa)" />
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
        background: 'var(--c-000000cc, #000000cc)',
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
          background: 'radial-gradient(120% 120% at 50% 0%, var(--c-221c3a, #221c3a) 0%, var(--c-141414, #141414) 55%)',
          border: '1px solid var(--c-2e2e2e, #2e2e2e)',
          borderRadius: 14,
          width: 'min(94vw, 520px)',
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 18px 48px var(--c-000000aa, #000a)',
        }}
      >
        <div style={{ padding: '26px 24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <SplashLogo />
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-f0f0f0, #f0f0f0)' }}>{ui.title}</div>
          <div style={{ fontSize: 11, color: 'var(--c-777777, #777)', fontFamily: 'var(--mono)' }}>{ui.version(APP_VERSION)}</div>
          <p style={{ fontSize: 13, color: 'var(--c-9a9a9a, #9a9a9a)', lineHeight: 1.6, maxWidth: 400 }}>{ui.tagline}</p>
        </div>

        <div style={{ padding: '0 24px 20px', overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-777777, #777)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
            {ui.stepsTitle}
          </div>
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none' }}>
            {steps.map((step, index) => (
              <li key={step.title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--c-2a2440, #2a2440)', border: '1px solid var(--c-4c3f7a, #4c3f7a)', color: 'var(--c-c4b5fd, #c4b5fd)',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {index + 1}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-dddddd, #ddd)' }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-8d8d8d, #8d8d8d)', lineHeight: 1.5 }}>{step.text}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '12px 24px', borderTop: '1px solid var(--c-2e2e2e, #2e2e2e)', background: 'var(--c-141414, #141414)', flexWrap: 'wrap',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--c-999999, #999)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={event => onShowOnStartupChange(event.target.checked)}
              style={{ width: 14, height: 14, accentColor: 'var(--c-7c6aff, #7c6aff)', cursor: 'pointer' }}
            />
            {ui.showOnStartup}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onStart ?? onClose}
              autoFocus
              style={{
                background: 'var(--c-1f2a3f, #1f2a3f)', border: '1px solid var(--c-3f5a8a, #3f5a8a)', color: 'var(--c-9fc2ff, #9fc2ff)',
                borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {ui.start}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: '1px solid var(--c-3a3a3a, #3a3a3a)', color: 'var(--c-888888, #888)',
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
