import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind CSS v4 は PostCSS 設定ファイルを使わず、Viteプラグインとして組み込む方式。
  // src/index.css の `@import "tailwindcss";` はこのプラグインが解釈してコンパイルする。
  plugins: [react(), tailwindcss()],
  server: {
    // 既定値の localhost（127.0.0.1）だとコンテナ内部からしか listen を受け付けられない。
    // 0.0.0.0 で待ち受けることで、docker-compose.yml の ports 設定によるホストからの
    // ポートフォワード（http://localhost:5173）がコンテナに届くようにする。
    host: true,
    port: 5173,
  },
})
