# What the tested Frame actually does

Audit of one Samsung The Frame 43" (`TQ43LS03BGUXXC`, 2022 model, EU firmware
`T-PTMDEUC-1720.7, BT - S`, build `T-PTMDEUC-REL-202602250226`, Tizen 6.5.0, kernel 5.4.77,
armv7, .NET Core 3.1.3), 21 to 25 October 2026. Method: root shell via quiet-tizen, `strings`
on pulled binaries, systemd and registry inspection, `tcpdump` on the TV with the TV on and in
Art Mode (10 minutes each), and DNS queries from the TV itself. Results for other models or
firmware may differ.

## The "TV sensor" telemetry reported on X (October 2026)

Claim: Samsung TVs send events `EV101 LIGHTSENSOR_ON`, `EV201 SOUNDSENSOR_ON`,
`EV301/EV302 CAMERASENSOR_ON/OFF` through `CLogger::AddEventLogAsync`, module `*_tv_sensor`, to
`lcprd1.samsungcloudsolution.net`.

| Part of the claim | On the tested Frame |
|---|---|
| Event names EV101/201/301/302, module `*_tv_sensor` | **Not found** in about 60 files that use CLogger |
| CLogger logging library | Present and active |
| Upload host `lcprd1.samsungcloudsolution.net` | Present in the KPI collector; looked up about 6 times per 10 min when on, about 40 in Art Mode |
| Other modules on the same pipeline | `20_devicegraph` (Wi-Fi presence: IPs/MACs seen on the LAN), `22_devicegraph` (Bluetooth) |

So the specific sensor events were not present on this build, but the same pipeline was
logging other things. Blocking the upload host and stopping the collectors covers both.

## Running despite an earlier app-registry debloat

Disabling app records (`app_disable`) does not stop services that systemd starts directly.
These were still running after the first debloat:

| Service | What it does | Fix in this repo |
|---|---|---|
| `wifi-presence` | ARP-scans the home network; reports IP/MAC presence as KPI events | Step C (runtime mask) |
| `user-presence` | Motion sensing from Wi-Fi signal (CSI), feeds eco auto power-off | **Left running** (see troubleshooting) |
| `kpi-logging` | Forwards key presses and events to the logger | Step C |
| `contents-recognition-service` | ACR (recognises what is on screen) | Step C + DNS |
| `context-aware-service` / `-agent` | Context suggestions | Step B (stop markers) |
| `activity-inference-service` | Infers activity from usage | Step C |

## Already handled by the registry debloat (verified)

Bixby and Alexa wake-word engines off; `voice_recog_enable` false; no process had a microphone
capture device open; ACR, canalysis (its on-screen logo model was on disk but not loaded), PISA,
ad agent and targeted ads disabled; remote management (`rmdemon`, `rm.samsungqbe.com`) installed
but not running.

## Remote management (rmdemon), decompiled

The service `remote-management.service` runs `/usr/bin/rmdemon`, Samsung's remote-support daemon.
It is one of the things the X thread flags. On the tested TV, how it is gated:

- The unit is `Type=dbus` (bus name `org.tizen.GDBus.RemoteManagement`) with two start conditions,
  either of which must hold, or systemd skips it:
  `ConditionPathExists=|/opt/usr/apps/org.tizen.remote-management/tmp/RMStateFile` (a saved
  "seamless" session) **or** `ConditionPathExists=|/tmp/rmDaemonRun` (the on-screen UI asked for a
  session; it is deleted right after start). Both files were **absent**, so `ConditionResult=no`
  and the daemon was dead even though the boot target that wants it was active. No capture
  artifacts (`/tmp/rm_networkpacket`) existed: it had never run a dump here. The owner had never
  enabled the unit in `/etc`.
- So it is **not** an always-on packet logger. It runs only during a remote-support session, which
  starts with an on-TV PIN flow (the binary has `PinAuthorization` / `PinRequesting` and verifies
  the PIN against the server).
- What it can do once running, as operator-issued commands, not autonomous background work:
  `captureScreen`, remote mouse, and a network packet dump. The dump path is real: the binary
  calls `runTcpdumpWithArgs`, `tcpdump` is present on the TV (`/usr/bin/tcpdump`), and output goes
  to `/tmp/rm_networkpacket/dump.pcap` then `/tmp/networkpacket.tar.bz2`. Decompiling
  `CommandRmSetFiledataSave::startNetworkPacketDump` (radare2): it loads its config and runs the
  dump with **no per-command consent check**; the only gate is session start. Its callers are
  `performJob` (a received command) and `RmStateMachine::SeamlessConnection::doJob`.
- Network gate: its server `rm.samsungqbe.com` is on the block list, so PIN verification and
  upload fail even if it ran.

Residual exposure is therefore an authorized-session one: during a remote-support session the
operator could pull a screen capture or packet dump without a second prompt. Optional extra, since
it disables Samsung's remote phone-support: mask the unit (lost on reboot, like step C):
`tv exec --command 'systemctl mask --runtime remote-management.service'` (undo: `unmask --runtime`).

## Network

- Persistent connections remain to Samsung push (AWS, port 5229) and SmartThings (AWS, 443).
  They are needed for phone casting and SmartThings; not blocked.
- Also seen: streaming apps, Samsung's CDN for app content, and some unidentified CloudFront /
  Akamai traffic in Art Mode.
- The TV's resolver lists the router first and `8.8.8.8` as fallback. In normal use the TV got
  the router's answers (blocked). Whether the block also holds if the TV falls back to 8.8.8.8
  was not tested from the TV itself (its `nslookup` cannot query a specific server). On the
  tested UniFi router, though, devices under a Content Filter rule have all port-53 DNS
  redirected to the filter whatever server they ask (verified from a filtered computer), so the
  fallback is very likely covered. Encrypted DNS (port 853) is not; a firewall rule now blocks
  it for the TV (see docs/router.md).

## Residual risk after all steps

- The TV still runs Samsung's OS and core services; this is not a guarantee that nothing is sent.
- Step C is lost on every restart (not standby) until re-applied, and needs Developer Mode on to re-apply.
- `multi-assistant-service`, sound-AI and camera-related apps remain installed (no mic open, no
  camera on this model).
- Unidentified CDN traffic was not decoded.
- Firmware updates can re-enable things. Re-run `tv/status.sh` after an update.

## Persistence across reboots (why on-TV masks are volatile, and what to do)

Investigated 2026-10-25. Short version: the step-C runtime masks (and the remote-management mask)
cannot be made persistent on the TV by any safe method, and that is by design on this platform.
Do not try to make them persistent by modifying the TV. Use the router block as the permanent
layer, and if you want the services kept down across reboots, re-apply from the host.

What a full reboot loses: only the runtime masks on `wifi-presence`, `kpi-logging`,
`contents-recognition-service`, `activity-inference-service` (and the `remote-management` mask,
which is moot because rmdemon stays dead without its trigger files). Everything else persists:
the whole router layer, every app-registry disable, the context-aware / pisa / canalysis stop
markers (Samsung's own `/opt` marker mechanism), and the menu toggles. A reboot therefore only
resumes those services' **local** processing; none of them can exfiltrate, because their
destinations stay blocked at the router. Standby/wake does not lose the masks; only a full
restart, power cut or firmware update does.

Why plain systemd persistence does not work (and the rootfs route is unsafe):

- The only writable systemd unit paths are under `/run`, which is wiped on every boot. `/etc`
  and `/usr/lib` are on the read-only rootfs. So a persistent mask or drop-in cannot be placed
  anywhere systemd reads.
- The four units have no `ConditionPathExists`, so the `/opt` marker-file trick (which does work
  persistently for pisa/canalysis/context-aware) cannot gate them.
- The rootfs is `vdfs`, mounted read-only, and **100% full**, on a device with **no dm-verity**.
  No verity means a modified rootfs would still boot, so remounting `/` read-write and editing
  units is technically possible. Do **not** take this route: `/` is full, `SELP_ENABLE` is in the
  boot args and its reaction to a changed system partition is unknown, and there is **no at-home
  recovery if it fails to boot** (SDB is network-only and only exists once booted; the TV's USB
  ports are host-mode, not an SDB device port, so a cable to a computer is not a rescue path).

There IS a usable on-TV boot hook, on the writable `/opt` partition (not the read-only rootfs):

- `/opt/etc/parseinfo.sh` is run at every boot by the stock `AT-HUB.service`. It is world-writable
  and on `/opt`. On the tested 2022 Frame it confirmably runs each boot (it writes
  `/proc/target_version`, which was populated). It carries a Samsung `##UEP…:UEP` signature line,
  but that is a trailing shell comment and nothing observed enforces it at boot on `/opt`.
- The known method (used by **elithrar/samshush** on a newer Frame Pro, QN65LS03FWFXZA / fw 1301.0)
  is to **replace** this script with a wrapper that runs the saved original first, then starts a
  root job that re-applies the masks, keeping the original bytes under `/opt/usr/share/<name>`.
  Because it only touches writable `/opt`, it avoids the rootfs remount and its brick tail.
- Risk profile: low but not zero. `AT-HUB.service` runs late and backgrounds the script (`&`), so a
  broken wrapper almost certainly would not block boot, and running the original first preserves its
  normal job. The unknown is whether a given firmware enforces the UEP signature at boot; verify on
  your own firmware with a staged install (save the original, install the wrapper, power-cycle once
  to confirm it boots and the masks came back) and keep the restore (`startup remove`) ready. There
  is still no at-home rescue if a boot ever did fail, so weigh it against the host-side option below.
- Note: the sibling archive-launcher tooling (e.g. chris-ritsen/samsung-tv-root) instead keeps root
  volatile and persists from the **host** by re-acquiring root after each reboot. That is the
  zero-TV-write alternative.

Two supported persistence models, pick per risk tolerance:

1. **On-TV boot hook** (above): survives reboots with no host needed; small boot-script risk; verify
   per firmware.
2. **Host-side re-apply** (zero TV-write risk): leave a host (a computer that is usually on) able
   to reach the TV over SDB, and after each reboot re-run `tv/runtime-masks.sh --arg apply`. Its
   cost is leaving Developer Mode on (which keeps the TV's SDB port open on the LAN) and a short
   post-boot window where the services run locally but still cannot send anything out.

If you set up neither, the only consequence of a reboot is that those four services process locally
until the next manual re-apply; nothing leaves the network in the meantime, because the router
block is permanent and router-side.
