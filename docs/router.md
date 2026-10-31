# DNS blocking on the router

The list is in `../blocklist/samsung-tv-privacy.txt`. Apply it to the TV only if your router
supports per-device rules; the domains are Samsung-specific, so applying them to the whole
network is also fine.

Two things decide whether the block actually holds:

1. **Subdomains.** Some ad-block lists match exact names only. On the tested UniFi router the
   built-in Ad Block caught `lcprd1...` but not `log-config.samsungacr.com`; the rule's own
   Blocklist field matched subdomains. Test a subdomain, not just the domain.
2. **Other DNS servers.** The tested TV used the router and `8.8.8.8` as fallback. If the router
   does not intercept outbound DNS, or hands out an unfiltered IPv6 DNS server, the TV can get
   around the block. Whether that happens was not verified on the tested TV (its `nslookup`
   cannot query a chosen server), so add a router rule that redirects or blocks DNS (ports 53
   and 853) from the TV to anything other than the router, and check the router's log.

## UniFi (Network 10.x)

Settings → CyberSecure → Content Filter → Create New (or edit the TV's rule). Source: the TV.
Add the domains with Blocklist → Add Multiple, Save. Blocked names answer with UniFi's block
address `203.0.113.250` / `2001:db8:1000::fa`. These look like placeholders (they are
documentation ranges) but are what UniFi actually returned on the tested network; the check
script treats them, 0.0.0.0 and "no such domain" as blocked. Useful extras on the same router: Settings →
Networks → isolate any open/guest network so it cannot reach the TV; Settings → CyberSecure →
Intrusion Prevention.

Fallback DNS on UniFi: a device covered by a Content Filter rule has all ordinary DNS (port 53,
UDP and TCP) redirected to UniFi's filter, whatever server it asks. Verified 2026-10-25 from a
filtered computer on the tested network: lookups sent straight to 8.8.8.8, 1.1.1.1 and 9.9.9.9
all came back blocked (a built-in "Allow DNS UTM Filter" firewall rule is the visible sign).
Encrypted DNS on port 853 is **not** redirected. Close that with a firewall rule: Settings →
Policy Engine → Traffic and Firewall Rules → Advanced → Create Entry: type LAN In, action Drop,
protocol TCP/UDP, source MAC = the TV, destination port 853, logging on. It cannot break the
TV's normal DNS, and the log shows whether the TV ever tries encrypted DNS.

## AdGuard Home / Pi-hole / NextDNS

- AdGuard Home: Filters → Custom filtering rules, one `||domain^` line per domain (covers
  subdomains). Optionally a client-specific rule for the TV.
- Pi-hole: add each domain as a regex `(\.|^)domain\.tld$` deny entry, or a wildcard in v6.
- NextDNS: Denylist accepts the domains as-is and covers subdomains.
- Then force the TV to use that resolver: set it as the router's DHCP DNS and block or redirect
  outbound port 53 (and DoT 853) from the TV.

## Do not block

`osb.samsungqbe.com`, `gpm.samsungqbe.com`, `cdn.samsungcloudsolution.com`. These break Smart
Hub, app installs or updates.

## Verify

From the TV (root): `tv exec --script ../tv/dns-check.sh`. It looks the hosts up the way the TV
does in everyday use, together with a host that must resolve; if that fails the result is
UNREACHABLE instead of being counted as blocking. It ends with `ALL OK` or `NOT OK`. It cannot
test a fallback DNS server on its own (see point 2 above). If your filter answers
with a different block address, add it to `SINKHOLES` in the script. Without root: watch the
router's DNS log for the TV.

## Pin the firmware (block auto-updates) — optional

A Samsung firmware update can undo everything you changed on the TV: the app-registry disables,
the tuner disable, and launcher-as-Home all live in the `/opt` registry, which an update may
reset (the router layer survives, the TV-side changes may not). If you have rooted and debloated
the set, you usually want to stop the TV updating itself.

Block `ospserver.net`. That is Samsung's firmware (OSP/FOTA) delivery domain, and it is
**separate** from the app-update and Smart Hub servers, so apps keep installing and updating.
Verified on TQ43LS03BGUXXC / 1720.7: `fota-cloud-dn.ospserver.net` resolved to a real Samsung
CDN IP (`23.1.99.11`) before, and to the UniFi sinkhole after, while `cdn.samsungcloudsolution.com`
(apps) still resolved.

- **UniFi:** add `ospserver.net` to the same per-device Content Filter rule that holds the
  privacy blocklist (Settings → CyberSecure → Content Filter → the TV's rule → Blocklist). It is
  already in `../blocklist/samsung-tv-privacy.txt` under the firmware section. Edit it from the
  cloud console `unifi.ui.com`; the local `https://192.168.0.1` page is a self-signed cert the
  browser flags and some tools cannot script.
- **Other resolvers:** block `ospserver.net` with subdomain coverage (AdGuard `||ospserver.net^`,
  Pi-hole regex, NextDNS denylist), same as the privacy domains.
- **Close the encrypted-DNS bypass:** if the TV ever uses DoT (port 853) it could resolve the
  firmware host around the DNS block. Add the port-853 drop rule from the UniFi section above,
  with the TV's MAC as source. (Port-53 DNS is already redirected to the filter.)

Verify from the TV (root): `nslookup fota-cloud-dn.ospserver.net` should return your filter's
block address, and a control host such as `cdn.samsungcloudsolution.com` should still resolve.

To update deliberately later, remove `ospserver.net` from the rule, update, then re-apply the
registry changes (firmware updates are rare and not reversible once applied).
