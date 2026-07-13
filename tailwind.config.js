/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                void: '#0A0A0A',
                surface: '#171717',
                border: '#262626',
                accent: {
                    DEFAULT: '#1e3a8a', // Deep, muted navy blue (blue-900)
                    glow: '#8B5CF6'
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
