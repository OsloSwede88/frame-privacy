#!/bin/sh
# Read-only privacy status. Changes nothing.
# Run: tv exec --script tv/status.sh
test "$(id -u)" = 0 || echo 'warning: not root, some checks may be empty'
echo "== uptime (s): $(cut -d' ' -f1 /proc/uptime)"
echo '== services (want inactive, except user-presence which is deliberately left running)'
for u in wifi-presence kpi-logging contents-recognition-service com.samsung.tv.activity-inference-service \
         user-presence com.samsung.tv.context-aware-service com.samsung.tv.context-aware-agent \
         pisa-service canalysis-service adagent-service rmdemon; do
    printf '  %-48s %s\n' "$u" "$(systemctl is-active "$u.service" 2>/dev/null)"
done
printf '  %-48s %s\n' 'multi-assistant (app process, no mic expected)' "$(ps -ef | grep -c '[m]ulti-assistant-service')"
echo '== stop markers present'
ls /opt/usr/share/systemd/system/ 2>/dev/null | grep -E 'context-aware|pisa|canalysis|slive' | sed 's/^/  /'
echo '== registry: app_id|app_disable|app_onboot|app_autorestart for privacy-relevant apps'
sqlite3 -readonly /opt/dbspace/.pkgmgr_parser.db "SELECT app_id||'|'||app_disable||'|'||app_onboot||'|'||app_autorestart FROM package_app_info WHERE app_id IN ('com.samsung.tv.acr','com.samsung.tv.canalysis-service','com.samsung.tv.targeted-ad-service','com.samsung.tv.adagent-service','com.samsung.tv.farfieldvoice','com.samsung.tv.google-assistant','com.samsung.tv.iacr','com.samsung.tv.coba.adagent','com.samsung.tv.wakeup-engine-bixby','com.samsung.tv.wakeup-engine-alexa') ORDER BY app_id;" | sed 's/^/  /'
echo '== preferences'
for k in db/si_service/voice_recog_enable db/menu/voice/wakeupless_status db/multi-assistant/prelaunch_mode db/menu/autorun_tv_plus db/was/preload_by_country; do
    printf '  %s: %s\n' "$k" "$(vconftool get "$k" 2>&1 | sed 's/.*value = //')"
done
echo '== processes holding a microphone capture device (want none)'
ls -l /proc/[0-9]*/fd 2>/dev/null | grep -c 'pcmC.*c$' | sed 's/^/  open capture fds: /'
echo '== DNS servers in use'
grep nameserver /etc/resolv.conf | sed 's/^/  /'
