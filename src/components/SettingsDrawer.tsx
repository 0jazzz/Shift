import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Folder, Settings, HardDrive, Download, Check, AlertTriangle, RefreshCw, Monitor, ChevronDown } from 'lucide-react'
import { useAppStore } from '../store/appStore'

// ... existing interfaces ...

// ... SettingsDrawer component ...
// (I will target the specific areas)

// Helper Components

function Section({ label, icon: Icon, children, tooltip, id }: { label: string, icon: any, children: React.ReactNode, tooltip: string, id?: string }) {
    return (
        <div id={id} className="p-4 border-b border-[#1a1a1a]">
            {/* Header with portal tooltip */}
            <PortalTooltip text={tooltip} placement="right">
                <div className="flex items-center gap-2 text-neutral-500 mb-4 w-max cursor-help">
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                </div>
            </PortalTooltip>
            {children}
        </div>
    )
}

function PortalTooltip({ text, children, placement = 'top', xOffset = 0 }: { text: string, children: React.ReactNode, placement?: 'top' | 'right', xOffset?: number }) {
    const [show, setShow] = useState(false)
    const [pos, setPos] = useState({ top: 0, left: 0 })
    const triggerRef = useRef<HTMLDivElement>(null)

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            if (placement === 'right') {
                setPos({
                    top: rect.top + rect.height / 2,
                    left: rect.right + 12 + xOffset
                })
            } else { // This handles 'top' placement
                setPos({
                    top: rect.top - 8,
                    left: rect.left + rect.width / 2 + xOffset
                })
            }
            setShow(true)
        }
    }

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShow(false)}
                className="w-max"
            >
                {children}
            </div>
            {show && createPortal(
                <div
                    style={{
                        top: pos.top,
                        left: pos.left,
                        position: 'fixed',
                        zIndex: 9999,
                        // Always use the intended placement transform since we just shifted the 'left' coordinate
                        transform: placement === 'right' ? 'translateY(-50%)' : 'translate(-50%, -100%)'
                    }}
                    className="pointer-events-none"
                >
                    <div className={`
                        bg-[#222] border border-[#333] text-neutral-300 text-[10px] rounded px-2 py-1.5 shadow-xl
                        ${placement === 'right' ? 'w-max max-w-[240px] leading-tight' : 'whitespace-nowrap'}
                    `}>
                        {text}
                        {/* Arrow */}
                        <div
                            className={`
                                absolute w-0 h-0 border-4 border-transparent
                                ${placement === 'right'
                                    ? 'right-full top-1/2 -translate-y-1/2 border-r-[#222] -mr-px'
                                    : 'top-full left-1/2 -translate-x-1/2 border-t-[#222] -mt-px'
                                }
                            `}
                        />
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}

function Tooltip({ text, placement = 'top' }: { text: string, placement?: 'top' | 'right' }) {
    // ... existing implementation for other tooltips ...
    if (placement === 'right') {
        return (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1.5 bg-[#222] border border-[#333] text-neutral-300 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 w-max max-w-[240px] leading-tight">
                {text}
                <div className="absolute top-1/2 right-full -translate-y-1/2 -mr-px border-4 border-transparent border-r-[#222]" />
            </div>
        )
    }
    return (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#222] border border-[#333] text-neutral-300 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#222]" />
        </div>
    )
}

interface DependencyStatus {
    name: string
    found: boolean
    version: string | null
}

interface GpuInfo {
    name: string
    vendor: string
}

export default function SettingsDrawer() {
    const {
        isSettingsOpen,
        toggleSettings,
        setOutputPath,
        gpuPreference,
        setGpuPreference,
        autoSaveArchive,
        toggleAutoSaveArchive,
        autoSaveLogs,
        toggleAutoSaveLogs,
        uiScale,
        setUiScale,
        outputPaths
    } = useAppStore()

    const [dependencies, setDependencies] = useState<DependencyStatus[]>([])
    const [gpus, setGpus] = useState<GpuInfo[]>([])
    const [isRedownloading, setIsRedownloading] = useState<string | null>(null)

    // Load dependencies and GPUs on mount
    useEffect(() => {
        if (isSettingsOpen && window.electron?.invoke) {
            const timer = setTimeout(() => {
                window.electron.invoke<DependencyStatus[]>('checkDependencies').then(setDependencies)
                window.electron.invoke<GpuInfo[]>('detectGpus').then(gpuList => {
                    setGpus(gpuList)
                    // If preference exists and is in list, use it. Otherwise default to first.
                    if (gpuPreference && gpuList.some(g => g.name === gpuPreference)) {
                        // Already set in store
                    } else if (gpuList.length > 0 && !gpuPreference) {
                        setGpuPreference(gpuList[0].name)
                    }
                })
            }, 350)
            return () => clearTimeout(timer)
        }
    }, [isSettingsOpen])

    const handleRedownload = async (depName: string) => {
        if (!window.electron?.invoke) return
        setIsRedownloading(depName)
        await window.electron.invoke('downloadDependency', depName)
        const deps = await window.electron.invoke<DependencyStatus[]>('checkDependencies')
        setDependencies(deps)
        setIsRedownloading(null)
    }

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={toggleSettings}
                className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-200 ${
                    isSettingsOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            />

            {/* Drawer */}
            <div
                className={`fixed right-0 top-0 h-full w-96 bg-[#0a0a0a] border-l border-[#1a1a1a] z-50 flex flex-col font-mono text-xs overflow-hidden shadow-2xl transition-transform duration-200 ease-out will-change-transform ${
                    isSettingsOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                        {/* Header */}
                        <div className="h-9 bg-[#111] border-b border-[#1a1a1a] flex items-center px-3 justify-between">
                            <div className="flex items-center gap-2 text-neutral-400">
                                <Settings className="w-3.5 h-3.5" />
                                <span className="font-bold tracking-wider">SETTINGS://CONFIG</span>
                            </div>
                            <button onClick={toggleSettings} className="p-1 hover:bg-white/5 rounded transition-colors">
                                <X className="w-4 h-4 text-neutral-500 hover:text-white" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">

                            {/* Archive & Logs Settings */}
                            <Section label="OUTPUT_HANDLING" icon={Folder} tooltip="Configure how your history and logs are saved." id="tour-autosave-settings">
                                <div className="space-y-2">
                                    {/* Auto-Save Archive */}
                                    <div className="flex items-center justify-between bg-[#111] border border-[#222] rounded p-3 group relative hover:border-blue-500/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${autoSaveArchive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-neutral-700'}`} />
                                            <span className="text-neutral-300">Auto-Save Archive</span>
                                        </div>
                                        <button
                                            onClick={toggleAutoSaveArchive}
                                            className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${autoSaveArchive ? 'bg-blue-600' : 'bg-neutral-800'}`}
                                        >
                                            <motion.div
                                                initial={false}
                                                animate={{ x: autoSaveArchive ? 16 : 0 }}
                                                className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow"
                                            />
                                        </button>
                                        <div className="absolute top-full left-0 mt-2 px-2 py-1 bg-black border border-[#222] text-neutral-400 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                                            Automatically save conversion history to .txt file
                                        </div>
                                    </div>

                                    {/* Auto-Save Logs */}
                                    <div className="flex items-center justify-between bg-[#111] border border-[#222] rounded p-3 group relative hover:border-blue-500/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${autoSaveLogs ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-neutral-700'}`} />
                                            <span className="text-neutral-300">Auto-Save Logs</span>
                                        </div>
                                        <button
                                            onClick={toggleAutoSaveLogs}
                                            className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${autoSaveLogs ? 'bg-blue-600' : 'bg-neutral-800'}`}
                                        >
                                            <motion.div
                                                initial={false}
                                                animate={{ x: autoSaveLogs ? 16 : 0 }}
                                                className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow"
                                            />
                                        </button>
                                        <div className="absolute top-full left-0 mt-2 px-2 py-1 bg-black border border-[#222] text-neutral-400 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                                            Automatically save logs to .txt file when queue finishes
                                        </div>
                                    </div>
                                </div>
                            </Section>

                            {/* Output Path Section */}
                            <Section label="OUTPUT_PATHS" icon={Folder} tooltip="Set default directories for converted files by type." id="tour-output-paths">
                                <div className="space-y-4">
                                    {(['video', 'audio', 'image', 'doc'] as const).map((type) => (
                                        <div key={type} className="space-y-1 group relative">
                                            <div className="text-[10px] text-neutral-500 uppercase flex items-center gap-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${type === 'video' ? 'bg-blue-500' :
                                                    type === 'audio' ? 'bg-green-500' :
                                                        type === 'image' ? 'bg-purple-500' :
                                                            'bg-yellow-500'
                                                    }`} />
                                                {type}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={outputPaths[type]}
                                                    readOnly
                                                    placeholder={`Default: ../Converted Files/${type}`}
                                                    className="flex-1 bg-[#111] border border-[#222] rounded px-3 py-2 text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 transition-colors text-xs"
                                                />
                                                <button
                                                    onClick={async () => {
                                                        if (window.electron) {
                                                            const path = await window.electron.invoke('selectFolder')
                                                            if (path) setOutputPath(type, path)
                                                        }
                                                    }}
                                                    className="p-2 bg-[#111] border border-[#222] rounded hover:border-blue-500/50 transition-colors hover:text-white text-neutral-400"
                                                >
                                                    <Folder className="w-3.5 h-3.5" />
                                                </button>
                                                <Tooltip text={`Change save folder for ${type} files.`} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* UI Scale */}
                            <Section label="UI_SCALE" icon={Monitor} tooltip="Adjust the size of the application interface." id="tour-ui-scale">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-neutral-500 text-[10px]">Adjust Zoom</span>
                                    <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-[10px]">
                                        {uiScale.toFixed(1)}x
                                    </span>
                                </div>
                                <div className="relative group">
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.0"
                                        step="0.1"
                                        value={uiScale}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value)
                                            setUiScale(val)
                                            window.electron?.send('toMain', { type: 'setZoom', scale: val })
                                        }}
                                        className="w-full accent-blue-500 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer"
                                    />
                                    <Tooltip text="Drag to resize the application window content." />
                                </div>
                                <div className="flex justify-between text-[10px] text-neutral-600 mt-2">
                                    <span>0.5x</span>
                                    <span>1.0x</span>
                                    <span>2.0x</span>
                                </div>
                            </Section>

                            {/* GPU Selection */}
                            <Section label="GPU_ACCELERATION" icon={Monitor} tooltip="Select which Graphics Processing Unit to use." id="tour-gpu-settings">
                                <div className="relative group">
                                    <div className="relative">
                                        <select
                                            value={gpuPreference || ''}
                                            onChange={(e) => setGpuPreference(e.target.value)}
                                            className="w-full bg-[#111] border border-[#222] rounded px-3 py-2 text-neutral-300 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer hover:bg-[#161616] appearance-none pr-8"
                                        >
                                            {gpus.map((gpu, i) => (
                                                <option 
                                                    key={i} 
                                                    value={gpu.name}
                                                    className="bg-[#111] text-neutral-300"
                                                    style={{ backgroundColor: '#111', color: '#d4d4d4' }}
                                                >
                                                    {gpu.name}
                                                </option>
                                            ))}
                                            {gpus.length === 0 && (
                                                <option 
                                                    value="" 
                                                    className="bg-[#111] text-neutral-300"
                                                    style={{ backgroundColor: '#111', color: '#d4d4d4' }}
                                                >
                                                    Detecting GPUs...
                                                </option>
                                            )}
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                                    </div>
                                    <Tooltip text="Select specific GPU for hardware encoding (NVENC/AMF/QSV)." />
                                </div>
                                <p className="text-neutral-600 mt-2 text-[10px]">
                                    Requires restart to fully apply changes if switching vendors.
                                </p>
                            </Section>

                            {/* Installed Dependencies */}
                            <Section label="INSTALLED_DEPENDENCIES" icon={HardDrive} tooltip="Manage external tools." id="tour-dependencies">
                                <div className="space-y-2">
                                    {dependencies.map((dep) => (
                                        <div
                                            key={dep.name}
                                            className="bg-[#111] border border-[#1a1a1a] rounded p-3 flex items-center gap-3 relative group"
                                        >
                                            <div className={`w-6 h-6 rounded border flex items-center justify-center ${dep.found ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'
                                                }`}>
                                                {dep.found ? (
                                                    <Check className="w-3 h-3 text-green-400" />
                                                ) : (
                                                    <AlertTriangle className="w-3 h-3 text-red-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-neutral-300">{dep.name}</div>
                                                <div className="text-neutral-600 text-[10px] truncate">
                                                    {dep.found ? (dep.version || 'Installed') : 'Not found'}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRedownload(dep.name.toLowerCase())}
                                                disabled={isRedownloading === dep.name.toLowerCase()}
                                                className={`p-1.5 rounded transition-colors ${isRedownloading === dep.name.toLowerCase()
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : 'hover:bg-white/5 text-neutral-500 hover:text-white'
                                                    }`}
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${isRedownloading === dep.name.toLowerCase() ? 'animate-spin' : ''}`} />
                                            </button>
                                            {/* Tooltip removed as requested */}
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* Re-download All */}
                            <div id="tour-dependency-manager" className="p-4 space-y-3">
                                <PortalTooltip text="Global controls for all dependencies." placement="right" xOffset={-5}>
                                    <div className="flex items-center gap-2 text-neutral-500 mb-1 relative group w-max">
                                        <Download className="w-3.5 h-3.5" />
                                        <span>DEPENDENCY_MANAGER</span>
                                    </div>
                                </PortalTooltip>
                                <button
                                    onClick={() => {
                                        dependencies.forEach(dep => {
                                            if (!dep.found) handleRedownload(dep.name.toLowerCase())
                                        })
                                    }}
                                    className="w-full bg-[#111] border border-[#222] rounded px-4 py-2.5 text-neutral-400 hover:text-white hover:border-blue-500/50 transition-colors flex items-center justify-center gap-2 text-xs group relative"
                                >
                                    <Download className="w-4 h-4" />
                                    REINSTALL MISSING DEPENDENCIES
                                </button>

                                <button
                                    onClick={async () => {
                                        if (confirm('Are you sure you want to delete all dependencies? You will need to download them again.')) {
                                            if (window.electron?.invoke) {
                                                await window.electron.invoke('deleteAllDependencies')
                                                const deps = await window.electron.invoke<DependencyStatus[]>('checkDependencies')
                                                setDependencies(deps)
                                            }
                                        }
                                    }}
                                    className="w-full bg-red-500/10 border border-red-500/20 text-red-500 rounded px-4 py-2.5 hover:bg-red-500/20 hover:border-red-500/40 transition-colors flex items-center justify-center gap-2 text-xs group relative"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    DELETE ALL DEPENDENCIES
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-[#1a1a1a] bg-[#080808]">
                            <p className="text-neutral-600 text-center">Shift v1.0.0 | Windows</p>
                        </div>
            </div>
        </>
    )
}
