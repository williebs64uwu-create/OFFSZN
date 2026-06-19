import zipfile
import os

docx_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\23 páginas con los 4 sistemas que me llevaron a 100k mes.docx"
output_dir = r"c:\Users\Willie\Desktop\OFFSZN\cursos\extracted_images"

os.makedirs(output_dir, exist_ok=True)

with zipfile.ZipFile(docx_path) as docx:
    for f in docx.filelist:
        if f.filename.startswith("word/media/"):
            basename = os.path.basename(f.filename)
            dest_path = os.path.join(output_dir, basename)
            with open(dest_path, "wb") as out_f:
                out_f.write(docx.read(f.filename))
            print(f"Extracted {basename} ({f.file_size} bytes)")
