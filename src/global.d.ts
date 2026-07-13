export { }

declare global {
    interface Window {
        electron: {
            getPathForFile?: (file: File) => string
            send: (channel: string, data: any) => void
            receive: (channel: string, func: (...args: any[]) => void) => void
            invoke: <T = any>(channel: string, ...args: any[]) => Promise<T>
            removeListener: (channel: string, func: (...args: any[]) => void) => void
        }
    }
}
