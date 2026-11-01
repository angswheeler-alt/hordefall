The user's item art (2026-11-01). Raw Grok pictures on magenta live on the project drive
(art/items-pages/raw/). `python3 art/icons/items/cut.py <raw> <out>` keys out the magenta and trims each one
to 128 px (chests are split into -closed and -open). The game copies sit in src/assets/ui/:
coin, gem, ember, hp, ess-*, mat-crystal, mat-wild, unbinder, chest (Hero Chest), chest-open, glyph-chest,
glyph-grand, glyph-family, asc-chest-<element>, crest-<rarity> (frames; src/ui.ts crestFace puts the hero's face in)
and crest (common frame with a star, for crest counts).
