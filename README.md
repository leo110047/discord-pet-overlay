# Discord 桌面寵物 Overlay

一個 Tauri v2 桌面應用程式，讓你的 Discord 社群互動成為桌面寵物成長的動力。

## 功能特色

- 🐾 **桌面寵物**：一隻會在螢幕底部走動的可愛寵物
- 📈 **成長系統**：根據 Discord 活動（訊息、語音、遊戲）累積 XP，寵物會成長變大
- 🔄 **自動更新**：定時輪詢伺服器，寵物會自動成長，無需手動重整
- 🔗 **配對連動**：使用 Discord ID 和 6 位數配對碼連結 Discord Bot
- 💾 **持久儲存**：Token 和設定會自動保存，重啟不需重新配對
- ⬆️ **位置調整**：可調整寵物在螢幕上的垂直位置
- 👁️ **顯示控制**：可隨時顯示或隱藏寵物
- 🚶 **移動控制**：可選擇讓寵物走動或靜止
- 🔔 **系統托盤**：最小化到系統托盤，不佔用工作列

## 寵物階段

| 階段 | XP 範圍 | 說明 |
|------|---------|------|
| 🥚 Egg | 0 - 199 | 蛋形態，等待孵化 |
| 🐣 Teen | 200 - 799 | 幼年形態 |
| 🐾 Adult | 800+ | 成年形態 |

寵物大小 (scale) = 1.0 + min(XP/1000, 0.6)，最大 1.6 倍

## 安裝依賴

### 系統需求

- **Node.js** 18+
- **Rust** (最新穩定版)
- **macOS**: Xcode Command Line Tools
- **Windows**: Visual Studio Build Tools 2019+

### 安裝 Rust（如果尚未安裝）

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### 安裝專案依賴

```bash
cd discord-pet-overlay
npm install
```

## 開發

### 啟動開發模式

```bash
npm run tauri dev
```

這會同時啟動 Vite 開發伺服器和 Tauri 應用程式。

### 執行測試

```bash
npm test
```

### 執行 Lint

```bash
npm run lint
npm run lint:fix  # 自動修復
```

### 格式化程式碼

```bash
npm run format
```

## 打包

### macOS

```bash
npm run tauri build
```

產出檔案位於 `src-tauri/target/release/bundle/`

### Windows

```bash
npm run tauri build
```

產出檔案位於 `src-tauri/target/release/bundle/`

## 使用方式

### 首次配對

1. **啟動應用程式**
   - 應用程式啟動後會自動開啟設定視窗

2. **輸入 Discord ID**
   - 在 Discord 設定中開啟「開發者模式」
   - 右鍵點擊自己的頭像，選擇「複製 ID」
   - 將 ID 貼到設定視窗的第一個輸入框

3. **取得配對碼**
   - 點擊「發送配對碼」按鈕
   - Bot 會私訊給你一個 6 位數配對碼（有效 10 分鐘）

4. **完成連結**
   - 輸入配對碼到第二個輸入框
   - 點擊「連結」按鈕
   - 連線成功後會顯示「已連線」，寵物會出現在螢幕上

### 設定選項

- **寵物垂直位置**：使用上下箭頭調整寵物在螢幕上的位置
- **顯示寵物**：開關控制是否顯示寵物視窗
- **讓寵物走動**：開關控制寵物是否左右移動

### 系統托盤

- 點擊托盤圖示可開啟設定視窗
- 右鍵選單提供「設定」和「結束」選項

### macOS Dock

- 點擊 Dock 圖示可開啟設定視窗
- 未登入時不會顯示寵物視窗

## 專案結構

```
discord-pet-overlay/
├── src/                    # 前端原始碼
│   ├── api/                # API Client
│   │   └── client.ts       # HTTP 請求封裝
│   ├── store/              # 設定儲存
│   │   └── config.ts       # Tauri Store 封裝
│   ├── anim/               # 動畫系統
│   │   └── pet.ts          # 寵物控制器
│   ├── main.ts             # 主視窗入口
│   ├── settings-window.ts  # 設定視窗
│   ├── styles.css          # 主視窗樣式
│   ├── settings.css        # 設定視窗樣式
│   └── types.ts            # TypeScript 類型
├── src-tauri/              # Tauri 後端（Rust）
│   ├── src/
│   │   ├── main.rs         # 主程式
│   │   └── lib.rs          # 程式庫
│   ├── capabilities/       # 權限設定
│   ├── Cargo.toml          # Rust 依賴
│   └── tauri.conf.json     # Tauri 設定
├── index.html              # 主視窗 HTML
├── settings.html           # 設定視窗 HTML
├── vite.config.ts          # Vite 設定
├── tsconfig.json           # TypeScript 設定
└── package.json
```

## 安全聲明

⚠️ **本程式不會蒐集任何鍵盤輸入或個人隱私資料**

- ✅ 只讀取 Discord 行為推導的狀態（訊息數、語音時長、遊戲參與）
- ✅ 所有資料都來自 Discord Bot 的 API
- ✅ Token 儲存在本機，不會上傳到任何第三方服務
- ✅ API 只提供讀取功能，不能修改任何資料
- ❌ 不監控鍵盤輸入
- ❌ 不擷取螢幕畫面
- ❌ 不上傳個人資料

## API 端點

Overlay 會連接到 Discord Bot 的 API：

| 方法 | 端點 | 說明 |
|------|------|------|
| `POST` | `/api/link/request` | 請求發送配對碼到 Discord 私訊 |
| `POST` | `/api/link/complete` | 驗證配對碼，取得 Token |
| `GET` | `/api/me/pet-state` | 取得寵物狀態（需認證） |
| `GET` | `/api/health` | 健康檢查 |

## 疑難排解

### 無法連線到伺服器

1. 確認 Discord Bot 後端正在運行
2. 確認伺服器 URL 正確（預設 `http://localhost:8787`）
3. 檢查防火牆設定

### 發送配對碼沒反應

1. 確認 Discord ID 格式正確（17-20 位數字）
2. 確認已在 Discord 開啟「允許伺服器成員私訊」
3. 確認後端 Bot 正在運行

### 配對碼無效

- 配對碼有效期為 10 分鐘
- 配對碼只能使用一次
- 請重新點擊「發送配對碼」取得新碼

### 認證過期

- Token 預設有效 30 天
- 過期後請點擊「登出 / 重新配對」重新配對

### 寵物不顯示

1. 確認連線狀態為「已連線」
2. 確認「顯示寵物」開關已開啟
3. 嘗試點擊設定視窗的「重置」按鈕重置位置

## 授權

MIT
