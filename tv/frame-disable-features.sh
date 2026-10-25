#!/bin/sh
# Frame-specific, guarded follow-up to the app-registry plan.
# Run: tv exec --script tv/frame-disable-features.sh --arg SNAPSHOT_NAME
set -eu
test "$(id -u)" = 0
name=${1:?Give the snapshot name taken with recipes/snapshot.sh}
case "$name" in ""|*[!A-Za-z0-9_-]*) echo "Invalid snapshot name" >&2; exit 1;; esac
D=/opt/usr/share/quiet-tizen-backups/$name
test -s "$D/.pkgmgr_parser.db"
test -s "$D/.webappservice.db"

expect() {
    value=$(vconftool get "$1" 2>&1)
    printf '%s' "$value" | grep -Fq "$2" || {
        echo "Preference changed since snapshot: $1" >&2
        exit 1
    }
}
expect db/was/preload_by_country 'value = true (String)'
expect db/menu/autorun_tv_plus 'value = True (Boolean)'
expect db/si_service/voice_recog_enable 'value = True (Boolean)'
expect db/multi-assistant/prelaunch_mode 'value = True (Boolean)'
expect db/menu/voice/wakeupless_status 'value = 0 (Int32)'
test "$(sqlite3 -readonly /opt/dbspace/.webappservice.db "SELECT count(*) FROM WASConfigTable WHERE name='RESERVED_18' AND json_valid(value) AND json_type(value,'$.rsp.preloadByCountry')='text' AND json_extract(value,'$.rsp.preloadByCountry')='true';")" = 1

vconftool set -f -t string db/was/preload_by_country false
vconftool set -f -t bool db/menu/autorun_tv_plus 0
vconftool set -f -t bool db/si_service/voice_recog_enable 0
vconftool set -f -t bool db/multi-assistant/prelaunch_mode 0
sqlite3 -bail /opt/dbspace/.webappservice.db <<'SQL'
BEGIN IMMEDIATE;
CREATE TEMP TABLE quiet_guard(ok INTEGER CHECK(ok=1));
INSERT INTO quiet_guard SELECT count(*)=1 FROM WASConfigTable
 WHERE name='RESERVED_18' AND json_valid(value)
 AND json_type(value,'$.rsp.preloadByCountry')='text'
 AND json_extract(value,'$.rsp.preloadByCountry')='true';
UPDATE WASConfigTable SET value=json_set(value,'$.rsp.preloadByCountry','false')
 WHERE name='RESERVED_18';
DROP TABLE quiet_guard;
COMMIT;
SQL
test "$(sqlite3 -readonly /opt/dbspace/.webappservice.db 'PRAGMA quick_check;')" = ok

# These exact services were observed active and correspond to selected groups.
for unit in adagent-service.service com.samsung.tv.context-aware-agent.service com.samsung.tv.context-aware-service.service; do
    state="$D/runtime-$unit.active"
    test ! -e "$state" || { echo "Original state already recorded: $unit" >&2; exit 1; }
    systemctl is-active "$unit" > "$state" 2>&1 || true
    systemctl stop --no-block "$unit" || true
done

echo 'Frame feature preferences disabled; preload cache updated; selected active services asked to stop.'
