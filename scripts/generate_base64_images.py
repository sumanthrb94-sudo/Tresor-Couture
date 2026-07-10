from PIL import Image
import json, os, io, base64

base = r'C:\Users\91779\TresorCouture\Tresor-Couture\inventory-from-pptx'
img_dir = os.path.join(base, 'images')
out_path = os.path.join(base, 'images_base64.json')
max_kb = 900

with open(os.path.join(base, 'inventory_first15.json'), encoding='utf-8') as f:
    rows = json.load(f)

output = {}
for row in rows:
    code = row['code'] or f"SLIDE{row['slide']:02d}"
    image_file = row['image_files'].split(';')[0] if row['image_files'] else None
    if not image_file:
        print(f'  X {code}: no image file')
        continue

    local_path = os.path.join(img_dir, image_file)
    img = Image.open(local_path).convert('RGB')

    # Resize if too large
    img.thumbnail((1200, 1200), Image.LANCZOS)

    quality = 85
    while True:
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=quality, optimize=True, progressive=True)
        size_kb = buf.tell() / 1024
        if size_kb <= max_kb or quality <= 40:
            break
        quality -= 10
        # also downsize a bit more if still too big
        if size_kb > max_kb and quality <= 60:
            img.thumbnail((img.width * 0.8, img.height * 0.8), Image.LANCZOS)

    if size_kb > max_kb:
        print(f'  X {code}: still too large ({size_kb:.1f} KB)')
        continue

    b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    output[code] = f'data:image/jpeg;base64,{b64}'
    print(f'  OK {code}: {size_kb:.1f} KB')

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)
print(f'\nWrote {out_path}')
