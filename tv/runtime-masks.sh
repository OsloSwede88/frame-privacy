#!/bin/sh
# Stop services that systemd starts regardless of the app registry. /etc/systemd/system is
# read-only on this firmware, so the masks live in /run and are lost on a full power cut:
# run "apply" again after one.
# Run: tv exec --script tv/runtime-masks.sh --arg apply|restore|status
# user-presence.service is left out on purpose: stopping it soon after a reboot was followed
# twice by the TV dropping off Wi-Fi on the tested Frame.
set -u
test "$(id -u)" = 0
action=${1:?apply, restore or status}
UNITS="wifi-presence.service kpi-logging.service contents-recognition-service.service com.samsung.tv.activity-inference-service.service"
case "$action" in
apply)
    for u in $UNITS; do systemctl mask --runtime "$u" >/dev/null 2>&1; systemctl stop "$u"; done;;
restore)
    for u in $UNITS; do systemctl unmask --runtime "$u" >/dev/null 2>&1; systemctl start --no-block "$u" || true; done;;
status) ;;
*) echo 'Use apply, restore or status' >&2; exit 1;;
esac
for u in $UNITS; do printf '%s %s %s\n' "$u" "$(systemctl is-active "$u")" "$(systemctl is-enabled "$u" 2>/dev/null)"; done
