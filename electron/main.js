import { app, BrowserWindow, shell } from 'electron'
import windowStateKeeper from 'electron-window-state'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
