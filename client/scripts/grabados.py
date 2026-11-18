"""
Genera las ilustraciones de línea tipo grabado de SIGTA (public/img/grabados/*.svg).
Son dibujos propios, hechos con trazos y rayados: una escena por área.
Uso:  python3 scripts/grabados.py
Se usan como máscara en el CSS, así el color lo pone el tema (claro u oscuro).
"""
import math, random
from pathlib import Path

W, H = 1200, 300
SUELO = 232

class Dibujo:
    def __init__(self, semilla):
        self.r = random.Random(semilla); self.piezas = [([], '')]; self.t = self.piezas[0][0]
        self.caja = (0, 0, W, H)   # x, y, ancho, alto del dibujo
    def pieza(self, silueta=''):
        """Empieza un objeto nuevo. Su silueta tapa todo lo que se dibujó antes (lo que queda detrás)."""
        self.piezas.append(([], silueta)); self.t = self.piezas[-1][0]
    @staticmethod
    def pol(pts): return '<path d="M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z"/>'
    def j(self, v, a=0.8): return v + self.r.uniform(-a, a)          # pulso de la mano
    def linea(self, x1, y1, x2, y2, g=1.1, a=0.8):
        # una recta dibujada a mano: levemente curva
        mx, my = (x1 + x2) / 2 + self.r.uniform(-a, a), (y1 + y2) / 2 + self.r.uniform(-a, a)
        self.t.append(f'<path d="M{self.j(x1,a/2):.1f} {self.j(y1,a/2):.1f}Q{mx:.1f} {my:.1f} {self.j(x2,a/2):.1f} {self.j(y2,a/2):.1f}" stroke-width="{g}"/>')
    def poli(self, pts, g=1.2, cerrar=True):
        n = len(pts)
        for i in range(n if cerrar else n - 1):
            (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % n]; self.linea(x1, y1, x2, y2, g)
    def curva(self, pts, g=1.1):
        d = f'M{pts[0][0]:.1f} {pts[0][1]:.1f}'
        for i in range(1, len(pts) - 1):
            (x, y), (nx, ny) = pts[i], pts[i + 1]; d += f'Q{x:.1f} {y:.1f} {(x+nx)/2:.1f} {(y+ny)/2:.1f}'
        d += f'T{pts[-1][0]:.1f} {pts[-1][1]:.1f}'
        self.t.append(f'<path d="{d}" stroke-width="{g}"/>')
    def rayado(self, x1, y1, x2, y2, paso=5, ang=60, g=0.7, corte=0.0):
        # rayado inclinado dentro de un rectángulo (sombra)
        dx = (y2 - y1) / math.tan(math.radians(ang))
        x = x1 - dx
        while x < x2:
            ax, ay, bx, by = x, y2, x + dx, y1
            if ax < x1: ay = y2 - (x1 - ax) * math.tan(math.radians(ang)); ax = x1
            if bx > x2: by = y1 + (bx - x2) * math.tan(math.radians(ang)); bx = x2
            if self.r.random() >= corte: self.linea(ax, ay, bx, by, g, 0.5)
            x += paso + self.r.uniform(-0.8, 0.8)
    def tablas(self, x1, y1, x2, y2, paso=7, g=0.7):
        x = x1 + paso
        while x < x2 - 2: self.linea(x, y1 + self.r.uniform(0, 2), x, y2, g, 0.4); x += paso + self.r.uniform(-1, 1)
    def aros(self, x1, y1, x2, y2, paso=9, g=0.7, comba=3):
        y = y1 + paso
        while y < y2 - 2: self.curva([(x1, y), ((x1 + x2) / 2, y + comba), (x2, y)], g); y += paso + self.r.uniform(-1, 1)

    # ---- piezas ----
    def suelo(self, x1=0, x2=W, y=SUELO):
        self.pieza()
        pts = [(x, y + self.r.uniform(-1.2, 1.2)) for x in range(x1, x2 + 1, 60)]; self.curva(pts, 1.3)
    def surcos(self, x1, x2, fuga_x, y1=SUELO + 4, y2=H, n=16, g=0.8):
        for i in range(n + 1):
            xb = x1 + (x2 - x1) * i / n
            xt = fuga_x + (xb - fuga_x) * 0.42
            self.curva([(xt, y1), ((xt + xb) / 2 + self.r.uniform(-2, 2), (y1 + y2) / 2), (xb + (xb - fuga_x) * 0.25, y2)], g)
    def pasto(self, x1, x2, y=SUELO, n=40):
        for _ in range(n):
            x = self.r.uniform(x1, x2); h = self.r.uniform(4, 10)
            self.linea(x, y + self.r.uniform(0, 3), x + self.r.uniform(-3, 3), y - h, 0.7, 0.3)
    def lomas(self, y=150, amp=14, x1=0, x2=W, g=0.9):
        f = self.r.uniform(0, 6)
        self.curva([(x, y + math.sin(x / 130 + f) * amp + math.sin(x / 47 + f) * amp * .3) for x in range(x1, x2 + 1, 40)], g)
    def nube(self, x, y, ancho=120):
        for i in range(4):
            a = ancho * self.r.uniform(.35, 1); dx = self.r.uniform(-20, 20)
            self.linea(x + dx, y + i * 6, x + dx + a, y + i * 6, 0.7, 0.6)
    def arbol(self, x, base=SUELO, alto=70, ancho=44):
        self.pieza(f'<ellipse cx="{x}" cy="{base - alto * .68:.1f}" rx="{ancho / 2 + 4:.1f}" ry="{alto * .34 + 5:.1f}"/>' + self.pol([(x - 2, base), (x - 2, base - alto * .5), (x + 3, base - alto * .5), (x + 3, base)]))
        self.linea(x - 2, base, x - 1, base - alto * .45, 1.2); self.linea(x + 3, base, x + 2, base - alto * .45, 1.2)
        self.linea(x, base - alto * .4, x - ancho * .2, base - alto * .62, 0.9); self.linea(x + 1, base - alto * .4, x + ancho * .22, base - alto * .6, 0.9)
        cx, cy = x, base - alto * .68
        for _ in range(int(ancho * 1.5)):                                   # copa: muchos arquitos
            ang = self.r.uniform(0, math.tau); d = math.sqrt(self.r.random())
            px, py = cx + math.cos(ang) * d * ancho / 2, cy + math.sin(ang) * d * alto * .34
            s = self.r.uniform(3, 6.5)
            self.t.append(f'<path d="M{px-s:.1f} {py:.1f}q{s:.1f} {-s*1.3:.1f} {2*s:.1f} 0" stroke-width="{0.7 if px < cx else 0.95}"/>')
    def galpon(self, x, ancho=150, alto=64, fondo=90, base=SUELO, porton=True, silo_chapa=False):
        # frente a dos aguas + lateral en perspectiva
        y0 = base - alto; cumbre = y0 - ancho * .32; k = 0.22   # k: cuánto sube el lateral
        frente = [(x, base), (x, y0), (x + ancho / 2, cumbre), (x + ancho, y0), (x + ancho, base)]
        lx = x + ancho + fondo; ly0 = y0 - fondo * k * .35; lb = base - fondo * k * .12
        self.pieza(self.pol([(x, base), (x, y0), (x + ancho / 2, cumbre), (x + ancho / 2 + fondo, cumbre - fondo * k * .35), (lx, ly0), (lx, lb), (x + ancho, base)]))
        self.poli(frente, 1.4)
        self.linea(x + ancho, y0, lx, ly0, 1.3); self.linea(lx, ly0, lx, lb, 1.3); self.linea(x + ancho, base, lx, lb, 1.3)
        cx2, cy2 = x + ancho / 2 + fondo, cumbre - fondo * k * .35
        self.linea(x + ancho / 2, cumbre, cx2, cy2, 1.3); self.linea(cx2, cy2, lx, ly0, 1.3)
        for i in range(1, 14):                                              # chapas del techo
            f = i / 14
            ax, ay = x + ancho / 2 + fondo * f, cumbre + (cy2 - cumbre) * f
            bx, by = x + ancho + fondo * f, y0 + (ly0 - y0) * f
            self.linea(ax, ay, bx, by, 0.7, 0.5)
        self.tablas(x, y0 + 4, x + ancho, base, 9)
        for i in range(1, 9):                                               # tablas del lateral, en sombra
            f = i / 9; px = x + ancho + fondo * f
            self.linea(px, y0 + (ly0 - y0) * f, px, base + (lb - base) * f, 0.9, 0.4)
        self.rayado(x + ancho + 2, y0 + 4, lx - 2, base - 2, 6, 55, 0.6, 0.15)
        if porton:
            px1, px2, py = x + ancho * .3, x + ancho * .7, base - alto * .72
            self.poli([(px1, base), (px1, py), (px2, py), (px2, base)], 1.2, cerrar=False)
            self.linea(px1, py, px2, base, 0.8); self.linea(px2, py, px1, base, 0.8); self.linea((px1 + px2) / 2, py, (px1 + px2) / 2, base, 1)
        vx, vy = x + ancho / 2, y0 - ancho * .1                             # ventana del altillo
        self.poli([(vx - 8, vy + 9), (vx - 8, vy - 7), (vx + 8, vy - 7), (vx + 8, vy + 9)], 1); self.linea(vx, vy - 7, vx, vy + 9, 0.7); self.linea(vx - 8, vy + 1, vx + 8, vy + 1, 0.7)
        return lx
    def silo(self, x, ancho=46, alto=120, base=SUELO, techo=20):
        y0 = base - alto
        self.pieza(self.pol([(x, base + 3), (x, y0), (x + ancho / 2, y0 - techo), (x + ancho, y0), (x + ancho, base + 3)]))
        self.linea(x, base, x, y0, 1.4); self.linea(x + ancho, base, x + ancho, y0, 1.4)
        self.curva([(x, y0), (x + ancho / 2, y0 + 5), (x + ancho, y0)], 1.2); self.curva([(x, base), (x + ancho / 2, base + 5), (x + ancho, base)], 1.2)
        self.linea(x, y0, x + ancho / 2, y0 - techo, 1.3); self.linea(x + ancho, y0, x + ancho / 2, y0 - techo, 1.3)
        for f in (.25, .5, .75): self.linea(x + ancho * f, y0 + 3, x + ancho / 2, y0 - techo, 0.6, 0.3)
        self.linea(x + ancho / 2, y0 - techo, x + ancho / 2, y0 - techo - 6, 1.2)
        self.aros(x, y0, x + ancho, base, 11, 0.7, 4)
        self.rayado(x + ancho * .62, y0 + 6, x + ancho - 1, base - 2, 4.5, 68, 0.6, 0.1)      # lado en sombra
        ex = x + ancho * .18                                                                 # escalera
        self.linea(ex, base, ex, y0 + 8, 0.7, 0.3); self.linea(ex + 5, base, ex + 5, y0 + 8, 0.7, 0.3)
        y = base - 6
        while y > y0 + 10: self.linea(ex, y, ex + 5, y, 0.6, 0.2); y -= 6
    def torre(self, x, ancho=26, alto=190, base=SUELO):
        # noria / elevador de la planta: torre reticulada con casilla arriba
        y0 = base - alto
        self.pieza(self.pol([(x, base), (x, y0), (x - 11, y0), (x - 11, y0 - 22), (x + ancho / 2, y0 - 34), (x + ancho + 11, y0 - 22), (x + ancho + 11, y0), (x + ancho, y0), (x + ancho, base)]))
        self.linea(x, base, x, y0, 1.3); self.linea(x + ancho, base, x + ancho, y0, 1.3)
        y = base
        while y > y0 + 4:
            ny = max(y - ancho, y0)
            self.linea(x, y, x + ancho, ny, 0.7, 0.4); self.linea(x + ancho, y, x, ny, 0.7, 0.4); self.linea(x, ny, x + ancho, ny, 0.8, 0.4); y = ny
        self.poli([(x - 8, y0), (x - 8, y0 - 22), (x + ancho + 8, y0 - 22), (x + ancho + 8, y0)], 1.3)
        self.linea(x - 11, y0 - 22, x + ancho / 2, y0 - 34, 1.2); self.linea(x + ancho + 11, y0 - 22, x + ancho / 2, y0 - 34, 1.2)
        self.tablas(x - 8, y0 - 21, x + ancho + 8, y0, 6, 0.6)
        return y0 - 10
    def cano(self, x1, y1, x2, y2):
        self.pieza(self.pol([(x1, y1), (x2, y2), (x2, y2 + 5), (x1, y1 + 5)]))
        self.linea(x1, y1, x2, y2, 1.1); self.linea(x1, y1 + 5, x2, y2 + 5, 1.1)
        n = int(math.hypot(x2 - x1, y2 - y1) / 16)
        for i in range(1, n): f = i / n; self.linea(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f + 5, 0.6, 0.2)
    def molino(self, x, alto=130, base=SUELO):
        # molino de viento de campo: torre reticulada + rueda de aspas + cola
        y0 = base - alto; a = 20
        self.pieza(f'<circle cx="{x}" cy="{y0 - 4}" r="31"/>' + self.pol([(x + 6, y0 - 4), (x + 52, y0 - 13), (x + 64, y0 - 4), (x + 52, y0 + 5)]))
        self.linea(x - a, base, x - 3, y0, 1.2); self.linea(x + a, base, x + 3, y0, 1.2)
        for i in range(5):
            f1, f2 = i / 5, (i + 1) / 5
            xa1, xb1 = x - a + (a - 3) * f1, x + a - (a - 3) * f1; xa2, xb2 = x - a + (a - 3) * f2, x + a - (a - 3) * f2
            ya, yb = base - alto * f1, base - alto * f2
            self.linea(xa1, ya, xb2, yb, 0.7, 0.4); self.linea(xb1, ya, xa2, yb, 0.7, 0.4); self.linea(xa2, yb, xb2, yb, 0.8, 0.3)
        R = 30; cy = y0 - 4
        self.t.append(f'<circle cx="{x}" cy="{cy}" r="{R}" stroke-width="1.1"/><circle cx="{x}" cy="{cy}" r="{R*.42:.1f}" stroke-width="0.8"/><circle cx="{x}" cy="{cy}" r="3" stroke-width="1.2"/>')
        for i in range(18):
            an = math.tau * i / 18
            self.linea(x + math.cos(an) * 4, cy + math.sin(an) * 4, x + math.cos(an) * R, cy + math.sin(an) * R, 0.7, 0.3)
            an2 = an + .2; self.linea(x + math.cos(an) * R * .45, cy + math.sin(an) * R * .45, x + math.cos(an2) * R, cy + math.sin(an2) * R, 0.6, 0.3)
        self.poli([(x + 6, cy), (x + R + 22, cy - 9), (x + R + 34, cy), (x + R + 22, cy + 9)], 1)
    def alambrado(self, x1, x2, base=SUELO + 2, alto=20, paso=34):
        self.pieza()
        x = x1
        while x <= x2: self.linea(x, base + 3, x + self.r.uniform(-1, 1), base - alto, 1.2); x += paso
        for f in (.25, .55, .85): self.curva([(x, base - alto * f + (2 if (i % 2) else 0)) for i, x in enumerate(range(x1, x2 + 1, paso // 2))], 0.6)
    def espiga(self, x, base, alto=64, incl=0):
        tx, ty = x + incl, base - alto
        self.curva([(x, base), (x + incl * .3, base - alto * .5), (tx, ty)], 0.9)
        for i in range(7):
            f = i / 7; px, py = tx - incl * .25 * f, ty + 22 * f
            self.t.append(f'<path d="M{px:.1f} {py:.1f}q-6 -4 -5 -11M{px:.1f} {py:.1f}q6 -4 5 -11" stroke-width="0.8"/>')
        self.linea(tx, ty, tx + incl * .1, ty - 12, 0.6, 0.3)
    def trigal(self, x1, x2, base=H + 6, n=26, alto=70):
        self.pieza()
        for i in range(n):
            x = x1 + (x2 - x1) * i / (n - 1) + self.r.uniform(-8, 8)
            self.espiga(x, base, alto + self.r.uniform(-16, 16), self.r.uniform(-12, 12))
    def camion(self, x, base=SUELO, largo=150, alto=58):
        y0 = base - alto - 10
        self.pieza(self.pol([(x, base), (x, y0), (x + largo, y0), (x + largo, base - 50), (x + largo + 30, base - 50), (x + largo + 48, base - 30), (x + largo + 52, base)]))
        self.poli([(x, base - 12), (x, y0), (x + largo, y0), (x + largo, base - 12)], 1.4)             # caja
        self.tablas(x, y0 + 2, x + largo, base - 12, 12, 0.6); self.linea(x, y0 + alto * .5, x + largo, y0 + alto * .5, 0.6)
        cx = x + largo + 4
        self.poli([(cx, base - 12), (cx, base - 50), (cx + 26, base - 50), (cx + 44, base - 30), (cx + 48, base - 12)], 1.4)   # cabina
        self.poli([(cx + 6, base - 32), (cx + 6, base - 45), (cx + 23, base - 45), (cx + 35, base - 32)], 0.9)
        self.linea(x - 4, base - 12, cx + 48, base - 12, 1.2)
        for rx in (x + 24, x + 46, x + largo - 18, cx + 30):
            self.t.append(f'<circle cx="{rx}" cy="{base - 9}" r="10" stroke-width="1.4"/><circle cx="{rx}" cy="{base - 9}" r="4" stroke-width="0.9"/>')
        self.rayado(x + 2, base - 11, x + largo - 30, base - 2, 4, 50, 0.5)
    def pallet(self, x, base=SUELO, filas=3, cols=3, lado=17):
        self.pieza(self.pol([(x - 3, base), (x - 3, base - 4), (x, base - 4), (x, base - 4 - filas * lado * .82), (x + cols * lado, base - 4 - filas * lado * .82), (x + cols * lado, base - 4), (x + cols * lado + 3, base - 4), (x + cols * lado + 3, base)]))
        self.linea(x - 3, base - 4, x + cols * lado + 3, base - 4, 1.3); self.linea(x - 3, base, x + cols * lado + 3, base, 1.1)
        for c in (0, cols * lado / 2 - 2, cols * lado - 4): self.poli([(x + c, base), (x + c, base - 4), (x + c + 4, base - 4), (x + c + 4, base)], 0.8)
        for f in range(filas):
            for c in range(cols if f < filas - 1 or self.r.random() > .4 else cols - 1):
                bx, by = x + c * lado, base - 4 - (f + 1) * lado * .82
                self.poli([(bx, by + lado * .82), (bx, by), (bx + lado, by), (bx + lado, by + lado * .82)], 1)
                self.linea(bx + lado * .3, by, bx + lado * .3, by + lado * .82, 0.5, 0.2); self.linea(bx + lado * .7, by, bx + lado * .7, by + lado * .82, 0.5, 0.2)
    def pajaros(self, x, y, n=4):
        for _ in range(n):
            px, py, s = x + self.r.uniform(-40, 40), y + self.r.uniform(-14, 14), self.r.uniform(3, 6)
            self.t.append(f'<path d="M{px-s:.1f} {py:.1f}q{s/2:.1f} {-s:.1f} {s:.1f} 0q{s/2:.1f} {-s:.1f} {s:.1f} 0" stroke-width="0.8"/>')
    # ---- más piezas de campo ----
    def sol(self, x, y, r=60):
        self.t.append(f'<circle cx="{x}" cy="{y}" r="{r}" stroke-width="1.3"/>')
        yy = y - r + 7
        while yy < y + r - 3:                                                # rayado horizontal dentro del disco
            m = math.sqrt(max(r * r - (yy - y) ** 2, 0)) - 4
            if m > 4: self.linea(x - m, yy, x + m * self.r.uniform(.55, 1), yy, 0.6, 0.4)
            yy += 7
        for i in range(28):                                                  # rayos, uno largo y uno corto
            an = math.tau * i / 28; a, b = r + 10, r + (46 if i % 2 else 24) + self.r.uniform(-4, 4)
            self.linea(x + math.cos(an) * a, y + math.sin(an) * a, x + math.cos(an) * b, y + math.sin(an) * b, 0.8, 0.5)
    def arboleda(self, x1, x2, base, alto=24):
        x = x1
        while x < x2:
            a = alto * self.r.uniform(.7, 1.2); self.arbol(x, base, a, a * .7); x += a * self.r.uniform(.5, .9)
    def casa(self, x, base=SUELO, ancho=86, alto=46):
        y0 = base - alto; cumbre = y0 - 30
        self.pieza(self.pol([(x - 6, y0), (x + ancho * .5, cumbre), (x + ancho + 6, y0), (x + ancho, y0), (x + ancho, base), (x, base), (x, y0)])
                   + self.pol([(x + ancho * .7, y0 - 8), (x + ancho * .7, cumbre - 12), (x + ancho * .7 + 11, cumbre - 12), (x + ancho * .7 + 11, y0 - 8)]))
        self.poli([(x, base), (x, y0), (x + ancho, y0), (x + ancho, base)], 1.3, cerrar=False)
        self.linea(x - 6, y0, x + ancho * .5, cumbre, 1.4); self.linea(x + ancho + 6, y0, x + ancho * .5, cumbre, 1.4); self.linea(x - 6, y0, x + ancho + 6, y0, 1.2)
        for i in range(1, 6): f = i / 6; self.linea(x - 6 + (ancho + 12) * f * .5, y0 + (cumbre - y0) * f, x + ancho + 6 - (ancho + 12) * f * .5, y0 + (cumbre - y0) * f, 0.6, 0.4)   # tejas
        cx = x + ancho * .7
        self.poli([(cx, y0 - 14), (cx, cumbre - 12), (cx + 11, cumbre - 12), (cx + 11, y0 - 6)], 1.1, cerrar=False)       # chimenea
        hx, hy = cx + 5, cumbre - 16
        self.curva([(hx, hy), (hx + 6, hy - 12), (hx - 3, hy - 24), (hx + 9, hy - 38), (hx + 2, hy - 52)], 0.7)            # humo
        self.curva([(hx + 5, hy - 4), (hx + 12, hy - 16), (hx + 4, hy - 30), (hx + 14, hy - 44)], 0.6)
        px = x + ancho * .16
        self.poli([(px, base), (px, base - alto * .62), (px + 15, base - alto * .62), (px + 15, base)], 1.1, cerrar=False)   # puerta
        for vx in (x + ancho * .46, x + ancho * .74):                                                                       # ventanas
            self.poli([(vx, base - alto * .34), (vx, base - alto * .7), (vx + 15, base - alto * .7), (vx + 15, base - alto * .34)], 1)
            self.linea(vx + 7.5, base - alto * .7, vx + 7.5, base - alto * .34, 0.6, 0.2); self.linea(vx, base - alto * .52, vx + 15, base - alto * .52, 0.6, 0.2)
        self.rayado(x + ancho * .86, y0 + 3, x + ancho - 1, base - 1, 4, 62, 0.5)
    def rueda(self, x, y, r, dientes=True):
        self.t.append(f'<circle cx="{x}" cy="{y}" r="{r}" stroke-width="1.6"/><circle cx="{x}" cy="{y}" r="{r*.62:.1f}" stroke-width="1"/><circle cx="{x}" cy="{y}" r="{r*.18:.1f}" stroke-width="1.1"/>')
        n = int(r * 1.1)
        for i in range(n):
            an = math.tau * i / n
            if dientes: self.linea(x + math.cos(an) * r * .68, y + math.sin(an) * r * .68, x + math.cos(an + .22) * r * .95, y + math.sin(an + .22) * r * .95, 0.8, 0.2)
        for i in range(6): an = math.tau * i / 6; self.linea(x + math.cos(an) * r * .2, y + math.sin(an) * r * .2, x + math.cos(an) * r * .6, y + math.sin(an) * r * .6, 0.7, 0.2)
    def tractor(self, x, base=SUELO, e=1.0):
        # tractor de perfil mirando a la derecha; x es el borde trasero
        R, rr = 27 * e, 15 * e; ty, dy = base - R, base - rr
        tx, dx = x + R, x + R + 78 * e
        cab = [(x + 8 * e, ty - 6 * e), (x + 12 * e, ty - 58 * e), (x + 54 * e, ty - 58 * e), (x + 60 * e, ty - 26 * e)]
        capot = [(x + 60 * e, ty - 26 * e), (x + 118 * e, ty - 22 * e), (x + 120 * e, dy - 4 * e), (x + 44 * e, ty + 4 * e)]
        self.pieza(self.pol(cab + capot[1:] + [(x + 8 * e, ty + 4 * e)]) + f'<circle cx="{tx:.1f}" cy="{ty:.1f}" r="{R + 1:.1f}"/><circle cx="{dx:.1f}" cy="{dy:.1f}" r="{rr + 1:.1f}"/>')
        self.poli(cab, 1.4, cerrar=False); self.linea(x + 6 * e, ty - 60 * e, x + 60 * e, ty - 60 * e, 1.6)                # techo
        self.poli([(x + 18 * e, ty - 30 * e), (x + 20 * e, ty - 52 * e), (x + 50 * e, ty - 52 * e), (x + 54 * e, ty - 30 * e)], 0.9)   # vidrio
        self.poli(capot, 1.4)
        for i in range(1, 6): xx = x + (64 + i * 9) * e; self.linea(xx, ty - 20 * e, xx, ty - 4 * e, 0.6, 0.3)             # rejilla del capot
        self.linea(x + 100 * e, ty - 23 * e, x + 100 * e, ty - 50 * e, 1.6); self.linea(x + 97 * e, ty - 50 * e, x + 104 * e, ty - 53 * e, 1.2)   # escape
        self.rueda(tx, ty, R); self.rueda(dx, dy, rr)
        self.curva([(tx - R - 3 * e, ty - 4 * e), (tx - R * .6, ty - R - 6 * e), (tx + R * .7, ty - R - 5 * e), (tx + R + 4 * e, ty - 6 * e)], 1.3)   # guardabarros
    def fardo(self, x, base=SUELO, r=20):
        cy = base - r
        self.pieza(f'<circle cx="{x}" cy="{cy}" r="{r + 1}"/>')
        self.t.append(f'<circle cx="{x}" cy="{cy}" r="{r}" stroke-width="1.4"/>')
        pts = [(x + math.cos(a / 3) * (r - 2) * (a / 60), cy + math.sin(a / 3) * (r - 2) * (a / 60)) for a in range(6, 61, 2)]   # espiral de la paja
        self.curva(pts, 0.7)
        for i in range(14): an = self.r.uniform(0, math.tau); self.linea(x + math.cos(an) * r, cy + math.sin(an) * r, x + math.cos(an) * (r + 3), cy + math.sin(an) * (r + 3), 0.6, 0.3)
        self.linea(x - r * .8, base, x + r * .9, base + 1, 0.8)
    def tranquera(self, x, base=SUELO + 2, ancho=70, alto=30):
        self.pieza()
        for px in (x, x + ancho): self.linea(px, base + 3, px, base - alto - 6, 1.8); self.linea(px + 3, base + 3, px + 3, base - alto - 6, 0.8)
        for f in (.15, .4, .65, .9): self.linea(x + 3, base - alto * f, x + ancho, base - alto * f, 1.1, 0.5)
        self.linea(x + 3, base - alto * .15, x + ancho, base - alto * .9, 1); self.linea(x + ancho * .5, base - alto * .1, x + ancho * .5, base - alto * .95, 0.9)
    def camino(self, x_cerca, ancho_cerca, x_lejos, y1=SUELO + 2, y2=H):
        # camino de tierra que viene desde el horizonte
        self.pieza(self.pol([(x_lejos - 3, y1), (x_lejos + 3, y1), (x_cerca + ancho_cerca, y2), (x_cerca, y2)]))
        for lado in (0, 1):
            xa, xb = x_lejos + (3 if lado else -3), x_cerca + (ancho_cerca if lado else 0)
            self.curva([(xa, y1), (xa + (xb - xa) * .18 + 14, y1 + (y2 - y1) * .3), (xa + (xb - xa) * .55 - 10, y1 + (y2 - y1) * .65), (xb, y2)], 1.1)
        for f in (.35, .5, .66, .8, .93):                                                      # huellas
            cx = x_lejos + (x_cerca + ancho_cerca / 2 - x_lejos) * f ** 1.6; yy = y1 + (y2 - y1) * f; a = ancho_cerca * f * .16
            self.linea(cx - a, yy, cx - a * .3, yy + 2, 0.6, 0.6); self.linea(cx + a * .4, yy + 1, cx + a, yy, 0.6, 0.6)
    def svg(self):
        # Cada pieza se recorta con las siluetas de las piezas que tiene adelante: así nada se ve "a través" de un galpón.
        defs, cuerpo = [], []
        for i, (trazos, _) in enumerate(self.piezas):
            delante = ''.join(sil for _, sil in self.piezas[i + 1:])
            if delante:
                defs.append(f'<mask id="m{i}" maskUnits="userSpaceOnUse" x="{self.caja[0]}" y="{self.caja[1]}" width="{self.caja[2]}" height="{self.caja[3]}"><rect x="{self.caja[0]}" y="{self.caja[1]}" width="{self.caja[2]}" height="{self.caja[3]}" fill="#fff"/><g fill="#000" stroke="#000" stroke-width="2">{delante}</g></mask>')
                cuerpo.append(f'<g mask="url(#m{i})">{"".join(trazos)}</g>')
            else: cuerpo.append(''.join(trazos))
        x0, y0, w, h = self.caja
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {w} {h}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">'
                f'<defs>{"".join(defs)}</defs>{"".join(cuerpo)}</svg>\n')

def granja():
    d = Dibujo(7)
    d.lomas(168, 12); d.lomas(186, 8, g=0.7); d.nube(140, 46, 150); d.nube(760, 34, 120); d.pajaros(520, 70)
    d.arbol(70, alto=96, ancho=62); d.arbol(128, alto=70, ancho=44)
    d.galpon(300, 150, 66, 110); d.silo(556, 44, 128)
    d.galpon(640, 96, 44, 70, porton=False); d.arbol(880, alto=86, ancho=56); d.arbol(934, alto=62, ancho=40)
    d.molino(1040, 118); d.alambrado(150, 290); d.alambrado(960, 1190)
    d.suelo(); d.pasto(0, W, n=70); d.surcos(-200, 1400, 600, n=30)
    return d
def planta():
    d = Dibujo(21)
    d.lomas(176, 8, g=0.7); d.nube(90, 40, 140); d.nube(980, 52, 130)
    for i, x in enumerate((330, 388, 446, 504)): d.silo(x, 50, 136 - (i % 2) * 6, techo=22)
    cy = d.torre(580, 26, 196)
    for x in (355, 413, 471, 529): d.cano(593, cy + 6, x, SUELO - 150)
    d.galpon(660, 170, 60, 150); d.silo(1000, 40, 92)
    d.arbol(120, alto=84, ancho=54); d.arbol(182, alto=60, ancho=38); d.arbol(1090, alto=90, ancho=58)
    d.alambrado(0, 300, paso=40); d.suelo(); d.pasto(0, W, n=60); d.surcos(-300, 1500, 620, n=26)
    return d
def campo():
    d = Dibujo(33)
    d.lomas(150, 16); d.lomas(172, 10, g=0.7); d.lomas(196, 6, g=0.6); d.nube(420, 38, 170); d.nube(900, 60, 110); d.pajaros(250, 60, 5)
    d.molino(210, 126); d.arbol(330, alto=74, ancho=48)
    d.silo(712, 36, 96); d.galpon(760, 110, 50, 80); d.arbol(1000, alto=92, ancho=60); d.arbol(1060, alto=64, ancho=42)
    d.suelo(); d.pasto(0, W, n=50); d.trigal(-10, W + 10, n=58, alto=62)
    return d
def deposito():
    d = Dibujo(45)
    d.lomas(182, 7, g=0.7); d.nube(180, 44, 130); d.nube(840, 36, 150)
    d.galpon(240, 220, 78, 190); d.pallet(96, filas=3); d.pallet(160, filas=2)
    d.camion(700); d.pallet(930, filas=3, cols=2); d.pallet(980, filas=2, cols=3)
    d.arbol(40, alto=88, ancho=54); d.arbol(1110, alto=96, ancho=62); d.silo(1150, 36, 100)
    d.suelo(); d.pasto(0, 240, n=20); d.pasto(1040, W, n=16)
    for y in (SUELO + 16, SUELO + 34, SUELO + 56): d.linea(-20, y, W + 20, y + 2, 0.7, 1.5)      # playón
    for x in range(40, W, 110): d.linea(x, SUELO + 45, x + 46, SUELO + 45, 1)
    return d

def ingreso():
    """La escena de la pantalla de ingreso: vertical, llena todo el panel. Arriba queda cielo para el título."""
    d = Dibujo(101); X0, X1, CIELO, FONDO = 150, 1050, -700, 440
    d.caja = (X0, CIELO, X1 - X0, FONDO - CIELO)
    # cielo: sol arriba a la derecha, nubes y bandadas (a la izquierda queda despejado para el texto)
    d.sol(905, -560, 74)
    d.nube(900, -380, 130); d.nube(880, -300, 150); d.nube(900, -150, 120); d.nube(200, -40, 150); d.nube(640, -20, 140)
    d.pajaros(960, -430, 5); d.pajaros(990, -230, 4)
    # lomas del fondo con un casco lejano
    d.lomas(40, 30, X0, X1); d.lomas(84, 22, X0, X1, g=0.8); d.lomas(124, 16, X0, X1, g=0.7); d.lomas(160, 11, X0, X1, g=0.6)
    d.arboleda(150, 300, 150, 22); d.silo(700, 14, 40, base=142, techo=7); d.galpon(722, 46, 20, 40, base=142, porton=False); d.arboleda(790, 900, 146, 20)
    d.arboleda(480, 660, 186, 26); d.arboleda(940, 1050, 190, 28)
    d.lomas(196, 6, X0, X1, g=0.6)
    # la planta: batería de silos, noria y galpón
    d.molino(978, 210)
    for i, x in enumerate((176, 246, 316)): d.silo(x, 64, 222 - (i % 2) * 16, techo=30)
    cy = d.torre(398, 32, 256)
    for x in (208, 278, 348): d.cano(416, cy + 6, x, SUELO - 236)
    d.galpon(448, 214, 108, 150)
    d.arbol(178, alto=120, ancho=74); d.arbol(862, alto=196, ancho=124); d.arbol(934, alto=126, ancho=80)
    d.casa(1010, SUELO, 70, 44)
    d.alambrado(812, 1050, paso=34)
    d.suelo(X0 - 10, X1 + 10); d.pasto(X0, X1, n=120)
    # el campo: surcos, camino, tractor, fardos, tranquera y trigo en primer plano
    d.surcos(-700, 1900, 600, y1=SUELO + 4, y2=FONDO, n=58, g=0.85)
    d.camino(455, 220, 596, SUELO + 2, FONDO)
    d.fardo(214, 286, 22); d.fardo(280, 304, 28); d.fardo(940, 292, 24); d.fardo(1004, 312, 30); d.fardo(848, 276, 18)
    d.tractor(672, 306, 1.4)
    d.tranquera(326, 312, 104, 44); d.alambrado(150, 326, base=312, alto=28, paso=44)
    d.trigal(140, 440, base=FONDO + 6, n=26, alto=118); d.trigal(800, 1060, base=FONDO + 6, n=24, alto=118)
    return d
def cosecha():
    d = Dibujo(57)
    d.sol(1040, 96, 44); d.lomas(160, 12); d.lomas(184, 8, g=0.7); d.nube(200, 40, 150); d.nube(640, 56, 120); d.pajaros(820, 60, 4)
    d.arboleda(0, 220, 214, 26); d.arboleda(980, 1200, 212, 24)
    d.casa(120, SUELO, 80, 42); d.arbol(230, alto=92, ancho=60)
    d.tractor(470, SUELO + 4, 1.0); d.fardo(680, SUELO + 2, 22); d.fardo(740, SUELO + 6, 26); d.fardo(830, SUELO + 2, 20); d.fardo(360, SUELO + 4, 22)
    d.molino(920, 112); d.tranquera(1060, SUELO + 2, 70, 28)
    d.suelo(); d.pasto(0, W, n=60); d.trigal(-10, W + 10, n=64, alto=54)
    return d
def horizonte():
    """Tira baja y ancha para el pie de las pantallas: la granja vista de lejos. Empalma al repetirse."""
    d = Dibujo(73); d.caja = (0, 120, W, 180)
    d.lomas(176, 6, g=0.7); d.arboleda(20, 170, SUELO, 30); d.silo(196, 22, 62, techo=10); d.silo(222, 22, 56, techo=10); d.galpon(256, 70, 30, 60)
    d.arboleda(420, 520, SUELO, 26); d.molino(566, 70); d.casa(630, SUELO, 50, 26); d.arboleda(700, 800, SUELO, 34)
    d.tractor(850, SUELO + 2, 0.6); d.fardo(960, SUELO + 2, 11); d.fardo(990, SUELO + 3, 13); d.arboleda(1040, 1180, SUELO, 28)
    d.pieza(); d.linea(0, SUELO, W, SUELO, 1.3, 0.3); d.pasto(0, W, n=60)
    for y in (SUELO + 14, SUELO + 30, SUELO + 50): d.linea(0, y, W, y, 0.7, 0.2)
    return d

if __name__ == '__main__':
    destino = Path(__file__).resolve().parent.parent / 'public/img/grabados'; destino.mkdir(parents=True, exist_ok=True)
    for nombre, f in (('granja', granja), ('planta', planta), ('campo', campo), ('deposito', deposito), ('ingreso', ingreso), ('cosecha', cosecha), ('horizonte', horizonte)):
        (destino / f'{nombre}.svg').write_text(f().svg()); print(nombre, f'{(destino / f"{nombre}.svg").stat().st_size / 1024:.0f} KB')
