# Reels

Phone footage in, Instagram-ready 9:16 out, with the brand watermark on it.

```bash
apt-get install -y ffmpeg                       # once
python3 tools/reels/make_watermark.py           # once, or after a brand change
python3 tools/reels/reel.py clip.mp4 -o reels/
```

Point it at as many files as you like — videos or stills — and it writes one
`*-reel.mp4` each into `-o`. Nothing is uploaded anywhere; the files are yours to
post.

---

## What comes out

1080 × 1920, H.264 High / yuv420p, 30 fps, AAC 48 kHz stereo, faststart, capped
at 6 Mbps, loudness-normalised to −14 LUFS. That is what Instagram wants handed
to it. Give it anything else and it re-encodes from its own guess, which is where
the soft, dark, quiet version of your video comes from.

---

## The two decisions worth understanding

### Fit — what happens to a 16:9 clip

A landscape clip cannot become 9:16 without either losing two thirds of the frame
or gaining bars. There is no third answer, so the choice is yours to make per
clip:

| `--fit` | What it does | Use it when |
|---|---|---|
| `auto` *(default)* | `cover` if the clip was shot vertically, `blur` otherwise | Most of the time |
| `blur` | Video centred at full width, blurred copy of itself filling above and below | A wide shot where the edges matter — a shop interior, a full window display |
| `cover` | Scaled up and cropped to fill the whole frame | **The action is centred** — a ribbon being cut, one person, one garment |
| `pad` | Plain black bars | Almost never |

**This is the setting that most changes how a reel lands.** A ribbon-cutting in
`blur` puts the faces in a band a third of the screen tall; the same clip in
`cover` fills the phone and you can see who is smiling. A shop pan in `cover`
loses the shop. Render both and look — it costs one flag.

### Where the watermark goes

`--pos tr` (default), `tl`, `br`, `bl`.

Top-right is the default because that is the part of a reel Instagram's own
interface leaves alone. The bottom ~330 px carries the caption, the handle and
the audio strip; the right rail carries the like and share buttons; the top
~90 px is the header. A watermark in the bottom-right spends its life behind a
Like button.

---

## Everything else

```
--mark gold|cream     cream for footage that is already all gold — a lit window
                      at night, brass, marigolds — where gold on gold stops
                      being a watermark and becomes texture
--no-watermark
--start / --end       trim: seconds or mm:ss  (--start 0:04 --end 0:22)
--duration            seconds per still image (default 6, with a slow push in)
--cover-frame         also write a poster JPG, for the reel's cover
--crf / --maxrate     quality and its ceiling (defaults 21 and 6M)
--preset              x264 preset (default medium)
```

Stills work the same way — hand it a JPG and it produces a 6-second clip with a
slow zoom, so a photo can go out as a reel rather than a post.

---

## The watermark

`make_watermark.py` builds `branding/video/watermark-{gold,cream}.png` from the
brand kit — the TC mark from `tc-master-mark-4k.png`, the wordmark set in
Cormorant Bold, both over a soft shadow taken from their own alpha.

It is generated rather than saved once as a file because the inputs are the brand
kit's own: change the mark or the palette and the watermark follows. The sizes
are in the script as named constants with the reasoning attached, which is worth
more than it sounds — "the watermark is 4 px too big" is not an argument anyone
can have with a PNG.

Two details that are about video specifically, not about logos:

* **It sits on a shadow.** Footage goes from a white shop wall to a night street
  inside one clip, so the mark cannot rely on contrast with what is behind it.
  The shadow is invisible on dark footage and is what holds the gold together on
  a bright one.
* **The wordmark is Bold and loosely tracked.** Instagram re-encodes everything,
  and thin strokes at small sizes do not survive it. A print lockup would be
  lighter and tighter and would arrive as mush.

---

## Several clips into one reel

Nine separate posts is nine posts nobody watches to the end. One 30-second cut
with the good four seconds of each is a reel:

```bash
python3 tools/reels/montage.py a.mp4 b.mp4 c.jpg -o reels/opening.mp4 --style punchy
python3 tools/reels/montage.py --list          # every transition name
```

`file@start:length` picks the slice, in seconds — `'ribbon.mp4@12:5'`. Without
it, the slice starts 15% in, because the first second of a phone clip is usually
the hand still travelling to the framing the person meant.

### Styles

| `--style` | What it does between shots | For |
|---|---|---|
| `luxe` *(default)* | Dreamy, linear blur, dissolve — nothing calls attention to the cut | A couture window, a lookbook |
| `punchy` | Whip pans, zoom blurs, spins. Everything moves the *frame* | A launch, a drop, a sale |
| `playful` | Kaleidoscope, swirl, glitch | Two of these is plenty; eight is a screensaver |
| `classic` | Fade, dissolve, smooth wipes | Nothing that could look dated |
| `random` | A shuffle of all 122, seeded by `--seed` | Finding one you like |

The transitions are **[GL Transitions](https://github.com/gl-transitions/gl-transitions)**,
the collection behind most of what you see between shots on Instagram, reaching
FFmpeg through **[xfade-easing](https://github.com/scriptituk/xfade-easing)**.

### Why there is a build script

GL transitions reach FFmpeg two ways, and the difference is not academic:

| | one 0.7s transition at 1080×1920 |
|---|---|
| Patched FFmpeg — native C | **~4 seconds** |
| Stock FFmpeg — expressions | **~4 minutes** |

Same output either way. But a nine-clip montage is eight transitions: about
half an hour on stock FFmpeg against under a minute. `montage.py` finds a
patched build if there is one, falls back to expressions if not, and prints
which it used rather than leaving you wondering why a 30-second video is still
rendering.

```bash
sudo tools/reels/build-ffmpeg-xfade.sh     # 15-40 min, once, into /opt/ffmpeg-xfade
```

It does not touch the system ffmpeg. Set `FFMPEG_XFADE` to point elsewhere.

A handful of transitions — CrossZoom and Exponential Swish among them, which are
two of the most recognisable — exist *only* in the patched build. Styles that
name them drop them from the rotation on stock FFmpeg rather than failing, so
`--style punchy` works either way and is simply better with the build.

---

## Notes on the source material

WhatsApp hands over 1024 × 576. Every output here is an upscale, which is why
there is an unsharp pass *after* the scale — before it, it would just amplify
WhatsApp's compression. **If you have the originals off the phone rather than
out of WhatsApp, use those**: they are usually 1080p or 4K, and the difference is
larger than anything this tool can do.

Clips shot vertically arrive as 1024 × 576 with a rotation flag rather than as
576 × 1024. Every decision here is made on the *displayed* shape, not the stored
one, which is the bug you get for free if you read `width` and `height` and stop.
