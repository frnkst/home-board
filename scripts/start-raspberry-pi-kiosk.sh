#!/usr/bin/env bash

set -u

readonly HOME_BOARD_URL="${HOME_BOARD_URL:-https://home.void0.ch/display}"
readonly HDMI_OUTPUT="${HDMI_OUTPUT:-}"
readonly PROFILE_DIR="${HOME_BOARD_PROFILE_DIR:-$HOME/.config/home-board-kiosk}"
readonly OFF_MINUTES=$((23 * 60 + 30))
readonly ON_MINUTES=$((5 * 60))

log() {
  printf '[home-board] %s\n' "$*"
}

find_browser() {
  local candidate
  for candidate in chromium chromium-browser; do
    if command -v "$candidate" >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  log "Chromium wurde nicht gefunden. Installiere es mit: sudo apt install chromium"
  return 1
}

wayland_output() {
  if [[ -n "$HDMI_OUTPUT" ]]; then
    printf '%s\n' "$HDMI_OUTPUT"
  else
    wlr-randr | awk '/^HDMI-[A-Za-z0-9-]+/ { print $1; exit }'
  fi
}

set_display_power() {
  local power="$1"
  local output

  if [[ -n "${WAYLAND_DISPLAY:-}" ]] && command -v wlr-randr >/dev/null 2>&1; then
    output="$(wayland_output)"
    if [[ -z "$output" ]]; then
      log "Kein HDMI-Ausgang gefunden. Setze HDMI_OUTPUT, zum Beispiel HDMI-A-1."
      return 1
    fi
    if [[ "$power" == "off" ]]; then
      wlr-randr --output "$output" --off
    else
      wlr-randr --output "$output" --on
    fi
  elif [[ -n "${DISPLAY:-}" ]] && command -v xset >/dev/null 2>&1; then
    xset +dpms
    xset dpms force "$power"
    [[ "$power" == "on" ]] && xset -dpms
  elif command -v vcgencmd >/dev/null 2>&1; then
    vcgencmd display_power "$([[ "$power" == "on" ]] && printf 1 || printf 0)" >/dev/null
  else
    log "Keine unterstützte HDMI-Steuerung gefunden (wlr-randr, xset oder vcgencmd)."
    return 1
  fi

  log "Bildschirm $power"
}

monitor_display_schedule() {
  local current_minutes
  local wanted_state
  local current_state=""

  while true; do
    current_minutes=$((10#$(date +%H) * 60 + 10#$(date +%M)))
    if ((current_minutes >= OFF_MINUTES || current_minutes < ON_MINUTES)); then
      wanted_state="off"
    else
      wanted_state="on"
    fi

    if [[ "$wanted_state" != "$current_state" ]]; then
      if set_display_power "$wanted_state"; then
        current_state="$wanted_state"
      fi
    fi
    sleep 30
  done
}

main() {
  local browser
  local schedule_pid
  browser="$(find_browser)" || exit 1
  mkdir -p "$PROFILE_DIR"

  monitor_display_schedule &
  schedule_pid=$!
  trap 'kill "$schedule_pid" 2>/dev/null || true' EXIT INT TERM
  trap 'exit 0' INT TERM

  while true; do
    log "Starte $HOME_BOARD_URL im Kioskmodus"
    "$browser" \
      --kiosk \
      --noerrdialogs \
      --disable-infobars \
      --disable-background-networking \
      --disable-component-update \
      --disable-sync \
      --disable-session-crashed-bubble \
      --disable-translate \
      --disable-vulkan \
      --disable-webgpu \
      --disable-features=Translate,TranslateUI,OptimizationHints,MediaRouter,PushMessaging,WebGPU,Vulkan,DefaultANGLEVulkan,VulkanFromANGLE \
      --lang=de-CH \
      --accept-lang=de-CH,de \
      --password-store=basic \
      --user-data-dir="$PROFILE_DIR" \
      "$HOME_BOARD_URL"
    log "Chromium wurde beendet; Neustart in 5 Sekunden."
    sleep 5
  done
}

main "$@"
