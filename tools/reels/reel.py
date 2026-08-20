"""Turn phone footage into an Instagram-ready 9:16 reel with the brand watermark.

    python3 tools/reels/reel.py IN.mp4 [IN2.mp4 photo.jpg ...] -o out/

Every output is 1080x1920, H.264 High / yuv420p, 30fps, AAC 48kHz stereo,
faststart, loudness-normalised — which is what Instagram wants handed to it. Give
it anything else and Instagram re-encodes from its own guess, which is where the
soft, dark, quiet version of your video comes from.

Why each step is here, since none of it is decoration:

**9:16 by construction.** A 16:9 clip cannot become 9:16 without either losing
two thirds of the frame or gaining bars. Cropping a shop opening throws away the
shop, so the default fills the space with a blurred, darkened copy of the frame
itself. Footage already shot vertically is scaled to fill, with no bars at all —
that is `--fit auto`, and it decides per clip.

**The watermark sits where Instagram's own UI does not.** The bottom ~330px
carries the caption, the handle and the audio strip, the right rail carries the
buttons, and the top ~90px is the header. Top-right at y=110 is clear of all of
it on every phone. Put it bottom-right and it spends its life behind a Like
button.

**Loudness, not volume.** Phone clips arrive anywhere from -30 to -8 LUFS.
Instagram normalises to about -14, so a quiet clip gets pushed up — noise and
all — and a loud one gets squashed. Doing it here, once, with a real two-pass
measurement, is the difference.

**Sharpening after upscale, never before.** WhatsApp hands over 1024x576; 1080x1920
is an upscale either way, and an unsharp pass after the scale recovers the edges
the scale invented. Before it, it just amplifies WhatsApp's compression.

Options worth knowing:

    --pos tr|tl|br|bl     watermark corner (default tr)
    --fit auto|blur|cover|pad
    --mark gold|cream     cream for footage that is already all gold
    --start / --end       trim, in seconds or mm:ss
    --duration            for stills (default 6s, with a slow push in)
    --no-watermark
    --cover-frame         also write a poster JPG for the reel cover
    --crf / --maxrate     quality and its ceiling (defaults 21 and 6M)
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WATERMARKS = {
    'gold': ROOT / 'branding' / 'video' / 'watermark-gold.png',
    'cream': ROOT / 'branding' / 'video' / 'watermark-cream.png',
}

W, H = 1080, 1920
FPS = 30

# Where Instagram's own chrome is, on a 1080x1920 frame. The watermark goes in
# the gap. These are the numbers to change if the app's layout moves.
SAFE_X = 48
SAFE_TOP = 112            # clear of the Reels header
SAFE_BOTTOM = 336         # clear of caption, handle and the audio strip

WM_OPACITY = 0.88
IMAGES = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp'}


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def need(tool: str) -> None:
    if not shutil.which(tool):
        sys.exit(f'{tool} is not installed.  apt-get install -y ffmpeg')


def probe(path: Path) -> dict:
    p = run(['ffprobe', '-v', 'error', '-print_format', 'json',
             '-show_streams', '-show_format', str(path)])
    if p.returncode:
        sys.exit(f'{path.name}: {p.stderr.strip()}')
    return json.loads(p.stdout)


def video_shape(info: dict) -> tuple[int, int, bool]:
    """Displayed width and height, and whether the file has audio.

    Rotation matters and is easy to get wrong: a phone writes 1024x576 with a
    -90 display matrix for a clip that is actually portrait. ffmpeg rotates it
    on decode, so every decision downstream has to be made on the DISPLAYED
    shape, not on the stored one.
    """
    v = next((s for s in info['streams'] if s['codec_type'] == 'video'), None)
    if not v:
        sys.exit('No video stream.')
    w, h = int(v['width']), int(v['height'])
    rot = 0
    for sd in v.get('side_data_list', []) or []:
        if 'rotation' in sd:
            rot = int(sd['rotation'])
    if abs(rot) % 180 == 90:
        w, h = h, w
    has_audio = any(s['codec_type'] == 'audio' for s in info['streams'])
    return w, h, has_audio


def seconds(v: str | None) -> float | None:
    """Accepts 12, 12.5, 1:05 or 1:05.5 — because nobody counts a clip in seconds."""
    if v is None:
        return None
    if ':' in v:
        m, s = v.rsplit(':', 1)
        return int(m) * 60 + float(s)
    return float(v)


def measure_loudness(path: Path, trim: list[str]) -> dict | None:
    """First pass of a two-pass loudnorm.

    One-pass loudnorm has to guess as it goes, so the opening seconds come out
    at the wrong level — which on a clip that opens with a ribbon being cut is
    exactly the part that matters.
    """
    p = run(['ffmpeg', '-hide_banner', *trim, '-i', str(path),
             '-af', 'loudnorm=I=-14:LRA=11:TP=-1.5:print_format=json',
             '-f', 'null', '-'])
    m = re.findall(r'\{[^{}]*"input_i"[^{}]*\}', p.stderr, re.S)
    if not m:
        return None
    try:
        return json.loads(m[-1])
    except json.JSONDecodeError:
        return None


def build_filter(src_w: int, src_h: int, fit: str, wm: Path | None,
                 pos: str, is_still: bool, dur: float) -> tuple[str, str]:
    """The filter graph, and the label of its video output."""
    aspect = src_w / src_h
    target = W / H

    if fit == 'auto':
        # Within 4% of 9:16 is "shot for this", and filling the frame beats
        # hairline bars nobody meant to be there.
        fit = 'cover' if abs(aspect - target) / target < 0.04 else 'blur'

    chains = []

    if is_still:
        # A still that just sits there reads as a broken video. A slow push in
        # over the whole clip is the least-effort thing that reads as alive.
        # zoompan works on frames, so the zoom is expressed per frame.
        frames = max(1, int(dur * FPS))
        base = (f"[0:v]scale={W*2}:{H*2}:force_original_aspect_ratio=increase,"
                f"crop={W*2}:{H*2},"
                f"zoompan=z='min(zoom+{0.10/frames:.8f},1.10)':d={frames}:"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
                f"setsar=1[base]")
        chains.append(base)
    elif fit == 'cover':
        chains.append(
            f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,"
            f"crop={W}:{H},unsharp=5:5:0.5:5:5:0.0,fps={FPS},setsar=1[base]")
    elif fit == 'pad':
        chains.append(
            f"[0:v]scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,fps={FPS},setsar=1[base]")
    else:  # blur
        # The background is the frame itself, blown up, blurred and taken down
        # in brightness and saturation. Darker and duller on purpose: it has to
        # read as wall, not as a second video competing with the first.
        chains.append(
            f"[0:v]split=2[bgsrc][fgsrc];"
            f"[bgsrc]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
            f"gblur=sigma=32,eq=brightness=-0.10:saturation=0.55[bg];"
            f"[fgsrc]scale={W}:-2:flags=lanczos,unsharp=5:5:0.55:5:5:0.0[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,fps={FPS},setsar=1[base]")

    if wm is None:
        chains[-1] = chains[-1].replace('[base]', '[v]')
        return ';'.join(chains), '[v]'

    x = f"{SAFE_X}" if pos.endswith('l') else f"W-w-{SAFE_X}"
    y = f"{SAFE_TOP}" if pos.startswith('t') else f"H-h-{SAFE_BOTTOM}"
    chains.append(f"[1:v]format=rgba,colorchannelmixer=aa={WM_OPACITY}[wm]")
    chains.append(f"[base][wm]overlay={x}:{y}:format=auto[v]")
    return ';'.join(chains), '[v]'


def render(src: Path, out_dir: Path, args) -> Path:
    info = probe(src)
    is_still = src.suffix.lower() in IMAGES
    wm = None if args.no_watermark else WATERMARKS[args.mark]
    if wm and not wm.exists():
        sys.exit(f'{wm} is missing — run: python3 tools/reels/make_watermark.py')

    if is_still:
        src_w, src_h, has_audio = int(info['streams'][0]['width']), int(info['streams'][0]['height']), False
        dur = args.duration
    else:
        src_w, src_h, has_audio = video_shape(info)
        dur = float(info['format']['duration'])

    start, end = seconds(args.start), seconds(args.end)
    trim: list[str] = []
    if start:
        trim += ['-ss', str(start)]
    if end:
        trim += ['-to', str(end)]
    if start or end:
        dur = (end or dur) - (start or 0)

    graph, vlabel = build_filter(src_w, src_h, args.fit, wm, args.pos, is_still, dur)

    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y']
    if is_still:
        cmd += ['-loop', '1', '-t', f'{dur}', '-i', str(src)]
    else:
        cmd += [*trim, '-i', str(src)]
    if wm:
        cmd += ['-i', str(wm)]

    afilter = 'anull'
    if has_audio:
        stats = measure_loudness(src, trim)
        if stats:
            # Two-pass: hand the measurement back so the second pass applies a
            # known correction instead of chasing the level as it plays.
            afilter = (f"loudnorm=I=-14:LRA=11:TP=-1.5:"
                       f"measured_I={stats['input_i']}:measured_LRA={stats['input_lra']}:"
                       f"measured_TP={stats['input_tp']}:measured_thresh={stats['input_thresh']}:"
                       f"offset={stats['target_offset']}:linear=true")
        else:
            afilter = 'loudnorm=I=-14:LRA=11:TP=-1.5'
        cmd += ['-filter_complex', graph, '-map', vlabel, '-map', '0:a:0', '-af', afilter]
    else:
        # Silent track rather than no track. A reel with no audio stream at all
        # is treated as "original audio" by some clients and shows a missing
        # audio strip, and it cannot be given a soundtrack in the editor.
        cmd += ['-f', 'lavfi', '-t', f'{dur}', '-i', 'anullsrc=r=48000:cl=stereo']
        cmd += ['-filter_complex', graph, '-map', vlabel, '-map', f'{2 if wm else 1}:a']

    out = out_dir / f'{src.stem.split("-", 1)[-1]}-reel.mp4'
    cmd += [
        '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1',
        '-preset', args.preset, '-crf', str(args.crf), '-pix_fmt', 'yuv420p',
        # Quality-targeted with a ceiling. Without the cap the blurred
        # background and the upscale's grain pull the bitrate past 10 Mbps —
        # twice what Instagram keeps, so it is upload weight that is thrown
        # away on arrival. The cap costs nothing visible and halves the file.
        '-maxrate', args.maxrate, '-bufsize', str(int(args.maxrate.rstrip('M')) * 2) + 'M',
        '-g', str(FPS * 2), '-keyint_min', str(FPS), '-sc_threshold', '0',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
        '-movflags', '+faststart', '-shortest', str(out),
    ]

    p = run(cmd)
    if p.returncode:
        sys.exit(f'{src.name}: ffmpeg failed\n{p.stderr.strip()[-2000:]}')

    if args.cover_frame:
        cover = out.with_suffix('.cover.jpg')
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
             '-ss', f'{min(1.0, dur / 3):.2f}', '-i', str(out),
             '-frames:v', '1', '-q:v', '2', str(cover)])
    return out


def main() -> None:
    need('ffmpeg')
    need('ffprobe')

    ap = argparse.ArgumentParser(description='Instagram-ready 9:16 reels, watermarked.')
    ap.add_argument('inputs', nargs='+', type=Path)
    ap.add_argument('-o', '--out', type=Path, default=Path('reels'))
    ap.add_argument('--pos', choices=['tr', 'tl', 'br', 'bl'], default='tr',
                    help='watermark corner (default tr — clear of Instagram\'s own UI)')
    ap.add_argument('--fit', choices=['auto', 'blur', 'cover', 'pad'], default='auto')
    ap.add_argument('--mark', choices=['gold', 'cream'], default='gold')
    ap.add_argument('--no-watermark', action='store_true')
    ap.add_argument('--start', help='trim from, seconds or mm:ss')
    ap.add_argument('--end', help='trim to, seconds or mm:ss')
    ap.add_argument('--duration', type=float, default=6.0, help='seconds per still image')
    ap.add_argument('--crf', type=int, default=21, help='lower is better quality (18-23)')
    ap.add_argument('--maxrate', default='6M', help='bitrate ceiling; Instagram keeps about 5 Mbps')
    ap.add_argument('--preset', default='medium', help='x264 preset; slow gains little on phone footage')
    ap.add_argument('--cover-frame', action='store_true', help='also write a poster JPG')
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    for src in args.inputs:
        if not src.exists():
            sys.exit(f'{src} not found')
        out = render(src, args.out, args)
        info = probe(out)
        v = next(s for s in info['streams'] if s['codec_type'] == 'video')
        size = int(info['format']['size']) / 1e6
        print(f'  {out.name:<34} {v["width"]}x{v["height"]}  '
              f'{float(info["format"]["duration"]):5.1f}s  {size:5.1f} MB')


if __name__ == '__main__':
    main()
