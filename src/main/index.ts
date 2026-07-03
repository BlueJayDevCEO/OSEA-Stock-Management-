import { BrowserWindow, Menu, app, shell } from 'electron'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import * as xlsx from 'xlsx'
import { loadConfig, dbPathFor } from './config'
import { openDatabase, closeDatabase } from './db'
import { registerIpc } from './ipc'

const isDev = !app.isPackaged
const migrationRuntimeTest = process.argv.includes('--migration-picker-runtime-test')

let mainWindow: BrowserWindow | null = null
let migrationRuntimeDir: string | null = null

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

  if (migrationRuntimeTest) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const result = await mainWindow!.webContents.executeJavaScript(`
            (async () => {
              const waitFor = async (predicate, label) => {
                const started = Date.now()
                while (Date.now() - started < 8000) {
                  if (predicate()) return
                  await new Promise((resolve) => setTimeout(resolve, 100))
                }
                throw new Error('Timed out waiting for ' + label)
              }

              window.location.hash = '/settings?tab=migration'
              await waitFor(() => document.body.textContent.includes('Data Migration Centre'), 'migration centre')
              const button = Array.from(document.querySelectorAll('button')).find((el) => el.textContent.includes('Select Files'))
              if (!button) throw new Error('Select Files button not found')
              button.click()
              await waitFor(() => document.body.textContent.includes('OSEA_Customer_Test_Stock.xlsx - Retail Stock'), 'retail stock preview')
              await waitFor(() => document.body.textContent.includes('OSEA_Customer_Test_Stock.xlsx - Rental Assets'), 'rental assets preview')
              await waitFor(() => document.body.textContent.includes('1 rows detected'), 'preview row count')
              const cards = Array.from(document.querySelectorAll('.card'))
              const selectedFor = (name) => {
                const card = cards.find((el) => el.textContent.includes(name))
                return card?.querySelector('select')?.value
              }
              return (
                selectedFor('OSEA_Customer_Test_Stock.xlsx - Retail Stock') === 'RetailProducts' &&
                selectedFor('OSEA_Customer_Test_Stock.xlsx - Rental Assets') === 'RentalAssets'
              )
            })()
          `)
          if (!result) throw new Error('Migration sheets did not render with expected suggested entities')
          console.log('MIGRATION PICKER RUNTIME TEST PASSED')
        } catch (err) {
          console.error('MIGRATION PICKER RUNTIME TEST FAILED:', err)
          app.exit(1)
          return
        } finally {
          closeDatabase()
          if (migrationRuntimeDir) rmSync(migrationRuntimeDir, { recursive: true, force: true })
        }
        app.exit(0)
      }, 1000)
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

  if (process.argv.includes('--migration-test')) {
    const { runMigrationTest } = await import('./migrationTest')
    try {
      await runMigrationTest()
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      app.exit(1)
    }
    return
  }

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

  if (migrationRuntimeTest) {
    migrationRuntimeDir = mkdtempSync(join(tmpdir(), 'osea-migration-runtime-'))
    const dataDir = join(migrationRuntimeDir, 'data')
    mkdirSync(dataDir, { recursive: true })
    const selectedFile = join(migrationRuntimeDir, 'OSEA_Customer_Test_Stock.xlsx')
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet([
        {
          'Stock Code': 'STK-001',
          'Product Name': 'Mask',
          Brand: 'Scubapro',
          Category: 'Masks',
          Qty: 4,
          'Cost Price': 10,
          'Retail Price': 25,
          Barcode: '123456'
        }
      ]),
      'Retail Stock'
    )
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet([
        {
          'Asset Number': 'RA-001',
          'Equipment Type': 'BCD',
          Brand: 'Aqualung',
          Model: 'Pro',
          'Serial No': 'SN-001',
          Size: 'M',
          'Purchase Price': 200
        }
      ]),
      'Rental Assets'
    )
    xlsx.writeFile(workbook, selectedFile)
    process.env['OSEA_DATA_DIR'] = dataDir
    process.env['OSEA_TEST_CHOOSE_FILES'] = selectedFile
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
