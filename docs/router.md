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
   around the block.

## UniFi (Network 10.x)

Settings → CyberSecure → Content Filter → Create New (or edit the TV's rule). Source: the TV.
Add the domains with Blocklist → Add Multiple, Save. Blocked names answer with UniFi's block
address (`203.0.113.250` / `2001:db8:1000::fa`). Useful extras on the same router: Settings →
Networks → isolate any open/guest network so it cannot reach the TV; Settings → CyberSecure →
Intrusion Prevention.

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

From the TV (root): `tv exec --script ../tv/dns-check.sh`. Every "should block" line must show
your block address (or 0.0.0.0 / NXDOMAIN) for **every** DNS server listed; "should work" lines
must show real addresses. Without root: watch the router's DNS log for the TV.
