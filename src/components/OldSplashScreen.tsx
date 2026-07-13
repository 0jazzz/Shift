import { motion } from 'framer-motion'

export default function OldSplashScreen() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden"
        >
            <div className="relative flex items-center justify-center pointer-events-none select-none">
                {/* Main Logo - GPU-optimized */}
                <motion.h1
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: [2, 1, 1], opacity: [0, 1, 1, 0] }}
                    transition={{
                        duration: 2.5,
                        times: [0, 0.3, 0.8, 1],
                        ease: "easeOut"
                    }}
                    className="text-white font-black text-[110px] leading-none z-10"
                    style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        letterSpacing: '-0.07em', // Tighter to ensure connection
                        textShadow: '0 0 1px rgba(255,255,255,0.5)', // Fill the anti-aliasing gap
                        willChange: 'transform, opacity', // GPU hint
                        transform: 'translateZ(0)', // Force GPU layer
                    }}
                >
                    SHIFT
                </motion.h1>

                {/* Simple glow - single layer, no blur animation */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.4, 0.4, 0] }}
                    transition={{ duration: 2.5, times: [0, 0.3, 0.8, 1] }}
                    className="absolute w-[500px] h-[200px] bg-blue-500 rounded-full"
                    style={{
                        filter: 'blur(80px)',
                        willChange: 'opacity',
                        transform: 'translateZ(0)'
                    }}
                />
            </div>
        </motion.div>
    )
}
