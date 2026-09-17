import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { Buffer } from 'node:buffer'
import { execFile, execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROVIDER_LABELS = { openai: 'OpenAI', claude: 'Claude' }
const CLAUDE_MODELS = ['default', 'sonnet', 'opus', 'haiku', 'sonnet[1m]', 'opus[1m]']
const aiChildren = new Map()
const ollamaCloudRequests = new Map()

function ollamaCloudCredentialPath() { return path.join(app.getPath('userData'), 'ollama-cloud-key.bin') }
function loadOllamaCloudApiKey() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return ''
    return safeStorage.decryptString(Buffer.from(fs.readFileSync(ollamaCloudCredentialPath(), 'utf8'), 'base64'))
  } catch { return '' }
}
function saveOllamaCloudApiKey(value) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this system')
  const credentialPath = ollamaCloudCredentialPath()
  const key = String(value || '').trim()
  if (!key) {
    try { fs.unlinkSync(credentialPath) } catch { /* no saved credential */ }
    return true
  }
  fs.mkdirSync(path.dirname(credentialPath), { recursive: true })
  fs.writeFileSync(credentialPath, safeStorage.encryptString(key).toString('base64'), { encoding: 'utf8', mode: 0o600 })
  return true
}

function requestOllamaCloud({ path: apiPath, method = 'GET', body = null, apiKey = '', requestId = '' } = {}) {
  const allowedPaths = new Set(['/api/tags', '/api/show', '/api/chat'])
  if (!allowedPaths.has(apiPath)) return Promise.reject(new Error('Unsupported Ollama Cloud API path'))
  const key = String(apiKey || loadOllamaCloudApiKey()).trim()
  if (!key) return Promise.reject(new Error('Ollama Cloud API key required'))
  const payload = body == null ? '' : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const request = https.request(`https://ollama.com${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json, application/x-ndjson',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: 180000,
    }, response => {
      let data = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { data += chunk })
      response.on('end', () => {
        if (requestId) ollamaCloudRequests.delete(requestId)
        resolve({ status: response.statusCode || 500, body: data })
      })
    })
    if (requestId) ollamaCloudRequests.set(requestId, request)
    request.on('timeout', () => request.destroy(new Error('Ollama Cloud request timed out')))
    request.on('error', error => { if (requestId) ollamaCloudRequests.delete(requestId); reject(error) })
    if (payload) request.write(payload)
    request.end()
  })
}

function streamOllamaCloud(requestData, emit) {
  const { path: apiPath, method = 'POST', body = null, apiKey = '', requestId = '' } = requestData || {}
  if (apiPath !== '/api/chat') { emit({ type: 'error', message: 'Unsupported Ollama Cloud streaming path' }); return }
  const key = String(apiKey || loadOllamaCloudApiKey()).trim()
  if (!key) { emit({ type: 'error', message: 'Ollama Cloud API key required' }); return }
  const payload = JSON.stringify(body || {})
  const request = https.request(`https://ollama.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/x-ndjson',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    timeout: 180000,
  }, response => {
    emit({ type: 'start', status: response.statusCode || 500 })
    response.setEncoding('utf8')
    response.on('data', chunk => emit({ type: 'chunk', chunk }))
    response.on('end', () => { if (requestId) ollamaCloudRequests.delete(requestId); emit({ type: 'end' }) })
  })
  if (requestId) ollamaCloudRequests.set(requestId, request)
  request.on('timeout', () => request.destroy(new Error('Ollama Cloud request timed out')))
  request.on('error', error => { if (requestId) ollamaCloudRequests.delete(requestId); emit({ type: 'error', message: error.message }) })
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

function commandFor(provider) { return resolveCommand(provider === 'openai' ? 'codex' : 'claude') }
function quotePowerShell(value) { return `'${String(value).replaceAll("'", "''")}'` }
function quoteCmd(value) { return `"${String(value).replaceAll('"', '""')}"` }
function invocation(provider, args) {
  const command = commandFor(provider)
  if (process.platform !== 'win32') return { command, args }
  const extension = path.extname(command).toLowerCase()
  if (extension === '.cmd' || extension === '.bat') {
    const line = [quoteCmd(command), ...args.map(quoteCmd)].join(' ')
    return { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`] }
  }
  if (extension === '.ps1') return { command: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', [`& ${quotePowerShell(command)}`, ...args.map(quotePowerShell)].join(' ')] }
  return { command, args }
}
function providerEnvironment(provider) {
  const environment = { ...process.env }
  if (provider === 'openai') delete environment.OPENAI_API_KEY
  if (provider === 'claude') {
    delete environment.ANTHROPIC_API_KEY
    delete environment.ANTHROPIC_AUTH_TOKEN
  }
  return environment
}
function runStatus(provider, args) {
  return new Promise(resolve => {
    const call = invocation(provider, args)
    execFile(call.command, call.args, { env: providerEnvironment(provider), windowsHide: true, shell: call.shell, timeout: 30000 }, (error, stdout, stderr) => {
      const output = String(stdout || stderr || error?.message || '').trim()
      resolve({ ok: !error, missing: error?.code === 'ENOENT' || /not recognized|not found/i.test(output), output })
    })
  })
}
function runCli(provider, args, input, requestId, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const call = invocation(provider, args)
    const child = spawn(call.command, call.args, { env: providerEnvironment(provider), windowsHide: true, shell: call.shell, stdio: ['pipe', 'pipe', 'pipe'] })
    if (requestId) aiChildren.set(requestId, child)
    let stdout = ''; let stderr = ''; let settled = false
    const timer = setTimeout(() => { if (!settled) { settled = true; child.kill(); if (requestId) aiChildren.delete(requestId); reject(new Error(`${PROVIDER_LABELS[provider]} request timed out`)) } }, timeout)
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk }); child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', error => { if (!settled) { settled = true; clearTimeout(timer); if (requestId) aiChildren.delete(requestId); reject(error.code === 'ENOENT' ? new Error(`${PROVIDER_LABELS[provider]} client not found`) : error) } })
    child.once('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (requestId) aiChildren.delete(requestId)
      if (code !== 0) reject(new Error(extractCliError([stderr, stdout].filter(Boolean).join('\n'), `${PROVIDER_LABELS[provider]} exited with code ${code}`)))
      else if (stdout.trim()) resolve(stdout)
      else reject(new Error(extractCliError(stderr, `${PROVIDER_LABELS[provider]} returned no output`)))
    })
    child.stdin.end(input)
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
function extractText(raw) {
  const text = String(raw || '').trim(); const candidates = []
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    let value
    try { value = JSON.parse(line) } catch { continue }
    if (value?.is_error || value?.error) {
      const detail = value?.error?.message || value?.error || value?.result || value?.message || 'Claude returned an error'
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    }
    for (const candidate of [value.result, value.output, value.item?.text, value.item?.content, value.message?.content, value.content]) if (typeof candidate === 'string') candidates.push(candidate)
  }
  return String(candidates.at(-1) || text).trim()
}
function serializeMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map(message => `${String(message?.role || 'user').toUpperCase()}:\n${typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content || '')}`).join('\n\n')
}
async function chatWithCli({ provider, model, messages, requestId }) {
  if (!['openai', 'claude'].includes(provider)) throw new Error('Unsupported desktop AI provider')
  const safeModel = /^[A-Za-z0-9._:/-]+(?:\[[A-Za-z0-9]+\])?$/.test(String(model || '')) ? String(model) : ''
  const instruction = `${serializeMessages(messages)}\n\nReturn only the assistant response. Do not inspect or modify local files.`
  if (provider === 'openai') return extractText(await runCli(provider, ['exec', '--json', '--sandbox', 'read-only', ...(safeModel ? ['--model', safeModel] : []), '-'], instruction, requestId))
  return extractText(await runCli(provider, ['-p', '--output-format', 'json', '--permission-mode', 'plan', '--tools', '', ...(safeModel && safeModel !== 'default' ? ['--model', safeModel] : [])], instruction, requestId))
}

async function providerStatus(provider) {
  if (!['openai', 'claude'].includes(provider)) return { provider, installed: false, authenticated: false }
  const status = await runStatus(provider, provider === 'openai' ? ['login', 'status'] : ['auth', 'status'])
  let authenticated = status.ok
  if (provider === 'claude' && status.ok) {
    try { authenticated = JSON.parse(status.output)?.loggedIn === true } catch { authenticated = /logged\s*in/i.test(status.output) && !/not logged|logged\s*in\s*[:=]\s*false/i.test(status.output) }
  }
  return { provider, label: PROVIDER_LABELS[provider], installed: !status.missing, authenticated, output: status.output }
}

function codexModels() {
  return new Promise((resolve, reject) => {
    const call = invocation('openai', ['app-server']); const child = spawn(call.command, call.args, { env: providerEnvironment('openai'), windowsHide: true, shell: call.shell, stdio: ['pipe', 'pipe', 'pipe'] })
    let buffer = ''; let stderr = ''; let settled = false
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); child.kill(); error ? reject(error) : resolve(value) }
    const timer = setTimeout(() => finish(new Error('OpenAI model discovery timed out')), 30000)
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { stderr += chunk })
    child.stdout.on('data', chunk => {
      buffer += chunk; const lines = buffer.split(/\r?\n/); buffer = lines.pop() || ''
      for (const line of lines) {
        let message; try { message = JSON.parse(line) } catch { continue }
        if (message.id === 1 && message.error) return finish(new Error(message.error.message || 'OpenAI initialization failed'))
        if (message.id === 1) { child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`); child.stdin.write(`${JSON.stringify({ method: 'model/list', id: 2, params: { limit: 100, includeHidden: false } })}\n`) }
        if (message.id === 2) return finish(null, (message.result?.data || []).filter(item => item?.model).sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault))).map(item => item.model))
      }
    })
    child.once('error', error => finish(error)); child.once('close', code => { if (!settled && code !== 0) finish(new Error(stderr.trim() || `OpenAI model discovery failed with exit code ${code}`)) })
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
    if (!['openai', 'claude'].includes(provider)) throw new Error('Unsupported desktop AI provider')
    const availability = await runStatus(provider, ['--version'])
    if (availability.missing) throw new Error(`${PROVIDER_LABELS[provider]} client not found`)
    const call = invocation(provider, provider === 'openai' ? ['login'] : ['auth', 'login'])
    const child = spawn(call.command, call.args, { env: providerEnvironment(provider), detached: true, windowsHide: true, shell: call.shell, stdio: 'ignore' })
    child.unref()
    return { started: true, provider }
  })
  ipcMain.handle('ai-list-models', async (_, provider) => {
    const status = await providerStatus(provider)
    if (!status.installed) throw new Error(`${PROVIDER_LABELS[provider] || 'AI'} client not found`)
    if (!status.authenticated) throw new Error(`${PROVIDER_LABELS[provider] || 'AI'} login required`)
    return provider === 'openai' ? codexModels() : CLAUDE_MODELS
  })
  ipcMain.handle('ai-chat', (_, request) => chatWithCli(request || {}))
  ipcMain.handle('ai-cancel', (_, requestId) => {
    const child = aiChildren.get(String(requestId || ''))
    if (!child) return false
    child.kill()
    aiChildren.delete(String(requestId))
    return true
  })
  ipcMain.handle('ollama-cloud-key-get', () => Boolean(loadOllamaCloudApiKey()))
  ipcMain.handle('ollama-cloud-key-save', (_, value) => saveOllamaCloudApiKey(value))
  ipcMain.handle('ollama-cloud-request', (_, request) => requestOllamaCloud(request))
  ipcMain.on('ollama-cloud-stream', (event, request) => {
    const channel = `ollama-cloud-stream:${String(request?.requestId || '')}`
    streamOllamaCloud(request, message => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, message)
    })
  })
  ipcMain.handle('ollama-cloud-cancel', (_, requestId) => {
    const request = ollamaCloudRequests.get(String(requestId || ''))
    if (!request) return false
    request.destroy(new Error('Ollama Cloud request cancelled'))
    ollamaCloudRequests.delete(String(requestId))
    return true
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
