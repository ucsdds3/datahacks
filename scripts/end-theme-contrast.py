"""WCAG contrast check for the portal's End theme (src/staff-portal/end-theme.css).

Usage: python3 scripts/end-theme-contrast.py

Text must reach 4.5:1 (AA); focus rings and control borders 3:1. Translucent glass
(the sidebar and page-title strips) is checked over the brightest end-stone in the
painting, the worst case, ignoring the blur that only helps.
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

BRIGHTEST_ISLAND = '#fdf3c0'  # 99th percentile luminance of the artwork
GLASS = over('#180d2c', 0.78, BRIGHTEST_ISLAND)      # page titles, handbook contents
SIDEBAR = over('#180d2c', 0.84, BRIGHTEST_ISLAND)
SIDEBAR_ACTIVE = over('#a97fbf', 0.26, SIDEBAR)
CARD = '#f2ecd0'
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
    ('Read-only input', '#594a6b', '#ebe4c3', TEXT),
    ('Checkbox row text', '#26173a', '#ebe5c6', TEXT),
    ('Combobox highlighted option', '#26173a', '#e2d3ee', TEXT),
    ('Input border vs panel', '#76678a', CARD, NON_TEXT),
    ('Focus ring on panel', '#0c6a61', CARD, NON_TEXT),
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
