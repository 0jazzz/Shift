import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Show the window now that React is ready to paint
getCurrentWindow().show();

// Remove loading screen after React mounts
document.getElementById("loading")?.remove();

// BRIDGE: Route all legacy Electron calls directly to the REAL Rust Backend
// and provide a minimal event/listener surface so existing React code keeps working.
type LegacyListener = (...args: any[]) => void;

const legacyListenerRegistry = new Map<
  string,
  Map<LegacyListener, Promise<() => void>>
>();

function legacyReceive(channel: string, func: LegacyListener) {
  // Replace existing listener for the same (channel, func)
  legacyRemoveListener(channel, func);

  const unlistenPromise = listen(channel, (event) => {
    // Electron-style handlers expect the payload directly
    func((event as any).payload);
  })
    .then((unlisten) => () => unlisten())
    .catch((err) => {
      console.error(`[TAURI EVENT ERROR] listen(${channel}) failed:`, err);
      return () => {};
    });

  let chanMap = legacyListenerRegistry.get(channel);
  if (!chanMap) {
    chanMap = new Map();
    legacyListenerRegistry.set(channel, chanMap);
  }
  chanMap.set(func, unlistenPromise);
}

function legacyRemoveListener(channel: string, func: LegacyListener) {
  const chanMap = legacyListenerRegistry.get(channel);
  const unlistenPromise = chanMap?.get(func);
  if (!chanMap || !unlistenPromise) return;

  chanMap.delete(func);
  unlistenPromise.then((unlisten) => unlisten());

  if (chanMap.size === 0) legacyListenerRegistry.delete(channel);
}

function legacyRemoveAllListeners(channel: string) {
  const chanMap = legacyListenerRegistry.get(channel);
  if (!chanMap) return;

  for (const unlistenPromise of chanMap.values()) {
    unlistenPromise.then((unlisten) => unlisten());
  }

  legacyListenerRegistry.delete(channel);
}

window.electron = {
  invoke: async (channel: string, ...args: any[]) => {
    try {
      if (channel === "getMissingDependencies")
        return await invoke("get_missing_dependencies");
      if (channel === "checkDependencies")
        return await invoke("check_dependencies");
      if (channel === "detectGpus") return await invoke("detect_gpus");
      if (channel === "getTargetFormats")
        return await invoke("get_target_formats", { ext: args[0] });
      if (channel === "startConversion")
        return await invoke("start_conversion", { payload: args[0] });
      if (channel === "downloadDependency")
        return await invoke("download_dependency", { depName: args[0] });
      if (channel === "deleteAllDependencies")
        return await invoke("delete_all_dependencies");
      if (channel === "selectFolder") return await invoke("select_folder");
      if (channel === "saveSilent")
        return await invoke("save_silent", { payload: args[0] });

      console.log(`[UNMAPPED IPC] ${channel}`, args);
      return { success: true };
    } catch (error) {
      console.error(`[TAURI IPC ERROR] ${channel}:`, error);
      // Return empty arrays to prevent mapping crashes
      if (
        channel === "getMissingDependencies" ||
        channel === "checkDependencies" ||
        channel === "detectGpus"
      )
        return [];
      return { success: false, error };
    }
  },
  send: (channel: string, ...args: any[]) => {
    if (channel === "toMain") {
      const data = args[0];
      if (data?.type === "setZoom") {
        // Tauri uses standard CSS for zooming
        (document.body.style as any).zoom = data.scale;
        return;
      }
      if (data?.type === "openFile") {
        invoke("show_item_in_folder", { path: data.path });
        return;
      }
    }
    console.log(`[UNMAPPED SEND] ${channel}`, args);
  },

  on: (channel: string, func: LegacyListener) => {
    legacyReceive(channel, func);
    return () => legacyRemoveListener(channel, func);
  },
  receive: legacyReceive,
  removeListener: legacyRemoveListener,
  removeAllListeners: legacyRemoveAllListeners,

  getPathForFile: (file: any) => file.name,
  showItemInFolder: () => {},
} as any;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
