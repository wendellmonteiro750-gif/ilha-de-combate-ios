# Battle Island character asset

Place the supplied model file at this exact path:

`assets/military-male-03.glb`

The game loader checks this path first and falls back to the previous character if the file is not present.

The uploaded model uses a Bip01 skeleton. Arm and hand bone aliases are mapped in game.js. Its animation clips are not included in the GLB, so locomotion and prone animations still need retargeting/procedural implementation.
