interface Window {
  // In the Tauri port we keep a legacy Electron-like bridge so the React code
  // doesn't have to be rewritten all at once.
  electron: {
    invoke: <T = any>(channel: string, ...args: any[]) => Promise<T>;
    send: (channel: string, ...args: any[]) => void;

    // Preferred subscription API (returns an unsubscribe function)
    on: (channel: string, func: (...args: any[]) => void) => () => void;

    // Legacy aliases still used in some components
    receive: (channel: string, func: (...args: any[]) => void) => void;
    removeListener: (channel: string, func: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;

    getPathForFile: (file: File) => string;
    showItemInFolder: (path: string) => void;
  };
}
