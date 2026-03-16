import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface DownloadProgress {
    dependency: string
    percent: number
    status: 'pending' | 'downloading' | 'extracting' | 'done' | 'error'
    message?: string
}

type ProgressCallback = (progress: DownloadProgress) => void

interface DepConfig {
    url: string
    extractPath: string
    type: 'zip' | '7z' | 'pip'
}

// ALL dependencies use ZIP or 7z extraction - NO INSTALLERS!
const DOWNLOAD_URLS: Record<string, DepConfig> = {
    ffmpeg: {
        // gyan.dev always serves latest release via this URL
        url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
        extractPath: '', // Dynamic - will find folder starting with 'ffmpeg-'
        type: 'zip'
    },
    imagemagick: {
        // Dynamic resolution - scrapes directory for latest version
        url: 'DYNAMIC:IMAGEMAGICK',
        extractPath: '',
        type: 'zip'
    },
    pandoc: {
        // Updated to latest version 3.8.3
        url: 'https://github.com/jgm/pandoc/releases/download/3.8.3/pandoc-3.8.3-windows-x86_64.zip',
        extractPath: 'pandoc-3.8.3',
        type: 'zip'
    },
    libreoffice: {
        // Skip LibreOffice for now - it's 300MB+ and requires complex extraction
        // Users can install it manually if needed for DOC/DOCX conversion
        // Pandoc can handle most document conversions
        url: '',
        extractPath: '',
        type: 'zip'
    },
    xpdf: {
        // Updated to latest version 4.06
        url: 'https://dl.xpdfreader.com/xpdf-tools-win-4.06.zip',
        extractPath: 'xpdf-tools-win-4.06\\bin64',
        type: 'zip'
    },
    pdf2docx: {
        // Python package - installed via pip
        url: 'pdf2docx', // Name of package for pip
        extractPath: '',
        type: 'pip'
    },
    exiftool: {
        // Dynamic resolution - fetches latest ExifTool version
        url: 'DYNAMIC:EXIFTOOL',
        extractPath: '',
        type: 'zip'
    }
}

function downloadWithRedirects(url: string, dest: string, onProgress: (percent: number) => void, maxRedirects = 15): Promise<void> {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'))
            return
        }

        const protocol = url.startsWith('https') ? https : http

        const request = protocol.get(url, { timeout: 30000 }, (res) => {
            // Handle redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location
                if (redirectUrl.startsWith('/')) {
                    const urlObj = new URL(url)
                    redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`
                }
                console.log(`Redirecting to: ${redirectUrl}`)
                downloadWithRedirects(redirectUrl, dest, onProgress, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject)
                return
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
                return
            }

            const totalSize = parseInt(res.headers['content-length'] || '0', 10)
            let downloaded = 0

            const file = fs.createWriteStream(dest)

            res.on('data', (chunk: Buffer) => {
                downloaded += chunk.length
                if (totalSize > 0) {
                    onProgress(Math.round((downloaded / totalSize) * 100))
                }
            })

            res.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve()
            })
            file.on('error', reject)
        })

        request.on('error', reject)
        request.on('timeout', () => {
            request.destroy()
            reject(new Error('Request timeout'))
        })
    })
}

function getArchiveExtension(url: string): 'zip' | '7z' {
    const match = url.match(/\.(zip|7z)(?:[?#]|$|\/)/i)
    if (match && match[1]) {
        return match[1].toLowerCase() as 'zip' | '7z'
    }
    return 'zip'
}

async function extractZip(zipPath: string, destDir: string, subPath?: string, depName?: string): Promise<void> {
    await fs.promises.mkdir(destDir, { recursive: true })
    console.log(`Extracting ${zipPath} to ${destDir}`)
    const cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`
    await execAsync(cmd, { timeout: 300000 }) // 5 min timeout for large files

    let actualSubPath = subPath
    if (!actualSubPath && depName === 'ffmpeg') {
        const entries = await fs.promises.readdir(destDir)
        const ffmpegDir = entries.find(e => e.startsWith('ffmpeg-'))
        if (ffmpegDir) {
            actualSubPath = path.join(ffmpegDir, 'bin')
        }
    }

    if (actualSubPath) {
        const srcDir = path.join(destDir, actualSubPath)
        if (fs.existsSync(srcDir)) {
            const files = await fs.promises.readdir(srcDir)
            for (const file of files) {
                const srcFile = path.join(srcDir, file)
                const destFile = path.join(destDir, file)
                if (!fs.existsSync(destFile)) {
                    await fs.promises.rename(srcFile, destFile)
                }
            }
        }
    }
}

async function extract7z(archivePath: string, destDir: string): Promise<void> {
    await fs.promises.mkdir(destDir, { recursive: true })
    console.log(`Extracting 7z ${archivePath} to ${destDir}`)

    const sevenZaPath = path.join(destDir, '7za.exe')
    if (!fs.existsSync(sevenZaPath)) {
        console.log('Downloading 7za.exe for extraction...')
        const sevenZaUrl = 'https://www.7-zip.org/a/7za920.zip'
        const sevenZaZip = path.join(destDir, '7za_temp.zip')

        await new Promise<void>((resolve, reject) => {
            const file = fs.createWriteStream(sevenZaZip)
            https.get(sevenZaUrl, (res) => {
                res.pipe(file)
                file.on('finish', () => { file.close(); resolve() })
            }).on('error', reject)
        })

        const extractCmd = `powershell -Command "Expand-Archive -Path '${sevenZaZip}' -DestinationPath '${destDir}' -Force"`
        await execAsync(extractCmd, { timeout: 30000 })
        await fs.promises.unlink(sevenZaZip)
    }

    const cmd = `"${sevenZaPath}" x "${archivePath}" -o"${destDir}" -y`
    await execAsync(cmd, { timeout: 300000 })
}

async function installPipPackage(packageName: string, onProgress: (percent: number, message?: string) => void): Promise<void> {
    console.log(`[PIP] Installing ${packageName}...`)

    return new Promise((resolve, reject) => {
        // Using spawn to get real-time output
        const cmd = 'python'
        // Add --prefer-binary to avoid source builds if possible
        const args = ['-m', 'pip', 'install', '--upgrade', packageName, '--no-warn-script-location', '--prefer-binary']

        console.log(`[PIP] Running: ${cmd} ${args.join(' ')}`)

        const child = spawn(cmd, args, {
            shell: true
        })

        // Smarter fake progress
        let fakePercent = 0
        let ticks = 0
        const timer = setInterval(() => {
            ticks++

            let shouldIncrement = false

            if (fakePercent < 50) {
                // Fast start (every tick)
                shouldIncrement = true
                fakePercent += 2
            } else if (fakePercent < 75) {
                // Moderate (every 2nd tick)
                if (ticks % 2 === 0) {
                    shouldIncrement = true
                    fakePercent += 1
                }
            } else if (fakePercent < 90) {
                // Slow (every 5th tick = 5s)
                if (ticks % 5 === 0) {
                    shouldIncrement = true
                    fakePercent += 1
                }
            } else if (fakePercent < 95) {
                // Very slow (every 10th tick = 10s)
                if (ticks % 10 === 0) {
                    shouldIncrement = true
                    fakePercent += 1
                }
            }

            if (shouldIncrement && fakePercent <= 95) {
                onProgress(fakePercent)
            }
        }, 1000)

        const handleOutput = (data: Buffer) => {
            const line = data.toString().trim()
            if (!line) return

            console.log(`[PIP] ${line}`)

            // Heuristic status updates
            if (line.includes('Building') || line.includes('running setup.py') || line.includes('metadata')) {
                onProgress(fakePercent, 'Compiling (this might take some time)...')
            } else if (line.includes('Collecting') || line.includes('Downloading')) {
                onProgress(fakePercent, 'Downloading packages...')
            } else if (line.includes('Installing')) {
                onProgress(fakePercent, 'Installing...')
            }
        }

        child.stdout.on('data', handleOutput)
        child.stderr.on('data', handleOutput)

        child.on('close', (code: number) => {
            clearInterval(timer)
            if (code === 0) {
                onProgress(100, 'Installation complete')
                resolve()
            } else {
                reject(new Error(`Pip install process exited with code ${code}`))
            }
        })

        child.on('error', (err: Error) => {
            clearInterval(timer)
            reject(err)
        })
    })
}

async function fetchLatestImageMagickUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
        const indexUrl = 'https://imagemagick.org/archive/binaries/'
        https.get(indexUrl, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                // Look for: ImageMagick-*.portable-Q16-x64.zip OR .7z
                // The pattern is: ImageMagick-[version]-portable-Q16-x64.[ext]
                const regex = /ImageMagick-[\d\.-]+-portable-Q16-x64\.(zip|7z)/g
                const matches = data.match(regex)
                if (matches && matches.length > 0) {
                    const latestFilename = matches[matches.length - 1]
                    resolve(`${indexUrl}${latestFilename}`)
                } else {
                    reject(new Error('Could not find ImageMagick portable zip/7z in directory listing'))
                }
            })
        }).on('error', reject)
    })
}

function fetchTextWithRedirects(url: string, maxRedirects = 10): Promise<string> {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'))
            return
        }

        const protocol = url.startsWith('https') ? https : http
        const req = protocol.get(url, { timeout: 20000 }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location
                if (redirectUrl.startsWith('/')) {
                    const urlObj = new URL(url)
                    redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`
                }
                res.resume()
                fetchTextWithRedirects(redirectUrl, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject)
                return
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
                return
            }

            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => resolve(data))
        })

        req.on('error', reject)
        req.on('timeout', () => {
            req.destroy()
            reject(new Error('Request timeout'))
        })
    })
}

async function fetchLatestExifToolUrl(): Promise<string> {
    const fallbackUrl = 'https://sourceforge.net/projects/exiftool/files/exiftool-13.52_64.zip/download';

    try {
        const indexUrl = 'https://exiftool.org/'
        const html = await fetchTextWithRedirects(indexUrl)

        const hrefRegex = /href\s*=\s*["']([^"']*exiftool-[^"']*\.zip[^"']*)["']/gi
        const found: string[] = []
        let match: RegExpExecArray | null = null
        while ((match = hrefRegex.exec(html)) !== null) {
            found.push(match[1])
        }

        if (found.length === 0) {
            console.warn('Could not find ExifTool zip in directory listing, using fallback')
            return fallbackUrl;
        }

        const normalizeUrl = (href: string) => {
            if (href.startsWith('http')) return href
            return new URL(href, indexUrl).toString()
        }

        const candidates = found
            .map(normalizeUrl)
            .filter(url => /exiftool-\d+(?:\.\d+)+(?:_\d+)?\.zip/i.test(url))

        if (candidates.length === 0) {
            return fallbackUrl;
        }

        const extractVersion = (url: string) => {
            const verMatch = url.match(/exiftool-(\d+(?:\.\d+)+)(?:_\d+)?\.zip/i)
            return verMatch ? verMatch[1] : '0'
        }

        const compareVersions = (a: string, b: string) => {
            const pa = a.split('.').map(n => parseInt(n, 10))
            const pb = b.split('.').map(n => parseInt(n, 10))
            const len = Math.max(pa.length, pb.length)
            for (let i = 0; i < len; i++) {
                const na = pa[i] || 0
                const nb = pb[i] || 0
                if (na > nb) return 1
                if (na < nb) return -1
            }
            return 0
        }

        const prefer64 = process.arch === 'x64'
        const archCandidates = candidates.filter(url =>
            prefer64 ? /_64\.zip/i.test(url) : /_32\.zip/i.test(url)
        )
        const pickFrom = archCandidates.length > 0 ? archCandidates : candidates

        const latest = pickFrom
            .map(url => ({ url, ver: extractVersion(url) }))
            .sort((a, b) => compareVersions(a.ver, b.ver))
            .pop()

        if (!latest) {
            return fallbackUrl;
        }

        return latest.url
    } catch (err) {
        console.warn('Error fetching latest ExifTool URL, using fallback:', err);
        return fallbackUrl;
    }
}

export async function downloadDependency(
    name: string,
    binDir: string,
    onProgress: ProgressCallback
): Promise<boolean> {
    let config = DOWNLOAD_URLS[name] // Let is mutable for dynamic update
    if (!config) {
        onProgress({ dependency: name, percent: 0, status: 'error', message: `Unknown dependency: ${name}` })
        return false
    }

    // Resolve Dynamic URLs
    if (config.url === 'DYNAMIC:IMAGEMAGICK') {
        try {
            console.log('Fetching latest ImageMagick version...')
            onProgress({ dependency: name, percent: 0, status: 'downloading', message: 'Finding latest version...' })
            const dynamicUrl = await fetchLatestImageMagickUrl()
            console.log(`Resolved ImageMagick URL: ${dynamicUrl}`)

            // Determine type from extension
            const is7z = dynamicUrl.toLowerCase().endsWith('.7z')

            // Create a temp config with the resolved URL and correct type
            config = {
                ...config,
                url: dynamicUrl,
                type: is7z ? '7z' : 'zip'
            }
        } catch (e) {
            const err = e as Error
            console.error('Failed to resolve dynamic URL:', err.message)
            onProgress({ dependency: name, percent: 0, status: 'error', message: `Ver check failed: ${err.message}` })
            return false
        }
    }

    if (config.url === 'DYNAMIC:EXIFTOOL') {
        try {
            console.log('Fetching latest ExifTool version...')
            onProgress({ dependency: name, percent: 0, status: 'downloading', message: 'Finding latest version...' })
            const dynamicUrl = await fetchLatestExifToolUrl()
            console.log(`Resolved ExifTool URL: ${dynamicUrl}`)

            config = {
                ...config,
                url: dynamicUrl,
                type: 'zip'
            }
        } catch (e) {
            const err = e as Error
            console.error('Failed to resolve ExifTool URL:', err.message)
            onProgress({ dependency: name, percent: 0, status: 'error', message: `Ver check failed: ${err.message}` })
            return false
        }
    }

    if (config.type === 'pip') {
        // ... (existing pip logic)
        try {
            onProgress({ dependency: name, percent: 0, status: 'downloading' })
            // ...
            try {
                await execAsync('python --version')
            } catch {
                throw new Error('Python is not installed or not in PATH')
            }

            onProgress({ dependency: name, percent: 10, status: 'downloading' })
            await installPipPackage(config.url, (percent, message) => {
                onProgress({ dependency: name, percent, status: 'downloading', message })
            })

            console.log(`${name} installed successfully`)
            onProgress({ dependency: name, percent: 100, status: 'done' })
            return true
        } catch (e) {
            // ... (error handling)
            const error = e as Error
            console.error(`Error installing ${name}:`, error.message)
            onProgress({ dependency: name, percent: 0, status: 'error', message: error.message })
            return false
        }
    }

    // Skip if no URL (like LibreOffice which is optional)
    if (!config.url) {
        onProgress({ dependency: name, percent: 0, status: 'error', message: `${name} must be installed manually` })
        return false
    }

    // ... (rest of standard download logic)
    const urlExt = getArchiveExtension(config.url)
    const filePath = path.join(binDir, `${name}_temp.${urlExt}`)

    try {
        await fs.promises.mkdir(binDir, { recursive: true })

        console.log(`Downloading ${name} from ${config.url}`)
        onProgress({ dependency: name, percent: 0, status: 'downloading' })
        await downloadWithRedirects(config.url, filePath, (percent) => {
            onProgress({ dependency: name, percent, status: 'downloading' })
        })

        console.log(`Extracting ${name}...`)
        onProgress({ dependency: name, percent: 100, status: 'extracting' })

        if (config.type === '7z') {
            await extract7z(filePath, binDir)
        } else {
            // Updated extractZip call to handle generic extractions if needed
            await extractZip(filePath, binDir, config.extractPath || undefined, name)
        }

        // ExifTool: Handle nested folder structure (e.g. exiftool-13.50_64/exiftool(-k).exe)
        if (name === 'exiftool') {
            const findFile = async (dir: string, filename: string): Promise<string | null> => {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true })
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name)
                    if (entry.isDirectory()) {
                        const found = await findFile(fullPath, filename)
                        if (found) return found
                    } else if (entry.name === filename) {
                        return fullPath
                    }
                }
                return null
            }

            const exifExePath = await findFile(binDir, 'exiftool(-k).exe')

            if (exifExePath) {
                const targetExe = path.join(binDir, 'exiftool.exe')

                // Move executable
                if (fs.existsSync(targetExe)) await fs.promises.unlink(targetExe)
                await fs.promises.rename(exifExePath, targetExe)
                console.log(`Moved ${exifExePath} to ${targetExe}`)

                // Move exiftool_files if present (often in same dir as exe)
                const sourceDir = path.dirname(exifExePath)
                const sourceFilesDir = path.join(sourceDir, 'exiftool_files')
                const targetFilesDir = path.join(binDir, 'exiftool_files')

                if (fs.existsSync(sourceFilesDir)) {
                    // Remove existing target files dir if exists
                    if (fs.existsSync(targetFilesDir)) {
                        await fs.promises.rm(targetFilesDir, { recursive: true, force: true }).catch(() => { })
                    }
                    try {
                        await fs.promises.rename(sourceFilesDir, targetFilesDir)
                    } catch (renameErr) {
                        console.log(`Rename failed, falling back to copy:`, renameErr)
                        await fs.promises.cp(sourceFilesDir, targetFilesDir, { recursive: true }).catch(err => {
                            throw new Error(`Failed to copy exiftool_files: ${err.message}`);
                        })
                        await fs.promises.rm(sourceFilesDir, { recursive: true, force: true }).catch(err => {
                            console.warn('Failed to rm sourceFilesDir, skipping:', err)
                        })
                    }
                    console.log(`Moved ${sourceFilesDir} to ${targetFilesDir}`)
                }

                // Cleanup empty parent folder if it was nested
                if (sourceDir !== binDir) {
                    try {
                        // Try to remove the versioned folder (e.g. exiftool-13.50_64)
                        // Verify it's effectively empty or just trash now
                        await fs.promises.rm(sourceDir, { recursive: true, force: true })
                    } catch (err) {
                        console.warn('Failed to cleanup exiftool source dir:', err)
                    }
                }
            } else {
                console.error('Could not find exiftool(-k).exe after extraction')
            }
        }

        await fs.promises.unlink(filePath)

        console.log(`${name} installed successfully`)
        onProgress({ dependency: name, percent: 100, status: 'done' })
        return true
    } catch (e) {
        const error = e as Error
        console.error(`Error installing ${name}:`, error.message)
        onProgress({ dependency: name, percent: 0, status: 'error', message: error.message })
        try { await fs.promises.unlink(filePath) } catch { }
        return false
    }
}
