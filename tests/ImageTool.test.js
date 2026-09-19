import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { streamChat } from '../src/debate/Stream'
import { ollamaProvider } from '../src/providers/ollama'
import { createCliProvider } from '../src/providers/cli'
import { coverCrop, fitWithin, isThumbnailDataUrl, preferredOutputType } from '../src/services/Images'
import { attachToolInvocationResult } from '../src/debate/Debate'
import { Data } from '../src/data/Data'
import { readAttachment } from '../src/tools/AttachmentTool'
import { createConversationToolExecutor } from '../src/tools/ConversationTools'
import { VIEW_IMAGE_TOOL, loadFullImage, viewImage } from '../src/tools/ImageTool'
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

describe('thumbnail on the tool pill', () => {
  const THUMB = 'data:image/jpeg;base64,/9j/4AAQ'

  it('crops the centered square, like object-fit: cover at 1:1', () => {
    expect(coverCrop(800, 600)).toEqual({ x: 100, y: 0, side: 600 })
    expect(coverCrop(300, 900)).toEqual({ x: 0, y: 300, side: 300 })
  })

  it('accepts only our own data URLs as thumbnails', () => {
    expect(isThumbnailDataUrl(THUMB)).toBe(true)
    expect(isThumbnailDataUrl('https://example.org/a.png')).toBe(false)
    expect(isThumbnailDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(isThumbnailDataUrl('data:image/jpeg;base64,AA" onerror="x')).toBe(false)
  })

  it('comes back with the tool result, for attachments and URLs alike', async () => {
    const thumbnail = vi.fn(async () => THUMB)
    const attached = await viewImage({ source: 'colosseo' }, { attachments: [{ ...PHOTO, image: { ...PHOTO.image } }], thumbnail })
    const fetched = await viewImage({ source: 'https://example.org/a.png' }, {
      fetchImage: async () => ({ kind: 'image', blob: new Blob(['x'], { type: 'image/png' }) }),
      normalize: async () => normalized(),
      thumbnail,
      cache: new Map(),
    })
    expect(attached.pill).toEqual({ thumbnail: THUMB, imageSource: 'colosseo.jpg', imageKind: 'attachment' })
    expect(fetched.pill).toEqual({ thumbnail: THUMB, imageSource: 'https://example.org/a.png', imageKind: 'image' })
  })

  it('never costs the model its image when the thumbnail fails', async () => {
    const photo = { ...PHOTO, image: { ...PHOTO.image } }
    const result = await viewImage({ source: 'colosseo.jpg' }, { attachments: [photo], thumbnail: async () => { throw new Error('no canvas') } })
    expect(result.pill.thumbnail).toBeNull()
    expect(result.images).toEqual(['QUJD'])
  })

  it('is reported by the loop for the very pill it announced', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call += 1
      const lines = call === 1
        ? [JSON.stringify({ message: { tool_calls: [{ function: { name: 'view_image', arguments: { source: 'colosseo.jpg' } } }] } }) + '\n',
            JSON.stringify({ done: true, message: { content: '' } }) + '\n']
        : [JSON.stringify({ done: true, message: { content: 'Arches.' } }) + '\n']
      return { ok: true, body: new ReadableStream({ start(controller) { for (const line of lines) controller.enqueue(new TextEncoder().encode(line)); controller.close() } }) }
    }))
    const announced = []
    const completed = []
    await streamChat({
      baseUrl: 'http://fake',
      model: 'eyes',
      messages: [{ role: 'user', content: 'Look.' }],
      useTools: true,
      tools: [VIEW_IMAGE_TOOL],
      executeTool: (name, args) => viewImage(args, { attachments: [{ ...PHOTO, image: { ...PHOTO.image } }], thumbnail: async () => THUMB }),
      onToken: () => {},
      onToolInvocation: invocation => announced.push(invocation),
      onToolInvocationResult: (invocation, extra) => completed.push({ invocation, extra }),
    })
    expect(completed).toHaveLength(1)
    expect(completed[0].invocation).toBe(announced[0])
    expect(completed[0].extra).toMatchObject({ thumbnail: THUMB, imageSource: 'colosseo.jpg' })
  })

  it('is stored on that pill wherever the turn carried it, and only on it', () => {
    const invocation = { name: 'view_image', arguments: { source: 'colosseo.jpg' } }
    const twin = { name: 'view_image', arguments: { source: 'colosseo.jpg' } }
    const history = [
      { seq: 1, toolInvocations: [twin], toolEvents: [{ type: 'invocation', invocation: twin }] },
      { seq: 2, toolInvocations: [invocation], toolEvents: [{ type: 'invocation', invocation, beforeContent: true }] },
    ]
    const next = attachToolInvocationResult(history, invocation, { thumbnail: THUMB })
    expect(next[0]).toBe(history[0])
    expect(next[1].toolInvocations[0]).toMatchObject({ name: 'view_image', thumbnail: THUMB })
    expect(next[1].toolEvents[0]).toMatchObject({ beforeContent: true, invocation: { thumbnail: THUMB } })
  })

  it('appears in the HTML export, and a foreign src never does', () => {
    const turn = thumbnail => [
      { role: 'topic', content: 'Rome', turn: 0, seq: 0 },
      { role: 'A', content: 'Arches.', turn: 1, seq: 1, toolInvocations: [{ name: 'view_image', arguments: { source: 'colosseo.jpg' }, thumbnail }] },
    ]
    const participants = [{ id: 0, tag: 'A', name: 'Alice', mood: 'none' }]
    const constants = { MOODS: [{ id: 'none', label: 'Neutral', emoji: '' }], MOOD_INTENSITY: [{ label: 'Balanced' }], DEFAULT_MOOD_INTENSITY: 0, AGE_GROUPS: [{ label: 'Adult' }], DEFAULT_AGE_GROUP: 0, EDUCATION_LEVELS: [{ value: null, label: 'Model default' }], CHARACTER_TYPES: [{ value: null, label: 'Person' }], RESPONSE_LENGTHS: [{ value: 'short', label: 'Short' }] }
    const withThumb = Data.buildHTML({ messages: turn(THUMB), participants, baseUrl: '', constants })
    const foreign = Data.buildHTML({ messages: turn('https://evil.example/pixel.png'), participants, baseUrl: '', constants })
    expect(withThumb).toContain(`<img class="tool-pill-thumb" src="${THUMB}"`)
    // An attachment has nothing to link to.
    expect(withThumb).not.toContain('<a class="tool-pill-thumb-button"')
    expect(withThumb).toContain('<span class="tool-pill-icon">🖼️</span>')
    expect(foreign).not.toContain('evil.example')
    expect(foreign).toContain('class="tool-pill"')
  })
})

describe('full-size image for the lightbox', () => {
  const THUMB = 'data:image/jpeg;base64,/9j/4AAQ'

  it('reopens an attachment by the name the pill stored', async () => {
    const full = await loadFullImage('colosseo.jpg', { attachments: [PHOTO] })
    expect(full).toEqual({ kind: 'attachment', src: 'data:image/jpeg;base64,QUJD', width: 800, height: 600 })
  })

  it('reuses what the tool already downloaded, and downloads again after a reset', async () => {
    const cache = new Map()
    const fetchImage = vi.fn(async () => ({ kind: 'page', blob: new Blob(['x'], { type: 'image/png' }) }))
    const options = { fetchImage, normalize: async () => normalized(), cache }
    await viewImage({ source: 'https://example.org/' }, { ...options, thumbnail: async () => THUMB })
    expect((await loadFullImage('https://example.org/', options)).kind).toBe('page')
    expect(fetchImage).toHaveBeenCalledTimes(1)
    cache.clear()
    await loadFullImage('https://example.org/', options)
    expect(fetchImage).toHaveBeenCalledTimes(2)
  })

  it('draws the thumbnail of an image once, however many times it is viewed', async () => {
    const thumbnail = vi.fn(async () => THUMB)
    const options = { fetchImage: async () => ({ kind: 'image', blob: new Blob(['x'], { type: 'image/png' }) }), normalize: async () => normalized(), thumbnail, cache: new Map() }
    await viewImage({ source: 'https://example.org/b.png' }, options)
    await viewImage({ source: 'https://example.org/b.png' }, options)
    expect(thumbnail).toHaveBeenCalledTimes(1)
  })

  it('fails on a removed attachment instead of showing something else', async () => {
    await expect(loadFullImage('colosseo.jpg', { attachments: [] })).rejects.toThrow('neither an attached image')
  })

  it('links the exported thumbnail to its source, without letting a quote out of the attribute', () => {
    const constants = { MOODS: [{ id: 'none', label: 'Neutral', emoji: '' }], MOOD_INTENSITY: [{ label: 'Balanced' }], DEFAULT_MOOD_INTENSITY: 0, AGE_GROUPS: [{ label: 'Adult' }], DEFAULT_AGE_GROUP: 0, EDUCATION_LEVELS: [{ value: null, label: 'Model default' }], CHARACTER_TYPES: [{ value: null, label: 'Person' }], RESPONSE_LENGTHS: [{ value: 'short', label: 'Short' }] }
    const html = source => Data.buildHTML({
      messages: [
        { role: 'topic', content: 'Rome', turn: 0, seq: 0 },
        { role: 'A', content: 'Arches.', turn: 1, seq: 1, toolInvocations: [{ name: 'view_image', arguments: { source }, thumbnail: THUMB, imageSource: source, imageKind: 'image' }] },
      ],
      participants: [{ id: 0, tag: 'A', name: 'Alice', mood: 'none' }], baseUrl: '', constants,
    })
    expect(html('https://example.org/a.png')).toContain('<a class="tool-pill-thumb-button" href="https://example.org/a.png" target="_blank"')
    const hostile = html('https://example.org/a.png" onmouseover="alert(1)')
    expect(hostile).not.toMatch(/href="[^"]*" onmouseover=/)
    expect(hostile).toContain('href="https://example.org/a.png%22%20onmouseover=%22alert(1)"')
  })
})
