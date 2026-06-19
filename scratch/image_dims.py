import os
import struct

dir_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\extracted_images"

def get_png_size(path):
    with open(path, 'rb') as f:
        data = f.read(24)
        if data[:8] == b'\x89PNG\r\n\x1a\n' and data[12:16] == b'IHDR':
            w, h = struct.unpack('>ii', data[16:24])
            return w, h
    return None

for f in sorted(os.listdir(dir_path)):
    if f.lower().endswith(".png"):
        path = os.path.join(dir_path, f)
        size = get_png_size(path)
        print(f"{f}: {size}")
