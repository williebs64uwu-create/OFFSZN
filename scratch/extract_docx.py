import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\23 páginas con los 4 sistemas que me llevaron a 100k mes.docx"
output_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\23_paginas_sistemas.txt"

def docx_to_text(path):
    # Namespace dictionary
    namespaces = {
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    }
    
    with zipfile.ZipFile(path) as docx:
        # Check if document.xml exists
        xml_content = docx.read('word/document.xml')
        root = ET.fromstring(xml_content)
        
        paragraphs = []
        for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            texts = []
            for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                if t.text:
                    texts.append(t.text)
            paragraphs.append(''.join(texts))
            
        return '\n\n'.join(paragraphs)

try:
    text = docx_to_text(docx_path)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"Successfully extracted text to {output_path}. Length: {len(text)} characters.")
except Exception as e:
    import traceback
    traceback.print_exc()
