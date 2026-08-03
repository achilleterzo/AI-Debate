export const ROLL_DICE_TOOL = {
  type: 'function',
  function: {
    name: 'roll_dice',
    description: 'Roll a shared set of dice for the role-playing scene. Every participant receives the same result in the shared debate history.',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'integer', minimum: 1, maximum: 100, description: 'Number of dice to roll.' },
        sides: { type: 'integer', minimum: 2, maximum: 1000, description: 'Number of faces on each die.' },
      },
      required: ['count', 'sides'],
    },
  },
}

function secureRandomInt(max) {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(1)
    const limit = Math.floor(0x100000000 / max) * max
    do crypto.getRandomValues(values); while (values[0] >= limit)
    return values[0] % max
  }
  return Math.floor(Math.random() * max)
}

export function rollDice({ count = 1, sides = 20 } = {}) {
  const safeCount = Math.min(100, Math.max(1, Math.round(Number(count) || 1)))
  const safeSides = Math.min(1000, Math.max(2, Math.round(Number(sides) || 20)))
  const rolls = Array.from({ length: safeCount }, () => secureRandomInt(safeSides) + 1)
  return { count: safeCount, sides: safeSides, rolls, total: rolls.reduce((sum, value) => sum + value, 0) }
}

export function formatDiceRoll(result) {
  return `Shared dice result: ${result.count}d${result.sides} → [${result.rolls.join(', ')}] = ${result.total}`
}
