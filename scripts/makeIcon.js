/**
 * Generates build/icon.png (512×512) — the OSEA Dive Manager app icon.
 * Run with: npx electron scripts/makeIcon.js
 * electron-builder derives the .ico / .icns variants from this PNG.
 */
const { app, BrowserWindow } = require('electron')
const { writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

const html = `<!doctype html><html><body style="margin:0">
<div style="width:512px;height:512px;border-radius:104px;
  background:linear-gradient(135deg,#1b99bd 0%,#07c5a7 100%);
  display:flex;align-items:center;justify-content:center">
  <svg width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
  </svg>
</div></body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 600))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  mkdirSync(join(__dirname, '..', 'build'), { recursive: true })
  writeFileSync(join(__dirname, '..', 'build', 'icon.png'), image.toPNG())
  console.log('build/icon.png written')
  app.exit(0)
})
