# ODANGO - Discord 桌面寵物

一個 Tauri v2 桌面應用程式，讓你的 Discord 社群互動成為桌面寵物成長的動力。

## 功能特色

- 🐾 **桌面寵物**：可愛的寵物會在螢幕底部走動
- 🐣 **多寵物系統**：從蛋開始孵化，可選擇不同種類的寵物
- 📈 **成長系統**：根據 Discord 活動（訊息、語音、遊戲）累積 XP，寵物會成長進化
- 🔄 **自動同步**：定時輪詢伺服器，寵物會自動成長，無需手動重整
- 🔗 **配對連動**：使用 Discord ID 和 6 位數配對碼連結 Discord Bot
- 💾 **持久儲存**：Token 和設定會自動保存，重啟不需重新配對
- 🖱️ **互動模式**：按住 `Ctrl+O` 0.5 秒進入互動模式，可拖曳視窗位置和調整寬度
- 👁️ **顯示控制**：可隨時顯示或隱藏寵物
- 🚶 **移動控制**：可選擇讓寵物走動或靜止
- 🔔 **系統托盤**：最小化到系統托盤，不佔用工作列
- 🆕 **應用程式內更新**：可在設定頁面檢查並下載更新

## 寵物系統

### 孵化流程

1. 所有用戶從「蛋」開始
2. 累積足夠 XP 後，蛋會孵化
3. 孵化時 Bot 會私訊 3 個隨機寵物選項，由你選擇
4. 選擇後寵物會出現在桌面上

### 進化階段

| 階段 | 說明 |
|------|------|
| 🥚 egg | 初始蛋形態 |
| 🐣 stage1 | 孵化後第一階段 |
| 🐾 stage2 | 第二階段進化（部分寵物） |
| 🌟 stage3 | 最終階段進化（部分寵物） |

*各寵物的進化門檻和可達階段不同*

### XP 獲取方式

| 行為 | XP |
|------|-----|
| 發送訊息 | +1 |
| 語音通話（每分鐘） | +2 |
| 遊戲事件 | +20 |

## 安裝

### 下載安裝檔

從 [Releases](https://github.com/leo110047/discord-pet-overlay/releases) 下載對應平台的安裝檔：

- **macOS**: `ODANGO_x.x.x_aarch64.dmg`（Apple Silicon）或 `ODANGO_x.x.x_x64.dmg`（Intel）
- **Windows**: `ODANGO_x.x.x_x64-setup.exe`

### macOS 注意事項

由於應用程式未經 Apple 簽署，首次開啟時可能會出現安全警告：

1. 右鍵點擊應用程式，選擇「打開」
2. 在彈出的對話框中點擊「打開」
3. 如果 DMG 被系統隔離，請在終端機執行：
   ```bash
   xattr -cr /Applications/ODANGO.app
   ```

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

### 互動模式

按住 `Ctrl+O`（macOS: `Cmd+O`）0.5 秒進入互動模式：

- **拖曳移動**：點擊並拖曳視窗到任意位置
- **調整寬度**：拖曳左右邊緣調整視窗寬度
- **退出**：再次按住 `Ctrl+O` 0.5 秒退出互動模式

### 設定選項

- **重置視窗位置**：將視窗重置回螢幕底部中央
- **顯示寵物**：開關控制是否顯示寵物視窗
- **讓寵物走動**：開關控制寵物是否左右移動
- **選擇顯示的寵物**：如果有多隻寵物，可選擇要顯示哪些

### 系統托盤

- 點擊托盤圖示可開啟設定視窗
- 右鍵選單提供「設定」和「結束」選項

## 開發

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

### 啟動開發模式

```bash
npm run tauri dev
```

### 執行測試

```bash
npm test
```

### 打包

```bash
npm run tauri build
```

產出檔案位於 `src-tauri/target/release/bundle/`

## 專案結構

```
discord-pet-overlay/
├── src/                    # 前端原始碼
│   ├── api/                # API Client
│   │   └── client.ts       # HTTP 請求封裝
│   ├── store/              # 設定儲存
│   │   ├── config.ts       # Tauri Store 封裝
│   │   └── spriteCache.ts  # Sprite 快取
│   ├── anim/               # 動畫系統
│   │   └── pet.ts          # 寵物控制器
│   ├── main.ts             # 主視窗入口
│   ├── settings-window.ts  # 設定視窗
│   ├── interaction-mode.ts # 互動模式（拖曳、縮放）
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

## API 端點

ODANGO 會連接到 Discord Bot 的 API：

| 方法 | 端點 | 說明 |
|------|------|------|
| `POST` | `/api/link/request` | 請求發送配對碼到 Discord 私訊 |
| `POST` | `/api/link/complete` | 驗證配對碼，取得 Token |
| `GET` | `/api/me/pets` | 取得所有寵物狀態（需認證） |
| `GET` | `/assets/*` | 取得寵物 Sprite 圖片 |
| `GET` | `/api/health` | 健康檢查 |
| `GET` | `/update/:target/:arch/:version` | 檢查應用程式更新 |

## 安全聲明

⚠️ **本程式不會蒐集任何鍵盤輸入或個人隱私資料**

- ✅ 只讀取 Discord 行為推導的狀態（訊息數、語音時長、遊戲參與）
- ✅ 所有資料都來自 Discord Bot 的 API
- ✅ Token 儲存在本機，不會上傳到任何第三方服務
- ✅ API 只提供讀取功能，不能修改任何資料
- ❌ 不監控鍵盤輸入
- ❌ 不擷取螢幕畫面
- ❌ 不上傳個人資料

## 疑難排解

### 無法連線到伺服器

1. 確認 Discord Bot 後端正在運行
2. 確認網路連線正常
3. 稍後再試（伺服器可能暫時不可用）

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
3. 點擊「重置視窗位置」按鈕
4. 按住 `Ctrl+O` 進入互動模式，拖曳視窗到可見位置

### macOS DMG 被當成損壞檔

這是因為應用程式未經 Apple 開發者帳號簽署。請在終端機執行：

```bash
xattr -cr /Applications/ODANGO.app
```

或右鍵點擊應用程式選擇「打開」。

## 授權

MIT
