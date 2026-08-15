/**
 * The X that removes a chip or a list row.
 *
 * A typed "x" was doing this job: at 11px, in the same colour and weight as the
 * text beside it, it read as the last letter of the label rather than as a
 * control. The glyph is a stroked SVG at a fixed size, with its own hit area
 * and a hover state, so it is visibly a button before it is clicked.
 */
export default function RemoveButton({ onClick, title, color = '#7f629d', hoverColor = '#f87171', size = 14 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        background: 'none',
        border: 'none',
        color,
        cursor: 'pointer',
        padding: 2,
        margin: -2,
        lineHeight: 0,
        borderRadius: 4,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={event => {
        event.currentTarget.style.color = hoverColor
        event.currentTarget.style.background = '#ffffff12'
      }}
      onMouseLeave={event => {
        event.currentTarget.style.color = color
        event.currentTarget.style.background = 'none'
      }}
    >
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
      </svg>
    </button>
  )
}
