# -*- coding: utf-8 -*-
"""
Write product copy from what is actually known about each piece.

Grounded strictly in the product's own record: the garment type and colour in
its name, its master category, and its price. Nothing about fabric, handwork or
provenance is asserted unless the name states it — "Banarasi", "Denim",
"Leather" and "Sequin" are claims the record makes, so the copy may repeat
them; "hand-embroidered" is not, so it never appears uninvited.
"""
import json, re

rows = json.load(open("all.json"))

COLOURS = ["LAVENDER","SKYBLUE","SKY BLUE","RADIUM GREEN","LEMON GREEN","OLIVE GREEN","DARK GREEN",
           "ANTIQUE GOLD","CHAMPAGNE","CREAME","CREAM","MAGENTA","CRIMSON","MAROON","PURPLE","ORANGE",
           "YELLOW","GREEN","WHITE","BLACK","BROWN","BEIGE","BLUE","BULE","PINK","RED","MUD","IVORY",
           "SAGE","TAUPE","NAVY","GOLD","SILVER","GREY","GRAY","PEACH","MINT","BERRY","BLUSH"]
FIX = {"BULE":"blue","CREAME":"cream","SKYBLUE":"sky blue","GRAY":"grey","RADIUM GREEN":"radium green"}

def colour_of(name):
    u = " " + re.sub(r"[^A-Z ]", " ", name.upper()) + " "
    for c in COLOURS:
        if f" {c} " in u:
            return FIX.get(c, c.lower())
    return None

def has(name, *words):
    u = name.upper()
    return any(w in u for w in words)

def a(word):
    return "an" if word[0].lower() in "aeiou" else "a"

def copy_for(r):
    n = (r["name"].strip() + " " + (r["desc"] or "")).strip()
    cat, col = r["cat"], colour_of(n)
    C = col.capitalize() if col else None
    c = col or ""

    # --- pieces whose name names a fabric or technique -------------------
    if has(n, "BANARASI"):
        return ("Woven in the Banarasi tradition, with zari running through the drape and a border "
                "that carries the weight of the weave. A wedding-season piece that photographs as "
                "richly as it wears.")
    if has(n, "SEQUEL", "SEQUIN"):
        base = f"{C} sequin work" if C else "Sequin work"
        return (f"{base} across the length of the piece, catching light with every turn. Cut for "
                "receptions and sangeet evenings, where the room is lit low and the shine does the work.")
    if has(n, "LEATHER"):
        return ("A leather half piece, cut close and finished clean. Pairs back to a soft top or a "
                "full skirt when you want one structured element carrying the look.")
    if has(n, "DENIM") and has(n, "JUMPSUIT"):
        return ("A denim jumpsuit cut for an easy line through the waist, with the weight to hold its "
                "shape all day. Roll the cuff with flats for daytime, or belt it and add a heel.")
    if has(n, "DENIM") and has(n, "SHORT"):
        return ("Denim shorts in a clean, unfussy cut that sits well on the waist. The kind of piece "
                "that earns its place by going with everything already in the wardrobe.")
    if has(n, "DENIM") and has(n, "DRESS"):
        return (f"A{' ' + c if c else ''} denim dress with enough structure to stand on its own and "
                "enough ease to wear all day. Straightforward, and better for it.")
    if has(n, "JEANS"):
        return ("A special-edition jean, cut straight through the leg and finished with the detail "
                "that gives the piece its name. Made in a short run.")

    # --- Indian occasion wear -------------------------------------------
    if has(n, "SHERWANI"):
        return (f"{C + ' s' if C else 'A s'}herwani cut for the groom's side of the celebration — "
                "structured through the shoulder, falling clean to the knee. Wears with churidar "
                "or a straight trouser.")
    if has(n, "ANARKALI"):
        return (f"{C + ' a' if C else 'An a'}narkali with the flare coming in from the yoke, so it "
                "moves when you do. Full-length, and cut to be worn without a dupatta if the "
                "evening calls for it.")
    if has(n, "MASAKALI"):
        return (f"{C + ' m' if C else 'A m'}asakhali, cut in the silhouette the style is named for — "
                "fitted above, released below. A festive piece that reads dressed without being formal.")
    if has(n, "HALF SAREE"):
        return ("A half saree set — skirt, blouse and drape — for the ceremony where the whole point "
                "is the transition into it. Cut to be worn young and carried well.")
    if has(n, "ONE MINUTE SAREE"):
        return (f"{'A ' + c + ' o' if c else 'A o'}ne-minute saree: pre-draped and pre-pleated, so it "
                "goes on like a dress and falls like a saree. For the mornings where the ceremony "
                "starts before you have finished getting ready.")
    if has(n, "LEHANGA", "LEHENGA", "LAHANGACHOLI", "LEHANGACHOLI"):
        return (f"{'A ' + c + ' l' if c else 'A l'}ehenga choli — skirt, blouse and dupatta — cut "
                "with enough volume in the skirt to hold its shape through a long evening. A "
                "wedding-party piece.")
    if has(n, "THREE PIECE", "3 PIECE"):
        return (f"{'A ' + c + ' t' if c else 'A t'}hree-piece set that arrives complete, so nothing "
                "has to be matched to it. The easiest kind of festive dressing: one decision, "
                "not three.")
    if has(n, "SAREE"):
        return (f"{'A ' + c + ' s' if c else 'A s'}aree with the drape and fall to carry a full "
                "evening. Comes with its blouse piece, ready for the tailor.")
    if has(n, "GAGRA", "GHAGRA"):
        return ("A gagra choli cut full through the skirt, with a fitted choli and a drape to finish. "
                "Festive dressing that holds its shape from the ceremony to the last dance.")

    # --- western wear -----------------------------------------------------
    if has(n, "JUMPSUIT"):
        return (f"{'A ' + c + ' j' if c else 'A j'}umpsuit cut for a clean line through the waist. "
                "One piece, one decision, and it carries an evening without needing anything added.")
    if has(n, "MAXI"):
        return (f"{'A ' + c + ' m' if c else 'A m'}axi cut to fall full-length with an easy drape "
                "through the skirt. Wears flat by day and heeled after dark.")
    if has(n, "FROCK"):
        return (f"{'A ' + c + ' f' if c else 'A f'}rock with a fitted bodice and a skirt that moves. "
                "Short enough for the evening, structured enough for the office party.")
    if has(n, "GOWN"):
        return (f"{'A ' + c + ' g' if c else 'A g'}own cut to fall full-length, shaped through the "
                "bodice and released below. For the evening that asks for one considered piece "
                "and nothing else.")
    if has(n, "SKIRT"):
        return (f"{'A ' + c + ' s' if c else 'A s'}kirt cut to sit on the waist and fall clean. "
                "Pairs back to a fitted top, or to a blouse you already own.")
    if has(n, "SHORT"):
        return (f"{'T' if not c else C + ' s'}{'ailored shorts' if not c else 'horts'} cut to sit "
                "neatly on the waist. An easy, unfussy piece for warm mornings and long days.")
    if has(n, "OPEN TOP", "SLEEVE LESS", "SLEEVELESS", "TOP"):
        stretch = "Stretch through the body, so it moves with you rather than against you. " if has(n, "STRETCH") else ""
        sleeveless = "sleeveless " if has(n, "SLEEVE LESS", "SLEEVELESS") else ""
        return (f"{'A ' + c + ' ' + sleeveless if c else 'A ' + sleeveless}top cut clean and easy to "
                f"layer. {stretch}Works under a jacket or on its own.")
    if has(n, "BLOUSE"):
        return (f"{'A ' + c + ' b' if c else 'A b'}louse piece, ready for the tailor to cut to your "
                "measurements. Pairs with a saree or a lehenga skirt already in the wardrobe.")
    if has(n, "DRESS") and has(n, "BACK OPEN"):
        return (f"{'A ' + c + ' d' if c else 'A d'}ress with an open back — the detail sits behind "
                "you, so the front stays quiet and the turn does the talking.")
    if has(n, "DRESS"):
        return (f"{'A ' + c + ' d' if c else 'A d'}ress cut with a fitted bodice and a skirt that "
                "moves — the kind of piece that carries a dinner without needing much beside it.")
    if has(n, "COAT"):
        return ("Comes with its matching coat, so the layer is cut for the piece rather than borrowed "
                "from elsewhere. Wear it open through the ceremony, closed when the evening cools.")

    # --- nothing in the name to describe ---------------------------------
    # A piece already on the website cannot be left with a two-word description,
    # so it gets the honest floor: its category, and not one detail more. Draft
    # pieces are held back instead — inventing twelve different descriptions for
    # twelve products all named "DESIGNER WEAR" would be writing fiction about
    # real stock.
    if r["status"] == "Active":
        # TC00125 is named "WESTERN WEAR" but filed under Studios Pret, so key
        # off being live rather than off the category: whatever the shelf, a
        # piece a customer can buy today needs more than two words.
        return (f"A piece from the Tresor Couture {cat} rail, cut and finished in the Hyderabad "
                "atelier. Message us for measurements and fabric detail before you order.")
    return None

out, unnamed = [], []
for r in rows:
    if len(r["desc"]) >= 80:
        continue
    d = copy_for(r)
    if d:
        out.append((r, d))
    else:
        unnamed.append(r)

print(f"copy written : {len(out)}")
print(f"cannot write : {len(unnamed)}  (name gives nothing to describe)")
json.dump([{"r": r, "desc": d} for r, d in out], open("desc.json", "w"), ensure_ascii=False)
json.dump(unnamed, open("unnamed.json", "w"), ensure_ascii=False)
print("\n--- the 10 Active pieces (live on the site) ---")
for r, d in out:
    if r["status"] == "Active":
        print(f"\n{r['bc']}  {r['name']}\n   {d}")
