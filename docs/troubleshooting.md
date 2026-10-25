# Troubleshooting

## The TV drops off Wi-Fi after a restart ("Wireless network disconnected", IP 0.0.0.0)

Seen on the tested TV on 25 October 2026. Two causes were found, both handled in this repo:

1. **`user-presence` stopped shortly after boot.** Twice, the Wi-Fi dropped within minutes of
   stopping it on a freshly restarted TV. It uses the Wi-Fi chip for motion sensing. It is now
   left running; `tv/runtime-masks.sh` does not touch it. If you stopped it, restart the TV.
2. **Roaming to a far access point.** With several access points, the TV joined one at
   -84 dBm and kept failing. Lock the TV to the access point with the best signal (UniFi:
   client → Settings → Lock to Access Point) and give it a fixed IP in the router.

Keep the TV's own IP settings on automatic; set the fixed address in the router instead.

## The TV does not answer (ping, SDB) but the router says it is connected

- Standby: the TV can stop answering for a few minutes while in standby. Wait, or wake it.
- A firewall on your computer (for example LuLu on macOS) may be blocking `ping`, `nc` or Python.
- `arp -n TV_IP` showing `(incomplete)` means the TV is not answering at all; not a firewall.

## `tv.py` says "target not found" or "serial number ... wrong" while port 26101 is open

Reset the SDB connection: `sdb disconnect TV_IP:26101; sdb kill-server; sdb connect TV_IP:26101`.

## Root payload aborts with exit 134

The payload was built for the wrong .NET runtime. The Frame uses .NET Core 3.1:
`python3 tools/build.py payloads --target-framework netcoreapp3.1`.

## After any restart

Step C (runtime masks) lives in `/run`, which is emptied on every restart: a power cut, a
firmware update, a restart from the menu or a long press on the power button. Standby and wake
keep it. The tested TV also restarted on its own during testing, so check rather than assume:
`tv exec --script ../tv/runtime-masks.sh --arg status` (the uptime line shows a restart), then
`--arg apply` if needed. Everything else persists.

## Undo everything

Registry flags first, so services that get restarted are allowed to run (the same order
quiet-tizen's `stop-marker.sh` expects):

1. Each registry plan's `restore.sh`, newest plan first.
2. `frame-restore-features.sh SNAPSHOT`, with the snapshot name used for `frame-disable-features.sh`.
3. `recipes/stop-marker.sh restore UNIT MARKER SNAPSHOT` for each marker, each with the snapshot
   name it was applied with (steps A3 and B).
4. `runtime-masks.sh restore` (or simply restart the TV).
5. Remove the router rule, and turn the menu toggles back on if wanted.

This repo's scripts (steps 2 and 4) are safe to re-run if one stops part-way. quiet-tizen's
plan and marker scripts (steps 1 and 3) deliberately refuse when the state is no longer what they
recorded; if one fails, check `tv/status.sh` before re-running anything.
