import re

structure_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\document_structure.txt"
ocr_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\ocr_text.txt"
merged_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\merged_document.txt"

# Read OCR text
ocr_map = {}
current_image = None
current_text = []

with open(ocr_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if line.startswith("IMAGE: "):
            if current_image:
                ocr_map[current_image] = "\n".join(current_text).strip()
            current_image = line.replace("IMAGE: ", "").strip()
            current_text = []
        elif line.startswith("==="):
            continue
        else:
            if current_image:
                current_text.append(line)
    if current_image:
        ocr_map[current_image] = "\n".join(current_text).strip()

# Read structure and merge
merged_lines = []
with open(structure_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        match = re.match(r"^\s*\[IMAGE\]\s*(image\d+\.png)", line)
        if match:
            img_name = match.group(1)
            merged_lines.append(f"--- [IMAGE START: {img_name}] ---")
            ocr_text = ocr_map.get(img_name, "")
            if ocr_text:
                merged_lines.append(ocr_text)
            else:
                merged_lines.append("[No OCR text or empty image]")
            merged_lines.append(f"--- [IMAGE END: {img_name}] ---\n")
        else:
            # Clean up [TEXT] prefix
            clean_line = re.sub(r"^\[TEXT\]\s*", "", line)
            # If it's table
            if clean_line.startswith("[TABLE]") or clean_line.startswith("  [ROW]"):
                merged_lines.append(clean_line)
            else:
                merged_lines.append(clean_line)

with open(merged_path, "w", encoding="utf-8") as f:
    f.write("\n".join(merged_lines))

print(f"Merged document written to {merged_path}")
