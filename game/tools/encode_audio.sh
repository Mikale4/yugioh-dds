#!/bin/sh
# Rebuild the web-sized soundtrack: audio/bgm-src (320 kb/s rips, not in git)
# -> audio/bgm (64 kb/s mono, ~23 MB total, what the game and the site load).
cd "$(dirname "$0")/../audio" || exit 1
for f in bgm-src/*.mp3; do
  ffmpeg -v error -y -i "$f" -vn -map 0:a:0 -ac 1 -ar 32000 \
    -codec:a libmp3lame -b:a 64k "bgm/$(basename "$f")" || exit 1
done
