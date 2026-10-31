/* Catalog + defaults for the launcher. Edit here to add a logo for an app, change the default
   dock, or add a weather location. The dock the viewer actually sees is editable in the UI
   (Settings -> Rediger meny) and saved on the TV; this file only provides the starting point. */

/* A white logo (img/glyph/<file>.png) for an app id. Apps without one show their name. */
window.LAUNCHER_GLYPHS = {
  'org.tizen.netflix-app': 'netflix',
  'org.tizen.primevideo': 'prime',
  'com.samsung.tv.aria-video': 'appletv',
  'n8N84lD1cR.NRKTVBeta': 'nrktv',
  '9Ur5IzDKqV.TizenYouTube': 'youtube',
  'com.samsung.tv.cobalt-yt': 'youtube'
};

/* Per-app sizing class (keeps logos optically even). Optional. */
window.LAUNCHER_CLASS = {
  'org.tizen.netflix-app': 't-netflix',
  'org.tizen.primevideo': 't-prime',
  'com.samsung.tv.aria-video': 't-apple',
  'n8N84lD1cR.NRKTVBeta': 't-nrk',
  '9Ur5IzDKqV.TizenYouTube': 't-youtube',
  'com.samsung.tv.cobalt-yt': 't-youtube'
};

/* The default dock, used until the viewer edits it. Deduped at render time, so listing both
   YouTube ids is fine: only the one that is actually installed shows, and only once. */
window.LAUNCHER_DEFAULT_DOCK = [
  'org.tizen.netflix-app',
  'org.tizen.primevideo',
  'com.samsung.tv.aria-video',
  'n8N84lD1cR.NRKTVBeta',
  'com.samsung.tv.cobalt-yt',
  '9Ur5IzDKqV.TizenYouTube'
];

/* Which apps count as "streaming" and so appear in Rediger meny. Two ways to match:
   1. exact app id (most reliable), or
   2. a word in the app's name (catches an installed service whose id we don't know yet).
   A matched app with no logo in LAUNCHER_GLYPHS falls back to a logo chosen by word below,
   and if there is still none, to its name as white text. */
window.LAUNCHER_STREAMING_IDS = {
  'org.tizen.netflix-app': 1, 'org.tizen.primevideo': 1, 'com.samsung.tv.aria-video': 1,
  'n8N84lD1cR.NRKTVBeta': 1, '9Ur5IzDKqV.TizenYouTube': 1, 'com.samsung.tv.cobalt-yt': 1
};
/* name word -> logo file in img/glyph. Order matters: first hit wins. */
window.LAUNCHER_STREAMING_WORDS = [
  { word: 'netflix', glyph: 'netflix' },
  { word: 'prime video', glyph: 'prime' },
  { word: 'disney', glyph: 'disneyplus' },
  { word: 'hbo', glyph: 'max' },
  { word: 'max', glyph: 'max' },
  { word: 'viaplay', glyph: 'viaplay' },
  { word: 'skyshowtime', glyph: 'skyshowtime' },
  { word: 'paramount', glyph: 'paramount' },
  { word: 'apple tv', glyph: 'appletv' },
  { word: 'nrk', glyph: 'nrktv' },
  { word: 'tv 2', glyph: 'tv2play' },
  { word: 'tv2', glyph: 'tv2play' },
  { word: 'youtube', glyph: 'youtube' },
  { word: 'spotify', glyph: 'spotify' },
  { word: 'twitch', glyph: null },
  { word: 'plex', glyph: null },
  { word: 'pluto', glyph: null },
  { word: 'rakuten', glyph: null },
  { word: 'discovery', glyph: null }
];
/* Per-logo sizing for the dock, by glyph name (mirrors LAUNCHER_CLASS, which is keyed by id). */
window.LAUNCHER_GLYPH_CLASS = {
  netflix: 't-netflix', prime: 't-prime', appletv: 't-apple', nrktv: 't-nrk',
  youtube: 't-youtube', disneyplus: 't-disney', max: 't-max', viaplay: 't-viaplay',
  skyshowtime: 't-sky', paramount: 't-paramount', tv2play: 't-tv2', spotify: 't-spotify'
};

/* Weather locations to choose from (Open-Meteo, no API key). Add your own with lat/lon.
   The first entry is the default until the viewer picks another. */
window.LAUNCHER_LOCATIONS = [
  { name: 'Hønefoss', lat: 60.1683, lon: 10.2518 },
  { name: 'Oslo', lat: 59.9139, lon: 10.7522 },
  { name: 'Fagernes', lat: 60.9886, lon: 9.2894 },
  { name: 'Bergen', lat: 60.3913, lon: 5.3221 },
  { name: 'Trondheim', lat: 63.4305, lon: 10.3951 },
  { name: 'Stavanger', lat: 58.9700, lon: 5.7331 },
  { name: 'Kristiansand', lat: 58.1599, lon: 8.0182 },
  { name: 'Tromsø', lat: 69.6492, lon: 18.9553 }
];
