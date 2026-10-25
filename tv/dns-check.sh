#!/bin/sh
# Ask each DNS server the TV uses about the tracking hosts in blocklist/ and two hosts that must
# keep working. Run on the TV (its own DNS view; a per-device router rule only applies there).
# Run: tv exec --script tv/dns-check.sh
# Blocked looks like 0.0.0.0, 127.0.0.1, NXDOMAIN or your router's block address.
BLOCK="log-config.samsungacr.com log-ingestion-eu.samsungacr.com acr-eu-prd.samsungcloud.tv acr0.samsungcloudsolution.com lcprd1.samsungcloudsolution.net lcprd2.samsungcloudsolution.net rm.samsungqbe.com samsungads.com config.samsungads.com"
KEEP="osb.samsungqbe.com cdn.samsungcloudsolution.com"
for s in $(awk '/^nameserver/{print $2}' /etc/resolv.conf); do
    echo "== DNS server $s"
    for h in $BLOCK; do printf '  should block  %-40s %s\n' "$h" "$(nslookup "$h" "$s" 2>&1 | sed -n '/^Name/,$p' | grep -i '^address' | sed 's/^Address[ 0-9]*: *//' | tr '\n' ' ')"; done
    for h in $KEEP; do printf '  should work   %-40s %s\n' "$h" "$(nslookup "$h" "$s" 2>&1 | sed -n '/^Name/,$p' | grep -i '^address' | sed 's/^Address[ 0-9]*: *//' | tr '\n' ' ')"; done
done
