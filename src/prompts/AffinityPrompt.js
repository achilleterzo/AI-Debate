export function buildAffinityBlock({ actor, allParticipants }) {
  const affinityEntries = Object.entries(actor.affinity && typeof actor.affinity === 'object' ? actor.affinity : {})
    .map(([id, weight]) => {
      const other = allParticipants.find(p => String(p.id) === String(id) && p.id !== actor.id)
      const value = Number(weight)
      if (!other || !Number.isFinite(value) || value === 0) return null
      return `- ${other.name || other.tag}: ${value > 0 ? '+' : ''}${value.toFixed(2)}`
    })
    .filter(Boolean)

  return affinityEntries.length > 0
    ? `Your relational affinity toward other participants, from -1.00 (strong conflict, distrust, hostility) to +1.00 (strong alignment, trust, support):\n${affinityEntries.join('\n')}\n\nLet these weights shape your tone toward each participant and how willing you are to agree with, build on, or push back against their arguments.`
    : ''
}
