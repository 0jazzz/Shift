import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export interface SplashScreenProps {
    appReady?: boolean
    onComplete?: () => void
}

// File extensions distributed evenly around a horizontal ellipse
const extensions = ['.jpg', '.mp4', '.pdf', '.flac', '.png', '.docx', '.zip', '.wav', '.mov', '.gif', '.mkv', '.mp3', '.txt', '.pptx', '.webp', '.avi', '.m4a']
const RX = 260  // horizontal radius
const RY = 80   // vertical radius
const ORBIT_DEGREES = 25
const ORBIT_RAD = (ORBIT_DEGREES * Math.PI) / 180

// Pre-calculate start and end positions for each extension along the ellipse
const orbitalItems = extensions.map((ext, i) => {
    const startAngle = (i / extensions.length) * Math.PI * 2 - Math.PI / 2
    const endAngle = startAngle + ORBIT_RAD
    return {
        ext,
        startX: Math.cos(startAngle) * RX,
        startY: Math.sin(startAngle) * RY,
        endX: Math.cos(endAngle) * RX,
        endY: Math.sin(endAngle) * RY,
    }
})

export default function SplashScreen({ appReady = false, onComplete }: SplashScreenProps) {
    const [minTimeElapsed, setMinTimeElapsed] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setMinTimeElapsed(true), 800)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (minTimeElapsed && appReady && onComplete) {
            const exitTimer = setTimeout(onComplete, 50)
            return () => clearTimeout(exitTimer)
        }
    }, [minTimeElapsed, appReady, onComplete])

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeOut" } }}
            className="fixed inset-0 z-[9999] bg-[#050505] flex items-center justify-center overflow-hidden"
        >
            <div className="relative pointer-events-none select-none">

                {/* Orbital extensions — each moves along the ellipse individually */}
                {orbitalItems.map((item, i) => (
                    <motion.span
                        key={i}
                        className="absolute font-mono text-sm text-neutral-300 whitespace-nowrap drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]"
                        style={{
                            left: '50%',
                            top: '50%',
                            translateX: '-50%',
                            translateY: '-50%',
                            willChange: 'transform, opacity',
                        }}
                        initial={{
                            x: item.startX,
                            y: item.startY,
                            opacity: 0,
                        }}
                        animate={{
                            x: [item.startX, item.startX, item.endX],
                            y: [item.startY, item.startY, item.endY],
                            opacity: [0, 1, 0],
                        }}
                        transition={{
                            duration: 0.7,
                            delay: i * 0.02,
                            times: [0, 0.3, 1],
                            ease: "easeInOut",
                        }}
                    >
                        {item.ext}
                    </motion.span>
                ))}

                {/* SHIFT — reveals at center after orbital ring fades */}
                <motion.h1
                    className="text-white font-black text-[110px] leading-none z-10 relative"
                    style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        textShadow: '0 0 1px rgba(255,255,255,0.5)',
                        willChange: 'transform, opacity, letter-spacing',
                        transform: 'translateZ(0)',
                    }}
                    initial={{ opacity: 0, scale: 1.02, letterSpacing: '0.06em' }}
                    animate={{ opacity: 1, scale: 1, letterSpacing: '-0.05em' }}
                    exit={{ opacity: 0, y: -15, transition: { duration: 0.2, ease: 'easeOut' } }}
                    transition={{ delay: 0.4, duration: 0.3, ease: "easeOut" }}
                >
                    SHIFT
                </motion.h1>

            </div>
        </motion.div>
    )
}
