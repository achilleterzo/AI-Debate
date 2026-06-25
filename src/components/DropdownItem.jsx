import { useState} from 'react'
import { styles } from './Style'

export default function DropdownItem({ onClick, danger, disabled, children }) {
  const [hovered, setHovered] = useState(false)
  const base = danger ? styles.dropdownItemDanger : styles.dropdownItem
  return (
	<button
	  style={{ ...base, background: hovered && !disabled ? '#2a2a2a' : 'none', opacity: disabled ? 0.35 : 1, cursor: disabled ? 'default' : 'pointer' }}
	  onMouseEnter={() => setHovered(true)}
	  onMouseLeave={() => setHovered(false)}
	  onClick={disabled ? undefined : onClick}
	  disabled={disabled}
	>{children}</button>
  )
}
