# Vendored: xfade-easing

`uneased-transitions-yuv420p-inline.txt` is from
**[scriptituk/xfade-easing](https://github.com/scriptituk/xfade-easing)** by
Raymond Luckhurst, MIT licensed — see `xfade-easing.LICENSE`. It transpiles the
[GL Transitions](https://github.com/gl-transitions/gl-transitions) collection
(Gaëtan Renaudeau et al.) into expressions for FFmpeg's own `xfade` filter.

## Why this file and not the project

The project ships two ways to get GL transitions into FFmpeg:

1. **A patched FFmpeg** — native C filters, fast, and requires building FFmpeg
   from source on every machine that renders a video.
2. **Custom expressions** — the same transitions expressed in `xfade`'s own
   expression language, driven through `transition=custom:expr=…` on **stock,
   unmodified FFmpeg**.

We take the second, and only the one pre-generated file it needs. `apt-get
install ffmpeg` is then the entire setup, on any machine, including CI. The
generator (`xfade-easing.sh`) additionally wants Bash 4, gawk and gsed, which is
three more things to install for output that does not change between runs.

The file is data, not code: 138 transitions, each a name and one line of
expression. `montage.py` parses it into a lookup.

## Updating it

```bash
git clone --depth 1 https://github.com/scriptituk/xfade-easing.git
cp xfade-easing/expr/uneased-transitions-yuv420p-inline.txt tools/reels/vendor/
```

**yuv420p, not rgb24** — deliberately. Our pipeline is yuv420p end to end, which
is what H.264 for Instagram has to be; the rgb24 expressions would force two
colourspace conversions per transition for no visible gain.
