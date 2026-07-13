import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Monitor, ArrowRight, Sparkles, FolderArchive, ScrollText, HardDrive, Download, Folder, SlidersHorizontal } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface OnboardingProps {
    onComplete: () => void
}

type StepConfig = {
    title: string
    desc: string
    icon: any
    targetId?: string
    placement?: 'left' | 'right' | 'top' | 'bottom' | 'center'
    inflation?: number
}

export default function Onboarding({ onComplete }: OnboardingProps) {
    // Tour state - simplified, no more dependency checking (handled by FirstRunModal)
    // Tour state
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
    const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const { setSettingsOpen } = useAppStore()

    const tourSteps: StepConfig[] = [
        // Settings sections - Top to Bottom order (visible when drawer opens)
        {
            title: "Auto-Save Preferences",
            desc: "Automatically save your conversion history and logs.",
            icon: Sparkles,
            targetId: "tour-autosave-settings",
            placement: "left",
            inflation: 0
        },
        {
            title: "Output Paths",
            desc: "Organize your converted files into custom folders.",
            icon: Folder,
            targetId: "tour-output-paths",
            placement: "left",
            inflation: 0
        },
        {
            title: "UI Scale",
            desc: "Adjust the interface size to your preference.",
            icon: SlidersHorizontal,
            targetId: "tour-ui-scale",
            placement: "left",
            inflation: 0
        },
        {
            title: "Hardware Acceleration",
            desc: "Select your preferred GPU to speed up conversions.",
            icon: Monitor,
            targetId: "tour-gpu-settings",
            placement: "left",
            inflation: 0
        },
        {
            title: "Installed Dependencies",
            desc: "Check the status of tools like FFmpeg and ImageMagick.",
            icon: HardDrive,
            targetId: "tour-dependencies",
            placement: "left",
            inflation: 0
        },
        {
            title: "Dependency Manager",
            desc: "Repair or reinstall missing dependencies easily.",
            icon: Download,
            targetId: "tour-dependency-manager",
            placement: "left",
            inflation: 0
        },
        // Header items
        {
            title: "Archive",
            desc: "Browse your history of converted files.",
            icon: FolderArchive,
            targetId: "tour-archive-button",
            placement: "bottom",
            inflation: 6
        },
        {
            title: "Activity Logs",
            desc: "Track detailed logs of your conversion tasks.",
            icon: ScrollText,
            targetId: "tour-logs-button",
            placement: "bottom",
            inflation: 6
        },
        {
            title: "Ready to Start!",
            desc: "Drag and drop files to start converting immediately.",
            icon: Sparkles,
            targetId: "tour-dropzone",
            placement: "bottom",
            inflation: 0
        }
    ]

    const settingsDrawerIds = [
        'tour-dependency-manager',
        'tour-dependencies',
        'tour-gpu-settings',
        'tour-ui-scale',
        'tour-output-paths',
        'tour-autosave-settings'
    ]

    // Open settings drawer on mount for the first step
    useEffect(() => {
        setSettingsOpen(true)
    }, [])

    // Step Change Effect — Keep Drawer Open & Track
    useEffect(() => {
        const currentStep = tourSteps[currentStepIndex]
        if (!currentStep.targetId) return

        const isInSettings = settingsDrawerIds.includes(currentStep.targetId)
        const prevStep = currentStepIndex > 0 ? tourSteps[currentStepIndex - 1] : null
        const wasInSettings = prevStep?.targetId && settingsDrawerIds.includes(prevStep.targetId)

        let closeTimer: any

        if (wasInSettings && !isInSettings) {
            // Close drawer instantly
            setSettingsOpen(false)
        } else {
            setSettingsOpen(isInSettings)
        }

        let frameId: number

        // Continuous layout tracking ensures the box stays glued to the element 
        // even if the layout shifts (e.g. when the drawer finally closes)
        const trackAndMeasure = () => {
            const el = document.getElementById(currentStep.targetId!)
            
            if (el) {
                const rect = el.getBoundingClientRect()
                const inf = currentStep.inflation || 0
                // Divide by zoom: getBoundingClientRect returns viewport px,
                // but CSS top/left/clip-path inside a zoomed body use CSS px
                const zoom = parseFloat((document.body.style as any).zoom) || 1
                const newX = (rect.x - inf) / zoom
                const newY = (rect.y - inf) / zoom
                const newW = (rect.width + (inf * 2)) / zoom
                const newH = (rect.height + (inf * 2)) / zoom

                setHighlightRect(prev => {
                    if (!prev || Math.abs(prev.x - newX) > 1 || Math.abs(prev.y - newY) > 1 || Math.abs(prev.width - newW) > 1) {
                        return new DOMRect(newX, newY, newW, newH)
                    }
                    return prev
                })
            }

            frameId = requestAnimationFrame(trackAndMeasure)
        }

        // Wait a frame for React to mount elements if needed, then scroll & start tracking
        requestAnimationFrame(() => {
            const el = document.getElementById(currentStep.targetId!)
            if (el) {
                // Manual scroll: find the nearest scrollable parent and center the element within it
                const scrollContainer = el.closest('.custom-scrollbar') as HTMLElement | null
                if (scrollContainer) {
                    const containerRect = scrollContainer.getBoundingClientRect()
                    const elRect = el.getBoundingClientRect()
                    // Calculate how much to scroll so the element is vertically centered in the container
                    const currentScrollTop = scrollContainer.scrollTop
                    const elTopRelativeToContainer = elRect.top - containerRect.top + currentScrollTop
                    const desiredScrollTop = elTopRelativeToContainer - (containerRect.height / 2) + (elRect.height / 2)
                    scrollContainer.scrollTo({ top: desiredScrollTop, behavior: 'smooth' })
                } else {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
            }
            trackAndMeasure()
        })

        return () => {
            clearTimeout(closeTimer)
            cancelAnimationFrame(frameId)
        }
    }, [currentStepIndex])

    // Resize Handler
    useEffect(() => {
        const handleResize = () => {
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
            resizeTimeoutRef.current = setTimeout(() => {
                const currentStep = tourSteps[currentStepIndex]
                if (currentStep.targetId) {
                    const el = document.getElementById(currentStep.targetId)
                    if (el) {
                        const rect = el.getBoundingClientRect()
                        const inf = currentStep.inflation || 0
                        const zoom = parseFloat((document.body.style as any).zoom) || 1
                        setHighlightRect(new DOMRect(
                            (rect.x - inf) / zoom, (rect.y - inf) / zoom,
                            (rect.width + (inf * 2)) / zoom, (rect.height + (inf * 2)) / zoom
                        ))
                    }
                }
            }, 100)
        }

        window.addEventListener('resize', handleResize)
        return () => {
            window.removeEventListener('resize', handleResize)
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
        }
    }, [currentStepIndex])

    // handleNext: ONLY changes step index. Measurement is centralized in useEffect.
    const handleNext = () => {
        if (currentStepIndex < tourSteps.length - 1) {
            setCurrentStepIndex(prev => prev + 1)
        } else {
            onComplete()
        }
    }

    const getCardPosition = () => {
        if (!highlightRect) return { top: '50%', left: '50%', x: '-50%', y: '-50%' }
        const stepConfig = tourSteps[currentStepIndex]
        const gap = 20
        let pos = { top: 0, left: 0, x: '0%', y: '0%' }

        // Use clientWidth/Height — these are zoom-safe unlike window.innerWidth/Height
        const zoom = parseFloat((document.body.style as any).zoom) || 1
        const vw = window.innerWidth / zoom
        const vh = window.innerHeight / zoom

        switch (stepConfig.placement) {
            case 'left':
                // Position card right next to the highlight's left edge
                pos = {
                    top: highlightRect.top + (highlightRect.height / 2),
                    left: highlightRect.left - gap,
                    x: '-100%',
                    y: '-50%'
                }
                break
            case 'right':
                pos = { top: highlightRect.top + (highlightRect.height / 2), left: highlightRect.right + gap, x: '0%', y: '-50%' }
                break
            case 'bottom':
                pos = { top: highlightRect.bottom + gap, left: highlightRect.left + (highlightRect.width / 2), x: '-50%', y: '0%' }
                break
            case 'top':
                pos = { top: highlightRect.top - gap, left: highlightRect.left + (highlightRect.width / 2), x: '-50%', y: '-100%' }
                break
            default:
                pos = { top: highlightRect.top + (highlightRect.height / 2), left: highlightRect.left + (highlightRect.width / 2), x: '-50%', y: '-50%' }
        }

        const W = 320, H = 250, M = 20
        if (pos.y === '-50%') pos.top = Math.max(H / 2 + M, Math.min(pos.top, vh - H / 2 - M))
        else if (pos.y === '0%') pos.top = Math.max(M, Math.min(pos.top, vh - H - M))
        else if (pos.y === '-100%') pos.top = Math.max(H + M, Math.min(pos.top, vh - M))

        if (pos.x === '-50%') pos.left = Math.max(W / 2 + M, Math.min(pos.left, vw - W / 2 - M))
        else if (pos.x === '0%') pos.left = Math.max(M, Math.min(pos.left, vw - W - M))
        else if (pos.x === '-100%') pos.left = Math.max(W + M, Math.min(pos.left, vw - M))

        return pos
    }

    const cardPos = getCardPosition()
    const snappySpring = { type: "spring" as const, stiffness: 400, damping: 35, restDelta: 1, restSpeed: 10 }
    const isFirstStep = currentStepIndex === 0

    return (
        <div className="fixed inset-0 z-[5000] pointer-events-none">
            {/* Single Clip-Path Mask Overlay - replaces 4 layout-animated quadrants */}
            {highlightRect ? (
                <div 
                    className="absolute inset-0 bg-black/50 pointer-events-auto"
                    style={{
                        clipPath: `polygon(
                            0% 0%, 
                            0% 100%, 
                            ${highlightRect.left}px 100%, 
                            ${highlightRect.left}px ${highlightRect.top}px, 
                            ${highlightRect.right}px ${highlightRect.top}px, 
                            ${highlightRect.right}px ${highlightRect.bottom}px, 
                            ${highlightRect.left}px ${highlightRect.bottom}px, 
                            ${highlightRect.left}px 100%, 
                            100% 100%, 
                            100% 0%
                        )`,
                        transition: isFirstStep 
                            ? 'opacity 0.7s ease' 
                            : 'clip-path 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)'
                    }}
                    onWheel={(e) => {
                        const drawer = document.querySelector('.custom-scrollbar')
                        if (drawer) drawer.scrollTop += e.deltaY
                    }}
                />
            ) : (
                // Fallback full cover if no rect yet
                <div 
                    className="absolute inset-0 bg-black/50 pointer-events-auto"
                    onWheel={(e) => {
                        const drawer = document.querySelector('.custom-scrollbar')
                        if (drawer) drawer.scrollTop += e.deltaY
                    }}
                />
            )}

            {/* Spotlight Highlight Box — pure CSS transition, immune to React re-renders */}
            {highlightRect && (
                <div
                    className="absolute border-2 border-blue-500 rounded-lg bg-transparent pointer-events-none z-10"
                    style={{
                        top: 0,
                        left: 0,
                        transform: `translate(${highlightRect.left}px, ${highlightRect.top}px)`,
                        width: highlightRect.width,
                        height: highlightRect.height,
                        transition: isFirstStep
                            ? 'opacity 0.7s ease'
                            : 'transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), width 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), height 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)',
                        willChange: 'transform, width, height',
                    }}
                />
            )}

            {/* Dialog Card */}
            {highlightRect && (
                <motion.div
                    initial={isFirstStep ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        top: cardPos.top,
                        left: cardPos.left,
                        x: cardPos.x,
                        y: cardPos.y
                    }}
                    transition={{
                        ...snappySpring,
                        opacity: { duration: isFirstStep ? 0.7 : 0.2 }
                    }}
                    style={{ position: 'absolute', zIndex: 50 }}
                    className="pointer-events-auto"
                >
                    <div className="bg-[#0a0a0a] border border-neutral-800 p-5 rounded-xl shadow-2xl w-72 relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full" style={{ filter: 'blur(30px)' }} />

                        <div className="relative z-10 flex flex-col gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                                {(() => {
                                    const Icon = tourSteps[currentStepIndex].icon
                                    return <Icon className="w-4 h-4" />
                                })()}
                            </div>

                            <div className="min-h-[80px]">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentStepIndex}
                                        initial={{ opacity: 0, x: 5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -5 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <h3 className="text-sm font-semibold text-white mb-1">
                                            {tourSteps[currentStepIndex].title}
                                        </h3>
                                        <p className="text-xs text-neutral-400 leading-relaxed">
                                            {tourSteps[currentStepIndex].desc}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-neutral-600">
                                    {currentStepIndex + 1} of {tourSteps.length}
                                </span>
                                <button
                                    onClick={handleNext}
                                    className="bg-white text-black hover:bg-neutral-200 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                    {currentStepIndex === tourSteps.length - 1 ? "Get Started" : "Next"}
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

/*
 * PRESERVED FOR FUTURE USE: App Update Loading Screen
 * 
 * {isUpdating && (
 *     <motion.div className="fixed inset-0 z-[9998] bg-black flex flex-col items-center justify-center">
 *         <div className="w-48 space-y-4 text-center">
 *             <div className="w-6 h-6 mx-auto border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
 *             <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">Updating</p>
 *             <div className="h-0.5 bg-neutral-800 rounded-full overflow-hidden">
 *                 <motion.div className="h-full bg-white" animate={{ width: `${progress}%` }} />
 *             </div>
 *         </div>
 *     </motion.div>
 * )}
 */
