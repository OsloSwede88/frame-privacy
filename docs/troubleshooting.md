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

## After a power cut

Step C (runtime masks) is gone. Run `tv exec --script ../tv/runtime-masks.sh --arg apply`, then
`--arg status`. Everything else persists.

## Undo everything

In reverse order: `runtime-masks.sh restore`; `stop-marker.sh restore` for each marker;
`frame-restore-features.sh SNAPSHOT`; each registry plan's `restore.sh` (newest first). Remove
the router rule. Turn the menu toggles back on if wanted.
