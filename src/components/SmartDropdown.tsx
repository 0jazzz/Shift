import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'

interface SmartDropdownProps {
    options: string[]
    value: string
    onChange: (val: string) => void
    align?: 'left' | 'right'
}

export default function SmartDropdown({ options, value, onChange, align = 'left' }: SmartDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 bg-surface hover:bg-white/5 px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors text-sm w-32 justify-between"
            >
                <span className="truncate text-white/90">{value}</span>
                <ChevronDown className="w-4 h-4 text-neutral-500" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className={`absolute z-[100] top-full mt-2 w-full bg-[#121212] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden py-1 max-h-64 overflow-y-auto custom-scrollbar ${align === 'right' ? 'right-0' : 'left-0'}`}
                    >
                        {options.map((opt) => (
                            <div
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false) }}
                                className="px-4 py-2 text-sm hover:bg-accent/10 hover:text-accent cursor-pointer flex items-center justify-between transition-colors text-gray-400 hover:text-white"
                            >
                                <span>{opt}</span>
                                {value === opt && <Check className="w-3 h-3 text-accent" />}
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
