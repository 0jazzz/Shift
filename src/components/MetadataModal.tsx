import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Save, Disc, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface FileMetadata {
    title?: string
    artist?: string
    album?: string
    year?: string
    genre?: string
    comment?: string
    track?: string
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

type FileCategory = 'audio' | 'video' | 'image' | 'document' | 'other'

const getFileCategory = (filePath: string): FileCategory => {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const audio = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'])
    const video = new Set(['mp4', 'mkv', 'avi', 'mov', 'webm'])
    const image = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic'])
    const document = new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'epub'])

    if (audio.has(ext)) return 'audio'
    if (video.has(ext)) return 'video'
    if (image.has(ext)) return 'image'
    if (document.has(ext)) return 'document'
    return 'other'
}

export default function MetadataModal() {
    const { tasks, editingTaskId, setEditingTask, updateTask, addLog } = useAppStore()
    const task = tasks.find(t => t.id === editingTaskId)

    const [metadata, setMetadata] = useState<FileMetadata>({})
    const [initialMetadata, setInitialMetadata] = useState<Record<string, string>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveMode, setSaveMode] = useState<'original' | 'conversion' | null>(null)
    const [tagSearch, setTagSearch] = useState('')

    useEffect(() => {
        if (!task || !window.electron?.invoke) return

        let mounted = true
        setIsLoading(true)
        setTagSearch('')

        // Load existing metadata from file
        window.electron.invoke('readMetadata', task.file.path)
            .then((data: FileMetadata) => {
                if (mounted) {
                    // Merge with any staged metadata in the task
                    const merged = { ...data, ...(task.metadata || {}) }
                    setMetadata(merged)

                    // Create clean initial state for diffing
                    const cleanInitial: Record<string, string> = {}
                    Object.entries(merged).forEach(([key, value]) => {
                        if (value !== undefined && value !== null) cleanInitial[key] = value
                    })
                    setInitialMetadata(cleanInitial)

                    setIsLoading(false)
                }
            })
            .catch((err: any) => {
                console.error('Failed to read metadata', err)
                if (mounted) setIsLoading(false)
            })

        return () => { mounted = false }
    }, [task])

    if (!task) return null

    const handleClose = () => setEditingTask(null)

    const handleChange = (key: string, value: string) => {
        setMetadata(prev => ({ ...prev, [key]: value }))
    }

    const getCleanMetadata = (): Record<string, string> => {
        const clean: Record<string, string> = {}
        Object.entries(metadata).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (!isReadOnlyKey(key)) {
                    clean[key] = value
                }
            }
        })
        return clean
    }

    const logChanges = (newMetadata: Record<string, string>) => {
        const changes: string[] = []
        const allKeys = new Set([...Object.keys(initialMetadata), ...Object.keys(newMetadata)])

        allKeys.forEach(key => {
            const oldVal = initialMetadata[key]
            const newVal = newMetadata[key]
            if (oldVal !== newVal) {
                changes.push(`${key}: "${oldVal || ''}" -> "${newVal || ''}"`)
            }
        })

        if (changes.length > 0) {
            addLog(`METADATA CHANGES:\n${changes.join('\n')}`)
        } else {
            addLog('METADATA: No changes detected.')
        }
    }

    const handleSaveToOriginal = async () => {
        if (!window.electron?.invoke) return
        setSaveMode('original')
        setIsSaving(true)

        try {
            const cleanMetadata = getCleanMetadata()
            logChanges(cleanMetadata)

            await window.electron.invoke('writeMetadata', {
                filePath: task.file.path,
                metadata: cleanMetadata
            })
            addLog(`METADATA: Updated original file ${task.file.name}`)
            // Also update the staged metadata to match
            updateTask(task.id, { metadata: cleanMetadata })
            handleClose()
        } catch (error: any) {
            addLog(`ERROR: Failed to write metadata - ${error.message}`)
        } finally {
            setIsSaving(false)
            setSaveMode(null)
        }
    }

    const handleApplyForConversion = () => {
        const cleanMetadata = getCleanMetadata()
        logChanges(cleanMetadata)
        updateTask(task.id, { metadata: cleanMetadata })
        addLog(`METADATA: Staged changes for conversion of ${task.file.name}`)
        handleClose()
    }

    const fileCategory = getFileCategory(task.file.path || task.file.name)
    const READ_ONLY_KEYS = new Set([
        'fileName',
        'fileType',
        'fileExt',
        'mimeType',
        'fileSize',
        'fileCreated',
        'fileModified',
        'pageCount'
    ])

    const isReadOnlyKey = (key: string) => {
        if (READ_ONLY_KEYS.has(key)) return true
        if (key === 'SourceFile') return true
        if (key.startsWith('File:')) return true
        if (key.startsWith('System:')) return true
        if (key.startsWith('Composite:')) return true
        if (key.startsWith('ExifTool:')) return true
        return false
    }

    const getAllTagEntries = () => {
        const entries = Object.keys(metadata)
            .filter(k => metadata[k] !== undefined)
            .map(k => {
                const hasGroup = k.includes(':')
                const parts = k.split(':')
                const group = hasGroup ? parts[0] : 'General'
                const name = hasGroup ? parts.slice(1).join(':') : k
                return {
                    key: k,
                    group,
                    name,
                    value: metadata[k] || ''
                }
            })

        const search = tagSearch.trim().toLowerCase()
        const filtered = search.length === 0
            ? entries
            : entries.filter(e =>
                e.key.toLowerCase().includes(search) ||
                e.group.toLowerCase().includes(search) ||
                e.name.toLowerCase().includes(search) ||
                (e.value || '').toLowerCase().includes(search)
            )

        return filtered.sort((a, b) => {
            const g = a.group.localeCompare(b.group)
            if (g !== 0) return g
            return a.name.localeCompare(b.name)
        })
    }

    const handleExtendedChange = (oldKey: string, newKey: string, newValue: string) => {
        if (isReadOnlyKey(oldKey)) return
        setMetadata(prev => {
            const next = { ...prev }
            if (oldKey !== newKey) {
                delete next[oldKey]
            }
            next[newKey] = newValue
            return next
        })
    }

    const handleDeleteTag = (key: string) => {
        if (isReadOnlyKey(key)) return
        setMetadata(prev => {
            const next = { ...prev }
            delete next[key]
            return next
        })
    }

    const handleAddTag = () => {
        setMetadata(prev => ({
            ...prev,
            ['NEW_TAG_' + Date.now().toString().slice(-4)]: ''
        }))
    }

    // Helper component for advanced inputs
    const AdvancedInput = ({
        label,
        field,
        value,
        placeholder,
        onChange,
        multiline = false,
        readOnly = false
    }: {
        label: string,
        field: string,
        value: string,
        placeholder: string,
        onChange: (val: string) => void,
        multiline?: boolean,
        readOnly?: boolean
    }) => {
        const original = initialMetadata[field] || ''
        const isModified = !readOnly && value !== original

        return (
            <div className="space-y-1.5 group">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">{label}</label>
                    {isModified && !readOnly && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => onChange(original)}
                            className="text-[10px] text-white hover:text-neutral-300 flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded transition-colors"
                        >
                            <span className="w-1 h-1 rounded-full bg-white" />
                            RESET
                        </motion.button>
                    )}
                </div>
                <div className="relative">
                    {multiline ? (
                        <textarea
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            placeholder={placeholder || original || 'Empty'}
                            rows={4}
                            readOnly={readOnly}
                            className={`w-full bg-[#0a0a0a] border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none transition-all resize-none custom-scrollbar
                            ${readOnly
                                    ? 'border-neutral-800 text-neutral-400'
                                    : isModified
                                    ? 'border-white/30 focus:border-white bg-white/5'
                                    : 'border-neutral-800 focus:border-neutral-600 focus:bg-[#111]'
                                }`}
                        />
                    ) : (
                        <input
                            type="text"
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            placeholder={placeholder || original || 'Empty'}
                            readOnly={readOnly}
                            className={`w-full bg-[#0a0a0a] border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none transition-all
                            ${readOnly
                                    ? 'border-neutral-800 text-neutral-400'
                                    : isModified
                                    ? 'border-white/30 focus:border-white bg-white/5'
                                    : 'border-neutral-800 focus:border-neutral-600 focus:bg-[#111]'
                                }`}
                        />
                    )}

                    {isModified && !multiline && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                    )}
                    {isModified && multiline && (
                        <div className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                    )}
                </div>
                {isModified && original && (
                    <div className="text-[10px] text-neutral-600 ml-1 truncate">
                        Original: <span className="text-neutral-500">"{original.length > 50 ? original.substring(0, 50) + '...' : original}"</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <motion.div
            // ... (modal wrapper same as before)
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 font-sans"
            onClick={handleClose}
        >
            <motion.div
                // ... (modal content wrapper same as before)
                className="bg-[#050505] border border-neutral-800 rounded-2xl w-full max-w-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header ... same */}

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-neutral-500 gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-white/5 blur-xl rounded-full" />
                                <Loader2 className="w-8 h-8 animate-spin text-white relative z-10" />
                            </div>
                            <p className="text-sm font-medium">Reading tags...</p>
                        </div>
                    ) : (
                        <>
                            {/* Standard Tags Section */}
                            {fileCategory === 'audio' && (
                                <div className="space-y-6">
                                    {/* Core Info */}
                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Core Info</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <AdvancedInput label="Title" field="title" value={metadata.title || ''} placeholder="Track Title" onChange={v => handleChange('title', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Artist" field="artist" value={metadata.artist || ''} placeholder="Artist" onChange={v => handleChange('artist', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Album" field="album" value={metadata.album || ''} placeholder="Album" onChange={v => handleChange('album', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Album Artist" field="albumArtist" value={metadata.albumArtist || ''} placeholder="Album Artist" onChange={v => handleChange('albumArtist', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Composer" field="composer" value={metadata.composer || ''} placeholder="Composer" onChange={v => handleChange('composer', v)} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Track Details</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="col-span-1">
                                                <AdvancedInput label="Year" field="year" value={metadata.year || ''} placeholder="YYYY" onChange={v => handleChange('year', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Track No." field="track" value={metadata.track || ''} placeholder="1" onChange={v => handleChange('track', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Genre" field="genre" value={metadata.genre || ''} placeholder="Genre" onChange={v => handleChange('genre', v)} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Content</h3>
                                        <div className="space-y-4">
                                            <AdvancedInput label="Comment" field="comment" value={metadata.comment || ''} placeholder="Add a comment..." onChange={v => handleChange('comment', v)} />
                                            <AdvancedInput label="Lyrics" field="lyrics" value={metadata.lyrics || ''} placeholder="Add lyrics..." onChange={v => handleChange('lyrics', v)} multiline />
                                        </div>
                                    </div>

                                    {/* Technical / Legal */}
                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Technical & Legal</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <AdvancedInput label="Copyright" field="copyright" value={metadata.copyright || ''} placeholder="Copyright notice" onChange={v => handleChange('copyright', v)} />
                                            <AdvancedInput label="Encoder" field="encoder" value={metadata.encoder || ''} placeholder="Encoded by..." onChange={v => handleChange('encoder', v)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {fileCategory === 'document' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Document Info</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <AdvancedInput label="Title" field="title" value={metadata.title || ''} placeholder="Document Title" onChange={v => handleChange('title', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Author" field="author" value={metadata.author || ''} placeholder="Author" onChange={v => handleChange('author', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Subject" field="subject" value={metadata.subject || ''} placeholder="Subject" onChange={v => handleChange('subject', v)} />
                                            </div>
                                            <div className="col-span-2">
                                                <AdvancedInput label="Keywords" field="keywords" value={metadata.keywords || ''} placeholder="keyword1; keyword2" onChange={v => handleChange('keywords', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Created" field="created" value={metadata.created || ''} placeholder="Creation date" onChange={v => handleChange('created', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Modified" field="modified" value={metadata.modified || ''} placeholder="Modified date" onChange={v => handleChange('modified', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Pages" field="pageCount" value={metadata.pageCount || ''} placeholder="Page count" onChange={v => handleChange('pageCount', v)} readOnly />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Description</h3>
                                        <div className="space-y-4">
                                            <AdvancedInput label="Description" field="description" value={metadata.description || ''} placeholder="Summary or abstract" onChange={v => handleChange('description', v)} multiline />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Production</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <AdvancedInput label="Creator" field="creator" value={metadata.creator || ''} placeholder="Creator Tool" onChange={v => handleChange('creator', v)} />
                                            <AdvancedInput label="Producer" field="producer" value={metadata.producer || ''} placeholder="Producer" onChange={v => handleChange('producer', v)} />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Notes</h3>
                                        <div className="space-y-4">
                                            <AdvancedInput label="Comment" field="comment" value={metadata.comment || ''} placeholder="Add a comment..." onChange={v => handleChange('comment', v)} multiline />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {fileCategory === 'video' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Video Info</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <AdvancedInput label="Title" field="title" value={metadata.title || ''} placeholder="Video Title" onChange={v => handleChange('title', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Author" field="author" value={metadata.author || ''} placeholder="Author" onChange={v => handleChange('author', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Creator" field="creator" value={metadata.creator || ''} placeholder="Creator" onChange={v => handleChange('creator', v)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Details</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <AdvancedInput label="Year" field="year" value={metadata.year || ''} placeholder="YYYY" onChange={v => handleChange('year', v)} />
                                            <AdvancedInput label="Genre" field="genre" value={metadata.genre || ''} placeholder="Genre" onChange={v => handleChange('genre', v)} />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Content</h3>
                                        <div className="space-y-4">
                                            <AdvancedInput label="Description" field="description" value={metadata.description || ''} placeholder="Description" onChange={v => handleChange('description', v)} multiline />
                                            <AdvancedInput label="Comment" field="comment" value={metadata.comment || ''} placeholder="Add a comment..." onChange={v => handleChange('comment', v)} />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Technical & Legal</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <AdvancedInput label="Copyright" field="copyright" value={metadata.copyright || ''} placeholder="Copyright notice" onChange={v => handleChange('copyright', v)} />
                                            <AdvancedInput label="Encoder" field="encoder" value={metadata.encoder || ''} placeholder="Encoded by..." onChange={v => handleChange('encoder', v)} />
                                            <AdvancedInput label="Producer" field="producer" value={metadata.producer || ''} placeholder="Producer" onChange={v => handleChange('producer', v)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {fileCategory === 'image' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Image Info</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <AdvancedInput label="Title" field="title" value={metadata.title || ''} placeholder="Image Title" onChange={v => handleChange('title', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Artist" field="artist" value={metadata.artist || ''} placeholder="Artist" onChange={v => handleChange('artist', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Creator" field="creator" value={metadata.creator || ''} placeholder="Creator" onChange={v => handleChange('creator', v)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Content</h3>
                                        <div className="space-y-4">
                                            <AdvancedInput label="Description" field="description" value={metadata.description || ''} placeholder="Description" onChange={v => handleChange('description', v)} multiline />
                                            <AdvancedInput label="Comment" field="comment" value={metadata.comment || ''} placeholder="Add a comment..." onChange={v => handleChange('comment', v)} />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Legal</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <AdvancedInput label="Copyright" field="copyright" value={metadata.copyright || ''} placeholder="Copyright notice" onChange={v => handleChange('copyright', v)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {fileCategory === 'other' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">General Info</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <AdvancedInput label="Title" field="title" value={metadata.title || ''} placeholder="Title" onChange={v => handleChange('title', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Author" field="author" value={metadata.author || ''} placeholder="Author" onChange={v => handleChange('author', v)} />
                                            </div>
                                            <div className="col-span-1">
                                                <AdvancedInput label="Keywords" field="keywords" value={metadata.keywords || ''} placeholder="keyword1; keyword2" onChange={v => handleChange('keywords', v)} />
                                            </div>
                                            <div className="col-span-2">
                                                <AdvancedInput label="Description" field="description" value={metadata.description || ''} placeholder="Description" onChange={v => handleChange('description', v)} multiline />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Notes</h3>
                                        <div className="space-y-4">
                                            <AdvancedInput label="Comment" field="comment" value={metadata.comment || ''} placeholder="Add a comment..." onChange={v => handleChange('comment', v)} multiline />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1 mb-4">Legal</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <AdvancedInput label="Copyright" field="copyright" value={metadata.copyright || ''} placeholder="Copyright notice" onChange={v => handleChange('copyright', v)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* File Info (Read-Only) */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">File Info</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <AdvancedInput label="File Name" field="fileName" value={metadata.fileName || ''} placeholder="File name" onChange={v => handleChange('fileName', v)} readOnly />
                                    </div>
                                    <div className="col-span-1">
                                        <AdvancedInput label="File Type" field="fileType" value={metadata.fileType || ''} placeholder="Type" onChange={v => handleChange('fileType', v)} readOnly />
                                    </div>
                                    <div className="col-span-1">
                                        <AdvancedInput label="Extension" field="fileExt" value={metadata.fileExt || ''} placeholder="Ext" onChange={v => handleChange('fileExt', v)} readOnly />
                                    </div>
                                    <div className="col-span-1">
                                        <AdvancedInput label="MIME Type" field="mimeType" value={metadata.mimeType || ''} placeholder="mime/type" onChange={v => handleChange('mimeType', v)} readOnly />
                                    </div>
                                    <div className="col-span-1">
                                        <AdvancedInput label="File Size" field="fileSize" value={metadata.fileSize || ''} placeholder="Size" onChange={v => handleChange('fileSize', v)} readOnly />
                                    </div>
                                    <div className="col-span-1">
                                        <AdvancedInput label="File Created" field="fileCreated" value={metadata.fileCreated || ''} placeholder="Created" onChange={v => handleChange('fileCreated', v)} readOnly />
                                    </div>
                                    <div className="col-span-1">
                                        <AdvancedInput label="File Modified" field="fileModified" value={metadata.fileModified || ''} placeholder="Modified" onChange={v => handleChange('fileModified', v)} readOnly />
                                    </div>
                                </div>
                            </div>

                            {/* All Tags Section */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex flex-col gap-3 px-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">All Metadata</h3>
                                        <button
                                            onClick={handleAddTag}
                                            className="text-[10px] font-bold text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors"
                                        >
                                            + ADD TAG
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={tagSearch}
                                        onChange={(e) => setTagSearch(e.target.value)}
                                        placeholder="Search tags, groups, or values..."
                                        className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-all"
                                    />
                                </div>

                                <div className="space-y-3">
                                    {getAllTagEntries().length === 0 ? (
                                        <div className="text-center py-4 text-neutral-600 text-xs italic border border-white/5 rounded-lg border-dashed">
                                            No metadata found.
                                        </div>
                                    ) : (
                                        getAllTagEntries().map((entry, idx) => {
                                            const isReadOnly = isReadOnlyKey(entry.key)
                                            const useTextarea = (entry.value || '').length > 120 || (entry.value || '').includes('\n')
                                            return (
                                                <div key={`${entry.key}-${idx}`} className={`flex gap-2 group ${isReadOnly ? 'opacity-80' : ''}`}>
                                                    <div className="w-20 shrink-0 text-[10px] uppercase tracking-widest text-neutral-600 pt-2">
                                                        {entry.group}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={entry.key}
                                                        readOnly={isReadOnly}
                                                        onChange={(e) => handleExtendedChange(entry.key, e.target.value, entry.value)}
                                                        className={`w-1/3 bg-[#0a0a0a] border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition-all
                                                        ${isReadOnly ? 'text-neutral-500' : 'text-neutral-300 focus:border-white/20'}`}
                                                        placeholder="KEY"
                                                    />
                                                    {useTextarea ? (
                                                        <textarea
                                                            value={entry.value}
                                                            readOnly={isReadOnly}
                                                            onChange={(e) => handleExtendedChange(entry.key, entry.key, e.target.value)}
                                                            className={`flex-1 bg-[#0a0a0a] border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-all resize-none
                                                            ${isReadOnly ? 'text-neutral-500' : 'focus:border-white/20'}`}
                                                            rows={3}
                                                            placeholder="Value"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={entry.value}
                                                            readOnly={isReadOnly}
                                                            onChange={(e) => handleExtendedChange(entry.key, entry.key, e.target.value)}
                                                            className={`flex-1 bg-[#0a0a0a] border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-all
                                                            ${isReadOnly ? 'text-neutral-500' : ''}`}
                                                            placeholder="Value"
                                                        />
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteTag(entry.key)}
                                                        disabled={isReadOnly}
                                                        className={`p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100
                                                        ${isReadOnly ? 'text-neutral-700 cursor-not-allowed' : 'text-neutral-600 hover:text-red-400 hover:bg-red-500/10'}`}
                                                        title={isReadOnly ? 'Read-only tag' : 'Remove Tag'}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-5 bg-[#0a0a0a] border-t border-neutral-800/50 flex items-center justify-between gap-4">

                    <button
                        onClick={handleSaveToOriginal}
                        disabled={isSaving || isLoading}
                        className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 text-neutral-400 hover:text-white transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {isSaving && saveMode === 'original' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:text-white transition-colors" />}
                        <span>Save to Original</span>
                    </button>

                    <button
                        onClick={handleApplyForConversion}
                        disabled={isSaving || isLoading}
                        className="flex-[1.5] h-11 flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-black shadow-lg shadow-white/10 hover:shadow-white/20 transition-all text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed group transform active:scale-[0.98]"
                    >
                        <Disc className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
                        <span>Apply & Queue Convert</span>
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}
