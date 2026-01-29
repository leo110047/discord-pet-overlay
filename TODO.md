# ODANGO (桌面程式) TODO 清單

## 待辦事項

（目前無待辦事項）

---

## 已完成

- v1.0.5 (準備中):
  - 應用程式更名為 ODANGO，更新新 ICON
  - 新增熱鍵喚醒互動模式（Ctrl+O 長按 0.5 秒）
  - 支援視窗位置調整和寬度調整（支援多螢幕）
  - 移除設定頁面的垂直位置調整按鈕
  - 新增版本號同步腳本 `scripts/sync-version.mjs`
  - 支援顯示多隻寵物（每隻獨立移動）
  - 設定介面新增寵物選擇器（多選）
  - 設定頁面改為顯示體型而非經驗值
  - 更新 PetState 類型以配合新 API（species, spritePath, pendingHatch, isActive 等）
  - API 改用 GET /api/me/pets 端點取得所有寵物
  - Sprite 圖片改為使用本地打包資源（public/sprites/）
- v1.0.4: 實作自動更新功能

---

## 備註

- 發布流程：參考 `docs/RELEASE_GUIDE.md`
- 簽名腳本：`scripts/sign-and-upload.sh`
