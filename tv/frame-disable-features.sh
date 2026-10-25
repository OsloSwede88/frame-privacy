#!/bin/sh
# Turn off voice recognition, assistant prelaunch, TV Plus autorun and country preload, and stop
# the ad agent and context-aware services for this boot. Safe to re-run: settings already off
# are left alone. Refuses if a setting has a value it does not recognise.
# Run: tv exec --script tv/frame-disable-features.sh --arg SNAPSHOT_NAME
# SNAPSHOT_NAME: the snapshot taken with recipes/snapshot.sh just before this step; the undo
# (frame-restore-features.sh) restores the values recorded in it.
set -eu
test "$(id -u)" = 0
name=${1:?Give the snapshot name taken with recipes/snapshot.sh}
case "$name" in ""|*[!A-Za-z0-9_-]*) echo "Invalid snapshot name" >&2; exit 1;; esac
D=/opt/usr/share/quiet-tizen-backups/$name
test -s "$D/.webappservice.db" && test -s "$D/preferences-before.txt" || { echo "Snapshot $name is incomplete" >&2; exit 1; }

# key on off: refuse unless the current value is the expected "on" or already "off".
check() {
    v=$(vconftool get "$1" 2>&1 | sed -n 's/.*value = \(.*\) (.*)$/\1/p')
    case "$v" in "$2"|"$3") ;; *) echo "Unexpected value for $1: '$v'; stop and inspect." >&2; exit 1;; esac
}
check db/was/preload_by_country true false
check db/menu/autorun_tv_plus True False
check db/si_service/voice_recog_enable True False
check db/multi-assistant/prelaunch_mode True False
preload=$(sqlite3 -readonly /opt/dbspace/.webappservice.db "SELECT json_extract(value,'\$.rsp.preloadByCountry') FROM WASConfigTable WHERE name='RESERVED_18' AND json_valid(value);")
case "$preload" in true|false) ;; *) echo "Unexpected preloadByCountry '$preload'; stop and inspect." >&2; exit 1;; esac

# Database first (one transaction), then the independent preference writes. Every write is
# idempotent, so a failure part-way can simply be re-run.
if [ "$preload" = true ]; then
    sqlite3 -bail /opt/dbspace/.webappservice.db <<'SQL'
BEGIN IMMEDIATE;
UPDATE WASConfigTable SET value=json_set(value,'$.rsp.preloadByCountry','false')
 WHERE name='RESERVED_18' AND json_valid(value) AND json_extract(value,'$.rsp.preloadByCountry')='true';
COMMIT;
SQL
    test "$(sqlite3 -readonly /opt/dbspace/.webappservice.db 'PRAGMA quick_check;')" = ok
fi
vconftool set -f -t string db/was/preload_by_country false
vconftool set -f -t bool db/menu/autorun_tv_plus 0
vconftool set -f -t bool db/si_service/voice_recog_enable 0
vconftool set -f -t bool db/multi-assistant/prelaunch_mode 0

# Record which of these services were running (first run only), then ask them to stop.
# Step B (stop markers) keeps the context-aware pair from starting again after a restart.
for unit in adagent-service.service com.samsung.tv.context-aware-agent.service com.samsung.tv.context-aware-service.service; do
    state="$D/runtime-$unit.active"
    test -e "$state" || { systemctl is-active "$unit" > "$state" 2>&1 || true; }
    systemctl stop --no-block "$unit" || true
done
echo 'Feature preferences off; preload cache updated; selected services asked to stop.'
