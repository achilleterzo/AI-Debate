import { useUiStrings } from '../i18n/UiStringsContext'
import DropdownItem from './DropdownItem'
import TopMenu from './TopMenu'
import { styles } from './Style'

export default function HeaderTop({
  headerTopRef,
  running,
  onSaveSnapshot,
  onLoadSnapshot,
  onOpenPromptSettings,
  onOpenSplash,
  onOpenWizard,
  onNewChat,
  onFork,
  canFork,
  exportItems,
  updateAvailable,
  ollamaOk,
  modelsCount,
  onOpenConnection,
  isWideLayout,
  headerOpen,
  onToggleHeaderOpen,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.app

  // Unreachable is the state that needs to shout: it is the one the user has to
  // act on, and the action is one click away on this very button.
  const status = ollamaOk === null
    ? { color: '#999', background: '#151515', border: '#303030' }
    : ollamaOk
      ? { color: '#4ade80', background: '#151515', border: '#303030' }
      : { color: '#f87171', background: '#2a1616', border: '#6b2b2b' }
  const statusLabel = ollamaOk === null
    ? ui.connectionConnecting
    : ollamaOk
      ? ui.connectionConnected(modelsCount)
      : ui.connectionUnreachable

  return (
    <div ref={headerTopRef} style={styles.headerTop}>
      <TopMenu
        DropdownItem={DropdownItem}
        running={running}
        onSaveSnapshot={onSaveSnapshot}
        onLoadSnapshot={onLoadSnapshot}
        onOpenPromptSettings={onOpenPromptSettings}
        onOpenSplash={onOpenSplash}
        onOpenWizard={onOpenWizard}
        onNewChat={onNewChat}
        onFork={onFork}
        canFork={canFork}
        exportItems={exportItems}
        updateAvailable={updateAvailable}
      />

      <span style={{ ...styles.title, textAlign: 'center' }}>{ui.debateTitle}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        {/* The status light doubles as the way into the endpoint settings: it is
            the thing you look at when the connection misbehaves. Every state
            carries its own words — a bare red dot says something is wrong
            without saying what, and without saying it is fixable here. */}
        <button
          onClick={onOpenConnection}
          title={`${statusLabel} — ${ui.connectionSettings}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: status.background, border: `1px solid ${status.border}`, borderRadius: 999,
            padding: '3px 9px', cursor: 'pointer', lineHeight: 1,
          }}
        >
          <span style={styles.dot(ollamaOk)} />
          <span style={{ fontSize: 11, color: status.color, whiteSpace: 'nowrap' }}>{statusLabel}</span>
        </button>
        {!isWideLayout && (
          <button
            onClick={onToggleHeaderOpen}
            title={headerOpen ? ui.collapseSettings : ui.expandSettings}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 22, padding: '0 2px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {headerOpen ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
