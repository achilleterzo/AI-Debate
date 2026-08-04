export const ROLL_DICE_TOOL = {
  type: 'function',
  function: {
    name: 'roll_dice',
    description: 'Individually roll dice for your own action in the role-playing scene. The tool call belongs to the participant who invokes it; only the resulting numbers are shared with everyone.',
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
  if (result.count === 1) return `(1d${result.sides}) -> ${result.rolls[0]}`
  return `(${result.count}d${result.sides}) -> [${result.rolls.join('+')}] = ${result.total}`
}
