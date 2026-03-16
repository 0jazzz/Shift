import { spawn } from 'child_process'
import path from 'path'
import fsSync from 'fs'
import { app } from 'electron'

// Reusing binary path logic from engine.ts (simplified here or imported if exported)
// Better to duplicate the small helper to avoid circular deps if engine imports this
function getBinDir(): string {
    if (app.isPackaged) {
        return path.join(path.dirname(app.getPath('exe')), '.bin')
    }
    return path.join(process.cwd(), '.bin')
}

function getBinaryPath(name: string): string {
    const binDir = getBinDir()
    return path.join(binDir, process.platform === 'win32' ? `${name}.exe` : name)
}

function getExifToolPath(): string | null {
    const binDir = getBinDir()
    const candidates = [
        path.join(binDir, process.platform === 'win32' ? 'exiftool.exe' : 'exiftool'),
        path.join(binDir, process.platform === 'win32' ? 'exiftool(-k).exe' : 'exiftool(-k)')
    ]
    for (const candidate of candidates) {
        if (fsSync.existsSync(candidate)) return candidate
    }
    return null
}

function isLikelyMedia(filePath: string): boolean {
    const ext = path.extname(filePath).slice(1).toLowerCase()
    return [
        'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a',
        'mp4', 'mkv', 'avi', 'mov', 'webm'
    ].includes(ext)
}

export interface FileMetadata {
    title?: string
    artist?: string
    album?: string
    year?: string
    genre?: string
    comment?: string
    track?: string
    lyrics?: string
    albumArtist?: string
    composer?: string
    encoder?: string
    copyright?: string
    author?: string
    subject?: string
    keywords?: string
    description?: string
    creator?: string
    producer?: string
    created?: string
    modified?: string
    pageCount?: string
    fileName?: string
    fileType?: string
    fileExt?: string
    mimeType?: string
    fileSize?: string
    fileCreated?: string
    fileModified?: string
    [key: string]: string | undefined
}

type TagMap = Record<string, string>

function normalizeValue(value: any): string {
    if (value === undefined || value === null) return ''
    if (Array.isArray(value)) return value.map(normalizeValue).join('; ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

function stripGroup(tag: string): string {
    const idx = tag.indexOf(':')
    return idx >= 0 ? tag.slice(idx + 1) : tag
}

function buildTagLookup(rawTags: TagMap) {
    const lowerMap = new Map<string, string>()
    const normalizedMap = new Map<string, string>()
    for (const key of Object.keys(rawTags)) {
        lowerMap.set(key.toLowerCase(), key)
        normalizedMap.set(stripGroup(key).toLowerCase(), key)
    }
    return { lowerMap, normalizedMap }
}

function searchTag(rawTags: TagMap, lookup: ReturnType<typeof buildTagLookup>, candidates: string[]): string | undefined {
    for (const candidate of candidates) {
        if (rawTags[candidate]) return rawTags[candidate]
        const lowerKey = lookup.lowerMap.get(candidate.toLowerCase())
        if (lowerKey && rawTags[lowerKey]) return rawTags[lowerKey]
        const normalizedKey = lookup.normalizedMap.get(candidate.toLowerCase())
        if (normalizedKey && rawTags[normalizedKey]) return rawTags[normalizedKey]
    }
    return undefined
}

function matchTag(rawTags: TagMap, lookup: ReturnType<typeof buildTagLookup>, candidates: string[]): { key?: string, value?: string } {
    for (const candidate of candidates) {
        if (rawTags[candidate]) return { key: candidate, value: rawTags[candidate] }
        const lowerKey = lookup.lowerMap.get(candidate.toLowerCase())
        if (lowerKey && rawTags[lowerKey]) return { key: lowerKey, value: rawTags[lowerKey] }
        const normalizedKey = lookup.normalizedMap.get(candidate.toLowerCase())
        if (normalizedKey && rawTags[normalizedKey]) return { key: normalizedKey, value: rawTags[normalizedKey] }
    }
    return {}
}

function markConsumed(consumed: Set<string>, rawTags: TagMap, lookup: ReturnType<typeof buildTagLookup>, candidates: string[]) {
    candidates.forEach(candidate => {
        if (rawTags[candidate]) consumed.add(candidate)
        const lowerKey = lookup.lowerMap.get(candidate.toLowerCase())
        if (lowerKey) consumed.add(lowerKey)
        const normalizedKey = lookup.normalizedMap.get(candidate.toLowerCase())
        if (normalizedKey) consumed.add(normalizedKey)
    })
}

async function readWithExifTool(filePath: string, exiftoolPath: string): Promise<FileMetadata> {
    return new Promise((resolve) => {
        console.log(`[METADATA] Reading metadata (ExifTool) for: ${filePath}`)
        const args = ['-json', '-G1', '-s', '-a', '-u', '-charset', 'filename=utf8', filePath]
        console.log(`[METADATA] Spawning: ${exiftoolPath} ${args.join(' ')}`)

        const proc = spawn(exiftoolPath, args)
        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data) => stdout += data)
        proc.stderr.on('data', (data) => stderr += data)

        proc.on('close', (code) => {
            if (code !== 0) {
                console.error(`[METADATA] ExifTool failed with code ${code}`)
                console.error(`[METADATA] stderr: ${stderr}`)
                resolve({})
                return
            }

            try {
                const parsed = JSON.parse(stdout)
                const raw = Array.isArray(parsed) ? parsed[0] : parsed
                if (!raw || typeof raw !== 'object') {
                    resolve({})
                    return
                }

                const rawTags: TagMap = {}
                Object.entries(raw).forEach(([key, value]) => {
                    if (key === 'SourceFile') return
                    if (key.startsWith('ExifTool:')) return
                    rawTags[key] = normalizeValue(value)
                })

                console.log(`[METADATA] ExifTool raw tags:`, Object.keys(rawTags))

                const lookup = buildTagLookup(rawTags)

                const titleMatch = matchTag(rawTags, lookup, ['title', 'Title', 'ObjectName', 'ImageDescription'])
                const artistMatch = matchTag(rawTags, lookup, ['artist', 'Artist'])
                const albumMatch = matchTag(rawTags, lookup, ['album', 'Album'])
                const yearMatch = matchTag(rawTags, lookup, ['year', 'Year', 'Date', 'CreateDate'])
                const genreMatch = matchTag(rawTags, lookup, ['genre', 'Genre'])
                const commentMatch = matchTag(rawTags, lookup, ['comment', 'Comment', 'UserComment'])
                const trackMatch = matchTag(rawTags, lookup, ['track', 'Track', 'TrackNumber'])
                const lyricsMatch = matchTag(rawTags, lookup, ['lyrics', 'Lyrics'])
                const albumArtistMatch = matchTag(rawTags, lookup, ['albumartist', 'AlbumArtist', 'Album Artist'])
                const composerMatch = matchTag(rawTags, lookup, ['composer', 'Composer'])
                const encoderMatch = matchTag(rawTags, lookup, ['encoder', 'Encoder'])
                const copyrightMatch = matchTag(rawTags, lookup, ['copyright', 'Copyright'])

                // Document-style tags
                const authorMatch = matchTag(rawTags, lookup, ['author', 'Author'])
                const subjectMatch = matchTag(rawTags, lookup, ['subject', 'Subject'])
                const keywordsMatch = matchTag(rawTags, lookup, ['keywords', 'Keywords'])
                const descriptionMatch = matchTag(rawTags, lookup, ['description', 'Description', 'ImageDescription'])
                const creatorMatch = matchTag(rawTags, lookup, ['creator', 'Creator', 'CreatorTool'])
                const producerMatch = matchTag(rawTags, lookup, ['producer', 'Producer'])
                const createdMatch = matchTag(rawTags, lookup, ['created', 'CreateDate', 'CreationDate', 'MetadataDate'])
                const modifiedMatch = matchTag(rawTags, lookup, ['modified', 'ModifyDate', 'ModDate'])
                const pageCountMatch = matchTag(rawTags, lookup, ['pagecount', 'PageCount', 'Pages'])

                const fileNameMatch = matchTag(rawTags, lookup, ['filename', 'FileName'])
                const fileTypeMatch = matchTag(rawTags, lookup, ['filetype', 'FileType'])
                const fileExtMatch = matchTag(rawTags, lookup, ['filetypeextension', 'FileTypeExtension'])
                const mimeTypeMatch = matchTag(rawTags, lookup, ['mimetype', 'MIMEType'])
                const fileSizeMatch = matchTag(rawTags, lookup, ['filesize', 'FileSize'])
                const fileCreatedMatch = matchTag(rawTags, lookup, ['filecreatedate', 'FileCreateDate'])
                const fileModifiedMatch = matchTag(rawTags, lookup, ['filemodifydate', 'FileModifyDate'])

                const title = titleMatch.value
                const artist = artistMatch.value
                const album = albumMatch.value
                const year = yearMatch.value
                const genre = genreMatch.value
                const comment = commentMatch.value
                const track = trackMatch.value
                const lyrics = lyricsMatch.value
                const albumArtist = albumArtistMatch.value
                const composer = composerMatch.value
                const encoder = encoderMatch.value
                const copyright = copyrightMatch.value
                const author = authorMatch.value
                const subject = subjectMatch.value
                const keywords = keywordsMatch.value
                const description = descriptionMatch.value
                const creator = creatorMatch.value
                const producer = producerMatch.value
                const created = createdMatch.value
                const modified = modifiedMatch.value
                const pageCount = pageCountMatch.value
                const fileName = fileNameMatch.value
                const fileType = fileTypeMatch.value
                const fileExt = fileExtMatch.value
                const mimeType = mimeTypeMatch.value
                const fileSize = fileSizeMatch.value
                const fileCreated = fileCreatedMatch.value
                const fileModified = fileModifiedMatch.value

                const metadata: FileMetadata = {
                    title,
                    artist,
                    album,
                    year,
                    genre,
                    comment,
                    track,
                    lyrics,
                    albumArtist,
                    composer,
                    encoder,
                    copyright,
                    author,
                    subject,
                    keywords,
                    description,
                    creator,
                    producer,
                    created,
                    modified,
                    pageCount,
                    fileName,
                    fileType,
                    fileExt,
                    mimeType,
                    fileSize,
                    fileCreated,
                    fileModified
                }

                console.log(`[METADATA] Mapped metadata:`, JSON.stringify(metadata, null, 2))

                const consumedKeys = new Set<string>()
                const addConsumed = (key?: string) => {
                    if (key) consumedKeys.add(key)
                }
                addConsumed(titleMatch.key)
                addConsumed(artistMatch.key)
                addConsumed(albumMatch.key)
                addConsumed(yearMatch.key)
                addConsumed(genreMatch.key)
                addConsumed(commentMatch.key)
                addConsumed(trackMatch.key)
                addConsumed(lyricsMatch.key)
                addConsumed(albumArtistMatch.key)
                addConsumed(composerMatch.key)
                addConsumed(encoderMatch.key)
                addConsumed(copyrightMatch.key)
                addConsumed(authorMatch.key)
                addConsumed(subjectMatch.key)
                addConsumed(keywordsMatch.key)
                addConsumed(descriptionMatch.key)
                addConsumed(creatorMatch.key)
                addConsumed(producerMatch.key)
                addConsumed(createdMatch.key)
                addConsumed(modifiedMatch.key)
                addConsumed(pageCountMatch.key)
                addConsumed(fileNameMatch.key)
                addConsumed(fileTypeMatch.key)
                addConsumed(fileExtMatch.key)
                addConsumed(mimeTypeMatch.key)
                addConsumed(fileSizeMatch.key)
                addConsumed(fileCreatedMatch.key)
                addConsumed(fileModifiedMatch.key)

                Object.keys(rawTags).forEach(key => {
                    if (!consumedKeys.has(key)) {
                        metadata[key] = rawTags[key]
                    }
                })

                resolve(metadata)
            } catch (e: any) {
                console.error('[METADATA] Failed to parse ExifTool output', e)
                resolve({})
            }
        })
    })
}

async function readWithFfprobe(filePath: string): Promise<FileMetadata> {
    return new Promise((resolve) => {
        const ffprobe = getBinaryPath('ffprobe')
        console.log(`[METADATA] Reading metadata (ffprobe) for: ${filePath}`)
        console.log(`[METADATA] Using ffprobe at: ${ffprobe}`)

        if (!fsSync.existsSync(ffprobe)) {
            console.error(`[METADATA] ffprobe binary NOT FOUND at ${ffprobe}`)
            resolve({})
            return
        }

        const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath]
        console.log(`[METADATA] Spawning: ${ffprobe} ${args.join(' ')}`)

        const proc = spawn(ffprobe, args)
        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data) => stdout += data)
        proc.stderr.on('data', (data) => stderr += data)

        proc.on('close', (code) => {
            if (code !== 0) {
                console.error(`[METADATA] ffprobe failed with code ${code}`)
                console.error(`[METADATA] stderr: ${stderr}`)
                resolve({})
                return
            }

            console.log(`[METADATA] ffprobe success. stdout length: ${stdout.length}`)

            try {
                const data = JSON.parse(stdout)
                const formatTags = data.format?.tags || {}
                let streamTags = {}
                if (data.streams) {
                    data.streams.forEach((stream: any) => {
                        if (stream.tags) {
                            streamTags = { ...streamTags, ...stream.tags }
                        }
                    })
                }

                const rawTags = { ...streamTags, ...formatTags }
                console.log(`[METADATA] Found raw tags keys:`, Object.keys(rawTags))

                const search = (candidates: string[]): string | undefined => {
                    for (const c of candidates) {
                        if (rawTags[c]) return rawTags[c]
                        const lowerKey = Object.keys(rawTags).find(k => k.toLowerCase() === c.toLowerCase())
                        if (lowerKey && rawTags[lowerKey]) return rawTags[lowerKey]
                    }
                    return undefined
                }

                const title = search(['title', 'TIT2', 'nam', 'name'])
                const artist = search(['artist', 'ARTIST', 'TPE1', 'ART'])
                const album = search(['album', 'ALBUM', 'TALB', 'alb'])
                const year = search(['date', 'year', 'TYER', 'day', 'TDRC'])
                const genre = search(['genre', 'TCON', 'gen'])
                const comment = search(['comment', 'COMM', 'cmt', 'description'])
                const track = search(['track', 'TRCK', 'trkn', 'tracknumber'])
                const lyrics = search(['lyrics', 'USLT', 'SYLT', 'UNSYNCED LYRICS', 'TEXT', 'TXXX:LYRICS'])
                const albumArtist = search(['album_artist', 'TPE2', 'ALBUM ARTIST', 'band', 'ensemble'])
                const composer = search(['composer', 'TCOM', 'wrt', 'writer'])
                const encoder = search(['encoder', 'TSSE', 'TENC', 'encoded_by'])
                const copyright = search(['copyright', 'TCOP', 'cprt'])

                const metadata: FileMetadata = {
                    title,
                    artist,
                    album,
                    year,
                    genre,
                    comment,
                    track,
                    lyrics,
                    albumArtist,
                    composer,
                    encoder,
                    copyright
                }

                console.log(`[METADATA] Mapped metadata:`, JSON.stringify(metadata, null, 2))

                const consumedKeys = new Set<string>()
                const markConsumed = (candidates: string[]) => {
                    candidates.forEach(c => {
                        if (rawTags[c]) consumedKeys.add(c)
                        const lowerKey = Object.keys(rawTags).find(k => k.toLowerCase() === c.toLowerCase())
                        if (lowerKey) consumedKeys.add(lowerKey)
                    })
                }

                markConsumed(['title', 'TIT2', 'nam', 'name'])
                markConsumed(['artist', 'ARTIST', 'TPE1', 'ART'])
                markConsumed(['album', 'ALBUM', 'TALB', 'alb'])
                markConsumed(['date', 'year', 'TYER', 'day', 'TDRC'])
                markConsumed(['genre', 'TCON', 'gen'])
                markConsumed(['comment', 'COMM', 'cmt', 'description'])
                markConsumed(['track', 'TRCK', 'trkn', 'tracknumber'])
                markConsumed(['lyrics', 'USLT', 'SYLT', 'UNSYNCED LYRICS', 'TEXT', 'TXXX:LYRICS'])
                markConsumed(['album_artist', 'TPE2', 'ALBUM ARTIST', 'band', 'ensemble'])
                markConsumed(['composer', 'TCOM', 'wrt', 'writer'])
                markConsumed(['encoder', 'TSSE', 'TENC', 'encoded_by'])
                markConsumed(['copyright', 'TCOP', 'cprt'])

                Object.keys(rawTags).forEach(key => {
                    if (!consumedKeys.has(key)) {
                        metadata[key] = rawTags[key]
                    }
                })

                resolve(metadata)
            } catch (e: any) {
                console.error('[METADATA] Failed to parse ffprobe output', e)
                resolve({})
            }
        })
    })
}

export async function readMetadata(filePath: string): Promise<FileMetadata> {
    const exiftool = getExifToolPath()
    if (exiftool) {
        return await readWithExifTool(filePath, exiftool)
    }

    if (isLikelyMedia(filePath)) {
        return await readWithFfprobe(filePath)
    }

    console.error('[METADATA] ExifTool not found and file is not media. Cannot read metadata.')
    return {}
}

async function writeWithExifTool(filePath: string, metadata: FileMetadata, exiftoolPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`[METADATA] Writing metadata (ExifTool) to ${filePath}`)

        const keyMap: Record<string, string> = {
            albumArtist: 'AlbumArtist',
            year: 'Year',
            comment: 'Comment',
            track: 'Track',
            lyrics: 'Lyrics',
            author: 'Author',
            subject: 'Subject',
            keywords: 'Keywords',
            description: 'Description',
            creator: 'Creator',
            producer: 'Producer',
            created: 'CreateDate',
            modified: 'ModifyDate'
        }

        const skipKeys = new Set([
            'SourceFile',
            'fileName',
            'fileType',
            'fileExt',
            'mimeType',
            'fileSize',
            'fileCreated',
            'fileModified',
            'pageCount',
            'FileName',
            'Directory',
            'FileSize',
            'FileModifyDate',
            'FileAccessDate',
            'FileInodeChangeDate',
            'FilePermissions',
            'FileType',
            'FileTypeExtension',
            'MIMEType',
            'ExifToolVersion'
        ])

        const args: string[] = ['-overwrite_original', '-charset', 'utf8']
        Object.entries(metadata).forEach(([key, value]) => {
            if (value === undefined) return
            if (skipKeys.has(key)) return
            if (key.startsWith('File:') || key.startsWith('ExifTool:') || key.startsWith('System:') || key.startsWith('Composite:')) return

            const exifKey = keyMap[key] || key
            args.push(`-${exifKey}=${value}`)
        })

        args.push(filePath)

        const proc = spawn(exiftoolPath, args)
        let stderr = ''

        proc.stderr.on('data', (data) => stderr += data)

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`ExifTool failed to write metadata: ${stderr}`))
                return
            }
            resolve()
        })
    })
}

async function writeWithFfmpeg(filePath: string, metadata: FileMetadata): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const ffmpeg = getBinaryPath('ffmpeg')

        if (!fsSync.existsSync(ffmpeg)) {
            reject(new Error('FFmpeg not found. Cannot write metadata.'))
            return
        }

        const dir = path.dirname(filePath)
        const ext = path.extname(filePath)
        const name = path.basename(filePath, ext)
        const tempPath = path.join(dir, `${name}_temp_meta${ext}`)

        const keyMap: Record<string, string> = {
            albumArtist: 'album_artist'
        }

        const metaArgs: string[] = []
        Object.entries(metadata).forEach(([key, value]) => {
            if (value !== undefined) {
                const ffmpegKey = keyMap[key] || key
                metaArgs.push('-metadata', `${ffmpegKey}=${value}`)
            }
        })

        const args = ['-i', filePath, '-c', 'copy', ...metaArgs, '-y', tempPath]

        console.log(`[METADATA] Writing tags to ${filePath}`, args)

        const proc = spawn(ffmpeg, args)
        let stderr = ''

        proc.stderr.on('data', (data) => stderr += data)

        proc.on('close', async (code) => {
            if (code !== 0) {
                reject(new Error(`FFmpeg failed to write metadata: ${stderr}`))
                return
            }

            try {
                await fsSync.promises.unlink(filePath)
                await fsSync.promises.rename(tempPath, filePath)
                resolve()
            } catch (e: any) {
                reject(new Error(`Failed to replace file: ${e.message}`))
            }
        })
    })
}

export async function writeMetadata(filePath: string, metadata: FileMetadata): Promise<void> {
    const exiftool = getExifToolPath()
    if (exiftool) {
        return await writeWithExifTool(filePath, metadata, exiftool)
    }

    if (!isLikelyMedia(filePath)) {
        throw new Error('ExifTool is required to write metadata for this file type.')
    }

    return await writeWithFfmpeg(filePath, metadata)
}
