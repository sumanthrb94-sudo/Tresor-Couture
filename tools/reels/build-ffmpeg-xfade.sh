#!/usr/bin/env bash
# Build an FFmpeg with GL transitions compiled in, into /opt/ffmpeg-xfade.
#
#   sudo tools/reels/build-ffmpeg-xfade.sh
#
# Optional, and it buys exactly one thing: speed.
#
# montage.py runs GL transitions on stock FFmpeg by feeding them to the xfade
# filter as expressions, which is correct and needs nothing installed — but the
# expression evaluator runs per pixel per frame, and one 0.7-second transition
# at 1080x1920 takes about FOUR MINUTES. The same transition compiled to C takes
# about four seconds. On a nine-clip montage that is half an hour against under
# a minute.
#
# montage.py finds this build on its own and says which engine it used. Nothing
# needs configuring after it finishes; set FFMPEG_XFADE to override the path.
#
# Takes 15-40 minutes depending on the machine. It does not touch the system
# ffmpeg — everything the rest of the toolchain does keeps using that one.
set -euo pipefail

PREFIX=${PREFIX:-/opt/ffmpeg-xfade}
FFMPEG_TAG=${FFMPEG_TAG:-n6.1.1}       # the patch in xfade-easing targets 6.1
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "==> deps"
apt-get update -qq
apt-get install -y -qq build-essential nasm yasm pkg-config git libx264-dev libx265-dev

echo "==> sources"
git clone --depth 1 https://github.com/scriptituk/xfade-easing.git "$WORK/xfade-easing"
git clone --depth 1 --branch "$FFMPEG_TAG" https://github.com/FFmpeg/FFmpeg.git "$WORK/ffmpeg"

echo "==> patch"
cd "$WORK/ffmpeg"
cp "$WORK/xfade-easing/src/xfade-easing.h" libavfilter/
# The v6.1 patch, not the top-level one: the top-level tracks FFmpeg master and
# will not apply to a release tag.
patch -p0 libavfilter/vf_xfade.c < "$WORK/xfade-easing/src/v6.1/vf_xfade.patch"

echo "==> configure"
./configure --prefix="$PREFIX" --enable-gpl --enable-libx264 \
    --disable-doc --disable-ffplay --disable-network --disable-debug

echo "==> build (this is the long part)"
# xfade-easing.h declares after statements, which FFmpeg's build flags reject.
make -j"$(nproc)" ECFLAGS=-Wno-declaration-after-statement
make install

echo
echo "==> done: $PREFIX/bin/ffmpeg"
"$PREFIX/bin/ffmpeg" -hide_banner -h filter=xfade | grep -c 'gl_' \
    | xargs -I{} echo "    {} native GL transitions available"
echo "    montage.py will find it automatically."
