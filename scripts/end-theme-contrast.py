"""WCAG contrast check for the portal's End theme (src/staff-portal/end-theme.css).

Usage: python3 scripts/end-theme-contrast.py

Text must reach 4.5:1 (AA); focus rings and control borders 3:1. The glass is
layered as on the page (sheet, then the sidebar pane or a title tile) and checked
over the brightest pixel in the painting; the translucent stone panels over the
darkest. Both ignore the blur, which only helps. No text sits on the bare sheet.
"""
import sys

def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def over(top, alpha, bottom):
    return '#' + ''.join(f'{round(alpha * t + (1 - alpha) * b):02x}' for t, b in zip(rgb(top), rgb(bottom)))

def luminance(h):
    def channel(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = map(channel, rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

# The painting's extremes (scripts measured end-sky-wide/tall.webp): text on glass is
# checked over the brightest pixel (99.9th percentile luminance), dark text on the
# translucent stone over the darkest, both ignoring the blur and the scrim, which only help.
BRIGHTEST_ISLAND = '#fff7e8'
DARKEST_SKY = '#180a2a'

# The tempered-glass layers in end-theme.css, stacked as they are on the page.
SHEET = ('#170d29', 0.38)   # --glass-sheet, the frosted sheet holding the app
PANE = ('#34225a', 0.70)    # --glass-pane, the sidebar on the sheet
TILE = ('#0e071c', 0.58)    # --glass-tile, page titles and handbook contents on the sheet
STONE = ('#f1ecd4', 0.95)   # --end-card, the end-stone panels on the sheet

def stack(base, *layers):
    for colour, alpha in layers:
        base = over(colour, alpha, base)
    return base

GLASS = stack(BRIGHTEST_ISLAND, SHEET, TILE)
SIDEBAR = stack(BRIGHTEST_ISLAND, SHEET, PANE)
SIDEBAR_ACTIVE = over('#4fd1bf', 0.13, SIDEBAR)
SIDEBAR_HOVER = over('#ffffff', 0.07, SIDEBAR)
SIGN_OUT = over('#ffffff', 0.1, SIDEBAR)
SHEET_ON_SKY = stack(DARKEST_SKY, SHEET)
CARD_DARKEST = stack(DARKEST_SKY, SHEET, STONE)
CARD = CARD_DARKEST  # the panel over the darkest sky: the worst case for its dark text
INPUT = '#fbf8ea'

TEXT, NON_TEXT = 4.5, 3.0
checks = [
    # Purple glass
    ('Page title on glass', '#f6f1dc', GLASS, TEXT),
    ('Page subtitle on glass', '#d4c8e8', GLASS, TEXT),
    ('Link on glass ("Sign it now")', '#7ae6d6', GLASS, TEXT),
    ('Waiver "Completed" on glass', '#9fe3ad', GLASS, TEXT),
    ('Waiver "Incomplete" on glass', '#f5c27e', GLASS, TEXT),
    ('Sidebar link', '#d4c8e8', SIDEBAR, TEXT),
    ('Sidebar active link', '#f6f1dc', SIDEBAR_ACTIVE, TEXT),
    ('Sidebar link, hovered', '#f6f1dc', SIDEBAR_HOVER, TEXT),
    ('Sidebar "Portal" label', '#d4c8e8', SIDEBAR, TEXT),
    ('Sign out (hovered)', '#f6f1dc', SIGN_OUT, TEXT),
    ('Active tab bar (pearl) vs sidebar', '#4fd1bf', SIDEBAR, NON_TEXT),
    ('Focus ring on glass', '#7ae6d6', GLASS, NON_TEXT),
    # End-stone panels
    ('Body text on panel', '#26173a', CARD, TEXT),
    ('Muted text on panel', '#594a6b', CARD, TEXT),
    ('Panel heading', '#2c1b42', CARD, TEXT),
    ('Handbook prose', '#3a2c4a', CARD, TEXT),
    ('Form label', '#3a2950', CARD, TEXT),
    ('Link on panel', '#0c6a61', CARD, TEXT),
    ('Error / required marker', '#a12c26', CARD, TEXT),
    ('Signed / checked-in green', '#22683a', CARD, TEXT),
    ('Orange note', '#8a4510', CARD, TEXT),
    ('Status pill text', '#26173a', CARD, TEXT),
    ('Input text', '#26173a', INPUT, TEXT),
    ('Placeholder', '#6c5d7d', INPUT, TEXT),
    ('Birthdate "MM/DD/YYYY" hint', '#6c5d7d', INPUT, TEXT),
    ('Read-only input', '#594a6b', '#ebe4c3', TEXT),
    ('Checkbox row text', '#26173a', '#ebe5c6', TEXT),
    ('Combobox highlighted option', '#26173a', '#e2d3ee', TEXT),
    ('Input border vs panel', '#76678a', CARD, NON_TEXT),
    ('Focus ring on panel', '#0c6a61', CARD, NON_TEXT),
    ('Focus ring vs input', '#0c6a61', INPUT, NON_TEXT),
    ('Section heading on panel', '#2c1b42', CARD, TEXT),
    ('Button (stone)', '#26173a', '#e6dfbb', TEXT),
    ('Button (primary, pearl)', '#0b2224', '#4fd1bf', TEXT),
    ('Button (disabled)', '#5a4b6b', '#ddd6b6', TEXT),
    ('Tab / table header text', '#594a6b', '#e6dfbb', TEXT),
    ('Done step marker', '#faf5ff', '#6b4a8e', TEXT),
    ('Current step marker', '#4a3166', INPUT, TEXT),
    ('Waiver step number', '#3e2858', '#efe4f6', TEXT),
    ('Tag: mentor', '#283f8c', '#dde0f6', TEXT),
    ('Tag: judge', '#8a4512', '#f1dcc7', TEXT),
    ('Tag: required', '#932f25', '#f2d3cf', TEXT),
    ('Avatar initials', '#0a4d46', '#cfe8e0', TEXT),
    ('Demo note', '#5f4710', '#f6ecc9', TEXT),
]

failed = False
for name, fg, bg, need in checks:
    value = ratio(fg, bg)
    ok = value >= need
    failed |= not ok
    print(f'{"ok  " if ok else "FAIL"} {value:5.2f}:1 (needs {need}) {name}: {fg} on {bg}')
sys.exit(1 if failed else 0)
