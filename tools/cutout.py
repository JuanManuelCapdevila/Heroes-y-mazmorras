import numpy as np, sys, json
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
import os
A = os.environ.get('ARTE_ORIGINAL', 'originales/')  # carpeta con las imágenes originales
MAP = {
 'terreno-madera':'2c6f56f9','terreno-ladrillo':'79729a1a','terreno-lana':'4f3c07ce','terreno-trigo':'e375756f',
 'terreno-mineral':'0dccd6bc','terreno-desierto':'18517302','fondo-tablero':'b822993d',
 'cueva':'26df149c','cripta':'3a8030c1','muralla':'9e47aa11','ruinas':'337eb16e',
 'heroe-comun':'f48a59bf','heroe-raro':'d390c921','heroe-epico':'a5752522','heroe-legendario':'8d9126bf',
 'trampa-foso':'4adaff76','trampa-gas':'d05a2439','trampa-alarma':'8e33df78','trampa-derrumbe':'3c9dfd53','trampa-senuelo':'a47329ed',
}
def checker_mask(a, t1=9, t2=14, fr=0.33, raw=False):
    g = a.mean(2)
    # periodo del damero a partir de la primera fila
    row = g[2]; b = row > np.median(row); edges = np.flatnonzero(b[1:] != b[:-1])
    P = np.median(np.diff(edges)) if len(edges) > 3 else 20.5
    s = int(round(P))
    def sh(x, dy, dx):
        return np.roll(np.roll(x, dy, 0), dx, 1)
    m = np.ones(g.shape, bool)
    for dy, dx in ((0, s), (s, 0)):
        d1 = np.abs(g - sh(g, dy, dx)); d1b = np.abs(g - sh(g, -dy, -dx))
        d2 = np.abs(g - sh(g, 2 * dy, 2 * dx))
        sat = a.max(2) - a.min(2)
        m &= (np.maximum(d1, d1b) > t1) & (d2 < t2)
    frac = ndi.uniform_filter(m.astype(float), size=int(P * 2))
    if raw: return frac
    return ndi.binary_dilation(frac > fr, iterations=3)
def parity_mask(a, thr=0.45):
    g = a.mean(2); H, W = g.shape
    row = g[2]; b = row > np.median(row); edges = np.flatnonzero(b[1:] != b[:-1])
    P = float(np.mean(np.diff(edges[:8]))) if len(edges) > 8 else 20.48
    P = W / round(W / P)
    x0 = (edges[0] + 1) % P
    col = g[:, 2]; bc = col > np.median(col); ec = np.flatnonzero(bc[1:] != bc[:-1]); y0 = (ec[0] + 1) % P
    yy, xx = np.mgrid[0:H, 0:W]
    par = ((np.floor((xx - x0) / P) + np.floor((yy - y0) / P)) % 2)
    light0 = g[2, 2] > g[2, int(x0 + P * 0.5) % W] if True else True
    # signo esperado: +1 en casillas con la misma paridad que la esquina si la esquina es clara
    cpar = par[2, 2]
    sgn = np.where(par == cpar, 1, -1) * (1 if g[2, 2] > np.median(row) else -1)
    s = int(round(P))
    def sh(x, dy, dx): return np.roll(np.roll(x, dy, 0), dx, 1)
    D = g - 0.25 * (sh(g, 0, s) + sh(g, 0, -s) + sh(g, s, 0) + sh(g, -s, 0))
    score = np.where(np.abs(D) > 3, np.sign(D) * sgn, 0)
    m = ndi.uniform_filter(score, size=int(P * 1.5))
    return ndi.binary_dilation(m > thr, iterations=2)
def cut(name, keep_largest=False, sat_t=14):
    im = Image.open(A + MAP[name] + '-image.jpg').convert('RGB')
    a = np.asarray(im).astype(np.int16)
    sat = a.max(2) - a.min(2); br = a.mean(2)
    cand = (sat < sat_t) & (br > 60)
    lab, n = ndi.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # cierre: absorbe ruido jpeg del damero
    bg = ndi.binary_opening(bg, iterations=1) | (bg & ndi.binary_erosion(bg, iterations=2))
    fg = ~bg
    fg = ndi.binary_fill_holes(fg)
    hero = keep_largest
    pm = parity_mask(a) if (hero or name == 'muralla') else None
    if pm is not None:
        outside = ndi.binary_dilation(~fg, iterations=3)
        lp, npm = ndi.label(pm)
        if npm:
            szp = ndi.sum(pm, lp, range(1, npm + 1))
            touch = ndi.maximum(outside, lp, range(1, npm + 1))
            good = [i + 1 for i in range(npm) if (touch[i] and szp[i] > 400) or szp[i] > 1500]
            pm = np.isin(lp, good)
        fg &= ~pm
    else: fg &= ~checker_mask(a, 14, 12, 0.45)
    # huecos interiores que son damero (patio de la muralla)
    frac = checker_mask(a, raw=True)
    labc, nc = ndi.label(cand)
    if nc:
        mean = ndi.mean(frac, labc, range(1, nc + 1)); size = ndi.sum(cand, labc, range(1, nc + 1))
        bad = [i + 1 for i in range(nc) if name == 'muralla' and mean[i] > 0.2 and size[i] > 5000]
        fg &= ~ndi.binary_dilation(np.isin(labc, bad), iterations=2)
    lab2, n2 = ndi.label(fg)
    if n2:
        sizes = ndi.sum(fg, lab2, range(1, n2 + 1))
        big = sizes.max()
        keep = [i + 1 for i, s in enumerate(sizes) if (s == big) or (not keep_largest and s > big * 0.02)]
        fg = np.isin(lab2, keep)
    if keep_largest:
        core = ndi.binary_erosion(fg, iterations=7)
        lab3, n3 = ndi.label(core)
        if n3:
            sz = ndi.sum(core, lab3, range(1, n3 + 1))
            core = lab3 == (int(np.argmax(sz)) + 1)
            fg = ndi.binary_dilation(core, iterations=9) & fg
    if hero:
        fg = ndi.binary_fill_holes(fg) & ~pm
    fg = ndi.binary_erosion(fg, iterations=1)
    alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA'); out.putalpha(alpha)
    bbox = out.getbbox()
    return out.crop(bbox)
if __name__ == '__main__':
    for n in MAP:
        im = cut(n, keep_largest=n.startswith('heroe'))
        im.save(f'arte-limpio/{n}.png'); print(n, im.size)
