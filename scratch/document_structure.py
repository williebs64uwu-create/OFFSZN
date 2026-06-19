import xml.etree.ElementTree as ET
import zipfile
import sys

# Set encoding to utf-8 for stdout just in case
sys.stdout.reconfigure(encoding='utf-8')

docx_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\23 páginas con los 4 sistemas que me llevaron a 100k mes.docx"
output_structure_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\document_structure.txt"

namespaces = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture'
}

rels = {}
with zipfile.ZipFile(docx_path) as docx:
    rels_content = docx.read('word/_rels/document.xml.rels')
    rels_root = ET.fromstring(rels_content)
    for child in rels_root:
        if child.attrib.get('Type', '').endswith('relationships/image'):
            r_id = child.attrib.get('Id')
            target = child.attrib.get('Target')
            rels[r_id] = target.split('/')[-1]

    doc_content = docx.read('word/document.xml')
    doc_root = ET.fromstring(doc_content)
    
    body = doc_root.find('w:body', namespaces)
    
    output_lines = []
    
    for i, child in enumerate(body):
        tag_name = child.tag.split('}')[-1]
        if tag_name == 'p':
            texts = []
            for t in child.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                if t.text:
                    texts.append(t.text)
            paragraph_text = ''.join(texts).strip()
            
            images = []
            for blip in child.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}blip'):
                embed_id = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                if embed_id in rels:
                    images.append(rels[embed_id])
            
            if paragraph_text or images:
                if paragraph_text:
                    output_lines.append(f"[TEXT] {paragraph_text}")
                for img in images:
                    output_lines.append(f"  [IMAGE] {img}")
        elif tag_name == 'tbl':
            output_lines.append("[TABLE]")
            for row in child.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr'):
                row_texts = []
                for cell in row.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc'):
                    cell_text = ''.join([t.text for t in cell.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]).strip()
                    row_texts.append(cell_text)
                output_lines.append(f"  [ROW] {' | '.join(row_texts)}")

    with open(output_structure_path, "w", encoding="utf-8") as f:
        f.write('\n'.join(output_lines))
    print(f"Structure written to {output_structure_path}")
