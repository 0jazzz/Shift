import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react'
import SplashScreen from './components/SplashScreen'

const Header = lazy(() => import('./components/Header'))
const HeroDropZone = lazy(() => import('./components/HeroDropZone'))
const TaskList = lazy(() => import('./components/TaskList'))
const SettingsDrawer = lazy(() => import('./components/SettingsDrawer'))
const SmartDropdown = lazy(() => import('./components/SmartDropdown'))
const FirstRunModal = lazy(() => import('./components/FirstRunModal'))
const Onboarding = lazy(() => import('./components/Onboarding'))
const LogsPanel = lazy(() => import('./components/LogsPanel'))
const ArchivePanel = lazy(() => import('./components/ArchivePanel'))
const MetadataModal = lazy(() => import('./components/MetadataModal'))
import { useAppStore, type Task } from './store/appStore'
import { Play, Trash2, Loader2, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

function App() {
    const { tasks, addTask, updateTask, removeTask, clearCompleted, addLog, addToArchive, removeAllTasks, hasCompletedOnboarding, editingTaskId, setEditingTask } = useAppStore()
    const [missingDeps, setMissingDeps] = useState<string[]>([])
    const [showSplash, setShowSplash] = useState(true)
    const [appReady, setAppReady] = useState(false)
    const [splashKey, setSplashKey] = useState(0)
    const [showFirstRun, setShowFirstRun] = useState(false)
    const [isConverting, setIsConverting] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [showQuitConfirm, setShowQuitConfirm] = useState(false)
    const [batchFormat, setBatchFormat] = useState('Select')
    const shouldStop = useRef(false)
    const pausedRef = useRef(false)
    const pauseResolver = useRef<((value: void | PromiseLike<void>) => void) | null>(null)

    // Splash Screen & Initial Setup
    useEffect(() => {
        // Signal app ready after initial setup completes
        const timer = setTimeout(() => {
            setAppReady(true)
        }, 500)
        return () => clearTimeout(timer)
    }, [])

    // Check dependencies on mount
    useEffect(() => {
        const scale = useAppStore.getState().uiScale
        if (scale !== 1) {
            window.electron?.send('toMain', { type: 'setZoom', scale })
        }

        const checkDeps = async () => {
            if (window.electron?.invoke) {
                const missing = await window.electron.invoke<string[]>('getMissingDependencies')
                setMissingDeps(missing)
                if (missing.length > 0) {
                    setShowFirstRun(true)
                }
            }
        }
        // Only run check here if we are NOT in onboarding mode (returning user)
        // If onboarding, Onboarding component handles it.
        // But if returning user has missing deps, showFirstRun will pop up (which is fine)
        const timeout = setTimeout(checkDeps, 100)
        return () => clearTimeout(timeout)
    }, [])

    // ... (rest of effects and handlers) ...
    // Listen for conversion progress
    useEffect(() => {
        if (!window.electron?.receive) return
        const handler = (data: any) => {
            if (data.type === 'conversionProgress') {
                updateTask(data.taskId, {
                    progress: data.percent,
                    status: data.status
                })
            }
        }
        window.electron.receive('fromMain', handler)
        return () => window.electron?.removeListener?.('fromMain', handler)
    }, [updateTask])

    // Handle file drop
    const handleFileDrop = useCallback(async (files: FileList) => {
        // ... (keep existing logic)
        for (const file of Array.from(files)) {
            const ext = file.name.split('.').pop()?.toLowerCase() || ''
            const filePath = window.electron?.getPathForFile
                ? window.electron.getPathForFile(file)
                : (file as any).path || file.name

            addLog(`Selected file: ${file.name}`)

            let availableFormats: string[] = []
            try {
                if (window.electron?.invoke) {
                    availableFormats = await window.electron.invoke('getTargetFormats', ext)
                }
            } catch (e) {
                console.error('Failed to get target formats', e)
            }

            if (!availableFormats || availableFormats.length === 0) {
                availableFormats = ['MP4', 'MKV', 'MP3', 'JPG', 'PNG', 'PDF', 'DOCX']
            }

            const newTask: Task = {
                id: crypto.randomUUID(),
                file: { name: file.name, path: filePath },
                status: 'ready',
                progress: 0,
                targetFormat: 'Select',
                originalSize: file.size,
                availableFormats
            }
            addTask(newTask)
        }
    }, [addTask, addLog])

    const handleStop = () => {
        if (isPaused) {
            setShowQuitConfirm(true)
        } else {
            setIsPaused(true)
            pausedRef.current = true
            addLog('Conversion paused by user')
        }
    }

    const handleQuitConfirm = async () => {
        const { autoSaveLogs, logs } = useAppStore.getState()
        if (autoSaveLogs && window.electron?.invoke && logs.length > 0) {
            await window.electron.invoke('saveSilent', { type: 'logs', content: logs.join('\n') })
        }
        shouldStop.current = true
        setIsPaused(false)
        pausedRef.current = false
        setShowQuitConfirm(false)
        removeAllTasks()
        if (pauseResolver.current) pauseResolver.current()
    }

    const handleResume = () => {
        setIsPaused(false)
        pausedRef.current = false
        addLog('Resuming conversion...')
        if (pauseResolver.current) pauseResolver.current()
    }

    const handleConvertAll = async () => {
        // ... (keep logic, just copying structure to match replacement target if needed, but I can target smaller chunks)
        // I will use a larger replacement to implement the return block structure
        const tasksToConvert = tasks.filter(t => t.status === 'ready' || t.status === 'error')
        if (tasksToConvert.length === 0) return

        const sessionId = crypto.randomUUID()
        setIsConverting(true)
        setIsPaused(false)
        pausedRef.current = false
        shouldStop.current = false
        addLog(`Starting conversion of ${tasksToConvert.length} file(s)`)

        const currentOutputPaths = useAppStore.getState().outputPaths

        for (let i = 0; i < tasksToConvert.length; i++) {
            const task = tasksToConvert[i]
            if (shouldStop.current) break
            if (pausedRef.current) {
                await new Promise<void>(resolve => {
                    pauseResolver.current = resolve
                })
                if (shouldStop.current) break
            }

            updateTask(task.id, { status: 'converting', progress: 0 })
            const taskIndex = i + 1
            const totalTasks = tasksToConvert.length

            let outputDir = ''
            const fmt = task.targetFormat.toLowerCase()

            if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(fmt)) outputDir = currentOutputPaths.video
            else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(fmt)) outputDir = currentOutputPaths.audio
            else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fmt)) outputDir = currentOutputPaths.image
            else if (['pdf', 'docx', 'txt', 'md'].includes(fmt)) outputDir = currentOutputPaths.doc

            if (!outputDir || outputDir.trim() === '') {
                const filePath = task.file.path
                const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
                const sourceDir = lastSlash > 0 ? filePath.substring(0, lastSlash) : '.'

                let typeFolder = 'Documents'
                if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(fmt)) typeFolder = 'Videos'
                else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(fmt)) typeFolder = 'Audio'
                else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fmt)) typeFolder = 'Images'

                outputDir = `${sourceDir}\\Converted Files\\${typeFolder}`
            }

            try {
                const result = await window.electron.invoke('startConversion', {
                    taskId: task.id,
                    inputPath: task.file.path,
                    targetFormat: task.targetFormat,
                    outputDir,
                    metadata: task.metadata
                }) as { success: boolean; error?: string; outputPath?: string; outputSize?: number }

                if (result.success) {
                    updateTask(task.id, {
                        status: 'done',
                        progress: 100,
                        outputPath: result.outputPath,
                        convertedSize: result.outputSize
                    })

                    let type: 'video' | 'audio' | 'image' | 'doc' = 'doc'
                    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(fmt)) type = 'video'
                    else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(fmt)) type = 'audio'
                    else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fmt)) type = 'image'

                    addToArchive({
                        id: crypto.randomUUID(),
                        name: task.file.name,
                        format: task.targetFormat,
                        timestamp: Date.now(),
                        outputPath: result.outputPath || '',
                        type,
                        sessionId,
                        batchIndex: taskIndex,
                        batchTotal: totalTasks
                    })
                    addLog(`SUCCESS: ${task.file.name} converted successfully`)
                } else {
                    updateTask(task.id, { status: 'error', progress: 0 })
                    addLog(`ERROR: ${task.file.name} - ${result.error}`)
                }
            } catch (error: any) {
                updateTask(task.id, { status: 'error', progress: 0 })
                addLog(`CRITICAL ERROR: ${task.file.name} - ${error.message}`)
            }
        }

        if (shouldStop.current) {
            addLog('Batch conversion stopped by user')
            tasks.filter(t => t.status === 'converting').forEach(t => {
                updateTask(t.id, { status: 'ready', progress: 0 })
            })
        } else {
            addLog('Batch conversion complete')
            const state = useAppStore.getState()
            if (state.autoSaveLogs && window.electron?.invoke && state.logs.length > 0) {
                window.electron.invoke('saveSilent', { type: 'logs', content: state.logs.join('\n') })
                    .then(() => addLog('Logs auto-saved silently.'))
                    .catch(e => console.error(e))
            }
        }

        setIsConverting(false)
        setIsPaused(false)
        setShowQuitConfirm(false)
    }

    const readyCount = tasks.filter(t => t.status === 'ready').length
    const doneCount = tasks.filter(t => t.status === 'done').length

    return (
        <div className="h-screen bg-black text-white flex flex-col select-none overflow-hidden font-sans">
            <AnimatePresence>
                {showSplash && <SplashScreen key={`splash-${splashKey}`} appReady={appReady} onComplete={() => setShowSplash(false)} />}
            </AnimatePresence>

            {/* DEV: Replay utilities */}
            {!showSplash && (
                <div className="fixed bottom-4 right-4 z-[9998] flex gap-2">
                    <button
                        onClick={() => {
                            // Close settings first, let onboarding reopen it on mount
                            useAppStore.setState({ isSettingsOpen: false })
                            // Small delay so the drawer closes before onboarding tries to reopen
                            setTimeout(() => {
                                useAppStore.setState({ hasCompletedOnboarding: false })
                            }, 100)
                        }}
                        className="px-3 py-1.5 text-xs font-mono bg-white/10 hover:bg-white/20 text-white/60 hover:text-white rounded border border-white/10 transition-colors"
                    >
                        ▶ Replay Onboarding
                    </button>
                    <button
                        onClick={() => {
                            setSplashKey(k => k + 1)
                            setAppReady(false)
                            setShowSplash(true)
                            setTimeout(() => setAppReady(true), 500)
                        }}
                        className="px-3 py-1.5 text-xs font-mono bg-white/10 hover:bg-white/20 text-white/60 hover:text-white rounded border border-white/10 transition-colors"
                    >
                        ▶ Replay Splash
                    </button>
                </div>
            )}

            {!showSplash && (
                <Suspense fallback={<div className="h-full bg-black" />}>
                    {/* Onboarding Flow */}
                    <>
                        {/* Main App UI - Always rendered behind onboarding */}
                        <>

                            <Header />
                            <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
                                <HeroDropZone onFileDrop={handleFileDrop} />

                                {/* Queue Header */}
                                {tasks.length > 0 && (
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a] bg-[#111] rounded-t-xl border-x">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold tracking-wider text-neutral-300 text-xs text-nowrap">CONVERSION_QUEUE</span>
                                                <span className="text-neutral-600 text-xs text-nowrap">({tasks.length} tasks)</span>
                                            </div>

                                            <div className="h-4 w-px bg-neutral-800" />

                                            {/* Clear All Button */}
                                            <div className="relative group">
                                                <button
                                                    onClick={removeAllTasks}
                                                    disabled={isConverting}
                                                    className={`flex items-center gap-2 text-[10px] font-medium transition-colors ${isConverting
                                                        ? 'text-neutral-600 cursor-not-allowed'
                                                        : 'text-neutral-500 hover:text-red-400'
                                                        }`}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    <span>CLEAR ALL</span>
                                                </button>
                                                {isConverting && (
                                                    <div className="absolute top-full left-0 mt-2 px-2 py-1 bg-[#222] border border-[#333] text-neutral-300 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                                        Functionality not available during conversion
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Batch Format Selector */}
                                            {tasks.length > 1 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-neutral-400 font-medium whitespace-nowrap">Convert all to:</span>
                                                    {(() => {
                                                        const readyTasks = tasks.filter(t => t.status === 'ready' || t.status === 'error')
                                                        if (readyTasks.length === 0) return null
                                                        let commonFormats = readyTasks[0].availableFormats || ['MP4', 'MKV', 'MP3', 'JPG', 'PNG', 'PDF']
                                                        for (let i = 1; i < readyTasks.length; i++) {
                                                            const TaskFormats = readyTasks[i].availableFormats
                                                            if (TaskFormats) commonFormats = commonFormats.filter(fmt => TaskFormats.includes(fmt))
                                                        }
                                                        if (commonFormats.length === 0) return <span className="text-[10px] text-neutral-600">No common formats</span>
                                                        return (
                                                            <SmartDropdown
                                                                value={batchFormat}
                                                                options={commonFormats}
                                                                onChange={(fmt) => {
                                                                    setBatchFormat(fmt)
                                                                    readyTasks.forEach(t => updateTask(t.id, { targetFormat: fmt }))
                                                                }}
                                                                align="right"
                                                            />
                                                        )
                                                    })()}
                                                </div>
                                            )}

                                            {/* Clear Completed */}
                                            {doneCount > 0 && (
                                                <>
                                                    <div className="h-4 w-px bg-neutral-800" />
                                                    <button
                                                        onClick={clearCompleted}
                                                        className="p-2 rounded hover:bg-white/5 text-neutral-500 hover:text-white transition-colors"
                                                        title="Clear Completed"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Task List */}
                                {tasks.length > 0 && (
                                    <div className="flex-1 min-h-0 border-x border-b border-[#1a1a1a] rounded-b-xl bg-[#0a0a0a]/50 overflow-hidden flex flex-col">
                                        <TaskList
                                            tasks={tasks}
                                            onRemove={removeTask}
                                            onFormatChange={(id, fmt) => updateTask(id, { targetFormat: fmt })}
                                            onEditMetadata={setEditingTask}
                                        />
                                    </div>
                                )}

                                {/* Convert Footer */}
                                {tasks.length > 0 && (
                                    <div className="flex items-center gap-2 h-12 shrink-0">
                                        {/* Main Action Button */}
                                        <motion.button
                                            layout
                                            onClick={isPaused ? handleResume : handleConvertAll}
                                            disabled={readyCount === 0 || (isConverting && tasks.length === 1 && !isPaused)}
                                            className={`h-full rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all relative overflow-hidden group 
                                        ${readyCount > 0 || isConverting
                                                    ? (tasks.length > 1 && isConverting ? 'bg-[#0a0a0a] text-white border border-white/10' : 'bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20')
                                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                                }`}
                                            style={{ flexGrow: 1 }}
                                        >
                                            {isConverting || isPaused ? (
                                                <>
                                                    {/* Progress Bar */}
                                                    {tasks.length > 1 && !isPaused && (
                                                        <motion.div
                                                            className="absolute inset-y-0 left-0 bg-accent/90"
                                                            initial={{ width: 0 }}
                                                            animate={{
                                                                width: `${(() => {
                                                                    const activeTasks = tasks.filter(t => t.status !== 'ready' || isConverting)
                                                                    if (activeTasks.length === 0) return 0
                                                                    const total = activeTasks.reduce((acc, t) => acc + (t.status === 'done' ? 100 : t.progress), 0)
                                                                    return (total / (activeTasks.length * 100)) * 100
                                                                })()}%`
                                                            }}
                                                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                                        />
                                                    )}

                                                    <span className="relative z-10 flex items-center gap-2 drop-shadow-md">
                                                        {!isPaused && <Loader2 className="w-4 h-4 animate-spin" />}
                                                        {tasks.length > 1
                                                            ? (isPaused ? 'Resume Conversion' : `Converting... ${Math.round((() => {
                                                                const activeTasks = tasks.filter(t => t.status !== 'ready' || isConverting)
                                                                if (activeTasks.length === 0) return 0
                                                                const total = activeTasks.reduce((acc, t) => acc + (t.status === 'done' ? 100 : t.progress), 0)
                                                                return (total / (activeTasks.length * 100)) * 100
                                                            })())}%`)
                                                            : (isPaused ? 'Resume' : 'Converting...')}
                                                    </span>
                                                </>
                                            ) : (
                                                <div className="relative z-10 flex items-center gap-2">
                                                    <Play className="w-4 h-4 fill-current" />
                                                    {tasks.length > 1 ? `Convert All (${readyCount})` : 'Convert'}
                                                </div>
                                            )}
                                        </motion.button>

                                        {/* Stop/Quit Button */}
                                        <AnimatePresence>
                                            {(isConverting || isPaused) && (
                                                <motion.button
                                                    layout
                                                    initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                                                    animate={{ width: 'auto', opacity: 1, marginLeft: 8 }}
                                                    exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                                                    onClick={handleStop}
                                                    className={`h-full border rounded-xl flex items-center justify-center whitespace-nowrap overflow-hidden transition-colors px-4
                                                ${isPaused
                                                            ? 'bg-red-500 hover:bg-red-600 text-white border-red-600'
                                                            : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/50 text-red-500'
                                                        }`}
                                                >
                                                    <Square className="w-4 h-4 fill-current" />
                                                    <span className="ml-2 font-medium hidden sm:inline">{isPaused ? 'Quit' : 'Stop'}</span>
                                                </motion.button>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Quit Confirmation Modal */}
                                <AnimatePresence>
                                    {showQuitConfirm && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center font-sans"
                                        >
                                            <motion.div
                                                initial={{ scale: 0.9, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.9, opacity: 0 }}
                                                className="bg-[#111] border border-neutral-800 rounded-xl p-6 shadow-2xl max-w-sm w-full"
                                            >
                                                <h3 className="text-lg font-bold text-white mb-2">Quit Conversion?</h3>
                                                <p className="text-neutral-400 text-sm mb-6">
                                                    This will stop the current process and clear the conversion queue. All unsaved progress will be lost.
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => setShowQuitConfirm(false)}
                                                        className="flex-1 px-4 py-2 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700 font-medium text-sm transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleQuitConfirm}
                                                        className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 font-medium text-sm transition-colors"
                                                    >
                                                        Quit
                                                    </button>
                                                </div>
                                            </motion.div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Modals & Drawers */}
                            <SettingsDrawer />
                            <ArchivePanel />
                            <LogsPanel />
                            <AnimatePresence>
                                {editingTaskId && <MetadataModal />}
                            </AnimatePresence>
                            {showFirstRun && (
                                <FirstRunModal
                                    missingDeps={missingDeps}
                                    onDismiss={() => setShowFirstRun(false)}
                                />
                            )}
                        </>

                        {/* Onboarding Overlay - Only show when FirstRunModal is closed */}
                        {!hasCompletedOnboarding && !showFirstRun && (
                            <AnimatePresence>
                                <Onboarding onComplete={() => useAppStore.getState().completeOnboarding()} />
                            </AnimatePresence>
                        )}
                    </>
                </Suspense>
            )}
        </div>
    )
}

export default App
