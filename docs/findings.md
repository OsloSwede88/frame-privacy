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
