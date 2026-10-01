#!/usr/bin/env bash

set -euo pipefail

if ((EUID == 0)); then
  printf 'Bitte dieses Skript als normaler Desktop-Benutzer, nicht mit sudo, starten.\n' >&2
  exit 1
fi

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly INSTALL_DIR="$HOME/.local/bin"
readonly CONFIG_DIR="$HOME/.config/home-board-kiosk"
readonly AUTOSTART_DIR="$HOME/.config/autostart"
readonly LAUNCHER="$INSTALL_DIR/home-board-kiosk"
readonly CONFIG_FILE="$CONFIG_DIR/environment"
readonly AUTOSTART_FILE="$AUTOSTART_DIR/home-board-kiosk.desktop"
readonly HOME_BOARD_URL="${HOME_BOARD_URL:-https://home.void0.ch/display}"
readonly HDMI_OUTPUT="${HDMI_OUTPUT:-}"

printf '[home-board] Installiere Chromium und HDMI-Werkzeuge …\n'
sudo apt-get update
sudo apt-get install -y chromium wlr-randr

if command -v raspi-config >/dev/null 2>&1; then
  printf '[home-board] Aktiviere Desktop-Autologin …\n'
  if ! sudo raspi-config nonint do_boot_behaviour B4; then
    printf '[home-board] Desktop-Autologin konnte nicht automatisch aktiviert werden.\n' >&2
    printf '[home-board] Bitte in raspi-config unter System Options > Boot aktivieren.\n' >&2
  fi
fi

install -Dm755 "$SCRIPT_DIR/start-raspberry-pi-kiosk.sh" "$LAUNCHER"
mkdir -p "$CONFIG_DIR" "$AUTOSTART_DIR"

{
  printf 'HOME_BOARD_URL=%q\n' "$HOME_BOARD_URL"
  if [[ -n "$HDMI_OUTPUT" ]]; then
    printf 'HDMI_OUTPUT=%q\n' "$HDMI_OUTPUT"
  fi
} >"$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

cat >"$AUTOSTART_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Home Board Kiosk
Comment=Startet das Home Board automatisch im Vollbildmodus
Exec=$LAUNCHER
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

printf '\n[home-board] Installation abgeschlossen.\n'
printf '[home-board] Der Kiosk startet bei der nächsten Anmeldung oder nach einem Neustart automatisch.\n'
printf '[home-board] Zum sofortigen Start: %s\n' "$LAUNCHER"
