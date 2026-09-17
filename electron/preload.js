import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  aiStatus: provider => ipcRenderer.invoke('ai-status', provider),
  aiLogin: provider => ipcRenderer.invoke('ai-login', provider),
  aiListModels: provider => ipcRenderer.invoke('ai-list-models', provider),
  aiChat: request => ipcRenderer.invoke('ai-chat', request),
  aiCancel: requestId => ipcRenderer.invoke('ai-cancel', requestId),
  hasOllamaCloudApiKey: () => ipcRenderer.invoke('ollama-cloud-key-get'),
  saveOllamaCloudApiKey: value => ipcRenderer.invoke('ollama-cloud-key-save', value),
  ollamaCloudRequest: request => ipcRenderer.invoke('ollama-cloud-request', request),
  ollamaCloudStream: (request, onEvent) => {
    const channel = `ollama-cloud-stream:${String(request?.requestId || '')}`
    const listener = (_, message) => onEvent(message)
    ipcRenderer.on(channel, listener)
    ipcRenderer.send('ollama-cloud-stream', request)
  },
  ollamaCloudStreamCleanup: requestId => ipcRenderer.removeAllListeners(`ollama-cloud-stream:${String(requestId || '')}`),
  ollamaCloudCancel: requestId => ipcRenderer.invoke('ollama-cloud-cancel', requestId),
})
