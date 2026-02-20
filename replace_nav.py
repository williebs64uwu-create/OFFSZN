import os

file_path = r"c:\Users\Willie\Desktop\OFFSZN\explorar.html"
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Verify the lines before we delete
assert "<!-- ==================== EXTRACTED NAVBAR ==================== -->" in lines[77], f"Expected marker at line 78, got {lines[77]}"
assert "<!-- EXPLORE FEED - Netflix Style -->" in lines[661] or "<!-- EXPLORE FEED" in lines[662], "Expected explore feed marker around line 662"

# Delete lines 79 through 661 (inclusive)
# In 0-indexed, this is indices 78 to 660. Slice `[78:661]` deletes 583 lines.
del lines[78:661]

# Insert the placeholder
lines.insert(78, '    <div id="navbar-placeholder"></div>\n')

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully replaced navbar in explorar.html!")
