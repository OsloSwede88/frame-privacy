# Instructions for an agent helping someone harden their Samsung Frame

You are helping the owner of a Samsung The Frame TV reduce what it sends to Samsung and what it
senses in the room. Read this file, `README.md` and `docs/findings.md` before acting. Then follow
the phases below in order. Work with the owner: ask for decisions and observations you cannot
make yourself, and do not ask about things this file already settles.

## Ground rules

- Work only on a TV the owner says is theirs, at the IP address they give you. Never scan the
  network for TVs. Never reuse identifiers, IPs or backups from this repository's tested TV.
- Everything here is **verified on one TV only**: Frame 43" `TQ43LS03BGUXXC`, EU firmware
  `T-PTMDEUC-1720.7, BT - S`, Tizen 6.5. Other Frames of 2022 to 2024 are probably similar, but
  app IDs, unit names and file paths must be re-read on the owner's TV before any change.
- Preserve: picture, HDMI, sound, Wi-Fi/Ethernet, Bluetooth, the remote, Art Mode, app
  installation, accessibility, the settings menu (`org.tizen.menu`), and the streaming apps the
  owner uses. Voice control, SmartThings and TV Plus are features the owner may want; ask.
- Every TV change must be reversible: back up first, write the undo before applying, apply one
  group at a time, verify, then continue.
- Never flash firmware, delete system packages, edit `/etc/passwd`, replace Samsung's SDB key,
  or write to read-only system partitions.
- Never put the owner's identifiers (serial, device ID, MAC, Wi-Fi name, account) into commits,
  issues or anything published.
- Report results honestly: separate what you verified on their TV from what this repo says.

## Phase 0: what the owner wants

Ask, in one message: which tier they want (below), which apps and features they rely on
(voice? SmartThings? TV Plus? casting from a phone?), what router or DNS filter they have, and
whether they want the optional launcher. Recommend Tier 1 to everyone; Tier 2 only if they are
comfortable with Developer Mode and a temporary root session.

| Tier | What | Needs | Risk |
|---|---|---|---|
| 1. No root | TV menu privacy toggles + DNS blocking on the router | Remote, router admin | None to the TV |
| 2. Root | Tier 1 + disable apps and services on the TV | Computer, Developer Mode, quiet-tizen | Low, reversible; one known Wi-Fi side effect handled below |

## Phase 1 (Tier 1): menu toggles, done by the owner with the remote

Settings → General (or Support) → Terms & Privacy. Turn off: Viewing Information Services,
Interest-Based Advertisement, Voice Recognition Services, and any "Privacy Choices" /
"Customization Service" items. Menu names vary by year and region; have the owner read out what
they see. Optional: Settings → General → Voice → turn off wake-up/voice assistant.

## Phase 2 (Tier 1): DNS blocking

Use `blocklist/samsung-tv-privacy.txt` and `docs/router.md`. Prefer a rule that applies only to
the TV. Verify from the TV's point of view: with root, run `tv/dns-check.sh`; without root,
check the router's query log after the TV has been on for 10 minutes. Make sure the "do not
block" hosts still resolve, then have the owner open Smart Hub and one streaming app.

Check whether the TV also gets an IPv6 DNS server or a fallback such as 8.8.8.8 (with root:
`cat /etc/resolv.conf`). A per-device rule must catch those too, or the router must redirect
outbound DNS.

## Phase 3 (Tier 2): access

1. Run `./setup.sh`. It clones quiet-tizen at a pinned commit and applies
   `patches/quiet-tizen-frame.patch` (adds `--profile`, and `--target-framework` to the build).
2. Follow `quiet-tizen/docs/02-access.md`: Samsung SDB from Tizen Studio, .NET SDK 6, Developer
   Mode on the TV with **Host PC IP = this computer's IP**, then restart the TV.
3. Build the root payloads for the TV's runtime. On the tested Frame the runtime is .NET Core
   3.1, so: `python3 tools/build.py payloads --target-framework netcoreapp3.1`. The default
   (net6.0) build aborts on that TV with exit 134.
4. Read the firmware string from Settings → Support → About This TV. Do not guess it.
5. Define the helper (inside `quiet-tizen/`):
   ```sh
   tv() { python3 tools/tv.py --host "$TV_IP" --firmware "$TV_FIRMWARE" \
     --profile profiles/tq43ls03bguxxc-1720.7.json "$@"; }
   tv doctor && tv root-check
   ```
6. **If the model or firmware differs from the profile, stop.** Do an inventory
   (`quiet-tizen/docs/01-inventory.md`), copy the profile to a new file for their exact
   model/firmware, keep only app IDs that exist in their registry, and show the owner the
   differences before any change. Never pass a fake `--firmware`.

Root sessions are temporary and limited to about 30 seconds per command: use `exec --script`,
run one session at a time, and never restart the TV inside a session.

## Phase 4 (Tier 2): read-only status

`tv exec --script ../tv/status.sh` and save the output under `.local/` as the "before" record.

## Phase 5 (Tier 2): changes, one group at a time

For each step: fresh snapshot with a new name, generate or write the undo, save the undo on the
TV, apply, verify with `tv/status.sh`, ask the owner to check picture/sound/apps if relevant.

| Step | What | How | Persists after restart? |
|---|---|---|---|
| A | Registry: groups `advertising`, `voice`, `context`, `smart-extras`, `tv-plus`, `privacy-extras` (pick per owner) | `recipes/snapshot.sh` then `tools/plan_cleanup.py --profile ... --groups ...` then apply, as in `quiet-tizen/docs/03-cleanup.md` | Yes |
| A2 | Preferences (voice recognition, prelaunch, TV Plus autorun, preload) | `../tv/frame-disable-features.sh SNAPSHOT` (undo: `frame-restore-features.sh`) | Yes |
| A3 | Stop markers for `pisa-service`, `canalysis-daemon`, `slive-provider-daemon` | `recipes/stop-marker.sh apply UNIT MARKER SNAPSHOT` per profile `stop_markers` | Yes |
| B | Context-aware service and agent | `recipes/stop-marker.sh` with the pairs in profile `context_markers` | Yes |
| C | `wifi-presence` (LAN ARP scans), `kpi-logging`, `contents-recognition-service`, `activity-inference` | `../tv/runtime-masks.sh apply` | **No**: re-run after a full power cut |

Important: the registry flags in step A do **not** stop services that systemd starts on its
own. That is why B and C exist. Always confirm with `status.sh`, not the registry.

Do **not** stop `user-presence.service` (Wi-Fi motion sensing for auto screen-off). On the
tested TV, stopping it shortly after a restart was followed twice by the TV losing Wi-Fi.

## Phase 6: verify after a restart

Have the owner restart the TV (and separately, try standby and wake). Then: `status.sh`,
`runtime-masks.sh status` (expect C to be gone after a full power cut: re-apply),
`dns-check.sh`, and ask the owner to confirm picture, HDMI, sound, remote, Art Mode and their
apps. If the TV drops off Wi-Fi, see `docs/troubleshooting.md`.

## Phase 7: hand over

Give the owner: what changed, what was verified, what is not covered (see "Residual" in
`docs/findings.md`), the undo commands, and the one recurring task (re-apply step C after a
power cut). Keep their backups under `.local/` and on the TV under
`/opt/usr/share/quiet-tizen-backups/`.

## Optional: the launcher

Only if the owner asks. See `launcher/README.md`. It is not needed for privacy.
