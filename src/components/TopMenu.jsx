import { useEffect, useRef, useState } from 'react'
import { UI_STRINGS } from '../i18n/UiStrings'

export default function TopMenu({
  DropdownItem,
  onSaveSnapshot,
  onLoadSnapshot,
  onOpenPromptSettings,
  exportItems,
}) {
  const ui = UI_STRINGS.topMenu
  const MenuItemComponent = DropdownItem
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const handler = event => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const withClose = onClick => () => {
    onClick?.()
    setMenuOpen(false)
    setExportOpen(false)
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 22, padding: '2px 4px', lineHeight: 1 }}
        onClick={() => setMenuOpen(v => {
          const next = !v
          if (!next) setExportOpen(false)
          return next
        })}
        title={ui.title}
      >☰</button>
      {menuOpen && (
        <div style={{
          position: 'absolute', left: 0, top: '110%', zIndex: 260,
          background: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: 8,
          padding: '6px 0', minWidth: 210, boxShadow: '0 4px 16px #0008',
        }}>
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setExportOpen(true)}
            onMouseLeave={() => setExportOpen(false)}
          >
            <MenuItemComponent onClick={() => setExportOpen(v => !v)}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                {ui.export}
                <span style={{ color: '#666', fontSize: 11 }}>▸</span>
              </span>
            </MenuItemComponent>
            {exportOpen && (
              <div style={{
                position: 'absolute', left: '100%', top: -6, zIndex: 261,
                background: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: 8,
                padding: '6px 0', minWidth: 190, boxShadow: '0 4px 16px #0008',
              }}>
                {exportItems.map(item => (
                  <MenuItemComponent key={item.label} disabled={item.disabled} onClick={withClose(item.onClick)}>{item.label}</MenuItemComponent>
                ))}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid #2e2e2e', margin: '4px 0' }} />
          <MenuItemComponent onClick={withClose(onLoadSnapshot)}>{ui.loadSnapshot}</MenuItemComponent>
          <MenuItemComponent onClick={withClose(onSaveSnapshot)}>{ui.saveSnapshot}</MenuItemComponent>
          <MenuItemComponent onClick={withClose(onOpenPromptSettings)}>{ui.promptSettings}</MenuItemComponent>
        </div>
      )}
    </div>
  )
}
