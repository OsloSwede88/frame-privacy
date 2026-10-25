#!/bin/sh
# Look up the tracking hosts in blocklist/ and two hosts that must keep working, the way the TV
# itself looks them up. Run on the TV (a per-device router rule only applies there).
# Run: tv exec --script tv/dns-check.sh
# Limitation: the TV's nslookup (toybox) ignores a server argument and always uses the TV's own
# resolver (/etc/resolv.conf, normally the router first). This shows what the TV gets in normal
# use; it does NOT prove that a fallback server such as 8.8.8.8 is filtered too.
# example.com must resolve as well; if it does not, the result is UNREACHABLE and nothing counts:
# no answer is never read as "blocked".
# Verdicts: BLOCKED (block/sinkhole address or no such domain), RESOLVES (a real address),
# TIMEOUT (no answer within 4 s, after one retry). Exit status is non-zero unless all is as expected.
BLOCK="log-config.samsungacr.com log-ingestion-eu.samsungacr.com acr-eu-prd.samsungcloud.tv acr0.samsungcloudsolution.com lcprd1.samsungcloudsolution.net lcprd2.samsungcloudsolution.net rm.samsungqbe.com samsungads.com config.samsungads.com"
KEEP="osb.samsungqbe.com cdn.samsungcloudsolution.com"
# Addresses filters answer with instead of the real one. UniFi really returns the two
# documentation-range addresses (observed on the tested network).
SINKHOLES=" 0.0.0.0 :: 127.0.0.1 ::1 203.0.113.250 2001:db8:1000::fa "
TMP=/tmp/dns-check.$$
mkdir -p "$TMP"
fail=0

# lookup DIR SERVER HOST... : query all hosts at once (the TV has no sub-second sleep and nslookup
# has no timeout option, so sequential lookups would not fit the ~30 s root session), give them
# 4 s, and kill the rest. A killed lookup leaves no ".done" file and counts as TIMEOUT.
# Each attempt writes to its own DIR, so a killed attempt can never mix with the retry.
lookup() {
    d=$TMP/$1 s=$2; shift 2
    rm -rf "$d"; mkdir -p "$d"
    for h in "$@"; do
        ( nslookup "$h" $s > "$d/$h" 2>&1; touch "$d/$h.done" ) &
    done
    n=0
    while [ $n -lt 4 ]; do
        sleep 1; n=$((n + 1)); left=0
        for h in "$@"; do [ -e "$d/$h.done" ] || left=1; done
        [ $left = 0 ] && break
    done
    for p in $(jobs -p); do kill "$p" 2>/dev/null; done
    wait 2>/dev/null
}

# verdict HOST -> sets $verdict and $addrs, from the retry if there was one.
verdict() {
    addrs=; f=$TMP/first/$1
    [ -e "$TMP/retry/$1.done" ] && f=$TMP/retry/$1
    if [ ! -e "$f.done" ]; then verdict=TIMEOUT; return; fi
    addrs=$(sed -n '/^Name/,$p' "$f" | grep -i '^address' | sed 's/^Address[ 0-9]*: *//; s/[][]//g' | tr '\n' ' ')
    if [ -z "$addrs" ]; then
        if grep -qiE "can't resolve|NXDOMAIN|not found|not known" "$f"; then verdict=BLOCKED; addrs='(no such domain)'
        else verdict=TIMEOUT; fi
        return
    fi
    verdict=BLOCKED
    for a in $addrs; do case "$SINKHOLES" in *" $a "*) ;; *) verdict=RESOLVES;; esac; done
}

s=   # no server argument: toybox nslookup would ignore it anyway (see the header)
for pass in once; do
    echo "== The TV's own resolver (nameservers in order: $(awk '/^nameserver/{printf "%s ", $2}' /etc/resolv.conf))"
    rm -rf "$TMP/retry"
    lookup first "$s" example.com $BLOCK $KEEP
    retry=
    for h in example.com $BLOCK $KEEP; do verdict "$h"; [ "$verdict" = TIMEOUT ] && retry="$retry $h"; done
    [ -z "$retry" ] || lookup retry "$s" $retry   # one retry for slow answers
    verdict example.com
    if [ "$verdict" != RESOLVES ]; then
        echo "  UNREACHABLE (example.com: $verdict); results cannot be trusted"
        fail=1; continue
    fi
    for h in $BLOCK; do
        verdict "$h"
        [ "$verdict" = BLOCKED ] && ok=ok || { ok=FAIL; fail=1; }
        printf '  %-4s want BLOCKED   %-34s %-8s %s\n' "$ok" "$h" "$verdict" "$addrs"
    done
    for h in $KEEP; do
        verdict "$h"
        [ "$verdict" = RESOLVES ] && ok=ok || { ok=FAIL; fail=1; }
        printf '  %-4s want RESOLVES  %-34s %-8s %s\n' "$ok" "$h" "$verdict" "$addrs"
    done
done
rm -rf "$TMP"
if [ "$fail" = 0 ]; then echo 'ALL OK'; else echo 'NOT OK: see FAIL / UNREACHABLE lines'; exit 1; fi
