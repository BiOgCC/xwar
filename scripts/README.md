# Scripts Directory

Utility scripts for asset processing and one-off data fixes.

## `asset-processing/`
Python and CJS scripts for processing game assets (images, sprites, avatars):
- `check_transparency.py` — Verify image transparency
- `copy_avatars.py` — Copy/organize avatar assets
- `copy_soldiers.cjs` — Copy soldier sprite assets
- `inspect_sniper.py` — Debug sniper asset
- `process_icons.py` — Process icon assets
- `process_target.py` — Process target overlay assets
- `remove_bg_icons.py` — Remove backgrounds from icon images
- `remove_bg_soldiers.py` — Remove backgrounds from soldier images
- `remove_green.py` — Remove green screen backgrounds

## `data-fixes/`
One-off data migration and fix scripts:
- `copy_cards.cjs` — Copy card data
- `copy_stages.cjs` — Copy stage data
- `fix_inventory.cjs` — Fix inventory data structure
- `fix_spec.cjs` — Fix specialization data
- `spec_replacement.tsx` — Specialization UI replacement script
- `ui_fix.cjs` — UI data fixes
