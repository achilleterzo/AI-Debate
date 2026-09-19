import { describe, expect, it } from 'vitest'
import { WEB_SEARCH_TOOL } from '../src/tools/WebSearchTool'

describe('web_search tool contract', () => {
  it('lets a participant override the configured search engine', () => {
    const engine = WEB_SEARCH_TOOL.function.parameters.properties.engine
    expect(engine.enum).toEqual(['auto', 'duckduckgo', 'brave', 'bing', 'google'])
    expect(WEB_SEARCH_TOOL.function.parameters.required).toEqual(['query'])
  })
})
