"""Stable building/furniture IDs shared by storage and AI validation.

Rendering definitions live in scene3d/modules.js. The maintenance contract check
compares these IDs with that catalog so new pieces cannot become unsavable.
"""
MODULE_IDS=frozenset({
    'floor','slab','wall_3_solid','wall_3_window_closed','wall_3_window_open',
    'wall_3_door_closed','wall_3_door_open','wall_3_doorway','wall_2_solid',
    'wall_1_solid','fence','roof_flat','roof_slope','stair_straight','pillar',
    'bed_double','nightstand','wardrobe','desk','chair','lamp','rug',
})
