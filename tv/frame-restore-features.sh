#!/bin/sh
# Run after restoring the registry plans. Restores the observed state of the tested Frame.
# Run: tv exec --script tv/frame-restore-features.sh --arg SNAPSHOT_NAME
set -eu
test "$(id -u)" = 0
name=${1:?Give the snapshot name taken with recipes/snapshot.sh}
case "$name" in ""|*[!A-Za-z0-9_-]*) echo "Invalid snapshot name" >&2; exit 1;; esac
D=/opt/usr/share/quiet-tizen-backups/$name
test -s "$D/.pkgmgr_parser.db"

vconftool set -f -t string db/was/preload_by_country true
vconftool set -f -t bool db/menu/autorun_tv_plus 1
vconftool set -f -t bool db/si_service/voice_recog_enable 1
vconftool set -f -t bool db/multi-assistant/prelaunch_mode 1

sqlite3 -bail /opt/dbspace/.webappservice.db <<'SQL'
BEGIN IMMEDIATE;
CREATE TEMP TABLE quiet_guard(ok INTEGER CHECK(ok=1));
INSERT INTO quiet_guard SELECT count(*)=1 FROM WASConfigTable
 WHERE name='RESERVED_18' AND json_valid(value)
 AND json_type(value,'$.rsp.preloadByCountry')='text'
 AND json_extract(value,'$.rsp.preloadByCountry')='false';
UPDATE WASConfigTable SET value=json_set(value,'$.rsp.preloadByCountry','true')
 WHERE name='RESERVED_18';
DROP TABLE quiet_guard;
COMMIT;
SQL

for pair in 'pisa-service.service pisa-service' 'canalysis-service.service canalysis-daemon' 'slive-provider-daemon.service slive-provider-daemon'; do
    set -- $pair
    unit=$1 marker=$2
    path=/opt/usr/share/systemd/system/$marker
    saved="$D/marker-$marker"
    test -f "$saved" && test -f "$saved.active"
    systemctl cat "$unit" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -Fqx "ConditionPathExists=!$path"
    case "$(cat "$saved")" in
        absent) rm -f "$path";;
        present) test -f "$path";;
        *) echo "Invalid marker backup: $marker" >&2; exit 1;;
    esac
    systemctl reset-failed "$unit" || true
    if [ "$(cat "$D/marker-$marker.active")" = active ]; then systemctl start --no-block "$unit" || true; fi
done

for unit in adagent-service.service com.samsung.tv.context-aware-agent.service com.samsung.tv.context-aware-service.service; do
    state="$D/runtime-$unit.active"
    if [ -f "$state" ] && [ "$(cat "$state")" = active ]; then systemctl start --no-block "$unit" || true; fi
done
echo 'Frame preferences, preload cache, stop markers and previously active selected services restored.'
