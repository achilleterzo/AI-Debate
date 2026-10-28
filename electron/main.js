import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { Buffer } from 'node:buffer'
import { execFile, execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { resolveWindowsShim } from './cliShim.js'
import { claudeEffort, codexEffort, createClaudeTranslator, createCodexTranslator, ndjson } from './cliStream.js'
import { browserFetchImage, browserFetchPage, browserSearch, disposeBrowser, showBrowser } from './web/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROVIDER_LABELS = { codex: 'Codex', claude: 'Claude', 'ollama-cloud': 'Ollama Cloud', openrouter: 'OpenRouter', gemini: 'Gemini' }
// The desktop clients, and the providers whose API key the app stores encrypted.
const CLI_PROVIDERS = ['codex', 'claude']
const KEY_PROVIDERS = ['ollama-cloud', 'openrouter', 'gemini']
// Reasoning levels a Codex sandbox may run in; the renderer sends one per request.
const CODEX_SANDBOXES = ['read-only', 'workspace-write', 'danger-full-access']
const CLAUDE_MODELS = ['default', 'sonnet', 'opus', 'haiku', 'sonnet[1m]', 'opus[1m]']
const aiChildren = new Map()
const apiRequests = new Map()

/**
 * API keys of the hosted providers, encrypted by the operating system.
 *
 * One file per provider, named after it, so a key entered for one provider can
 * never be read as another's. Ollama Cloud keeps the file name it had before
 * the other providers existed, so a key saved back then still loads.
 */
function apiCredentialPath(provider) { return path.join(app.getPath('userData'), `${provider}-key.bin`) }

function loadApiKey(provider) {
  if (!KEY_PROVIDERS.includes(provider)) return ''
  try {
    if (!safeStorage.isEncryptionAvailable()) return ''
    return safeStorage.decryptString(Buffer.from(fs.readFileSync(apiCredentialPath(provider), 'utf8'), 'base64'))
  } catch { return '' }
}

function saveApiKey(provider, value) {
  if (!KEY_PROVIDERS.includes(provider)) throw new Error(`Unsupported AI provider: ${provider}`)
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this system')
  const credentialPath = apiCredentialPath(provider)
  const key = String(value || '').trim()
  if (!key) {
    try { fs.unlinkSync(credentialPath) } catch { /* no saved credential */ }
    return true
  }
  fs.mkdirSync(path.dirname(credentialPath), { recursive: true })
  fs.writeFileSync(credentialPath, safeStorage.encryptString(key).toString('base64'), { encoding: 'utf8', mode: 0o600 })
  return true
}

/**
 * What each hosted provider exposes, and how it frames an answer.
 *
 * `paths` is an allow list: the renderer names one of these, never a URL, so a
 * request can only ever reach that provider's own API — and the key, which
 * never leaves this process, cannot be sent anywhere else. `stream` is the one
 * path that answers a token at a time.
 */
const API_PROVIDERS = {
  'ollama-cloud': {
    origin: 'https://ollama.com',
    paths: ['/api/tags', '/api/show', '/api/chat'],
    stream: '/api/chat',
    accept: 'application/json, application/x-ndjson',
  },
  openrouter: {
    origin: 'https://openrouter.ai/api/v1',
    paths: ['/models', '/chat/completions'],
    stream: '/chat/completions',
    accept: 'application/json, text/event-stream',
    // Optional attribution, shown in the OpenRouter activity dashboard.
    headers: { 'X-Title': 'AI Debate', 'HTTP-Referer': 'https://github.com/achilleterzo/AI-Debate' },
  },
  gemini: {
    origin: 'https://generativelanguage.googleapis.com/v1beta/openai',
    paths: ['/models', '/chat/completions'],
    stream: '/chat/completions',
    accept: 'application/json, text/event-stream',
  },
}

const API_TIMEOUT_MS = 180000

function apiTarget(provider, apiPath, { stream = false } = {}) {
  const target = API_PROVIDERS[provider]
  if (!target) throw new Error(`Unsupported AI provider: ${provider}`)
  const requested = String(apiPath || '')
  if (stream ? requested !== target.stream : !target.paths.includes(requested)) {
    throw new Error(`Unsupported ${PROVIDER_LABELS[provider]} API path`)
  }
  return target
}

function apiHeaders(provider, target, key, payload) {
  return {
    Authorization: `Bearer ${key}`,
    Accept: target.accept,
    ...target.headers,
    ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
  }
}

/** One request to a hosted provider, answered in full. `apiKey` overrides the saved one. */
function requestApi({ provider, path: apiPath, method = 'GET', body = null, apiKey = '', requestId = '' } = {}) {
  let target
  try { target = apiTarget(provider, apiPath) } catch (error) { return Promise.reject(error) }
  const label = PROVIDER_LABELS[provider]
  const key = String(apiKey || loadApiKey(provider)).trim()
  if (!key) return Promise.reject(new Error(`${label} API key required`))
  const payload = body == null ? '' : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const request = https.request(`${target.origin}${apiPath}`, {
      method,
      headers: apiHeaders(provider, target, key, payload),
      timeout: API_TIMEOUT_MS,
    }, response => {
      let data = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { data += chunk })
      response.on('end', () => {
        if (requestId) apiRequests.delete(requestId)
        resolve({ status: response.statusCode || 500, body: data })
      })
    })
    if (requestId) apiRequests.set(requestId, request)
    request.on('timeout', () => request.destroy(new Error(`${label} request timed out`)))
    request.on('error', error => { if (requestId) apiRequests.delete(requestId); reject(error) })
    if (payload) request.write(payload)
    request.end()
  })
}

/**
 * One streamed chat to a hosted provider. `emit` receives the same events as
 * the desktop clients — start, chunk, end, error — and the chunks are the
 * provider's own bytes, framed as its API frames them: the renderer's parser
 * for that provider is what reads them.
 */
function streamApi(requestData, emit) {
  const { provider, path: apiPath, method = 'POST', body = null, apiKey = '', requestId = '' } = requestData || {}
  let target
  try { target = apiTarget(provider, apiPath, { stream: true }) } catch (error) { emit({ type: 'error', message: error.message }); return }
  const label = PROVIDER_LABELS[provider]
  const key = String(apiKey || loadApiKey(provider)).trim()
  if (!key) { emit({ type: 'error', message: `${label} API key required` }); return }
  const payload = JSON.stringify(body || {})
  const request = https.request(`${target.origin}${apiPath}`, {
    method,
    headers: apiHeaders(provider, target, key, payload),
    timeout: API_TIMEOUT_MS,
  }, response => {
    emit({ type: 'start', status: response.statusCode || 500 })
    response.setEncoding('utf8')
    response.on('data', chunk => emit({ type: 'chunk', chunk }))
    response.on('end', () => { if (requestId) apiRequests.delete(requestId); emit({ type: 'end' }) })
  })
  if (requestId) apiRequests.set(requestId, request)
  request.on('timeout', () => request.destroy(new Error(`${label} request timed out`)))
  request.on('error', error => { if (requestId) apiRequests.delete(requestId); emit({ type: 'error', message: error.message }) })
  request.end(payload)
}

function knownWindowsCommand(name) {
  if (process.platform !== 'win32') return null
  const roots = []
  if (name === 'codex') {
    for (const root of [process.env.LOCALAPPDATA, process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : ''].filter(Boolean)) {
      const installRoot = path.join(root, 'OpenAI', 'Codex', 'bin')
      try {
        for (const entry of fs.readdirSync(installRoot, { withFileTypes: true })) if (entry.isDirectory()) roots.push(path.join(installRoot, entry.name))
      } catch { /* optional install location */ }
    }
  }
  roots.push(...[process.env.APPDATA, process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming') : '', process.env.npm_config_prefix].filter(Boolean).map(root => path.basename(root).toLowerCase() === 'npm' ? root : path.join(root, 'npm')))
  const names = name === 'codex' ? ['codex.exe', 'codex.cmd', 'codex.bat'] : ['claude.cmd', 'claude.exe', 'claude.bat']
  return roots.flatMap(root => names.map(candidate => path.join(root, candidate))).find(candidate => fs.existsSync(candidate)) || null
}

function knownPosixCommand(name) {
  if (process.platform === 'win32') return null
  const home = process.env.HOME || ''
  const candidates = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
    ...(home ? [
      path.join(home, '.local', 'bin', name),
      path.join(home, '.npm-global', 'bin', name),
      path.join(home, '.volta', 'bin', name),
    ] : []),
  ]
  if (home) {
    const nvmRoot = path.join(home, '.nvm', 'versions', 'node')
    try {
      for (const version of fs.readdirSync(nvmRoot, { withFileTypes: true })) {
        if (version.isDirectory()) candidates.push(path.join(nvmRoot, version.name, 'bin', name))
      }
    } catch { /* optional NVM installation */ }
  }
  return candidates.filter(candidate => {
    try { fs.accessSync(candidate, fs.constants.X_OK); return true } catch { return false }
  }).sort((left, right) => {
    try { return fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs } catch { return 0 }
  })[0] || null
}

function resolveCommand(name) {
  if (process.platform !== 'win32') {
    try {
      const found = execFileSync('/bin/sh', ['-lc', `command -v ${name}`], { timeout: 5000 }).toString().trim().split(/\r?\n/).find(Boolean)
      if (found) return found
    } catch { /* GUI applications often have a smaller PATH */ }
    return knownPosixCommand(name) || name
  }
  try {
    const candidates = execFileSync('where.exe', [name], { windowsHide: true, timeout: 5000 }).toString().split(/\r?\n/).map(value => value.trim()).filter(Boolean)
    const found = candidates.find(candidate => ['.exe', '.cmd', '.bat', '.ps1'].includes(path.extname(candidate).toLowerCase()))
    if (found) return found
  } catch { /* command lookup falls back to known install locations */ }
  return knownWindowsCommand(name) || name
}

function commandFor(provider) { return resolveCommand(provider === 'codex' ? 'codex' : 'claude') }
function quotePowerShell(value) { return `'${String(value).replaceAll("'", "''")}'` }
function quoteCmd(value) { return `"${String(value).replaceAll('"', '""')}"` }

function invocation(provider, args) {
  const command = commandFor(provider)
  if (process.platform !== 'win32') return { command, args }
  const extension = path.extname(command).toLowerCase()
  if (extension === '.cmd' || extension === '.bat') {
    const shim = resolveWindowsShim(command)
    if (shim) return { command: shim.command, args: [...shim.args, ...args], node: shim.node }
    const line = [quoteCmd(command), ...args.map(quoteCmd)].join(' ')
    // Verbatim: the line is already quoted for cmd.exe, and letting Node quote
    // it again turns every inner quote into \" — which cmd cannot parse.
    return { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], verbatim: true }
  }
  if (extension === '.ps1') return { command: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', [`& ${quotePowerShell(command)}`, ...args.map(quotePowerShell)].join(' ')] }
  return { command, args }
}
/** The child's environment, plus what running a script through Electron needs. */
function callEnvironment(provider, call) {
  return { ...providerEnvironment(provider), ...(call?.node ? { ELECTRON_RUN_AS_NODE: '1' } : {}) }
}

function providerEnvironment(provider) {
  const environment = { ...process.env }
  if (provider === 'codex') delete environment.OPENAI_API_KEY
  if (provider === 'claude') {
    delete environment.ANTHROPIC_API_KEY
    delete environment.ANTHROPIC_AUTH_TOKEN
    // Started from inside a Claude Code session (`npm run dev` in its
    // terminal), the app inherits that session's wiring: its proxy address and
    // its session markers. The client must use its own login, not a proxy
    // whose credentials belong to another process.
    if (environment.CLAUDECODE) {
      for (const name of Object.keys(environment)) {
        if (name === 'CLAUDECODE' || name.startsWith('CLAUDE_CODE_') || name === 'ANTHROPIC_BASE_URL') delete environment[name]
      }
    }
  }
  return environment
}

/**
 * The login runs in a terminal the user can see. Both logins are interactive —
 * a browser round trip, sometimes a code to paste back — and started hidden
 * with no console they either stalled or finished where nobody could tell.
 */
function openLoginTerminal(provider) {
  const command = commandFor(provider)
  const args = provider === 'codex' ? ['login'] : ['auth', 'login']
  const title = `AI Debate - ${PROVIDER_LABELS[provider]} login`
  const options = { env: providerEnvironment(provider), detached: true, stdio: 'ignore' }
  let child
  if (process.platform === 'win32') {
    const line = [quoteCmd(command), ...args.map(quoteCmd)].join(' ')
    child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', `start "${title}" cmd /d /s /k "${line}"`], { ...options, windowsVerbatimArguments: true, windowsHide: true })
  } else if (process.platform === 'darwin') {
    const line = [command, ...args].map(value => `'${String(value).replaceAll("'", "'\\''")}'`).join(' ')
    const script = `tell application "Terminal" to do script "${line.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
    child = spawn('osascript', ['-e', script, '-e', 'tell application "Terminal" to activate'], options)
  } else {
    const terminal = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm'].map(resolveCommand).find(candidate => path.isAbsolute(candidate))
    child = terminal
      ? spawn(terminal, [path.basename(terminal) === 'gnome-terminal' ? '--' : '-e', command, ...args], options)
      : spawn(command, args, options)
  }
  child.on('error', () => { /* reported by the status the dialog keeps polling */ })
  child.unref()
}
function runStatus(provider, args) {
  return new Promise(resolve => {
    const call = invocation(provider, args)
    execFile(call.command, call.args, { env: callEnvironment(provider, call), windowsHide: true, windowsVerbatimArguments: call.verbatim, timeout: 30000 }, (error, stdout, stderr) => {
      const output = String(stdout || stderr || error?.message || '').trim()
      // 9009 is cmd.exe's own "not recognized", whatever language it prints it in.
      resolve({ ok: !error, missing: error?.code === 'ENOENT' || error?.code === 9009 || /not recognized|not found/i.test(output), output })
    })
  })
}
function extractCliError(raw, fallback) {
  const text = String(raw || '').trim()
  for (const line of text.split(/\r?\n/).filter(Boolean).reverse()) {
    let value
    try { value = JSON.parse(line) } catch { continue }
    const detail = value?.error?.message || value?.error || (value?.is_error ? value?.result || value?.message : '')
    if (detail) return typeof detail === 'string' ? detail : JSON.stringify(detail)
  }
  return text || fallback
}

/**
 * Where the clients run. Not the app folder and not the user's home: both
 * clients read project instructions (CLAUDE.md, AGENTS.md) from their working
 * directory, and a debate participant has no business inheriting them.
 */
function cliWorkdir() {
  const directory = path.join(app.getPath('userData'), 'cli-workdir')
  fs.mkdirSync(directory, { recursive: true })
  return directory
}

const CLI_HARD_TIMEOUT_MS = 15 * 60 * 1000
// Reasoning levels each Codex model accepts, filled by the model listing.
const codexModelEfforts = new Map()

/**
 * One streamed chat through a desktop client. `emit` receives the same events
 * as the Ollama Cloud bridge — start, chunk, end, error — and every chunk is
 * NDJSON in the Ollama chat shape, so the renderer parses both the same way.
 */
function streamCliChat(request, emit) {
  const { provider } = request || {}
  if (!CLI_PROVIDERS.includes(provider)) { emit({ type: 'error', message: 'Unsupported desktop AI provider' }); return }
  const model = /^[A-Za-z0-9._:/-]+(?:\[[A-Za-z0-9]+\])?$/.test(String(request.model || '')) ? String(request.model) : ''
  const run = provider === 'codex' ? streamCodex : streamClaude
  run({ ...request, model }, emit)
}

/** Registers the child for cancellation; the returned function releases it once. */
function trackChild(requestId, child, cleanup = () => {}) {
  let ended = false
  const timer = setTimeout(() => child.kill(), CLI_HARD_TIMEOUT_MS)
  if (requestId) aiChildren.set(requestId, child)
  return () => {
    if (ended) return false
    ended = true
    clearTimeout(timer)
    if (requestId && aiChildren.get(requestId) === child) aiChildren.delete(requestId)
    cleanup()
    return true
  }
}

function streamClaude({ model, system = '', prompt = '', effort = null, requestId }, emit) {
  // A file rather than an argument: the system prompt carries the persona, the
  // rules and the tool protocol, which is far past what a Windows command line
  // passed through cmd.exe survives intact.
  const promptFile = path.join(app.getPath('temp'), `ai-debate-system-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  const removePromptFile = () => { try { fs.unlinkSync(promptFile) } catch { /* already gone */ } }
  const level = claudeEffort(effort)
  const args = [
    '-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    // No built-in tools and no MCP servers: the app's own tools are offered in
    // the prompt and executed by the app, never by the client.
    '--tools', '', '--strict-mcp-config', '--no-session-persistence',
    '--system-prompt-file', promptFile,
    ...(model && model !== 'default' ? ['--model', model] : []),
    ...(level ? ['--effort', level] : []),
  ]
  let child
  try {
    fs.writeFileSync(promptFile, String(system || 'You are a helpful assistant.'), 'utf8')
    const call = invocation('claude', args)
    child = spawn(call.command, call.args, { cwd: cliWorkdir(), env: callEnvironment('claude', call), windowsHide: true, windowsVerbatimArguments: call.verbatim, stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (error) {
    removePromptFile()
    emit({ type: 'error', message: error.message })
    return
  }
  const finish = trackChild(requestId, child, removePromptFile)
  const translator = createClaudeTranslator()
  let buffer = ''; let stderr = ''; let started = false; let sawResult = false
  const start = () => { if (!started) { started = true; emit({ type: 'start', status: 200 }) } }
  const handleLine = line => {
    if (!line.trim()) return
    let event
    try { event = JSON.parse(line) } catch { return }
    if (event.type === 'result') sawResult = true
    const lines = translator.push(event)
    if (lines.length) { start(); emit({ type: 'chunk', chunk: lines.join('') }) }
  }
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    lines.forEach(handleLine)
  })
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000) })
  child.stdin.on('error', () => { /* the close handler reports why the client ended */ })
  child.once('error', error => {
    if (!finish()) return
    emit({ type: 'error', message: error.code === 'ENOENT' ? 'Claude client not found' : error.message })
  })
  child.once('close', code => {
    handleLine(buffer)
    if (!finish()) return
    if (!sawResult) {
      const message = extractCliError(stderr, `Claude exited with code ${code}`)
      if (!started) { emit({ type: 'error', message }); return }
      emit({ type: 'chunk', chunk: ndjson({ error: message }) })
    }
    emit({ type: 'end' })
  })
  child.stdin.end(String(prompt || ''))
}

/**
 * Codex through `app-server` rather than `exec --json`: exec only reports the
 * finished message, while the app server streams it token by token and takes
 * the system prompt and the reasoning level as protocol fields.
 */
function streamCodex({ model, system = '', prompt = '', effort = null, sandbox = 'read-only', requestId }, emit) {
  let child
  try {
    const call = invocation('codex', ['app-server'])
    child = spawn(call.command, call.args, { cwd: cliWorkdir(), env: callEnvironment('codex', call), windowsHide: true, windowsVerbatimArguments: call.verbatim, stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (error) {
    emit({ type: 'error', message: error.message })
    return
  }
  const finish = trackChild(requestId, child)
  const translator = createCodexTranslator()
  const send = message => { if (!child.stdin.destroyed) child.stdin.write(`${JSON.stringify(message)}\n`) }
  let buffer = ''; let stderr = ''; let started = false
  const start = () => { if (!started) { started = true; emit({ type: 'start', status: 200 }) } }
  const fail = message => {
    if (!finish()) return
    if (started) { emit({ type: 'chunk', chunk: ndjson({ error: message }) }); emit({ type: 'end' }) } else emit({ type: 'error', message })
    child.kill()
  }
  const handleLine = line => {
    let message
    try { message = JSON.parse(line) } catch { return }
    // A request from the server — an approval, a user-input prompt. Nothing
    // here can grant one, and leaving it unanswered would stall the turn.
    if (message.method && message.id != null) {
      send({ id: message.id, error: { code: -32601, message: 'Not supported by AI Debate' } })
      return
    }
    if (message.id === 1) {
      if (message.error) return fail(message.error.message || 'Codex initialization failed')
      send({ method: 'initialized', params: {} })
      send({
        method: 'thread/start', id: 2, params: {
          ...(model ? { model } : {}),
          cwd: cliWorkdir(),
          // The client never acts for itself here — the app's own tools are
          // the only ones offered — so the sandbox is about what the user is
          // willing to let it reach at all, and stays theirs to choose.
          sandbox: CODEX_SANDBOXES.includes(sandbox) ? sandbox : 'read-only',
          approvalPolicy: 'never',
          ephemeral: true,
          baseInstructions: String(system || 'You are a helpful assistant.'),
        },
      })
      return
    }
    if (message.id === 2) {
      if (message.error) return fail(message.error.message || 'Codex thread could not start')
      const level = codexEffort(effort, codexModelEfforts.get(model))
      send({
        method: 'turn/start', id: 3, params: {
          threadId: message.result?.thread?.id,
          input: [{ type: 'text', text: String(prompt || ''), text_elements: [] }],
          ...(level ? { effort: level, summary: 'auto' } : {}),
        },
      })
      return
    }
    if (message.id === 3) {
      if (message.error) return fail(message.error.message || 'Codex turn could not start')
      start()
      return
    }
    const lines = translator.notification(message)
    if (lines.length) { start(); emit({ type: 'chunk', chunk: lines.join('') }) }
    if (translator.finished && finish()) {
      emit({ type: 'end' })
      child.kill()
    }
  }
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    lines.forEach(handleLine)
  })
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000) })
  child.stdin.on('error', () => { /* the close handler reports why the client ended */ })
  child.once('error', error => fail(error.code === 'ENOENT' ? 'Codex client not found' : error.message))
  child.once('close', code => fail(extractCliError(stderr, `Codex exited with code ${code}`)))
  send({ method: 'initialize', id: 1, params: { clientInfo: { name: 'ai_debate', title: 'AI Debate', version: app.getVersion() } } })
}
async function providerStatus(provider) {
  if (!CLI_PROVIDERS.includes(provider)) return { provider, installed: false, authenticated: false }
  const status = await runStatus(provider, provider === 'codex' ? ['login', 'status'] : ['auth', 'status'])
  let authenticated = status.ok
  if (provider === 'claude' && status.ok) {
    try { authenticated = JSON.parse(status.output)?.loggedIn === true } catch { authenticated = /logged\s*in/i.test(status.output) && !/not logged|logged\s*in\s*[:=]\s*false/i.test(status.output) }
  }
  return { provider, label: PROVIDER_LABELS[provider], installed: !status.missing, authenticated, output: status.output }
}

function codexModels() {
  return new Promise((resolve, reject) => {
    const call = invocation('codex', ['app-server']); const child = spawn(call.command, call.args, { env: callEnvironment('codex', call), windowsHide: true, windowsVerbatimArguments: call.verbatim, stdio: ['pipe', 'pipe', 'pipe'] })
    let buffer = ''; let stderr = ''; let settled = false
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); child.kill(); error ? reject(error) : resolve(value) }
    const timer = setTimeout(() => finish(new Error('Codex model discovery timed out')), 30000)
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { stderr += chunk })
    child.stdout.on('data', chunk => {
      buffer += chunk; const lines = buffer.split(/\r?\n/); buffer = lines.pop() || ''
      for (const line of lines) {
        let message; try { message = JSON.parse(line) } catch { continue }
        if (message.id === 1 && message.error) return finish(new Error(message.error.message || 'Codex initialization failed'))
        if (message.id === 1) { child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`); child.stdin.write(`${JSON.stringify({ method: 'model/list', id: 2, params: { limit: 100, includeHidden: false } })}\n`) }
        if (message.id === 2) {
          const listed = (message.result?.data || []).filter(item => item?.model)
          for (const item of listed) {
            codexModelEfforts.set(item.model, (item.supportedReasoningEfforts || []).map(option => option?.reasoningEffort).filter(Boolean))
          }
          return finish(null, listed.sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault))).map(item => item.model))
        }
      }
    })
    child.once('error', error => finish(error)); child.once('close', code => { if (!settled && code !== 0) finish(new Error(stderr.trim() || `Codex model discovery failed with exit code ${code}`)) })
    child.stdin.write(`${JSON.stringify({ method: 'initialize', id: 1, params: { clientInfo: { name: 'ai_debate', title: 'AI Debate', version: app.getVersion() } } })}\n`)
  })
}

function createWindow() {
  const windowState = windowStateKeeper({
    defaultWidth: 1740,
    defaultHeight: 960,
  })

  const win = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 1100,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: '#111111',
    icon: process.platform === 'darwin' ? undefined : path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  windowState.manage(win)
  // The hidden web browser is a window too: left alone it would keep the app
  // running after the user closed the only window they can see.
  win.on('closed', disposeBrowser)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
    return
  }

  win.loadFile(path.join(__dirname, '..', 'dist', 'web', 'index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('ai-status', (_, provider) => providerStatus(provider))
  ipcMain.handle('ai-login', async (_, provider) => {
    if (!CLI_PROVIDERS.includes(provider)) throw new Error('Unsupported desktop AI provider')
    const availability = await runStatus(provider, ['--version'])
    if (availability.missing) throw new Error(`${PROVIDER_LABELS[provider]} client not found`)
    openLoginTerminal(provider)
    return { started: true, provider }
  })
  ipcMain.handle('ai-list-models', async (_, provider) => {
    const status = await providerStatus(provider)
    if (!status.installed) throw new Error(`${PROVIDER_LABELS[provider] || 'AI'} client not found`)
    if (!status.authenticated) throw new Error(`${PROVIDER_LABELS[provider] || 'AI'} login required`)
    return provider === 'codex' ? codexModels() : CLAUDE_MODELS
  })
  ipcMain.on('ai-chat-stream', (event, request) => {
    const channel = `ai-chat-stream:${String(request?.requestId || '')}`
    streamCliChat(request || {}, message => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, message)
    })
  })
  ipcMain.handle('ai-cancel', (_, requestId) => {
    const child = aiChildren.get(String(requestId || ''))
    if (!child) return false
    child.kill()
    aiChildren.delete(String(requestId))
    return true
  })
  ipcMain.handle('ai-key-get', (_, provider) => Boolean(loadApiKey(provider)))
  ipcMain.handle('ai-key-save', (_, provider, value) => saveApiKey(provider, value))
  ipcMain.handle('ai-api-request', (_, request) => requestApi(request))
  ipcMain.on('ai-api-stream', (event, request) => {
    const channel = `ai-api-stream:${String(request?.requestId || '')}`
    streamApi(request, message => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, message)
    })
  })
  ipcMain.handle('ai-api-cancel', (_, requestId) => {
    const request = apiRequests.get(String(requestId || ''))
    if (!request) return false
    request.destroy(new Error('Request cancelled'))
    apiRequests.delete(String(requestId))
    return true
  })
  ipcMain.handle('web-fetch-page', (_event, request) => browserFetchPage(request))
  ipcMain.handle('web-search', (_event, request) => browserSearch(request))
  ipcMain.handle('web-browser-show', () => showBrowser())
  ipcMain.handle('web-fetch-image', (_event, request) => browserFetchImage(request))
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
