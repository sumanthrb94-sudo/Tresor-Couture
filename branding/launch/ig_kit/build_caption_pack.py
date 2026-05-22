"""
Emit a captions.csv + README.md alongside the rendered assets.

The CSV is ready to paste into Meta's bulk-upload flow or any social
scheduler (Buffer, Later, Metricool). Each row pairs one filename with a
suggested IG caption written in the Tresor voice + a hashtag mix that
respects the brand's restrained tone.
"""

from __future__ import annotations

import csv
from pathlib import Path
from specs import VIDEOS, POSTS, ROOT

# Restrained, on-brand hashtag pool. No #fashioninfluencer / no spammy tags.
BASE_TAGS = "#TresorCouture #SlowFashion #CuratedWardrobe #IndianBoutique #HandpickedFashion"
NICHE = {
    "THE ARCHIVE":        "#NewArrival #LimitedDrop",
    "A SINGLE PIECE":     "#StatementPiece #DressEdit",
    "THE CAPSULE":        "#CapsuleWardrobe #LessButBetter",
    "THE EDIT":           "#Lookbook #StyleEdit",
    "THE DETAILS":        "#CraftDetails #Handfinished",
    "RETURNED":           "#BackInStock #BoutiqueRestock",
    "THE TRANSITION":     "#StyleReel #OneDropThreeWays",
    "THE FORMULA":        "#StyleFormula #ConsideredDressing",
    "DAY TO NIGHT":       "#DayToNight #VersatileStyle",
    "THE UNBOXING":       "#Unboxing #BoutiqueArrival",
    "STYLING NOTE":       "#StylingNote #QuietLuxury",
    "ON VERSATILITY":     "#OutfitRepeater #VersatileWardrobe",
    "LAYERING NOTE":      "#LayeringGuide #SeasonalDressing",
    "THE FIX":            "#StyleFix #TailoringMatters",
    "ON CONFIDENCE":      "#MainCharacterEnergy #DressWell",
    "ON TRAVEL":          "#AirportStyle #TravelEdit",
    "ON PRESENCE":        "#DateNightLook #ConfidencePiece",
    "OUTFIT CHECK":       "#OutfitCheck #OOTD",
    "ON BECOMING":        "#FeelGoodFashion #Empowerment",
    "BEHIND THE WORK":    "#BehindTheBoutique #SmallBusiness",
    "THE BEGINNING":      "#FounderStory #BrandStory",
    "MEET THE CURATOR":   "#MeetTheMaker #CuratedByHand",
    "THE STANDARDS":      "#QualityFirst #SlowFashionPromise",
    "THE JOURNEY":        "#BoutiqueJourney #Gratitude",
    "ON PRICING":         "#HonestPricing #FairFashion",
    "STYLING GUIDE":      "#StylingGuide #ShirtStyling",
    "THE RULE OF THREE":  "#AccessoryEdit #DetailMatters",
    "COLOUR STUDY":       "#ColourStudy #PaletteInspo",
    "THE FIVE":           "#ShoeEssentials #WardrobeBasics",
    "THE DECODER":        "#SmartCasual #DressCodeDecoded",
    "FROM A CUSTOMER":    "#CustomerLove #BoutiqueLove",
    "A NOTE WE KEEP":     "#CustomerReview #SizeInclusive",
    "THE SHIFT":          "#WardrobeShift #BeforeAfter",
    "THE LOOP":           "#RepeatCustomer #BoutiqueFamily",
    "ONE EVENING":        "#WeddingGuest #StatementDress",
    "SEASONAL EDIT":      "#SeasonalEssentials #WardrobeStaples",
    "THE OCCASION":       "#FestiveEdit #OccasionWear",
    "COLOUR STORY":       "#ColourStory #SeasonalPalette",
    "A SUNDAY":           "#SundayReset #SelfCare",
    "THE PLANNER":        "#WeekendStyle #OutfitPlanner",
    "ON INTENTION":       "#IntentionalStyle #ThatGirlAesthetic",
    "ON RITUAL":          "#WardrobeRitual #SelfCareSunday",
    "FABRIC 101":         "#FabricGuide #KnowYourFabrics",
    "ON FIT":             "#FitMatters #StyleEducation",
    "THE ARCHITECTURE":   "#WardrobeArchitecture #SmartCloset",
    "ON LONGEVITY":       "#GarmentCare #InvestmentPieces",
    "COLOUR THEORY":      "#ColourTheory #OutfitBuilding",
    "THE STRATEGY":       "#InvestmentDressing #SmartShopping",
}

def caption_for(spec: dict) -> str:
    hook = spec["hook"].rstrip(".")
    body = " ".join(spec["body"])
    cta_line_map = {
        "SHOP THE EDIT":            "Shop the edit — link in bio.",
        "DISCOVER THE PIECE":       "Discover the piece — link in bio.",
        "EXPLORE THE CAPSULE":      "Explore the capsule — link in bio.",
        "OPEN THE LOOKBOOK":        "Open the lookbook — link in bio.",
        "STUDY THE PIECE":          "Study the details — link in bio.",
        "CLAIM YOURS":              "Claim yours before it leaves — link in bio.",
        "SHOP ALL THREE":           "Shop all three — link in bio.",
        "BUILD THE LOOK":           "Build the look — link in bio.",
        "SHOP THE PIECE":           "Shop the piece — link in bio.",
        "ORDER FROM THE EDIT":      "Order from the edit — link in bio.",
        "READ THE FULL NOTE":       "Full note on the site — link in bio.",
        "SEE EACH WAY":             "See each way — link in bio.",
        "BROWSE THE LAYERS":        "Browse the layers — link in bio.",
        "LET US STYLE IT":          "We will style it for you — DM us.",
        "SHOP THE BASES":           "Shop the bases — link in bio.",
        "DRESS FOR YOURSELF":       "Dress for yourself — link in bio.",
        "SHOP THE TRAVEL EDIT":     "Shop the travel edit — link in bio.",
        "FIND YOUR PIECE":          "Find your piece — link in bio.",
        "FIND YOUR CONFIDENCE PIECE": "Find your confidence piece — link in bio.",
        "VISIT THE STUDIO":         "DM us to visit the studio.",
        "READ OUR STORY":           "Read the full story — link in bio.",
        "FOLLOW ALONG":             "Follow along for first looks.",
        "LEARN MORE":               "Read the standards — link in bio.",
        "JOIN US":                  "Join the community — link in bio.",
        "SUBSCRIBE FOR FIRST LOOKS":"Subscribe for first looks — link in bio.",
        "SHOP THE SHIRT":           "Shop the shirt — link in bio.",
        "BROWSE ACCESSORIES":       "Browse accessories — link in bio.",
        "EXPLORE THE PALETTE":      "Explore the palette — link in bio.",
        "SHOP FOOTWEAR":            "Shop footwear — link in bio.",
        "READ THE GUIDE":           "Read the guide — link in bio.",
        "START WITH ONE":           "Start with one piece — link in bio.",
        "READ MORE REVIEWS":        "Read more reviews — link in bio.",
        "BUILD YOURS":              "Build your wardrobe — link in bio.",
        "JOIN THE FAMILY":          "Join the family — link in bio.",
        "DRESS THE EVENING":        "Dress the evening — link in bio.",
        "EXPLORE BY COLOUR":        "Explore by colour — link in bio.",
        "BUILD THE CAPSULE":        "Build the capsule — link in bio.",
        "JOIN THE RITUAL":          "Join the ritual — link in bio.",
        "PLAN WITH US":             "Plan with us — DM the editor.",
        "START WITH ONE PIECE":     "Start with one piece — link in bio.",
        "REFRESH WITH US":          "Refresh with us — link in bio.",
        "READ THE FULL GUIDE":      "Read the full guide — link in bio.",
        "READ THE NOTE":            "Read the note — link in bio.",
        "SAVE THE GUIDE":           "Save the guide — link in bio.",
        "STUDY THE PALETTE":        "Study the palette — link in bio.",
        "READ THE STRATEGY":        "Read the strategy — link in bio.",
    }
    cta_line = cta_line_map.get(spec["cta"], "Discover more — link in bio.")
    tags = f"{BASE_TAGS} {NICHE.get(spec['category'], '#Boutique')}"
    return f"{hook}.\n\n{body}\n\n{cta_line}\n\n{tags}"


def main():
    out = ROOT / "captions.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["filename", "kind", "category", "hook", "caption_for_meta"])
        for s in VIDEOS:
            fn = f"videos/TresorCouture_Reel_{s['id']}_1080x1920.mp4"
            w.writerow([fn, "reel", s["category"], s["hook"], caption_for(s)])
        for s in POSTS:
            fn = f"posts/TresorCouture_Post_{s['id']}_1080x1350.jpg"
            w.writerow([fn, "post", s["category"], s["hook"], caption_for(s)])
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
