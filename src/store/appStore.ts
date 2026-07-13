import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Task {
    id: string
    file: { name: string; path: string }
    status: 'ready' | 'converting' | 'done' | 'error'
    progress: number
    targetFormat: string
    originalSize: number
    convertedSize?: number
    outputPath?: string
    availableFormats?: string[]
    metadata?: Record<string, string>
}

export interface ArchiveEntry {
    id: string
    name: string
    format: string
    timestamp: number
    outputPath: string
    type: 'video' | 'image' | 'audio' | 'doc'
    sessionId?: string
    batchIndex?: number
    batchTotal?: number
}

interface AppState {
    tasks: Task[]
    outputPaths: {
        video: string
        audio: string
        image: string
        doc: string
    }
    isSettingsOpen: boolean
    isLogsOpen: boolean
    isArchiveOpen: boolean
    logs: string[]
    archive: ArchiveEntry[]
    uiScale: number
    gpuPreference: string | null
    autoSaveArchive: boolean
    activeFloatingPanel: 'logs' | 'archive' | null
    autoSaveLogs: boolean
    hasCompletedOnboarding: boolean
    editingTaskId: string | null

    // Actions
    addTask: (task: Task) => void
    removeTask: (id: string) => void
    removeAllTasks: () => void
    updateTask: (id: string, updates: Partial<Task>) => void
    setOutputPath: (category: 'video' | 'audio' | 'image' | 'doc', path: string) => void
    toggleSettings: () => void
    setSettingsOpen: (isOpen: boolean) => void
    toggleLogs: () => void
    toggleArchive: () => void
    bringToFront: (panel: 'logs' | 'archive') => void
    setUiScale: (scale: number) => void
    setGpuPreference: (gpu: string | null) => void
    toggleAutoSaveArchive: () => void
    toggleAutoSaveLogs: () => void
    completeOnboarding: () => void
    addLog: (message: string) => void

    clearLogs: () => void
    addToArchive: (entry: ArchiveEntry) => void
    clearArchive: () => void
    clearCompleted: () => void
    setEditingTask: (id: string | null) => void
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            tasks: [],
            outputPaths: {
                video: '',
                audio: '',
                image: '',
                doc: ''
            },
            isSettingsOpen: false,
            isLogsOpen: false,
            isArchiveOpen: false,
            activeFloatingPanel: null,
            logs: [],
            archive: [],
            uiScale: 1.0,

            gpuPreference: null,
            autoSaveArchive: false,
            autoSaveLogs: false,
            hasCompletedOnboarding: false,
            editingTaskId: null,

            addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
            removeTask: (id) => set((state) => ({ tasks: state.tasks.filter(t => t.id !== id) })),
            removeAllTasks: () => set({ tasks: [] }),
            updateTask: (id, updates) => set((state) => ({
                tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
            })),
            setOutputPath: (category, path) => set((state) => ({
                outputPaths: { ...state.outputPaths, [category]: path }
            })),
            toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
            setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
            toggleLogs: () => set((state) => {
                const newState = !state.isLogsOpen
                return {
                    isLogsOpen: newState,
                    activeFloatingPanel: newState ? 'logs' : state.activeFloatingPanel
                }
            }),
            toggleArchive: () => set((state) => {
                const newState = !state.isArchiveOpen
                return {
                    isArchiveOpen: newState,
                    activeFloatingPanel: newState ? 'archive' : state.activeFloatingPanel
                }
            }),
            bringToFront: (panel) => set({ activeFloatingPanel: panel }),
            setUiScale: (scale) => set({ uiScale: scale }),
            setGpuPreference: (gpu) => set({ gpuPreference: gpu }),
            toggleAutoSaveArchive: () => set((state) => ({ autoSaveArchive: !state.autoSaveArchive })),
            toggleAutoSaveLogs: () => set((state) => ({ autoSaveLogs: !state.autoSaveLogs })),
            completeOnboarding: () => set({ hasCompletedOnboarding: true }),
            addLog: (message) => set((state) => ({
                logs: [...state.logs.slice(-100), `[${new Date().toLocaleTimeString()}] ${message}`]
            })),
            clearLogs: () => set({ logs: [] }),
            addToArchive: (entry) => set((state) => ({ archive: [entry, ...state.archive] })),
            clearArchive: () => set({ archive: [] }),
            clearCompleted: () => set((state) => ({ tasks: state.tasks.filter(t => t.status !== 'done') })),
            setEditingTask: (id) => set({ editingTaskId: id }),
        }),
        {
            name: 'shift-storage',
            partialize: (state) => ({
                outputPaths: state.outputPaths,
                archive: state.archive,
                uiScale: state.uiScale,
                gpuPreference: state.gpuPreference,
                autoSaveArchive: state.autoSaveArchive,
                autoSaveLogs: state.autoSaveLogs,
                hasCompletedOnboarding: state.hasCompletedOnboarding
            }),
        }
    )
)
