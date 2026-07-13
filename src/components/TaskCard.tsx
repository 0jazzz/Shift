import { FileVideo, FileImage, FileText, FileAudio, ArrowRight, X, Loader2, Check, AlertTriangle, Folder, FilePenLine } from 'lucide-react'
import { motion } from 'framer-motion'
import SmartDropdown from './SmartDropdown'

interface TaskCardProps {
    id: string
    name: string
    status: 'ready' | 'converting' | 'done' | 'error'
    progress: number
    targetFormat: string
    originalSize: number
    convertedSize?: number
    outputPath?: string
    availableFormats?: string[]
    onRemove: () => void
    onFormatChange: (fmt: string) => void
    onEditMetadata: () => void
}

const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return FileVideo
    if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return FileAudio
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return FileImage
    return FileText
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getSmartFormats = (filename: string): string[] => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''

    // Video Formats
    if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv'].includes(ext)) {
        return [
            // Video
            'MP4', 'MKV', 'AVI', 'MOV', 'WEBM', 'WMV', 'FLV', 'GIF',
            // Audio (Extract)
            'MP3', 'WAV', 'AAC', 'FLAC', 'OGG', 'M4A'
        ]
    }

    // Audio Formats
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
        return ['MP3', 'WAV', 'AAC', 'FLAC', 'OGG', 'M4A']
    }

    // Image Formats
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'ico', 'svg'].includes(ext)) {
        return ['JPG', 'PNG', 'WEBP', 'GIF', 'BMP', 'TIFF', 'ICO', 'SVG']
    }

    // PDF
    if (ext === 'pdf') {
        return [
            // Docs
            'DOCX', 'TXT',
            // Images
            'PNG', 'JPG'
        ]
    }

    // Docs (Pandoc supported)
    if (['docx', 'doc', 'odt', 'rtf', 'txt', 'md', 'html', 'epub'].includes(ext)) {
        return ['PDF', 'DOCX', 'TXT', 'HTML', 'MD', 'ODT', 'RTF', 'EPUB']
    }

    // Fallback
    return ['MP4', 'MP3', 'JPG', 'PNG', 'PDF', 'DOCX']
}

export default function TaskCard({
    id, name, status, progress, targetFormat,
    originalSize, convertedSize, outputPath,
    onRemove, onFormatChange, onEditMetadata
}: TaskCardProps) {
    const Icon = getFileIcon(name)
    const ext = name.split('.').pop()?.toUpperCase() || '???'

    // Calculate size stats
    let sizeInfo = ''
    if (status === 'done' && convertedSize) {
        const diff = convertedSize - originalSize
        const percent = Math.round((diff / originalSize) * 100)
        const sign = diff > 0 ? '+' : ''
        sizeInfo = `${formatBytes(originalSize)} -> ${formatBytes(convertedSize)} (${sign}${percent}%)`
    }

    // Use smart formats based on file type
    const formats = getSmartFormats(name)

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="group bg-[#0a0a0a] border border-[#1a1a1a] rounded font-mono text-xs"
        >
            {/* Main Row */}
            <div className="flex items-center gap-3 p-2.5">
                {/* Status Indicator */}
                <div className={`w-8 h-8 rounded border flex items-center justify-center shrink-0
          ${status === 'converting' ? 'border-blue-500/50 bg-blue-500/10' :
                        status === 'done' ? 'border-green-500/50 bg-green-500/10' :
                            status === 'error' ? 'border-red-500/50 bg-red-500/10' :
                                'border-[#222] bg-[#111]'}`}
                >
                    {status === 'converting' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                    {status === 'done' && <Check className="w-4 h-4 text-green-400" />}
                    {status === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                    {status === 'ready' && <Icon className="w-4 h-4 text-neutral-500" />}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="text-neutral-300 truncate" title={name}>{name}</div>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-600">
                            <span>ID: {id.slice(0, 8)}</span>
                            {sizeInfo && (
                                <span className="text-blue-400/80 bg-blue-500/5 px-1 rounded border border-blue-500/20">
                                    {sizeInfo}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Conversion Arrow */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="bg-[#111] border border-[#222] px-2 py-1 rounded text-neutral-500">{ext}</span>
                        <ArrowRight className="w-3 h-3 text-neutral-600" />
                        <SmartDropdown
                            value={targetFormat}
                            options={formats}
                            onChange={onFormatChange}
                        />
                    </div>
                </div>

                {/* Status & Action */}
                <div className="flex items-center gap-2 shrink-0">
                    {status === 'converting' && (
                        <span className="text-blue-400 tabular-nums w-12 text-right">{progress}%</span>
                    )}
                    {status === 'done' && (
                        <span className="text-green-400">DONE</span>
                    )}
                    {status === 'error' && (
                        <span className="text-red-400">FAIL</span>
                    )}
                    {status === 'ready' && (
                        <span className="text-neutral-600">READY</span>
                    )}

                    <div className="flex items-center gap-1">
                        {status === 'done' && outputPath && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (window.electron?.send) {
                                        window.electron.send('toMain', { type: 'openFile', path: outputPath })
                                    }
                                }}
                                className="p-1.5 rounded hover:bg-[#222] text-neutral-500 hover:text-blue-400 transition-colors"
                                title="Open Output Folder"
                            >
                                <Folder className="w-3.5 h-3.5" />
                            </motion.button>
                        )}


                        {status === 'ready' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onEditMetadata()
                                }}
                                className="p-1.5 rounded hover:bg-[#222] text-neutral-500 hover:text-purple-400 transition-colors"
                                title="Edit Metadata"
                            >
                                <FilePenLine className="w-3.5 h-3.5" />
                            </button>
                        )}

                        <button
                            onClick={onRemove}
                            className="p-1.5 rounded hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            {
                status === 'converting' && (
                    <div className="h-0.5 bg-[#111]">
                        <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                )
            }
        </motion.div >
    )
}
