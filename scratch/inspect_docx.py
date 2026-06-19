import zipfile
import xml.etree.ElementTree as ET

docx_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\23 páginas con los 4 sistemas que me llevaron a 100k mes.docx"

with zipfile.ZipFile(docx_path) as docx:
    xml_content = docx.read('word/document.xml')
    root = ET.fromstring(xml_content)
    
    # Let's count elements
    tags = {}
    for elem in root.iter():
        tag = elem.tag.split('}')[-1]
        tags[tag] = tags.get(tag, 0) + 1
        
    print("Tag counts:")
    for tag, count in sorted(tags.items(), key=lambda x: x[1], reverse=True):
        print(f"  {tag}: {count}")

    # Let's see if there's w:t outside w:p, or other text containers
    # Find all elements that contain text directly (elem.text)
    text_containers = []
    for elem in root.iter():
        if elem.text and elem.text.strip():
            tag = elem.tag.split('}')[-1]
            text_containers.append((tag, elem.text.strip()))
            
    print(f"\nTotal text containers with text: {len(text_containers)}")
    print("First 10 text containers:")
    for tag, text in text_containers[:10]:
        print(f"  [{tag}]: {text[:50]}")
