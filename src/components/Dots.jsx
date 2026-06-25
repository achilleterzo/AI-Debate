export default function Dots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: '#666',
          animation: 'blink 1.2s infinite', animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  )
}
