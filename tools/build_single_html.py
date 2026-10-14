"""Convierte un manual HTML en UN solo archivo con las imágenes incrustadas (data URI).

Uso:  python tools/build_single_html.py pages/manual-preset-fl-studio-v2.html entregables/MANUAL.html

Así el cliente recibe un único .html que se ve completo sin carpetas ni internet
(solo la fuente Geist y los links t.me necesitan conexión).
"""
import base64, mimetypes, os, re, sys

src, dst = sys.argv[1], sys.argv[2]
base = os.path.dirname(os.path.abspath(src))
html = open(src, encoding="utf-8").read()


def inline(m):
    path = os.path.normpath(os.path.join(base, m.group(1)))
    mime = mimetypes.guess_type(path)[0] or "image/webp"
    data = base64.b64encode(open(path, "rb").read()).decode()
    return f'src="data:{mime};base64,{data}"'


out, n = re.subn(r'src="((?:\.\./)?images/[^"]+)"', inline, html)
os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
open(dst, "w", encoding="utf-8").write(out)
print(f"{n} imágenes incrustadas -> {dst} ({os.path.getsize(dst)//1024} KB)")
