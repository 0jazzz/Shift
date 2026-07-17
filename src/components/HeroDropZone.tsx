import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Upload, Folder, FileVideo, FileImage } from 'lucide-react'

interface HeroDropZoneProps {
    onFileDrop?: (files: FileList) => void
}

export default function HeroDropZone({ onFileDrop }: HeroDropZoneProps) {
    const [isDragging, setIsDragging] = useState(false)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        // Handled by native window listener in App.tsx to avoid duplicate entries in desktop.
        // Keep fallback only for browser-only environments to pass compilation checks.
        if (!window.electron && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileDrop?.(e.dataTransfer.files)
        }
    }, [onFileDrop])

    const handleClick = useCallback(async () => {
        if (window.electron?.invoke) {
            try {
                await window.electron.invoke('openDefaultFileManager')
            } catch (e) {
                console.error('Failed to open default file manager:', e)
            }
        }
    }, [])

    return (
        <motion.div
            id="tour-dropzone"
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded border font-mono overflow-hidden cursor-pointer transition-all duration-200
        ${isDragging
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-[#1a1a1a] hover:border-[#2a2a2a] bg-[#0a0a0a]'}`}
        >
            {/* Header Bar */}
            <div className="h-8 bg-[#111] border-b border-[#1a1a1a] flex items-center px-3 gap-2">
                <Upload className={`w-3.5 h-3.5 ${isDragging ? 'text-blue-400' : 'text-neutral-600'}`} />
                <span className="text-xs text-neutral-500">INPUT_HANDLER</span>
                <div className="ml-auto flex items-center gap-2 text-[10px] text-neutral-600">
                    <span className="bg-[#1a1a1a] px-1.5 py-0.5 rounded">DROP</span>
                    <span className="bg-[#1a1a1a] px-1.5 py-0.5 rounded">CLICK</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-8 flex flex-col items-center justify-center">
                <div className="flex items-center gap-6 mb-4">
                    <motion.div
                        animate={{ scale: isDragging ? 1.1 : 1, y: isDragging ? -5 : 0 }}
                        className="w-12 h-12 rounded-lg border border-[#222] bg-[#111] flex items-center justify-center"
                    >
                        <FileVideo className="w-6 h-6 text-blue-400/60" />
                    </motion.div>
                    <motion.div
                        animate={{ scale: isDragging ? 1.15 : 1, y: isDragging ? -8 : 0 }}
                        transition={{ delay: 0.05 }}
                        className="w-14 h-14 rounded-lg border border-[#222] bg-[#111] flex items-center justify-center"
                    >
                        <Folder className={`w-7 h-7 ${isDragging ? 'text-blue-400' : 'text-neutral-500'}`} />
                    </motion.div>
                    <motion.div
                        animate={{ scale: isDragging ? 1.1 : 1, y: isDragging ? -5 : 0 }}
                        transition={{ delay: 0.1 }}
                        className="w-12 h-12 rounded-lg border border-[#222] bg-[#111] flex items-center justify-center"
                    >
                        <FileImage className="w-6 h-6 text-purple-400/60" />
                    </motion.div>
                </div>

                <div className="text-center">
                    <div className="text-sm text-neutral-300 mb-1">
                        {isDragging ? '>> RELEASE TO IMPORT <<' : 'DROP FILES OR CLICK TO BROWSE'}
                    </div>
                    <div className="text-xs text-neutral-600">
                        SUPPORTED: VIDEO | AUDIO | IMAGE | DOCUMENT | 50+ FORMATS
                    </div>
                </div>
            </div>

            {/* Animated Border */}
            {isDragging && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 border-2 border-blue-500 rounded pointer-events-none"
                />
            )}
        </motion.div>
    )
}
