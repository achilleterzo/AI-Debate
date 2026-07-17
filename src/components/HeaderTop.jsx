import { UI_STRINGS } from '../i18n/UiStrings'
import DropdownItem from './DropdownItem'
import TopMenu from './TopMenu'
import { styles } from './Style'

export default function HeaderTop({
  headerTopRef,
  running,
  onSaveSnapshot,
  onLoadSnapshot,
  onOpenPromptSettings,
  exportItems,
  onClearSettings,
  ollamaOk,
  modelsCount,
  is2xlLayout,
  headerOpen,
  onToggleHeaderOpen,
}) {
  const ui = UI_STRINGS.app

  return (
    <div ref={headerTopRef} style={styles.headerTop}>
      <TopMenu
        DropdownItem={DropdownItem}
        running={running}
        onSaveSnapshot={onSaveSnapshot}
        onLoadSnapshot={onLoadSnapshot}
        onOpenPromptSettings={onOpenPromptSettings}
        exportItems={exportItems}
        onClearSettings={onClearSettings}
      />

      <span style={{ ...styles.title, textAlign: 'center' }}>{ui.debateTitle}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <div
          style={styles.dot(ollamaOk)}
          title={ollamaOk === null ? ui.connectionConnecting : ollamaOk ? ui.connectionConnected(modelsCount) : ui.connectionUnreachable}
        />
        {ollamaOk && <span style={styles.modelCount}>{ui.modelsCount(modelsCount)}</span>}
        {!is2xlLayout && (
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
