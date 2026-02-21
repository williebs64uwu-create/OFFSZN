import sys

with open('producto.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '<header class="navbar">' in line and start_idx == -1:
        start_idx = i
    if '</header>' in line and start_idx != -1 and end_idx == -1:
        end_idx = i

if start_idx != -1 and end_idx != -1:
    new_lines = lines[:start_idx] + [
        '  <!-- ==================== DYNAMIC NAVBAR ==================== -->\n',
        '  <div id="navbar-placeholder"></div>\n',
        '  <script src="/script/load-navbar.js?v=22"></script>\n'
    ] + lines[end_idx+1:]
    
    with open('producto.html', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"Successfully replaced lines {start_idx} to {end_idx}")
else:
    print(f"Failed to find boundaries. Start: {start_idx}, End: {end_idx}")
