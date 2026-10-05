# /// script
# requires-python = ">=3.11,<3.12"
# dependencies = [
#   "polars==0.16.16",
#   "pandas==1.5.3",
#   "numpy==1.24.4",
#   "pyarrow==11.0.0",
# ]
# ///
"""
Build web/public/data/gazetteer.json — the small location → GCC lookup the
browser demo uses instead of the course-provided sal.json.

1. Run the ORIGINAL `process_salV1` on sal.json and build `sal_dict` exactly
   as main.py does (16.6k keys including the bigram rows).
2. For every place name in the synthetic vocabulary
   (web/src/lib/synth/places.json) apply the ORIGINAL `normalise_location`
   and `return_words_ngrams`, and keep every n-gram that is a key of
   `sal_dict`.

Because every key that any of a place's n-grams could hit is kept, resolving
those places against the subset gives exactly the same first match as
against the full dictionary, while only a few hundred derived entries are
published. The expected resolution of each vocabulary entry is stored too
and checked by the web test-suite.

Usage:
  uv run scripts/build_gazetteer.py --sal path/to/sal.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from _original import REPO, build_sal_dict, load_original

PLACES = REPO / "web" / "src" / "lib" / "synth" / "places.json"
OUT = REPO / "web" / "public" / "data" / "gazetteer.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sal", required=True, type=Path)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    sal_path = args.sal.resolve()
    out = args.out.resolve()
    places = json.loads(PLACES.read_text())["places"]
    sal_sha = hashlib.sha256(sal_path.read_bytes()).hexdigest()

    orig = load_original(sal=sal_path)
    sal_dict = build_sal_dict(orig)
    normalise_location = orig.utils.normalise_location
    return_words_ngrams = orig.twitter_processor.return_words_ngrams

    subset: dict[str, str] = {}
    resolved = []
    for p in places:
        location = normalise_location(p["name"].lower())
        grams = return_words_ngrams(location.split(" "))
        hits = [g for g in grams if sal_dict.get(g)]
        for g in hits:
            subset[g] = sal_dict[g]
        first = hits[0] if hits else None
        resolved.append(
            {
                "name": p["name"],
                "location": location,
                "matchedBy": first,
                "gcc": sal_dict[first] if first else None,
                "tried": (grams.index(first) + 1) if first else len(grams),
            }
        )

    payload = {
        "_provenance": (
            "Derived by scripts/build_gazetteer.py: the original coursework "
            "process_salV1() + normalise_location() + return_words_ngrams() run on "
            "sal.json, restricted to the n-grams of the synthetic place vocabulary. "
            "Not the course-provided file."
        ),
        "source": {
            "salSha256": sal_sha,
            "fullDictionaryKeys": len(sal_dict),
        },
        "dict": dict(sorted(subset.items())),
        "places": resolved,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {out}: {len(subset)} keys for {len(places)} places")


if __name__ == "__main__":
    main()
