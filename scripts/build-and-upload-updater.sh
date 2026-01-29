#!/bin/bash
# Discord Pet Overlay - 本機建置更新包並上傳
# 此腳本在 GitHub Actions 建置完安裝檔後執行
# 用於產生簽名的更新包（.tar.gz + .sig）並上傳
#
# 用法: ./scripts/build-and-upload-updater.sh <version>
# 範例: ./scripts/build-and-upload-updater.sh v1.0.4
#
# 前提條件:
# 1. GitHub Actions 已建置完成（Release 有 DMG/MSI 安裝檔）
# 2. 本機有私鑰 ~/.tauri/discord-pet-overlay.key
# 3. 已安裝 gh CLI 並登入

set -e

VERSION=${1:-}
if [ -z "$VERSION" ]; then
    echo "用法: $0 <version>"
    echo "範例: $0 v1.0.4"
    exit 1
fi

# 配置
PRIVATE_KEY_PATH="$HOME/.tauri/discord-pet-overlay.key"
PRIVATE_KEY_PASSWORD="tauri2025"
REPO="leo110047/discord-pet-overlay"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Discord Pet Overlay 更新包建置腳本 ==="
echo "版本: $VERSION"
echo "專案目錄: $PROJECT_DIR"
echo ""

# 檢查私鑰
if [ ! -f "$PRIVATE_KEY_PATH" ]; then
    echo "錯誤: 找不到私鑰 $PRIVATE_KEY_PATH"
    echo "請先執行: npx tauri signer generate -w $PRIVATE_KEY_PATH -p \"$PRIVATE_KEY_PASSWORD\""
    exit 1
fi

cd "$PROJECT_DIR"

# 取得版本號（去掉 v）
VERSION_NUM=${VERSION#v}

# 確認 tauri.conf.json 版本
CONF_VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
if [ "$CONF_VERSION" != "$VERSION_NUM" ]; then
    echo "警告: tauri.conf.json 版本 ($CONF_VERSION) 與目標版本 ($VERSION_NUM) 不符"
    read -p "是否繼續？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "=== 步驟 1: 建置 macOS aarch64 ==="
TAURI_SIGNING_PRIVATE_KEY="$(cat "$PRIVATE_KEY_PATH")" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$PRIVATE_KEY_PASSWORD" \
npm run tauri build -- --target aarch64-apple-darwin

AARCH64_TAR="src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Discord Pet Overlay.app.tar.gz"
AARCH64_SIG="$AARCH64_TAR.sig"

if [ ! -f "$AARCH64_TAR" ] || [ ! -f "$AARCH64_SIG" ]; then
    echo "錯誤: aarch64 建置失敗"
    exit 1
fi
echo "✓ aarch64 建置完成"

echo ""
echo "=== 步驟 2: 建置 macOS x86_64 ==="
TAURI_SIGNING_PRIVATE_KEY="$(cat "$PRIVATE_KEY_PATH")" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$PRIVATE_KEY_PASSWORD" \
npm run tauri build -- --target x86_64-apple-darwin

X64_TAR="src-tauri/target/x86_64-apple-darwin/release/bundle/macos/Discord Pet Overlay.app.tar.gz"
X64_SIG="$X64_TAR.sig"

if [ ! -f "$X64_TAR" ] || [ ! -f "$X64_SIG" ]; then
    echo "錯誤: x86_64 建置失敗"
    exit 1
fi
echo "✓ x86_64 建置完成"

echo ""
echo "=== 步驟 3: 上傳更新包到 Release ==="

# 重命名檔案以包含架構資訊
TEMP_DIR="/tmp/tauri-upload-$VERSION"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

cp "$AARCH64_TAR" "$TEMP_DIR/Discord.Pet.Overlay_${VERSION_NUM}_aarch64.app.tar.gz"
cp "$AARCH64_SIG" "$TEMP_DIR/Discord.Pet.Overlay_${VERSION_NUM}_aarch64.app.tar.gz.sig"
cp "$X64_TAR" "$TEMP_DIR/Discord.Pet.Overlay_${VERSION_NUM}_x64.app.tar.gz"
cp "$X64_SIG" "$TEMP_DIR/Discord.Pet.Overlay_${VERSION_NUM}_x64.app.tar.gz.sig"

echo "上傳 aarch64 更新包..."
gh release upload "$VERSION" --repo "$REPO" \
    "$TEMP_DIR/Discord.Pet.Overlay_${VERSION_NUM}_aarch64.app.tar.gz" \
    "$TEMP_DIR/Discord.Pet.Overlay_${VERSION_NUM}_aarch64.app.tar.gz.sig" \
    --clobber

echo "上傳 x64 更新包..."
gh release upload "$VERSION" --repo "$REPO" \
    "$TEMP_DIR/Discord.Pet.Overlay_${VERSION_NUM}_x64.app.tar.gz" \
    "$TEMP_DIR/Discord.Pet.Overlay_${VERSION_NUM}_x64.app.tar.gz.sig" \
    --clobber

echo ""
echo "=== 步驟 4: 產生並上傳 latest.json ==="

# 讀取簽名
AARCH64_SIG_CONTENT=$(cat "$AARCH64_SIG")
X64_SIG_CONTENT=$(cat "$X64_SIG")

# 檢查是否有 Windows 更新包（從 Release 下載並簽名）
echo "檢查 Windows 更新包..."
WINDOWS_SIG_CONTENT=""
WINDOWS_URL=""

# 嘗試從 Release 下載 Windows nsis.zip
WINDOWS_ASSET=$(gh release view "$VERSION" --repo "$REPO" --json assets --jq '.assets[] | select(.name | endswith(".nsis.zip")) | select(.name | endswith(".sig") | not) | .name' 2>/dev/null || echo "")

if [ -n "$WINDOWS_ASSET" ]; then
    echo "找到 Windows 更新包: $WINDOWS_ASSET"
    gh release download "$VERSION" --repo "$REPO" --pattern "$WINDOWS_ASSET" --dir "$TEMP_DIR"

    # 簽名
    npx tauri signer sign --private-key-path "$PRIVATE_KEY_PATH" --password "$PRIVATE_KEY_PASSWORD" "$TEMP_DIR/$WINDOWS_ASSET"

    # 上傳簽名
    gh release upload "$VERSION" --repo "$REPO" "$TEMP_DIR/$WINDOWS_ASSET.sig" --clobber

    WINDOWS_SIG_CONTENT=$(cat "$TEMP_DIR/$WINDOWS_ASSET.sig")
    WINDOWS_URL="https://github.com/$REPO/releases/download/$VERSION/$(echo "$WINDOWS_ASSET" | sed 's/ /%20/g')"
    echo "✓ Windows 簽名完成"
else
    echo "警告: 找不到 Windows 更新包，latest.json 將不包含 Windows 平台"
fi

# 建立 latest.json
cat > "$TEMP_DIR/latest.json" << EOF
{
  "version": "$VERSION_NUM",
  "notes": "v$VERSION_NUM 更新",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$AARCH64_SIG_CONTENT",
      "url": "https://github.com/$REPO/releases/download/$VERSION/Discord.Pet.Overlay_${VERSION_NUM}_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "$X64_SIG_CONTENT",
      "url": "https://github.com/$REPO/releases/download/$VERSION/Discord.Pet.Overlay_${VERSION_NUM}_x64.app.tar.gz"
    }$(if [ -n "$WINDOWS_SIG_CONTENT" ]; then echo ",
    \"windows-x86_64\": {
      \"signature\": \"$WINDOWS_SIG_CONTENT\",
      \"url\": \"$WINDOWS_URL\"
    }"; fi)
  }
}
EOF

echo ""
echo "latest.json 內容:"
cat "$TEMP_DIR/latest.json"
echo ""

gh release upload "$VERSION" --repo "$REPO" "$TEMP_DIR/latest.json" --clobber
echo "✓ latest.json 上傳完成"

echo ""
echo "=== 步驟 5: 發布 Release ==="
read -p "是否將 Release 從 Draft 改為 Published？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh release edit "$VERSION" --repo "$REPO" --draft=false
    echo "✓ Release 已發布"
fi

# 清理
rm -rf "$TEMP_DIR"

echo ""
echo "=== 完成！ ==="
echo "Release: https://github.com/$REPO/releases/tag/$VERSION"
