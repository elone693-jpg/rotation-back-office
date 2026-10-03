"""Génère les icônes de l'application (PNG) sans dépendance : python3 scripts/icones.py
Dégradé turquoise → bleu profond, calendrier blanc à bandeau rouge, flèche de rotation turquoise.
Le motif reste dans la zone sûre centrale (icônes « maskable » Android et coins arrondis iOS)."""
import math, os, struct, zlib

TEAL, DEEP, RED, WHITE, ARROW = (0, 163, 180), (11, 74, 92), (237, 28, 36), (255, 255, 255), (0, 127, 140)

def sd_round_rect(x, y, cx, cy, hw, hh, r):
    qx, qy = abs(x - cx) - hw + r, abs(y - cy) - hh + r
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r

def cover(d, aa):
    return max(0.0, min(1.0, 0.5 - d / aa))

def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def render(size):
    s = size / 512.0
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            x, y = (px + 0.5) / s, (py + 0.5) / s
            col = mix(TEAL, DEEP, min(1, max(0, (x * 0.45 + y * 0.9) / 640)))
            aa = 1.0 / s
            # calendrier
            body = sd_round_rect(x, y, 256, 272, 130, 118, 26)
            col = mix(col, WHITE, cover(body, aa))
            head = max(body, y - 206)          # bandeau haut du calendrier
            col = mix(col, RED, cover(head, aa))
            for rx in (196, 316):              # anneaux
                ring = sd_round_rect(x, y, rx, 148, 11, 26, 11)
                col = mix(col, WHITE, cover(ring, aa))
            # flèche de rotation (arc + pointe)
            r = math.hypot(x - 256, y - 292)
            ang = math.degrees(math.atan2(y - 292, x - 256)) % 360
            arc = abs(r - 62) - 13
            if 300 <= ang or ang <= 20:        # ouverture de l'arc
                arc = max(arc, 1.0)
            col = mix(col, ARROW, cover(arc, aa))
            # pointe de flèche vers la droite, au bout de l'arc (vers 300°)
            ax, ay = 256 + 62 * math.cos(math.radians(300)), 292 + 62 * math.sin(math.radians(300))
            tx, ty = x - ax, y - ay
            c, sn = math.cos(math.radians(30)), math.sin(math.radians(30))
            ux, uy = tx * c + ty * sn, -tx * sn + ty * c
            tri = max(-ux - 6, ux - 34, abs(uy) - (34 - ux) * 0.75)
            col = mix(col, ARROW, cover(tri, aa))
            row += bytes(int(round(v)) for v in col)
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

out = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(out, exist_ok=True)
for n in (180, 192, 512):
    with open(os.path.join(out, f'icon-{n}.png'), 'wb') as f:
        f.write(render(n))
    print('icons/icon-%d.png' % n)
