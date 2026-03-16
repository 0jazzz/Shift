import { app, BrowserWindow, ipcMain } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerHandlers } from './ipc/handlers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(__dirname, '../public')

let win: BrowserWindow | null

const preload = join(__dirname, 'preload.mjs')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

async function createWindow() {
    win = new BrowserWindow({
        title: 'Shift',
        width: 1200,
        height: 800,
        frame: false,
        backgroundColor: '#0A0A0A',
        icon: join(process.env.VITE_PUBLIC!, 'icon.ico'),
        webPreferences: {
            preload,
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    win.setMenu(null)

    if (url) {
        win.loadURL(url)
    } else {
        win.loadFile(indexHtml)
    }

    try {
        registerHandlers(ipcMain)
    } catch (error) {
        console.error('Failed to register IPC handlers:', error)
    }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    win = null
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
