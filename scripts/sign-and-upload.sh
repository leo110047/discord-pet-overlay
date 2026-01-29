#!/bin/bash
# Discord Pet Overlay - 簽名並上傳更新包腳本
# 用法: ./scripts/sign-and-upload.sh <version>
# 範例: ./scripts/sign-and-upload.sh v1.0.4

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
TEMP_DIR="/tmp/tauri-signing-$VERSION"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Discord Pet Overlay 簽名上傳腳本 ==="
echo "版本: $VERSION"
echo ""

# 檢查私鑰
if [ ! -f "$PRIVATE_KEY_PATH" ]; then
    echo "錯誤: 找不到私鑰 $PRIVATE_KEY_PATH"
    exit 1
fi

# 建立暫存目錄
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "=== 步驟 1: 下載 Release 的更新包 ==="
# 取得 release 的所有 assets
ASSETS=$(gh release view "$VERSION" --repo "$REPO" --json assets --jq '.assets[] | select(.name | endswith(".tar.gz") or endswith(".nsis.zip")) | select(.name | endswith(".sig") | not) | .name')

if [ -z "$ASSETS" ]; then
    echo "錯誤: 找不到任何更新包 (.tar.gz 或 .nsis.zip)"
    echo "請確認 Release $VERSION 已經建置完成"
    exit 1
fi

echo "找到以下更新包:"
echo "$ASSETS"
echo ""

for ASSET in $ASSETS; do
    echo "下載: $ASSET"
    gh release download "$VERSION" --repo "$REPO" --pattern "$ASSET" --dir "$TEMP_DIR"
done

echo ""
echo "=== 步驟 2: 簽名更新包 ==="
for ASSET in $ASSETS; do
    echo "簽名: $ASSET"
    (cd "$PROJECT_DIR" && npx tauri signer sign --private-key-path "$PRIVATE_KEY_PATH" --password "$PRIVATE_KEY_PASSWORD" "$TEMP_DIR/$ASSET")
    echo "  -> 產生 $ASSET.sig"
done

echo ""
echo "=== 步驟 3: 上傳簽名檔 ==="
for ASSET in $ASSETS; do
    SIG_FILE="$ASSET.sig"
    echo "上傳: $SIG_FILE"
    gh release upload "$VERSION" --repo "$REPO" "$TEMP_DIR/$SIG_FILE" --clobber
done

echo ""
echo "=== 步驟 4: 更新 latest.json ==="

# 取得版本號（去掉 v）
VERSION_NUM=${VERSION#v}

# 建立 latest.json
cat > "$TEMP_DIR/latest.json" << EOF
{
  "version": "$VERSION_NUM",
  "notes": "v$VERSION_NUM 更新",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
EOF

# 讀取每個簽名並加入 latest.json
FIRST=true
for ASSET in $ASSETS; do
    SIG_CONTENT=$(cat "$TEMP_DIR/$ASSET.sig")
    URL="https://github.com/$REPO/releases/download/$VERSION/$(echo "$ASSET" | sed 's/ /%20/g')"

    # 判斷平台
    if [[ "$ASSET" == *"aarch64"*".app.tar.gz" ]]; then
        PLATFORM="darwin-aarch64"
    elif [[ "$ASSET" == *"x64"*".app.tar.gz" ]] || [[ "$ASSET" == *"x86_64"*".app.tar.gz" ]]; then
        PLATFORM="darwin-x86_64"
    elif [[ "$ASSET" == *".nsis.zip" ]]; then
        PLATFORM="windows-x86_64"
    else
        echo "警告: 無法判斷 $ASSET 的平台，跳過"
        continue
    fi

    if [ "$FIRST" = true ]; then
        FIRST=false
    else
        echo "," >> "$TEMP_DIR/latest.json"
    fi

    cat >> "$TEMP_DIR/latest.json" << EOF
    "$PLATFORM": {
      "signature": "$SIG_CONTENT",
      "url": "$URL"
    }
EOF
done

cat >> "$TEMP_DIR/latest.json" << EOF

  }
}
EOF

echo "產生的 latest.json:"
cat "$TEMP_DIR/latest.json"
echo ""

# 上傳 latest.json
echo "上傳 latest.json..."
gh release upload "$VERSION" --repo "$REPO" "$TEMP_DIR/latest.json" --clobber

echo ""
echo "=== 完成！ ==="
echo "Release $VERSION 已更新簽名"
echo ""
echo "請到以下網址確認:"
echo "https://github.com/$REPO/releases/tag/$VERSION"

# 清理
rm -rf "$TEMP_DIR"
