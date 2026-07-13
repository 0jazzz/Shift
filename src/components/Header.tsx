import { Monitor, Minus, X, Square, Settings, Activity, Cpu, Terminal, Clock } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { invoke } from '@tauri-apps/api/core'

export default function Header() {
    const toggleSettings = useAppStore(state => state.toggleSettings)
    const toggleLogs = useAppStore(state => state.toggleLogs)
    const toggleArchive = useAppStore(state => state.toggleArchive)
    const tasks = useAppStore(state => state.tasks)
    const logs = useAppStore(state => state.logs)


    const handleMinimize = () => invoke('window_minimize')
    const handleMaximize = () => invoke('window_maximize')
    const handleClose = () => invoke('window_close')

    const activeCount = tasks.filter(t => t.status === 'converting').length

    return (
        <div
            className="h-9 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center px-3 justify-between font-mono text-xs select-none"
            onPointerDown={(e) => {
                // Start drag if we didn't click a button or interactive element
                if (!(e.target as HTMLElement).closest('button')) {
                    invoke('window_start_dragging')
                }
            }}
        >
            {/* Left: Logo & Status */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-6 h-6 rounded border border-[#222] bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                        <Monitor className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="font-medium text-neutral-300 tracking-wider">SHIFT</span>
                    <span className="text-[10px] text-neutral-600 bg-[#111] px-1.5 py-0.5 rounded">v1.0.0</span>
                </div>

                <div className="h-4 w-px bg-[#222] flex-shrink-0" />

                {/* System Status */}
                <div className="flex items-center gap-3 text-neutral-500 overflow-hidden">
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Activity className={`w-3 h-3 ${activeCount > 0 ? 'text-green-500 animate-pulse' : 'text-neutral-600'}`} />
                        <span className="truncate">{activeCount > 0 ? `ACTIVE:${activeCount}` : 'IDLE'}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Cpu className="w-3 h-3" />
                        <span className="truncate">QUEUE:{tasks.length}</span>
                    </div>
                    <button
                        id="tour-logs-button"
                        onClick={toggleLogs}
                        className={`flex items-center gap-1 hover:text-white transition-colors flex-shrink-0 ${useAppStore.getState().activeFloatingPanel === 'logs' ? 'text-white' : ''}`}
                    >
                        <Terminal className="w-3 h-3" />
                        <span className="truncate">LOGS{logs.length > 0 ? `:${logs.length}` : ''}</span>
                    </button>
                    <button
                        id="tour-archive-button"
                        onClick={toggleArchive}
                        className={`flex items-center gap-1 hover:text-white transition-colors flex-shrink-0 ${useAppStore.getState().activeFloatingPanel === 'archive' ? 'text-white' : ''}`}
                    >
                        <Clock className="w-3 h-3" />
                        <span className="truncate">ARCHIVE</span>
                    </button>
                </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                    onClick={toggleSettings}
                    className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
                >
                    <Settings className="w-3.5 h-3.5 text-neutral-500 hover:text-white" />
                </button>

                <div className="h-4 w-px bg-[#222]" />

                <div className="flex items-center gap-1">
                    <button onClick={handleMinimize} className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors">
                        <Minus className="w-3.5 h-3.5 text-neutral-500 hover:text-white" />
                    </button>
                    <button onClick={handleMaximize} className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors">
                        <Square className="w-3 h-3 text-neutral-500 hover:text-white" />
                    </button>
                    <button onClick={handleClose} className="p-1.5 hover:bg-red-500/20 rounded transition-colors group">
                        <X className="w-3.5 h-3.5 text-neutral-500 group-hover:text-red-400" />
                    </button>
                </div>
            </div>
        </div>
    )
}
