#!/bin/sh
# Stop services that systemd starts regardless of the app registry. /etc/systemd/system is
# read-only on this firmware, so the masks live in /run and are lost on EVERY restart (power cut,
# firmware update, a restart from the menu or a long press on power). Standby and wake keep them.
# Re-run "apply" after any restart; check with "status" (uptime shows whether it restarted).
# Run: tv exec --script tv/runtime-masks.sh --arg apply|restore|status
# user-presence.service is left out on purpose: stopping it soon after a reboot was followed
# twice by the TV dropping off Wi-Fi on the tested Frame.
set -u
test "$(id -u)" = 0
action=${1:?apply, restore or status}
UNITS="wifi-presence.service kpi-logging.service contents-recognition-service.service com.samsung.tv.activity-inference-service.service"
fail=0
case "$action" in
apply)
    for u in $UNITS; do
        systemctl mask --runtime "$u" >/dev/null || { echo "mask failed: $u" >&2; fail=1; }
        systemctl stop --no-block "$u" || { echo "stop failed: $u" >&2; fail=1; }
    done;;
restore)
    for u in $UNITS; do
        systemctl unmask --runtime "$u" >/dev/null || { echo "unmask failed: $u" >&2; fail=1; }
        systemctl start --no-block "$u" || { echo "start failed: $u" >&2; fail=1; }
    done;;
status) ;;
*) echo 'Use apply, restore or status' >&2; exit 1;;
esac
# Non-blocking stop/start, so wait (max ~10 s, well inside the root session budget) for them to settle.
want=inactive; [ "$action" = restore ] && want=active
if [ "$action" != status ]; then
    i=0
    while [ $i -lt 10 ]; do
        pending=0
        for u in $UNITS; do [ "$(systemctl is-active "$u")" = "$want" ] || pending=1; done
        [ $pending = 0 ] && break
        sleep 1; i=$((i + 1))
    done
fi
echo "uptime_s $(cut -d' ' -f1 /proc/uptime)"
for u in $UNITS; do
    a=$(systemctl is-active "$u"); e=$(systemctl is-enabled "$u" 2>/dev/null)
    printf '%s %s %s\n' "$u" "$a" "$e"
    case "$action" in
        apply) { [ "$a" = inactive ] && [ "$e" = masked-runtime ]; } || fail=1;;
        restore) [ "$e" != masked-runtime ] || fail=1;;
    esac
done
if [ "$fail" != 0 ]; then echo "NOT OK: $action did not complete for every unit" >&2; exit 1; fi
[ "$action" = status ] || echo "OK: $action"
