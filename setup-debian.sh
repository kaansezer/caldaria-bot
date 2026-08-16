#!/usr/bin/env bash
#
# Caldaria Bot - Debian (systemd) kurulum betigi
#
# Kullanim:
#   sudo bash setup-debian.sh /opt/caldariaBot
#
# Yaptiklari:
#   - Node.js 20 LTS + build araclari kurar (yoksa)
#   - Repoyu klonlar
#   - npm install + production bagimliliklari kurar
#   - .env dosyasini secure sekilde olusturur (etkilesimli)
#   - systemd servisini olusturur ve aktiflestirir
#   - Komutlari global olarak kaydeder (opsiyonel, DISABLE_DEPLOY=1 ile atla)
#

set -euo pipefail

INSTALL_DIR="${1:-/opt/caldariaBot}"
APP_DIR="$INSTALL_DIR/app"
SERVICE_NAME="caldaria-bot"
REPO_URL="https://github.com/kaansezer/caldaria-bot.git"
NODE_MAJOR=20

info()  { echo -e "\e[1;36m[INFO]\e[0m $*"; }
warn()  { echo -e "\e[1;33m[WARN]\e[0m $*"; }
err()   { echo -e "\e[1;31m[ERROR]\e[0m $*" >&2; }

# Yalnizca root olarak calismali
if [[ $EUID -ne 0 ]]; then
  err "Root yetkisi gerekli. Sudo ile calistirin: sudo bash setup-debian.sh"
  exit 1
fi

info "Debian kurulum basliyor -> $APP_DIR"

# --- 1. Node.js 20 LTS kurulumu ---
if ! command -v node >/dev/null 2>&1 || [[ $(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1) -lt $NODE_MAJOR ]]; then
  info "Node.js $NODE_MAJOR.x kuruluyor..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs build-essential python3 make g++ >/dev/null
else
  info "Node.js mevcut: $(node -v)"
fi

# --- 2. Repo kurulumu (@google/genai native bagimliliklari icin git+gcc) ---
apt-get install -y git curl ca-certificates >/dev/null

info "Repo klonlaniyor: $REPO_URL"
mkdir -p "$INSTALL_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  info "Mevcut repo guncelleniyor..."
  git -C "$APP_DIR" pull --ff-only
fi
cd "$APP_DIR"

# --- 3. NPM bagimliliklari ---
info "npm install (production) calistiriliyor..."
npm install --omit=dev

# --- 4. .env olusturma (secure) ---
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  info ".env dosyasi olusturuluyor, bilgileri girin."
  read -rp "  DISCORD_TOKEN: " DISCORD_TOKEN
  read -rp "  CLIENT_ID: " DISCORD_CLIENT_ID
  echo "DISCORD_TOKEN=$DISCORD_TOKEN"     > "$ENV_FILE"
  echo "DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID" >> "$ENV_FILE"
  echo "GEMINI_API_KEY="                  >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  warn "GEMINI_API_KEY bos kaldi. Kullanmak icin: nano $ENV_FILE"
else
  info ".env mevcut (ortucu: $USER)."
fi

# --- 5. systemd servisi ---
SERVICE_UNIT="$APP_DIR/${SERVICE_NAME}.service"
cat > "$SERVICE_UNIT" <<EOF
[Unit]
Description=Caldaria Discord Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/src/index.js
Restart=always
RestartSec=5
EnvironmentFile=$APP_DIR/.env
User=root

# Guvenlik / sertlestirme (opsiyonel)
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
[Install]
WantedBy=multi-user.target
EOF

install -m 644 "$SERVICE_UNIT" "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null
systemctl restart "$SERVICE_NAME" >/dev/null

# --- 6. Komutlari kaydet (opsiyonel) ---
if [[ "${DISABLE_DEPLOY:-0}" != "1" ]]; then
  info "Slash komutlari global olarak kaydediliyor..."
  (cd "$APP_DIR" && node scripts/deploy.js global) || warn "Komut kaydi basarisiz (token/CLIENT_ID kontrol edin)."
else
  info "DISABLE_DEPLOY=1 -> komut kaydi atlandi."
fi

info "Kurulum tamam!"
echo
echo "  Durum:      systemctl status $SERVICE_NAME"
echo "  Loglar:     journalctl -u $SERVICE_NAME -f"
echo "  Yeniden:    systemctl restart $SERVICE_NAME"
echo "  Config:     nano $ENV_FILE"