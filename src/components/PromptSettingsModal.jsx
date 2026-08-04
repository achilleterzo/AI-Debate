import { useState } from 'react'
import ReactSelect from 'react-select'
import { UI_LANGUAGE_OPTIONS, formatLanguageLabel } from '../i18n/UiStrings'
import { useUiStrings } from '../i18n/UiStringsContext'
import { TRANSLATED_LANGUAGE_CODES } from '../i18n/locales'
import { UPDATE_ERROR, UPDATE_STATUS } from '../services/Updates'
import { TOOL_SETTINGS } from '../tools/ToolSettings'

const TABS = ['main', 'promptRules', 'advanced']

export default function PromptSettingsModal({
  value,
  onClose,
  onSave,
  onReset,
  onClearSettings,
  interfaceLang,
  onInterfaceLangChange,
  moodSelectStyles,
  updateCheck,
  timeoutSec,
  onTimeoutSecChange,
  debugMode,
  onDebugModeChange,
  running,
  enabledTools,
  onEnabledToolsChange,
}) {
  const UI_STRINGS = useUiStrings()
  const ui = UI_STRINGS.promptSettingsModal
  const appUi = UI_STRINGS.app
  const common = UI_STRINGS.common
  const topMenuUi = UI_STRINGS.topMenu
  const [text, setText] = useState(value)
  const [activeTab, setActiveTab] = useState('main')
  const languageOptions = UI_LANGUAGE_OPTIONS
    .filter(language => TRANSLATED_LANGUAGE_CODES.includes(language.code))
    .map(language => ({ value: language.code, label: language.label, code: language.code }))

  const tabLabel = {
    main: ui.tabMain,
    promptRules: ui.tabPromptRules,
    advanced: ui.tabAdvanced,
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, width: 'min(94vw, 820px)', height: 'min(84vh, 560px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ddd' }}>{ui.title}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid #2e2e2e', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  textAlign: 'left',
                  background: activeTab === tab ? '#1f2a3f' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: activeTab === tab ? '#9fc2ff' : '#999',
                  padding: '8px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >{tabLabel[tab]}</button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0, padding: 14, overflowY: 'auto' }}>
            {activeTab === 'main' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{ui.interfaceLanguage}</span>
                  <div style={{ minWidth: 170 }}>
                    <ReactSelect
                      styles={moodSelectStyles}
                      options={languageOptions}
                      value={languageOptions.find(o => o.value === interfaceLang) ?? null}
                      onChange={opt => onInterfaceLangChange(opt.value)}
                      formatOptionLabel={formatLanguageLabel}
                      menuPlacement="auto"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #242424', paddingTop: 14 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{ui.version}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: '#ddd', fontFamily: 'var(--mono)' }}>
                      v{updateCheck?.currentVersion ?? '—'}
                    </span>
                    <button
                      onClick={() => updateCheck?.check?.()}
                      disabled={!updateCheck || updateCheck.isChecking}
                      style={{
                        background: 'transparent',
                        border: '1px solid #3a3a3a',
                        color: updateCheck?.isChecking ? '#555' : '#888',
                        borderRadius: 6,
                        padding: '4px 12px',
                        cursor: updateCheck?.isChecking ? 'default' : 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {updateCheck?.isChecking ? ui.updateChecking : ui.updateCheckNow}
                    </button>
                  </div>

                  {updateCheck?.status === UPDATE_STATUS.UP_TO_DATE && (
                    <span style={{ fontSize: 11, color: '#4ade80' }}>{ui.updateUpToDate}</span>
                  )}
                  {updateCheck?.status === UPDATE_STATUS.ERROR && (
                    <span style={{ fontSize: 11, color: '#f87171' }}>
                      {updateCheck.errorKind === UPDATE_ERROR.UNREACHABLE
                        ? ui.updateUnreachable
                        : ui.updateError(updateCheck.error)}
                    </span>
                  )}
                  {updateCheck?.status === UPDATE_STATUS.AVAILABLE && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#f59e0b' }}>
                        {ui.updateAvailable(updateCheck.latestVersion)}
                      </span>
                      <button
                        onClick={() => window.open(updateCheck.releaseUrl, '_blank', 'noopener,noreferrer')}
                        style={{
                          background: '#2a1f10',
                          border: '1px solid #7a5a1f',
                          color: '#f0c060',
                          borderRadius: 6,
                          padding: '4px 12px',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >{ui.updateDownload}</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'promptRules' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#777' }}>{ui.description}</span>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 8, color: '#ddd', fontSize: 12, lineHeight: 1.55, padding: '10px 12px', resize: 'vertical', minHeight: 220 }}
                />
              </div>
            )}

            {activeTab === 'advanced' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', minHeight: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{ui.toolsTitle}</span>
                  <span style={{ fontSize: 11, color: '#666', lineHeight: 1.45 }}>{ui.toolsDescription}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
                    {TOOL_SETTINGS.map(tool => {
                      const enabled = enabledTools?.[tool.id] !== false
                      return (
                        <div key={tool.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 9px', border: '1px solid #252525', borderRadius: 7, background: '#101010', opacity: running ? 0.55 : 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{tool.icon}</span>
                            <span style={{ fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ui[tool.labelKey]} <span style={{ color: '#777' }}>({tool.id})</span></span>
                            {tool.rolePlayOnly && <span style={{ fontSize: 10, color: '#9b8bd4', border: '1px solid #443b64', borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>{ui.toolRolePlayOnly}</span>}
                            {tool.moderatorOnly && <span style={{ fontSize: 10, color: '#fb923c', border: '1px solid #6b4228', borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>{ui.moderator}</span>}
                          </div>
                          <div
                            onClick={() => !running && onEnabledToolsChange?.({ ...enabledTools, [tool.id]: !enabled })}
                            role="switch"
                            aria-checked={enabled}
                            style={{ width: 34, height: 18, borderRadius: 9, position: 'relative', flexShrink: 0, background: enabled ? '#4ade80' : '#444', cursor: running ? 'default' : 'pointer', transition: 'background 0.2s' }}
                            title={enabled ? ui.toolEnabled : ui.toolDisabled}
                          >
                            <div style={{ position: 'absolute', top: 2, left: enabled ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{appUi.timeout}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" min={10} max={600} value={timeoutSec} onChange={e => onTimeoutSecChange(Math.max(10, Number(e.target.value)))} disabled={running} style={{ width: 80, background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 6, color: '#ddd', padding: '5px 8px', fontSize: 13, textAlign: 'center' }} />
                    <span style={{ fontSize: 11, color: '#666' }}>{appUi.seconds}</span>
                  </div>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 18, borderTop: '1px solid #2e2e2e', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <button onClick={onClearSettings} style={{ background: 'transparent', border: '1px solid #5a2e2e', color: '#f87171', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{topMenuUi.clearSavedSettings}</button>
                  <div
                    onClick={() => onDebugModeChange(!debugMode)}
                    title={debugMode ? appUi.debugOn : appUi.debugOff}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ width: 32, height: 16, borderRadius: 8, position: 'relative', background: debugMode ? '#f59e0b' : '#444', transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: 2, left: debugMode ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: debugMode ? '#f59e0b' : '#aaa' }}>{appUi.debugLabel}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderTop: '1px solid #2e2e2e', flexShrink: 0 }}>
          <div>
            {activeTab === 'promptRules' && (
              <button onClick={() => setText(onReset())} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{ui.resetDefault}</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#888', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{activeTab === 'promptRules' ? common.cancel : common.close}</button>
            {activeTab === 'promptRules' && (
              <button onClick={() => onSave(text)} style={{ background: '#1f2a3f', border: '1px solid #3f5a8a', color: '#9fc2ff', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>{common.save}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
