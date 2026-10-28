/**
 * A provider's logo on a light square. The logos are drawn for a light page, so
 * on a dark theme they sink into the background; the square keeps them legible
 * whichever theme is active.
 */
export default function ProviderLogo({ src, size = 21, padding = '2px 4px', dimmed = false }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        boxSizing: 'border-box',
        objectFit: 'contain',
        padding,
        borderRadius: 4,
        background: 'var(--c-f4f4f0, #f4f4f0)',
        opacity: dimmed ? 0.7 : 1,
      }}
    />
  )
}
