import { BrowserWindow, Menu, app, shell } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { loadConfig, dbPathFor } from './config'
import { openDatabase, closeDatabase } from './db'
import { registerIpc } from './ipc'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'OSEA Dive Manager',
    backgroundColor: '#0c1622',
    icon: join(__dirname, '../../build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Surface renderer warnings/errors in the terminal during development
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[renderer:${level === 3 ? 'error' : 'warn'}] ${message} (${sourceId}:${line})`)
  })

  // Dev/CI helper: `--screenshot <file.png> [--route #/rental]` captures the UI and exits
  const shotIdx = process.argv.indexOf('--screenshot')
  if (shotIdx !== -1 && process.argv[shotIdx + 1]) {
    const shotPath = process.argv[shotIdx + 1]
    const routeIdx = process.argv.indexOf('--route')
    const route = routeIdx !== -1 ? process.argv[routeIdx + 1] : null
    mainWindow.webContents.once('did-finish-load', () => {
      if (route) void mainWindow?.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(route)}`)
      setTimeout(async () => {
        try {
          const image = await mainWindow!.webContents.capturePage()
          writeFileSync(shotPath, image.toPNG())
          console.log(`Screenshot written: ${shotPath}`)
        } catch (err) {
          console.error('Screenshot failed:', err)
        }
        app.exit(0)
      }, 3000)
    })
  }
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // External links open in the system browser, never inside the app
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.osea.divemanager')

  if (process.argv.includes('--smoke-test')) {
    const { runSmokeTest } = await import('./smokeTest')
    try {
      await runSmokeTest(process.argv.includes('--keep'))
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      app.exit(1)
    }
    return
  }

  // Reopen the customer's database if the app has already been set up
  const config = loadConfig()
  if (config) {
    try {
      openDatabase(dbPathFor(config.dataDir))
    } catch (err) {
      console.error('Failed to open database:', err)
    }
  }

  registerIpc(() => mainWindow)
  Menu.setApplicationMenu(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
