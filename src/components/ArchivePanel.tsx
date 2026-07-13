import { useState, useRef } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { X, Trash2, Folder, Clock, FileVideo, FileAudio, FileImage, FileText, ChevronDown, Layers } from 'lucide-react'
import { useAppStore, type ArchiveEntry } from '../store/appStore'

const getIcon = (type: string) => {
    switch (type) {
        case 'video': return FileVideo
        case 'audio': return FileAudio
        case 'image': return FileImage
        default: return FileText
    }
}

export default function ArchivePanel() {
    const isArchiveOpen = useAppStore(state => state.isArchiveOpen)
    const toggleArchive = useAppStore(state => state.toggleArchive)
    const archive = useAppStore(state => state.archive)
    const clearArchive = useAppStore(state => state.clearArchive)
    const activeFloatingPanel = useAppStore(state => state.activeFloatingPanel)
    const bringToFront = useAppStore(state => state.bringToFront)
    const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
    const [showClearConfirm, setShowClearConfirm] = useState(false)

    // Group items logic
    const displayList: (ArchiveEntry | { isBatch: true, sessionId: string, items: ArchiveEntry[], timestamp: number })[] = []
    const sessionMap = new Map<string, typeof displayList[0]>()

    archive.forEach(entry => {
        if (!entry.sessionId) {
            displayList.push(entry)
        } else {
            if (sessionMap.has(entry.sessionId)) {
                const batch = sessionMap.get(entry.sessionId)!
                if ('isBatch' in batch) {
                    batch.items.push(entry)
                }
            } else {
                const batch = {
                    isBatch: true,
                    sessionId: entry.sessionId,
                    items: [entry],
                    timestamp: entry.timestamp
                }
                // @ts-ignore
                displayList.push(batch)
                // @ts-ignore
                sessionMap.set(entry.sessionId, batch)
            }
        }
    })

    const toggleBatch = (id: string) => {
        const next = new Set(expandedBatches)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setExpandedBatches(next)
    }

    const handleOpenFolder = (path: string) => {
        if (window.electron?.send) {
            window.electron.send('toMain', { type: 'openFile', path })
        }
    }

    const handleSave = async () => {
        const text = archive.map(e => `[${new Date(e.timestamp).toLocaleString()}] ${e.name} -> ${e.format} (${e.outputPath})`).join('\n')

        if (window.electron?.invoke) {
            const result = await window.electron.invoke('saveSilent', { type: 'archive', content: text })
            if (result.success) {
                // Could show a toast here, for now maybe just console or small indication
                // The requirements didn't specify a complex UI for success, just silent.
                // We'll reuse the tooltip or added logic if we want feedback.
                // Let's print to console for debugging at least.
                console.log('Archive saved silently to:', result.path)
            }
        }
    }

    const handleClear = () => {
        clearArchive()
        setShowClearConfirm(false)
    }

    const zIndex = activeFloatingPanel === 'archive' ? 60 : 50

    const boundsRef = useRef<HTMLDivElement>(null)
    const dragControls = useDragControls()

    return (
        <AnimatePresence>
            {isArchiveOpen && (
                <motion.div
                    key="archive-wrapper"
                    ref={boundsRef}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ zIndex }}
                    className="fixed inset-0 flex items-center justify-center pointer-events-none p-4"
                >
                    <motion.div
                        key="archive-panel"
                        initial={{ scale: 0.95, x: 0, y: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.95 }}
                        drag
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={boundsRef}
                        dragMomentum={false}
                        className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col pointer-events-auto overflow-hidden font-mono text-sm"
                    >
                        {/* Header */}
                        <div 
                            onPointerDown={(e) => {
                                dragControls.start(e)
                                bringToFront('archive')
                            }}
                            className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] bg-[#0a0a0a] cursor-move"
                        >
                            <div className="flex items-center gap-2 pointer-events-none">
                                <Clock className="w-4 h-4 text-neutral-400" />
                                <span className="text-neutral-400">⟩_ ARCHIVE</span>
                                <span className="text-neutral-600 text-[10px]">({archive.length} files)</span>
                            </div>
                            <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
                                <motion.button
                                    onClick={handleSave}
                                    className="px-2 py-1 rounded hover:bg-[#1a1a1a] text-neutral-500 hover:text-white text-xs border border-transparent hover:border-[#222] transition-colors relative group"
                                >
                                    SAVE
                                    <div className="absolute top-full right-0 mt-2 w-max px-2 py-1 bg-black border border-[#222] text-neutral-400 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        Save history to file (Silent)
                                    </div>
                                </motion.button>

                                <div className="h-4 w-px bg-[#222]" />

                                <div className="relative">
                                    <button
                                        onClick={() => setShowClearConfirm(true)}
                                        className="px-2 py-1 hover:bg-red-500/10 rounded transition-colors text-neutral-500 hover:text-red-400 text-xs flex items-center gap-1.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>CLEAR</span>
                                    </button>

                                    {/* Clear Confirmation Popover */}
                                    <AnimatePresence>
                                        {showClearConfirm && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 5 }}
                                                className="absolute top-full right-0 mt-2 w-64 bg-[#111] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-2"
                                            >
                                                <p className="text-xs text-neutral-300">Are you absolutely sure you want to clear your history? This action cannot be undone.</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-1 bg-[#222] hover:bg-[#333] text-neutral-400 rounded text-xs">Cancel</button>
                                                    <button onClick={handleClear} className="flex-1 py-1 bg-red-900/50 hover:bg-red-800/50 text-red-200 rounded text-xs">Confirm</button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="h-4 w-px bg-[#222]" />

                                <button
                                    onClick={toggleArchive}
                                    className="p-1 hover:bg-[#222] rounded transition-colors text-neutral-400 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {archive.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-3">
                                    <Clock className="w-8 h-8 opacity-20" />
                                    <span className="text-sm">No conversion history found.</span>
                                </div>
                            ) : (
                                displayList.map((item) => {
                                    if ('isBatch' in item) {
                                        // Batch Rendering
                                        const isExpanded = expandedBatches.has(item.sessionId)
                                        // If only 1 item in batch (e.g. user stopped after 1), render as single?
                                        // User logic: "if its a multi file convert, just list the first file name... followed by ..."
                                        // Even if stopped, it was INTENDED as a batch.
                                        // But if only 1 item exists, it looks like a single file.
                                        // Let's render as single if count == 1, unless explicitly tagged?
                                        // Actually, let's stick to user request: "if its a multi file convert... list first file name... colored tag... expand button"

                                        if (item.items.length === 1) {
                                            // Render as Single
                                            const entry = item.items[0]
                                            const Icon = getIcon(entry.type)
                                            return <SingleEntry key={entry.id} entry={entry} Icon={Icon} onOpen={handleOpenFolder} />
                                        }

                                        const firstFile = item.items[0]
                                        const remaining = item.items.length - 1 // 1 shown, so N-1 remaining
                                        const completedCount = item.items.length
                                        const totalScheduled = item.items[0].batchTotal || completedCount // Fallback

                                        return (
                                            <div key={item.sessionId} className="border border-[#1a1a1a] rounded bg-[#0f0f0f] overflow-hidden">
                                                <div
                                                    onClick={() => toggleBatch(item.sessionId)}
                                                    className="flex items-center gap-4 p-3 hover:bg-[#161616] cursor-pointer transition-colors"
                                                >
                                                    <div className="w-8 h-8 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                                                        <Layers className="w-4 h-4 text-blue-400" />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-neutral-300 font-medium text-sm truncate">
                                                                {firstFile.name}{remaining > 0 ? ' ...' : ''}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-1">
                                                            <span>{new Date(item.timestamp).toLocaleString()}</span>
                                                            <span>•</span>
                                                            <span>{completedCount} / {totalScheduled} converted</span>
                                                            {totalScheduled > completedCount && (
                                                                <span className="text-red-400">• Stopped</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </div>

                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: 'auto' }}
                                                            exit={{ height: 0 }}
                                                            className="overflow-hidden border-t border-[#1a1a1a] bg-[#0c0c0c]"
                                                        >
                                                            <div className="p-2 space-y-1">
                                                                {item.items.map(entry => (
                                                                    <SingleEntry
                                                                        key={entry.id}
                                                                        entry={entry}
                                                                        Icon={getIcon(entry.type)}
                                                                        onOpen={handleOpenFolder}
                                                                        isSubItem
                                                                    />
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )
                                    } else {
                                        // Single Item
                                        const Icon = getIcon(item.type)
                                        return <SingleEntry key={item.id} entry={item} Icon={Icon} onOpen={handleOpenFolder} />
                                    }
                                })
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

function SingleEntry({ entry, Icon, onOpen, isSubItem = false }: { entry: ArchiveEntry, Icon: any, onOpen: (p: string) => void, isSubItem?: boolean }) {
    return (
        <div className={`group flex items-center gap-3 p-2 rounded hover:bg-[#1a1a1a] border border-transparent hover:border-[#222] transition-colors ${isSubItem ? 'pl-4' : ''}`}>
            <div className="w-6 h-6 rounded bg-[#161616] flex items-center justify-center shrink-0">
                <Icon className="w-3 h-3 text-neutral-500" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-neutral-400 group-hover:text-neutral-300 truncate font-medium text-xs">{entry.name}</span>
                    <span className="bg-[#1a1a1a] px-1 py-px rounded text-[9px] text-neutral-600">{entry.format}</span>
                </div>
                {!isSubItem && (
                    <div className="flex items-center gap-2 text-[10px] text-neutral-600">
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                )}
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); onOpen(entry.outputPath) }}
                className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/5 hover:text-white text-neutral-500 transition-all"
                title="Open Output"
            >
                <Folder className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}
