import { useEffect, useRef, useState } from 'react'
import { UI_STRINGS } from '../i18n/UiStrings'

export default function TopMenu({
  DropdownItem,
  onSaveSnapshot,
  onLoadSnapshot,
  onOpenPromptSettings,
  exportItems,
  onClearSettings,
}) {
  const ui = UI_STRINGS.topMenu
  const MenuItemComponent = DropdownItem
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const handler = event => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const withClose = onClick => () => {
    onClick?.()
    setMenuOpen(false)
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 22, padding: '2px 4px', lineHeight: 1 }}
        onClick={() => setMenuOpen(v => !v)}
        title={ui.title}
      >☰</button>
      {menuOpen && (
        <div style={{
          position: 'absolute', left: 0, top: '110%', zIndex: 260,
          background: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: 8,
          padding: '6px 0', minWidth: 210, boxShadow: '0 4px 16px #0008',
        }}>
          <MenuItemComponent onClick={withClose(onSaveSnapshot)}>{ui.saveSnapshot}</MenuItemComponent>
          <MenuItemComponent onClick={withClose(onLoadSnapshot)}>{ui.loadSnapshot}</MenuItemComponent>
          <MenuItemComponent onClick={withClose(onOpenPromptSettings)}>{ui.promptSettings}</MenuItemComponent>
          <div style={{ borderTop: '1px solid #2e2e2e', margin: '4px 0' }} />
          {exportItems.map(item => (
            <div key={item.label}><MenuItemComponent disabled={item.disabled} onClick={withClose(item.onClick)}>{item.label}</MenuItemComponent></div>
          ))}
          <div style={{ borderTop: '1px solid #2e2e2e', margin: '4px 0' }} />
          <MenuItemComponent danger onClick={withClose(onClearSettings)}>{ui.clearSavedSettings}</MenuItemComponent>
        </div>
      )}
    </div>
  )
}
