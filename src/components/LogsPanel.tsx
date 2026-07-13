import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { X, Trash2, Copy, Check, Download } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useRef, useEffect, useState } from 'react'

export default function LogsPanel() {
    const isLogsOpen = useAppStore(state => state.isLogsOpen)
    const toggleLogs = useAppStore(state => state.toggleLogs)
    const logs = useAppStore(state => state.logs)
    const clearLogs = useAppStore(state => state.clearLogs)
    const activeFloatingPanel = useAppStore(state => state.activeFloatingPanel)
    const bringToFront = useAppStore(state => state.bringToFront)
    const logRef = useRef<HTMLDivElement>(null)
    const [copied, setCopied] = useState(false)

    // Auto-scroll to bottom
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight
        }
    }, [logs])

    const handleCopy = () => {
        navigator.clipboard.writeText(logs.join('\n'))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const zIndex = activeFloatingPanel === 'logs' ? 60 : 50
    const boundsRef = useRef<HTMLDivElement>(null)
    const dragControls = useDragControls()

    return (
        <AnimatePresence>
            {isLogsOpen && (
                <motion.div
                    key="logs-wrapper"
                    ref={boundsRef}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ zIndex }}
                    className="fixed inset-0 flex items-end justify-end p-4 pointer-events-none"
                >
                    <motion.div
                        key="logs-panel"
                        initial={{ y: 20 }}
                        animate={{ y: 0 }}
                        exit={{ y: 20 }}
                        drag
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={boundsRef}
                        dragMomentum={false}
                        className="w-[500px] h-[300px] bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg shadow-2xl font-mono text-xs flex flex-col overflow-hidden pointer-events-auto"
                    >
                    {/* Header */}
                    <div 
                        onPointerDown={(e) => {
                            dragControls.start(e)
                            bringToFront('logs')
                        }}
                        className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] cursor-move bg-[#0a0a0a]"
                    >
                        <div className="flex items-center gap-2 pointer-events-none">
                            <span className="text-neutral-400">⟩_ LOGS</span>
                            <span className="text-neutral-600 text-[10px]">({logs.length} entries)</span>
                        </div>
                        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                            <button
                                onClick={handleCopy}
                                className="p-1 hover:bg-[#1a1a1a] rounded transition-colors text-neutral-500 hover:text-white"
                                title="Copy logs"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button
                                onClick={async () => {
                                    if (window.electron?.invoke) {
                                        const content = logs.join('\n')
                                        await window.electron.invoke('saveSilent', { type: 'logs', content })
                                    }
                                }}
                                className="p-1 hover:bg-[#1a1a1a] rounded transition-colors text-neutral-500 hover:text-white group relative"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <div className="absolute bottom-full right-0 mb-2 w-max px-2 py-1 bg-black border border-[#222] text-neutral-400 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    Save logs to file
                                </div>
                            </button>
                            <button
                                onClick={clearLogs}
                                className="p-1 hover:bg-[#1a1a1a] rounded transition-colors text-neutral-500 hover:text-white"
                                title="Clear logs"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={toggleLogs}
                                className="p-1 hover:bg-[#1a1a1a] rounded transition-colors text-neutral-500 hover:text-white"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Log Content */}
                    <div
                        ref={logRef}
                        className="flex-1 overflow-y-auto p-3 space-y-0.5 custom-scrollbar"
                    >
                        {logs.length === 0 ? (
                            <div className="text-neutral-600 text-center py-8">
                                No logs yet. Convert a file to see activity.
                            </div>
                        ) : (
                            logs.map((log, i) => (
                                <div
                                    key={i}
                                    className={`
                                        ${log.includes('ERROR') || log.includes('FAIL') ? 'text-red-400' : ''}
                                        ${log.includes('SUCCESS') || log.includes('DONE') ? 'text-green-400' : ''}
                                        ${log.includes('ENGINE') ? 'text-blue-400' : ''}
                                        ${!log.includes('ERROR') && !log.includes('SUCCESS') && !log.includes('ENGINE') ? 'text-neutral-500' : ''}
                                    `}
                                >
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
