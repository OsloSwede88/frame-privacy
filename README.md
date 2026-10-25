# frame-privacy

Make a Samsung **The Frame** TV stop reporting what you watch and what happens in your home,
without breaking the TV. Written so you can hand it to a coding agent (Claude Code, Codex and
similar) and let it walk you through the steps safely.

> Verified on **one** TV: Frame 43" `TQ43LS03BGUXXC` (2022), EU firmware
> `T-PTMDEUC-1720.7, BT - S`, Tizen 6.5. Other Frames are probably similar, but the agent
> instructions make it check your exact model and firmware before changing anything.

## Give this repository to your agent

Clone it, open it in your agent, and say:

> Read AGENTS.md and follow it to harden my Samsung Frame. My TV's IP is ___. Start with what
> needs no root, ask me before anything that changes the TV, and keep picture, HDMI, sound,
> Wi-Fi, Bluetooth, Art Mode and my streaming apps working.

## What it does

```
 Tier 1, no root (everyone)                  Tier 2, root (optional)
 ┌─────────────────────────────────┐        ┌───────────────────────────────────────────┐
 │ TV menu: viewing info, ads and  │        │ Disable ACR, ad, voice and context apps   │
 │ voice recognition off           │        │ Stop services the debloat misses:         │
 │ Router: DNS-block telemetry,    │        │  LAN scanner, KPI logger, ACR, activity   │
 │ ACR, ads, remote management     │        │ Verify: status + DNS check from the TV    │
 └─────────────────────────────────┘        └───────────────────────────────────────────┘
                                   Optional: a clean home-screen launcher
```

What the audit found (details and evidence in [docs/findings.md](docs/findings.md)):

- The specific "TV sensor" events reported on X in October 2026 (`EV101/201/301/302`,
  `*_tv_sensor`) were **not** on this firmware, but the same logging pipeline and upload host
  (`lcprd1.samsungcloudsolution.net`) were active.
- A common app-registry debloat leaves several services running, including one that ARP-scans
  your home network and one that senses motion through Wi-Fi.
- Some router ad-block lists match exact host names only, so tracking subdomains slip through.

## Contents

| Path | What |
|---|---|
| [AGENTS.md](AGENTS.md) | The step-by-step procedure for an agent (also readable by people) |
| [blocklist/](blocklist/samsung-tv-privacy.txt) | Domains to block, plus ones you must not block |
| [docs/router.md](docs/router.md) | UniFi, AdGuard Home, Pi-hole, NextDNS |
| [docs/findings.md](docs/findings.md) | What the tested TV actually does |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Wi-Fi drops, SDB errors, restarts, undo |
| [tv/](tv/) | Scripts run on the TV through quiet-tizen: status, DNS check, service masks, preferences |
| [profiles/](profiles/) | Exact model/firmware profile with the app IDs and service names |
| `setup.sh`, [patches/](patches/) | Fetch quiet-tizen at a pinned commit and apply the Frame patch |
| [launcher/](launcher/) | Optional home-screen app, text tiles, no logos |

## Built on quiet-tizen

Root access, consistent backups and the registry planner come from
[quiet-tizen](https://github.com/jss8649/quiet-tizen) (MIT), fetched by `setup.sh` at a reviewed
commit. The patch here adds a `--profile` option to its helper and a `--target-framework`
option to its build (the Frame runs .NET Core 3.1). Its safety rules apply: inventory first,
back up before each change, one group at a time, test after a restart.

## Caveats

- Root access uses Developer Mode and a temporary root session. It does not modify firmware,
  but you do it at your own risk, on a TV you own.
- This reduces data collection; it does not make the TV silent. Samsung push and SmartThings
  connections remain, and firmware updates can undo changes.
- Not affiliated with Samsung. "The Frame", Tizen and app names are trademarks of their owners.

## License

MIT, see [LICENSE](LICENSE). quiet-tizen is fetched separately under its own license.
