"""Cut several clips into one reel, with GL-style transitions between them.

    python3 tools/reels/montage.py a.mp4 b.mp4 c.jpg -o reels/opening.mp4

Nine separate clips is nine posts nobody watches to the end. One 30-second cut
with the good four seconds of each is a reel. That is what this does: take a
slice of every input, join them with a transition, watermark the result once.

    --per-clip 4         seconds taken from each input (default 4)
    --style luxe|punchy|playful|classic|random
    --transition NAME    force one transition for every cut
    --duration 0.7       seconds each transition takes
    --list               print every usable transition name and stop

Per-clip control, when the good bit is not where the default looks:

    montage.py 'ribbon.mp4@12:5' 'rail.mp4@0:3' shopfront.jpg

`@start:length`, in seconds. Without it, the slice is taken from 15% into the
clip — the start of a phone video is usually the hand still moving to the frame.

---

**The transitions come from GL Transitions**, the collection behind most of what
you see between shots on Instagram, via `xfade-easing`, which transpiles them
into expressions FFmpeg's own `xfade` filter can run. See `vendor/NOTICE.md`:
the point of taking that route is that stock `apt-get install ffmpeg` is the
whole setup — the alternative is building a patched FFmpeg on every machine.

**Style is a real choice, not a skin.** `punchy` whips and zoom-blurs between
shots, which is the language of a sale or a launch countdown; `luxe` dissolves
and drifts, which is the language of a couture window. Using punchy transitions
on slow footage makes the footage look slower, not faster.

**Every clip is normalised before it is cut in.** Same 1080x1920, same 30fps,
same loudness — an xfade between two clips of different sizes or frame rates
either fails or produces something subtly wrong halfway through the blend.
"""
from __future__ import annotations

import argparse
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reel import (  # noqa: E402
    FPS, H, IMAGES, SAFE_BOTTOM, SAFE_TOP, SAFE_X, W, WATERMARKS, WM_OPACITY,
    build_filter, measure_loudness, need, probe, run, video_shape,
)

EXPR_FILE = Path(__file__).resolve().parent / 'vendor' / 'uneased-transitions-yuv420p-inline.txt'

# Curated sets. Each is a rotation, not a random draw: a montage where every cut
# is a different effect reads as a demo of transitions rather than as a film.
STYLES = {
    # Soft, slow, expensive. Nothing calls attention to the cut itself.
    'luxe': ['GL_DREAMY', 'FADE', 'GL_LINEARBLUR', 'GL_CROSSWARP',
             'GL_ROTATE_SCALE_FADE', 'DISSOLVE'],
    # The short-form vocabulary: whip pans, zoom blurs, spins. For a launch, a
    # drop, a sale — anywhere the energy is the message.
    # All of these move the FRAME. Nothing here tiles, spirals or shows black,
    # because on a phone those read as a fault rather than as a cut — which is
    # what separates this list from 'playful' below.
    # CrossZoom and Exponential Swish are the two most recognisable and are
    # NATIVE-only, so on stock FFmpeg they drop out and the rest carry the
    # style. That is the reason styles degrade instead of failing.
    'punchy': ['GL_DIRECTIONALWARP', 'GL_CROSSZOOM', 'GL_LINEARBLUR',
               'GL_EXPONENTIAL_SWISH', 'GL_ROTATESCALEVANISH', 'GL_CROSSWARP'],
    # The loud ones — kaleidoscopes, spirals, glitch. They are genuinely popular
    # and they are genuinely a lot; on a 30-second cut, two of these is plenty
    # and eight is a screensaver.
    'playful': ['GL_MOSAIC', 'GL_SWIRL', 'GL_STATIC_WIPE', 'GL_KALEIDOSCOPE',
                'GL_RANDOMSQUARES', 'GL_POLKADOTSCURTAIN'],
    # Nothing that could ever look dated.
    'classic': ['FADE', 'DISSOLVE', 'SMOOTHLEFT', 'CIRCLEOPEN', 'SMOOTHRIGHT'],
}


def load_transitions() -> tuple[dict[str, str], set[str]]:
    """The vendored table: name -> expression, and every name it defines.

    Two return values because they are not the same set. `NATIVE` in the table
    marks a transition xfade-easing implements in C but could not express in
    xfade's expression language — real and usable, but only on a patched build.
    It belongs in the name list and must never reach the expression path.
    """
    if not EXPR_FILE.exists():
        sys.exit(f'{EXPR_FILE} is missing — see tools/reels/vendor/NOTICE.md')
    exprs: dict[str, str] = {}
    names: set[str] = set()
    name = None
    for line in EXPR_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if name is None:
            name = line
            names.add(line)
            continue
        # Strictly two-state — name line, then expression line. A value can look
        # exactly like a name (`NATIVE` does), so deciding by pattern instead of
        # by position silently shifts every entry after it.
        if line != 'NATIVE':
            exprs[name] = line
        name = None
    return exprs, names


# Two engines can run these transitions, and the difference is not academic.
#
#   patched FFmpeg   native C           ~4 seconds a transition
#   stock FFmpeg     custom expression  ~4 MINUTES a transition
#
# Same output either way — xfade-easing transpiles one from the other — but a
# nine-clip montage is eight transitions, which is half an hour of CPU on stock
# FFmpeg and under a minute on a patched one. So: use the patched build if this
# machine has one, fall back to expressions if not, and say which is happening
# rather than letting someone wonder why a 30-second video is still rendering.
#
# tools/reels/build-ffmpeg-xfade.sh builds the patched one.
FFMPEG_CANDIDATES = [
    os.environ.get('FFMPEG_XFADE'),
    '/opt/ffmpeg-xfade/bin/ffmpeg',
]


def find_engine() -> tuple[str, bool]:
    """The ffmpeg to use, and whether it has GL transitions compiled in.

    Detected by the `easing` option, which only the xfade-easing patch adds. The
    obvious test — looking for gl_* in the transition list — does not work: the
    patch accepts GL transitions as free-form strings and never adds them to the
    enum the help text prints.
    """
    for cand in [c for c in FFMPEG_CANDIDATES if c] + ['ffmpeg']:
        if not (shutil.which(cand) or Path(cand).is_file()):
            continue
        h = subprocess.run([cand, '-hide_banner', '-h', 'filter=xfade'],
                           capture_output=True, text=True).stdout
        if re.search(r'^\s+easing\s+<string>', h, re.M):
            return cand, True
    return 'ffmpeg', False


def native_name(name: str) -> str:
    """GL_DIRECTIONALWARP -> gl_directionalwarp.

    The patched filter matches these case-insensitively, which is worth relying
    on: the real GLSL names are camelCase in a dozen inconsistent ways
    (`directionalWarp`, `CrossZoom`, `rotate_scale_fade`) and reproducing that
    table by hand would be a second source of truth to get wrong.
    """
    return 'gl_' + name[3:].lower()


def parse_input(raw: str, default_len: float) -> tuple[Path, float | None, float]:
    """`path`, `path@start`, or `path@start:length`."""
    m = re.fullmatch(r'(.+?)@([\d.]+)(?::([\d.]+))?', raw)
    if not m:
        return Path(raw), None, default_len
    return Path(m.group(1)), float(m.group(2)), float(m.group(3) or default_len)


class Args:
    """The subset of reel.py's options its filter builder reads."""
    fit = 'auto'
    pos = 'tr'
    mark = 'gold'
    no_watermark = True
    duration = 6.0


def normalise(src: Path, start: float | None, length: float, tmp: Path,
              index: int, fit: str) -> tuple[Path, float]:
    """One input, made identical in shape, rate and loudness to all the others.

    Written to an intermediate file rather than kept as a filter branch: nine
    branches in one graph is a graph nobody can debug, and the intermediate is
    where you look when one clip in the middle comes out wrong.
    """
    is_still = src.suffix.lower() in IMAGES
    info = probe(src)

    if is_still:
        s = info['streams'][0]
        src_w, src_h, has_audio = int(s['width']), int(s['height']), False
        total = length
    else:
        src_w, src_h, has_audio = video_shape(info)
        total = float(info['format']['duration'])

    if start is None:
        # 15% in. The first second of a phone clip is usually the hand still
        # travelling to the framing the person meant.
        start = 0.0 if is_still else min(total * 0.15, max(0.0, total - length))
    length = min(length, max(0.5, total - start))

    a = Args()
    a.fit = fit
    graph, vlabel = build_filter(src_w, src_h, fit, None, 'tr', is_still, length)

    out = tmp / f'{index:02d}.mp4'
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y']
    if is_still:
        cmd += ['-loop', '1', '-t', f'{length}', '-i', str(src)]
    else:
        cmd += ['-ss', f'{start}', '-t', f'{length}', '-i', str(src)]

    if has_audio:
        stats = measure_loudness(src, ['-ss', f'{start}', '-t', f'{length}'])
        af = ('loudnorm=I=-14:LRA=11:TP=-1.5' if not stats else
              f"loudnorm=I=-14:LRA=11:TP=-1.5:measured_I={stats['input_i']}:"
              f"measured_LRA={stats['input_lra']}:measured_TP={stats['input_tp']}:"
              f"measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}:linear=true")
        cmd += ['-filter_complex', graph, '-map', vlabel, '-map', '0:a:0', '-af', af]
    else:
        # Silence, so every intermediate has an audio stream. A chain of audio
        # crossfades cannot skip a link.
        cmd += ['-f', 'lavfi', '-t', f'{length}', '-i', 'anullsrc=r=48000:cl=stereo']
        cmd += ['-filter_complex', graph, '-map', vlabel, '-map', '1:a']

    # Intermediates are cheap and thrown away; quality here must not be the
    # thing that limits the final encode.
    cmd += ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16',
            '-pix_fmt', 'yuv420p', '-r', str(FPS),
            '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
            '-t', f'{length}', str(out)]

    p = run(cmd)
    if p.returncode:
        sys.exit(f'{src.name}: {p.stderr.strip()[-1500:]}')
    return out, float(probe(out)['format']['duration'])


def main() -> None:
    need('ffmpeg')
    need('ffprobe')
    exprs, all_names = load_transitions()
    ffmpeg, patched = find_engine()

    ap = argparse.ArgumentParser(description='Several clips into one reel, with transitions.')
    ap.add_argument('inputs', nargs='*', help='file, file@start, or file@start:length')
    ap.add_argument('-o', '--out', type=Path, default=Path('reels/montage.mp4'))
    ap.add_argument('--per-clip', type=float, default=4.0)
    ap.add_argument('--style', choices=[*STYLES, 'random'], default='luxe')
    ap.add_argument('--transition', help='force one transition for every cut')
    ap.add_argument('--duration', type=float, default=0.7, help='seconds per transition')
    ap.add_argument('--fit', choices=['auto', 'blur', 'cover', 'pad'], default='cover',
                    help="default 'cover' — a montage wants full-bleed frames, not nine "
                         'different sets of blurred bars')
    ap.add_argument('--pos', choices=['tr', 'tl', 'br', 'bl'], default='tr')
    ap.add_argument('--mark', choices=['gold', 'cream'], default='gold')
    ap.add_argument('--no-watermark', action='store_true')
    ap.add_argument('--crf', type=int, default=21)
    ap.add_argument('--maxrate', default='5M')
    ap.add_argument('--seed', type=int, default=7, help='for --style random')
    ap.add_argument('--list', action='store_true', help='print transition names and stop')
    args = ap.parse_args()

    if args.list:
        names = sorted(all_names if patched else exprs)
        for i in range(0, len(names), 4):
            print('  ' + '  '.join(n.ljust(26) for n in names[i:i + 4]))
        print(f'\n{len(names)} transitions. GL_* are GL Transitions; the rest are '
              "FFmpeg's own.\nStyles: " + ', '.join(f'{k} ({len(v)})' for k, v in STYLES.items()))
        return
    if not args.inputs:
        ap.error('give it some clips (or --list)')

    def usable(name: str) -> bool:
        return name in (all_names if patched else exprs)

    if args.transition:
        key = args.transition.upper()
        if not usable(key):
            sys.exit(f'Unknown transition "{args.transition}". Try --list.')
        order = [key]
    elif args.style == 'random':
        rng = random.Random(args.seed)
        order = rng.sample(sorted(exprs), min(12, len(exprs)))
    else:
        # A style degrades rather than fails: the NATIVE-only transitions in a
        # style are simply not in the rotation on a stock FFmpeg, and the rest
        # carry it. Failing outright would make `--style punchy` an error on
        # every machine that had not built the patched ffmpeg.
        order = [t for t in STYLES[args.style] if usable(t)]
        dropped = [t for t in STYLES[args.style] if not usable(t)]
        if not order:
            sys.exit(f'Style "{args.style}" has nothing usable on this ffmpeg.')
        if dropped:
            print(f'  ({len(dropped)} of this style need the patched ffmpeg and are '
                  f'sitting this one out: {", ".join(dropped)})')

    parsed = [parse_input(s, args.per_clip) for s in args.inputs]
    for path, _, _ in parsed:
        if not path.exists():
            sys.exit(f'{path} not found')

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='montage-') as td:
        tmp = Path(td)
        clips: list[tuple[Path, float]] = []
        print('Normalising:')
        for i, (path, start, length) in enumerate(parsed):
            out, dur = normalise(path, start, length, tmp, i, args.fit)
            print(f'  {path.name:<34} {dur:5.2f}s')
            clips.append((out, dur))

        T = args.duration
        shortest = min(d for _, d in clips)
        if T >= shortest:
            # An xfade longer than a clip has nowhere to land: the clip is
            # entirely inside its own transitions and never actually plays.
            T = max(0.2, shortest * 0.5)
            print(f'  (transition shortened to {T:.2f}s — the shortest clip is {shortest:.2f}s)')

        cmd = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y']
        for path, _ in clips:
            cmd += ['-i', str(path)]
        wm = None if args.no_watermark else WATERMARKS[args.mark]
        if wm:
            if not wm.exists():
                sys.exit(f'{wm} is missing — run: python3 tools/reels/make_watermark.py')
            cmd += ['-i', str(wm)]

        chains: list[str] = []
        vlab, alab = '0:v', '0:a'
        offset = 0.0
        used: list[str] = []
        slow = 0
        for i in range(1, len(clips)):
            name = order[(i - 1) % len(order)]
            used.append(name)
            # Each transition starts T before the running total ends, and the
            # total loses T every time — the clips overlap, they do not queue.
            offset += clips[i - 1][1] - T
            nv, na = f'v{i}', f'a{i}'
            if not name.startswith('GL_'):
                # FFmpeg's own transitions are native everywhere. Using the
                # built-in beats the equivalent expression by ~50x, for free.
                spec = f'transition={name.lower()}'
            elif patched:
                spec = f'transition={native_name(name)}'
            else:
                spec = f"transition=custom:expr='{exprs[name]}'"
                slow += 1
            chains.append(
                f"[{vlab}][{i}:v]xfade={spec}:duration={T}:offset={offset:.4f}[{nv}]")
            chains.append(f"[{alab}][{i}:a]acrossfade=d={T}:c1=tri:c2=tri[{na}]")
            vlab, alab = nv, na

        if wm:
            x = f'{SAFE_X}' if args.pos.endswith('l') else f'W-w-{SAFE_X}'
            y = f'{SAFE_TOP}' if args.pos.startswith('t') else f'H-h-{SAFE_BOTTOM}'
            chains.append(f'[{len(clips)}:v]format=rgba,colorchannelmixer=aa={WM_OPACITY}[wm]')
            # Watermarked once, over the finished cut — put it on each clip
            # before the xfade and it cross-dissolves with itself at every join.
            chains.append(f'[{vlab}][wm]overlay={x}:{y}:format=auto[vout]')
            vlab = 'vout'

        cmd += ['-filter_complex', ';'.join(chains), '-map', f'[{vlab}]', '-map', f'[{alab}]']
        cmd += ['-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1',
                '-preset', 'medium', '-crf', str(args.crf), '-pix_fmt', 'yuv420p',
                '-maxrate', args.maxrate,
                '-bufsize', str(int(args.maxrate.rstrip('M')) * 2) + 'M',
                '-g', str(FPS * 2), '-keyint_min', str(FPS), '-sc_threshold', '0',
                '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
                '-movflags', '+faststart', str(args.out)]

        total = sum(d for _, d in clips) - T * (len(clips) - 1)
        print(f'\nJoining {len(clips)} clips, {T:.2f}s transitions '
              f'({args.transition or args.style}) -> {total:.1f}s')
        print(f'  engine: {ffmpeg}'
              + ('  (patched — GL transitions native)' if patched
                 else '  (stock — GL transitions run as expressions)'))
        if slow:
            # Said before the render, not after: four minutes a cut is a thing
            # to know while there is still time to pick a different style.
            print(f'  {slow} GL transition(s) have no native form here and will run as '
                  f'expressions —\n  budget about 4 minutes each. '
                  f'tools/reels/build-ffmpeg-xfade.sh makes this ~50x faster.')
        p = run(cmd)
        if p.returncode:
            sys.exit(f'ffmpeg failed\n{p.stderr.strip()[-2500:]}')

    info = probe(args.out)
    v = next(s for s in info['streams'] if s['codec_type'] == 'video')
    print(f"  {args.out}  {v['width']}x{v['height']}  "
          f"{float(info['format']['duration']):.1f}s  "
          f"{int(info['format']['size']) / 1e6:.1f} MB")
    print('  cuts: ' + ' → '.join(used))


if __name__ == '__main__':
    main()
