import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  aiStatus: provider => ipcRenderer.invoke('ai-status', provider),
  aiLogin: provider => ipcRenderer.invoke('ai-login', provider),
  aiListModels: provider => ipcRenderer.invoke('ai-list-models', provider),
  aiChatStream: (request, onEvent) => {
    const channel = `ai-chat-stream:${String(request?.requestId || '')}`
    ipcRenderer.on(channel, (_, message) => onEvent(message))
    ipcRenderer.send('ai-chat-stream', request)
  },
  aiChatStreamCleanup: requestId => ipcRenderer.removeAllListeners(`ai-chat-stream:${String(requestId || '')}`),
  aiCancel: requestId => ipcRenderer.invoke('ai-cancel', requestId),
  // The hosted providers (Ollama Cloud, OpenRouter, Gemini) are reached through
  // the main process: the API key is stored and used there, so it never enters
  // the renderer and never appears in a request the renderer can see.
  hasAiApiKey: provider => ipcRenderer.invoke('ai-key-get', provider),
  saveAiApiKey: (provider, value) => ipcRenderer.invoke('ai-key-save', provider, value),
  aiApiRequest: request => ipcRenderer.invoke('ai-api-request', request),
  aiApiStream: (request, onEvent) => {
    const channel = `ai-api-stream:${String(request?.requestId || '')}`
    const listener = (_, message) => onEvent(message)
    ipcRenderer.on(channel, listener)
    ipcRenderer.send('ai-api-stream', request)
  },
  aiApiStreamCleanup: requestId => ipcRenderer.removeAllListeners(`ai-api-stream:${String(requestId || '')}`),
  aiApiCancel: requestId => ipcRenderer.invoke('ai-api-cancel', requestId),
  webFetchPage: request => ipcRenderer.invoke('web-fetch-page', request),
  webSearch: request => ipcRenderer.invoke('web-search', request),
  webBrowserShow: () => ipcRenderer.invoke('web-browser-show'),
  webFetchImage: request => ipcRenderer.invoke('web-fetch-image', request),
})
