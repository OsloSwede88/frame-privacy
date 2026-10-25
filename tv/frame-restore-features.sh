#!/bin/sh
# Undo frame-disable-features.sh: put back the preference values and preload flag recorded in the
# snapshot, and restart the services that were running then. Safe to re-run.
# Order: after restoring the registry plans (newest first), before the stop markers.
# Stop markers are restored separately with recipes/stop-marker.sh restore, each with the
# snapshot name it was applied with.
# Run: tv exec --script tv/frame-restore-features.sh --arg SNAPSHOT_NAME   (same name as disable)
set -eu
test "$(id -u)" = 0
name=${1:?Give the snapshot name used for frame-disable-features.sh}
case "$name" in ""|*[!A-Za-z0-9_-]*) echo "Invalid snapshot name" >&2; exit 1;; esac
D=/opt/usr/share/quiet-tizen-backups/$name
test -s "$D/.webappservice.db" && test -s "$D/preferences-before.txt" || { echo "Snapshot $name is incomplete" >&2; exit 1; }

# preferences-before.txt holds a key line, then its "... value = X (Type)" line (recipes/snapshot.sh).
restore() {
    line=$(grep -A1 -x "$1" "$D/preferences-before.txt" | sed -n 2p)
    v=$(printf '%s' "$line" | sed -n 's/.*value = \(.*\) (.*)$/\1/p')
    case "$2:$v" in
        bool:True) vconftool set -f -t bool "$1" 1;;
        bool:False) vconftool set -f -t bool "$1" 0;;
        string:?*) vconftool set -f -t string "$1" "$v";;
        *) echo "No usable recorded value for $1 ('$line'); left unchanged." >&2; return 1;;
    esac
}
fail=0
restore db/was/preload_by_country string || fail=1
restore db/menu/autorun_tv_plus bool || fail=1
restore db/si_service/voice_recog_enable bool || fail=1
restore db/multi-assistant/prelaunch_mode bool || fail=1

orig=$(sqlite3 -readonly "$D/.webappservice.db" "SELECT json_extract(value,'\$.rsp.preloadByCountry') FROM WASConfigTable WHERE name='RESERVED_18' AND json_valid(value);")
case "$orig" in
    true|false)
        sqlite3 -bail /opt/dbspace/.webappservice.db <<SQL
BEGIN IMMEDIATE;
UPDATE WASConfigTable SET value=json_set(value,'\$.rsp.preloadByCountry','$orig')
 WHERE name='RESERVED_18' AND json_valid(value);
COMMIT;
SQL
        test "$(sqlite3 -readonly /opt/dbspace/.webappservice.db 'PRAGMA quick_check;')" = ok;;
    *) echo "No recorded preloadByCountry in the snapshot; left unchanged." >&2; fail=1;;
esac

for unit in adagent-service.service com.samsung.tv.context-aware-agent.service com.samsung.tv.context-aware-service.service; do
    state="$D/runtime-$unit.active"
    if [ -f "$state" ] && [ "$(cat "$state")" = active ]; then systemctl start --no-block "$unit" || fail=1; fi
done
if [ "$fail" = 0 ]; then echo 'Preferences, preload flag and previously running services restored.'
else echo 'Restore finished with warnings (see above).' >&2; exit 1; fi
