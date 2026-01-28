import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // 防止 Vite 清除 Rust 顯示的錯誤
  clearScreen: false,
  // Tauri 需要知道在開發模式下要連接的 URL
  server: {
    port: 1420,
    strictPort: true,
  },
  // 使用 Tauri CLI 處理環境變數
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri 在 Windows 上使用 Chromium，在 macOS 和 Linux 上使用 WebKit
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // 在 debug 模式下不進行壓縮，方便除錯
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // 在 debug 模式下產生 sourcemap
    sourcemap: !!process.env.TAURI_DEBUG,
    // 多頁面應用設定
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
