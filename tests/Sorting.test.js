import { describe, expect, it } from 'vitest'
import { buildOrderedItems } from '../src/utils/Sorting'

describe('buildOrderedItems', () => {
  it('orders messages and conclusions by their sequence number', () => {
    const messages = [{ role: 'alpha', seq: 3 }, { role: 'beta', seq: 1 }]
    const conclusions = [{ type: 'summary', seq: 2 }]

    expect(buildOrderedItems(messages, conclusions).map(item => item.kind === 'msg' ? item.msg.role : item.c.type))
      .toEqual(['beta', 'summary', 'alpha'])
  })

  it('places unsequenced messages by turn before unsequenced conclusions', () => {
    const messages = [{ role: 'alpha', turn: 2 }, { role: 'beta', turn: 1 }]
    const conclusions = [{ type: 'summary' }]

    expect(buildOrderedItems(messages, conclusions).map(item => item.kind === 'msg' ? item.msg.role : item.c.type))
      .toEqual(['beta', 'alpha', 'summary'])
  })

  it('includes source indexes only when requested', () => {
    const result = buildOrderedItems([{ role: 'alpha', seq: 1 }], [{ type: 'summary', seq: 2 }], {
      includeMessageIndex: true,
      includeConclusionIndex: true,
    })

    expect(result).toMatchObject([{ idx: 0 }, { cidx: 0 }])
  })
})
