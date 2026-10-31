#!/bin/zsh
# Builds the wallpaper set from tools/wallpapers.tsv (Wikimedia Commons files):
#   source-4k/<id>.jpg         3840 px wide original render (kept out of git and out of the app)
#   app/img/wall/<id>.jpg      1920x1080, what the TV shows (web apps render at 1080p)
#   app/img/wall/<id>-blur.jpg pre-blurred copy behind the glass panels
#   app/img/wall/<id>-thumb.jpg 256x144 for the picker
# and writes app/js/wallpapers.js. Re-run after editing the tsv; downloads are cached.
set -e
cd ${0:A:h}/..
UA='FrameLauncher/0.2 (personal TV wallpaper picker; https://lovvik.no)'
mkdir -p source-4k app/img/wall
js='window.WALLPAPERS = ['
tail -n +2 tools/wallpapers.tsv | while IFS=$'\t' read -r id title file license artist; do
  src=source-4k/$id.jpg
  if [[ ! -s $src ]]; then
    name=${file#File:}
    curl -sfL -A "$UA" -o $src "https://commons.wikimedia.org/wiki/Special:FilePath/${name// /%20}?width=3840"
    sleep 2
  fi
  magick $src -resize 1920x1080^ -gravity center -extent 1920x1080 -strip -interlace JPEG -quality 84 app/img/wall/$id.jpg
  magick app/img/wall/$id.jpg -resize 25% -blur 0x5 -resize 1920x1080! -modulate 108,135 -quality 80 app/img/wall/$id-blur.jpg
  magick app/img/wall/$id.jpg -resize 256x144 -strip -quality 82 app/img/wall/$id-thumb.jpg
  t=${title//\'/\\\'}; a=${artist//\'/\\\'}
  js+=$'\n'"  { id: '$id', title: '$t', credit: '$a, $license, Wikimedia Commons' },"
  print "$id $(magick identify -format '%wx%h' $src) $title"
done
print -r -- "${js%,}"$'\n];' > app/js/wallpapers.js
