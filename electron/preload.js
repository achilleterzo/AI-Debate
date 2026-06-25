import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
})
