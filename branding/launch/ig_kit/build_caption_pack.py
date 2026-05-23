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
        # New follow-conversion vocabulary (6 phrases total)
        "FOLLOW @TRESOR.COUTURE":   "Follow @tresor.couture for daily pieces.",
        "FOLLOW FOR FIRST LOOKS":   "Follow @tresor.couture for first looks.",
        "FOLLOW FOR DAILY NOTES":   "Follow @tresor.couture for daily notes.",
        "FOLLOW FOR THE EDIT":      "Follow @tresor.couture for the edit.",
        "FOLLOW THE JOURNEY":       "Follow @tresor.couture for the journey.",
        "+ FOLLOW FOR MORE":        "Follow @tresor.couture — there is more.",
        "SHOP @TRESOR.COUTURE":     "Shop the edit — link in bio.",
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
