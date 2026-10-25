/* The dock. Edit to match your TV: read installed app ids with `sdb shell 0 applist`.
   ids: candidates in order; the first one installed is used. glyph (optional): your own
   white logo as img/glyph/<glyph>.png; without it the card shows the name. */
window.LAUNCHER_APPS = [
  { name: 'Netflix', ids: ['org.tizen.netflix-app'] },
  { name: 'Prime Video', ids: ['org.tizen.primevideo'] },
  { name: 'Apple TV', ids: ['com.samsung.tv.aria-video'] },
  { name: 'YouTube', ids: ['9Ur5IzDKqV.TizenYouTube', 'com.samsung.tv.cobalt-yt'] }
];
