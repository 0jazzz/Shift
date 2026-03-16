import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Download, Check, X, AlertTriangle, Loader2, HardDrive } from 'lucide-react'

interface DownloadStatus {
    percent: number
    status: 'pending' | 'downloading' | 'extracting' | 'done' | 'error'
    message?: string
}

interface FirstRunModalProps {
    missingDeps: string[]
    onDismiss: () => void
}

const DEP_INFO: Record<string, { name: string; desc: string; size: string }> = {
    ffmpeg: { name: 'FFmpeg', desc: 'Video/Audio processing engine', size: '~85MB' },
    exiftool: { name: 'ExifTool', desc: 'Universal metadata reader/writer', size: '~5MB' },
    imagemagick: { name: 'ImageMagick', desc: 'Image manipulation toolkit', size: '~15MB' },
    pandoc: { name: 'Pandoc', desc: 'Document conversion engine', size: '~35MB' },
    xpdf: { name: 'Xpdf Tools', desc: 'PDF to text extraction', size: '~10MB' },
    pdf2docx: { name: 'pdf2docx', desc: 'Python PDF to DOCX converter', size: '~15MB' },
}

export default function FirstRunModal({ missingDeps, onDismiss }: FirstRunModalProps) {
    const [downloads, setDownloads] = useState<Record<string, DownloadStatus>>({})
    const [isDownloading, setIsDownloading] = useState(false)
    const [logs, setLogs] = useState<string[]>(['[INIT] Dependency check complete.'])
    const logRef = useRef<HTMLDivElement>(null)

    // Auto-scroll log to bottom
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight
        }
    }, [logs])

    useEffect(() => {
        // Initialize download status
        const initial: Record<string, DownloadStatus> = {}
        missingDeps.forEach(dep => {
            initial[dep] = { percent: 0, status: 'pending' }
        })
        setDownloads(initial)
    }, [missingDeps])

    useEffect(() => {
        if (!window.electron?.receive) return

        const handler = (data: any) => {
            if (data.type === 'downloadProgress') {
                setDownloads(prev => ({
                    ...prev,
                    [data.dependency]: {
                        percent: data.percent,
                        status: data.status,
                        message: data.message
                    }
                }))

                const statusText = data.status === 'downloading'
                    ? `Downloading... ${data.percent}%`
                    : data.status.toUpperCase()
                addLog(`[${data.dependency.toUpperCase()}] ${statusText}`)
            }
        }

        window.electron.receive('fromMain', handler)
        return () => window.electron?.removeListener?.('fromMain', handler)
    }, [])

    const addLog = (msg: string) => {
        setLogs(prev => {
            const lastLog = prev[prev.length - 1]
            // If last log and new log are both progress indicators for the same dependency, replace the last one
            if (lastLog && lastLog.includes('Downloading') && msg.includes('Downloading') &&
                lastLog.split(']')[0] === msg.split(']')[0]) {
                return [...prev.slice(0, -1), msg]
            }
            return [...prev.slice(-50), msg]
        })
    }

    const handleDownloadAll = async () => {
        if (!window.electron?.invoke) return
        setIsDownloading(true)
        addLog('[SYS] Starting parallel batch download...')

        // Execute all downloads in parallel
        await Promise.all(missingDeps.map(async (dep) => {
            addLog(`[${dep.toUpperCase()}] Initiating download...`)
            await window.electron.invoke('downloadDependency', dep)
        }))

        addLog('[SYS] All downloads complete.')
        setIsDownloading(false)
    }

    const allDone = missingDeps.every(d => downloads[d]?.status === 'done')

    if (missingDeps.length === 0) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/10 backdrop-blur-xl z-50 flex items-center justify-center p-4 font-mono"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg max-w-2xl w-full overflow-hidden shadow-2xl"
                >
                    {/* Header - Windows Style */}
                    <div className="bg-[#111] border-b border-[#1a1a1a] p-3 flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                            <Terminal className="w-3.5 h-3.5" />
                            <span>SHIFT://DEPENDENCY_MANAGER</span>
                        </div>
                        <button
                            onClick={onDismiss}
                            title={!allDone ? "You will be able to close this after all dependencies are installed" : "Close"}
                            className="ml-auto p-1 rounded transition-colors hover:bg-white/5 text-neutral-500 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* System Status */}
                    <div className="bg-[#080808] border-b border-[#1a1a1a] p-3 text-xs">
                        <div className="flex items-center gap-4 text-neutral-500">
                            <span className="text-amber-500">⚠ MISSING_DEPS: {missingDeps.length}</span>
                            <span>|</span>
                            <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                STATUS: {isDownloading ? 'DOWNLOADING' : allDone ? 'READY' : 'AWAITING_ACTION'}
                            </span>
                        </div>
                    </div>

                    {/* Dependency List */}
                    <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                        {missingDeps.map(dep => {
                            const info = DEP_INFO[dep] || { name: dep, desc: 'Unknown', size: '?' }
                            const status = downloads[dep] || { percent: 0, status: 'pending' }

                            return (
                                <div
                                    key={dep}
                                    className="bg-[#111] border border-[#1a1a1a] rounded p-3 flex items-center gap-4"
                                >
                                    {/* Status Icon */}
                                    <div className="w-8 h-8 rounded border border-[#222] bg-[#0a0a0a] flex items-center justify-center">
                                        {status.status === 'done' && <Check className="w-4 h-4 text-green-500" />}
                                        {status.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                        {status.status === 'pending' && <Download className="w-4 h-4 text-neutral-600" />}
                                        {(status.status === 'downloading' || status.status === 'extracting') && (
                                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white">{info.name}</span>
                                            <span className="text-[10px] text-neutral-600 bg-[#1a1a1a] px-1.5 py-0.5 rounded">{info.size}</span>
                                        </div>
                                        <div className="text-xs text-neutral-500 mt-0.5">{info.desc}</div>

                                        {/* Progress Bar */}
                                        {(status.status === 'downloading' || status.status === 'extracting') && (
                                            <div className="mt-2 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-blue-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${status.percent}%` }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Status Text */}
                                    <div className="text-xs text-right">
                                        {status.message ? (
                                            <span className="text-blue-400 capitalize">{status.message}</span>
                                        ) : (
                                            <>
                                                {status.status === 'pending' && <span className="text-neutral-600">WAITING</span>}
                                                {status.status === 'downloading' && <span className="text-blue-400">{status.percent}%</span>}
                                                {status.status === 'extracting' && <span className="text-yellow-400">EXTRACTING</span>}
                                                {status.status === 'done' && <span className="text-green-400">INSTALLED</span>}
                                                {status.status === 'error' && <span className="text-red-400">FAILED</span>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Terminal Log */}
                    <div ref={logRef} className="bg-[#050505] border-t border-[#1a1a1a] p-3 h-32 overflow-y-auto custom-scrollbar">
                        <div className="text-[10px] text-neutral-600 space-y-0.5">
                            {logs.map((log, i) => (
                                <div key={i} className="font-mono">
                                    <span className="text-neutral-700">{new Date().toLocaleTimeString()}</span>
                                    {' '}
                                    <span className={log.includes('ERROR') ? 'text-red-500' : log.includes('SYS') ? 'text-blue-400' : 'text-neutral-500'}>{log}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-[#0a0a0a] border-t border-[#1a1a1a] p-4 flex items-center justify-between">
                        <div className="text-xs text-neutral-600">
                            Dependencies will be installed to ./bin
                        </div>
                        <button
                            onClick={handleDownloadAll}
                            disabled={isDownloading || allDone}
                            className={`px-4 py-2 rounded text-xs font-medium flex items-center gap-2 transition-all
                ${allDone
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : isDownloading
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 cursor-wait'
                                        : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        >
                            {allDone ? (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    ALL INSTALLED
                                </>
                            ) : isDownloading ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    DOWNLOADING...
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5" />
                                    INSTALL ALL
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
