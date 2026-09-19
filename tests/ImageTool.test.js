import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { streamChat } from '../src/debate/Stream'
import { ollamaProvider } from '../src/providers/ollama'
import { createCliProvider } from '../src/providers/cli'
import { fitWithin, preferredOutputType } from '../src/services/Images'
import { readAttachment } from '../src/tools/AttachmentTool'
import { createConversationToolExecutor } from '../src/tools/ConversationTools'
import { VIEW_IMAGE_TOOL, viewImage } from '../src/tools/ImageTool'
import { buildTopicPromptBlocks } from '../src/prompts/TopicPrompt'

const PHOTO = {
  name: 'colosseo.jpg',
  kind: 'image',
  image: { base64: 'QUJD', mime: 'image/jpeg', width: 800, height: 600 },
  content: '[Image attachment, 800×600 px. Its contents are not available as text.]',
}
const NOTES = { name: 'notes.txt', content: 'Some notes.' }

function normalized() {
  return { base64: 'WFla', mime: 'image/png', width: 640, height: 480, bytes: 3 }
}

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ models: [
      { name: 'eyes', capabilities: ['completion', 'tools', 'vision'] },
      { name: 'blind', capabilities: ['completion', 'tools'] },
    ] }),
  })))
  await ollamaProvider.listModels('http://fake')
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('view_image', () => {
  it('returns an attached image by name, pixels apart from the text result', async () => {
    const result = await viewImage({ source: 'colosseo' }, { attachments: [NOTES, PHOTO] })
    expect(result.images).toEqual(['QUJD'])
    expect(JSON.parse(result.content)).toMatchObject({ source: 'colosseo.jpg', kind: 'attachment', width: 800 })
  })

  it('downloads and normalizes a URL once, then serves it from the cache', async () => {
    const cache = new Map()
    const fetchImage = vi.fn(async () => ({ kind: 'image', blob: new Blob(['x'], { type: 'image/webp' }) }))
    const normalize = vi.fn(async () => normalized())
    const options = { attachments: [], fetchImage, normalize, cache }

    const first = await viewImage({ source: 'https://example.org/a.webp' }, options)
    const second = await viewImage({ source: 'https://example.org/a.webp' }, options)

    expect(first.images).toEqual(['WFla'])
    expect(second.images).toEqual(['WFla'])
    expect(fetchImage).toHaveBeenCalledTimes(1)
    expect(normalize).toHaveBeenCalledTimes(1)
  })

  it('says a web page arrives as a screenshot, not as its text', async () => {
    const result = await viewImage({ source: 'https://example.org/' }, {
      fetchImage: async () => ({ kind: 'page', blob: new Blob(['x'], { type: 'image/png' }) }),
      normalize: async () => normalized(),
      cache: new Map(),
    })
    expect(JSON.parse(result.content).kind).toBe('page')
    expect(result.content).toContain('screenshot')
    expect(result.caption).toContain('screenshot of https://example.org/')
  })

  it('reports a failed download as text and forbids describing the image', async () => {
    const result = await viewImage({ source: 'https://example.org/gone.png' }, {
      attachments: [PHOTO],
      fetchImage: async () => { throw new Error('HTTP 404') },
      cache: new Map(),
    })
    expect(typeof result).toBe('string')
    expect(JSON.parse(result)).toMatchObject({ imageAttachments: ['colosseo.jpg'] })
    expect(result).toContain('HTTP 404')
    expect(result).toContain('do not describe it')
  })

  it('rejects a source that is neither an attachment nor a URL', async () => {
    const result = await viewImage({ source: 'file:///etc/passwd' }, { attachments: [PHOTO] })
    expect(JSON.parse(result).error).toContain('neither an attached image nor an http(s) URL')
  })

  it('is reachable through the conversation tool executor', async () => {
    const execute = createConversationToolExecutor({ viewImage: args => viewImage(args, { attachments: [PHOTO] }) })
    const result = await execute('view_image', { source: 'colosseo.jpg' })
    expect(result.images).toEqual(['QUJD'])
  })

  it('declares a single required source argument', () => {
    expect(VIEW_IMAGE_TOOL.function.parameters.required).toEqual(['source'])
  })
})

describe('image attachments elsewhere', () => {
  it('read_attachment lists images and points to view_image', () => {
    expect(JSON.parse(readAttachment([NOTES, PHOTO])).attachments).toEqual([
      { name: 'notes.txt', characters: 11 },
      { name: 'colosseo.jpg', type: 'image' },
    ])
    expect(JSON.parse(readAttachment([PHOTO], { name: 'colosseo.jpg' })).note).toContain('view_image')
  })

  it('the prompt tells a participant whether it can look at an image', () => {
    const history = [{ role: 'topic', content: 'The Colosseum' }]
    const seeing = buildTopicPromptBlocks({ history, attachedDocs: [PHOTO], imageToolAvailable: true }).docsBlock
    const blind = buildTopicPromptBlocks({ history, attachedDocs: [PHOTO], imageToolAvailable: false }).docsBlock
    expect(seeing).toContain('## colosseo.jpg\n(image, 800×600 px) Look at it with the view_image tool')
    expect(blind).toContain('You cannot view images in this turn')
  })
})

describe('vision capability', () => {
  it('is offered only to models that report it', async () => {
    expect(await ollamaProvider.supportsVision('eyes', { baseUrl: 'http://fake' })).toBe(true)
    expect(await ollamaProvider.supportsVision('blind', { baseUrl: 'http://fake' })).toBe(false)
    expect(await createCliProvider({ id: 'claude', label: 'Claude' }).supportsVision()).toBe(false)
  })
})

describe('image sizing', () => {
  it('scales the longer edge down to the limit and never up', () => {
    expect(fitWithin(4000, 3000, 1568)).toEqual({ width: 1568, height: 1176 })
    expect(fitWithin(600, 2400, 1568)).toEqual({ width: 392, height: 1568 })
    expect(fitWithin(300, 200, 1568)).toEqual({ width: 300, height: 200 })
  })

  it('keeps drawn images as PNG and photos as JPEG', () => {
    expect(preferredOutputType('image/png')).toBe('image/png')
    expect(preferredOutputType('image/svg+xml')).toBe('image/png')
    expect(preferredOutputType('image/webp')).toBe('image/jpeg')
    expect(preferredOutputType('image/jpeg')).toBe('image/jpeg')
  })
})

describe('the tool loop', () => {
  it('sends the image in a message after the tool result and keeps base64 out of the debug payload', async () => {
    let call = 0
    const fetchMock = vi.fn(async () => {
      call += 1
      const lines = call === 1
        ? [JSON.stringify({ message: { tool_calls: [{ function: { name: 'view_image', arguments: { source: 'colosseo.jpg' } } }] } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n']
        : [JSON.stringify({ message: { content: 'Three tiers of arches.' } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n']
      return {
        ok: true,
        body: new ReadableStream({ start(controller) { for (const line of lines) controller.enqueue(new TextEncoder().encode(line)); controller.close() } }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const payloads = []

    const result = await streamChat({
      baseUrl: 'http://fake',
      model: 'eyes',
      messages: [{ role: 'user', content: 'What does the attachment show?' }],
      useTools: true,
      tools: [VIEW_IMAGE_TOOL],
      executeTool: (name, args) => viewImage(args, { attachments: [PHOTO] }),
      onToken: () => {},
      onPayload: payload => payloads.push(payload),
    })

    expect(result).toBe('Three tiers of arches.')
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body).messages
    const toolIndex = sent.findIndex(message => message.role === 'tool')
    expect(sent[toolIndex]).toMatchObject({ tool_name: 'view_image' })
    expect(sent[toolIndex].images).toBeUndefined()
    expect(sent[toolIndex + 1]).toMatchObject({ role: 'user', images: ['QUJD'] })
    expect(sent[toolIndex + 1].content).toContain('not sent by any participant')

    const logged = payloads[1].body.messages[toolIndex + 1].images[0]
    expect(logged).toMatch(/^\[image: \d+ KB, base64 omitted\]$/)
  })
})
