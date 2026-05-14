import os
import glob

def replace_navbar(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        try:
            with open(filepath, 'r', encoding='latin-1') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            return

    # Look for the marker
    start_marker = '<!-- ==================== EXTRACTED NAVBAR ===================='
    start_idx = content.find(start_marker)
    if start_idx == -1:
        return # No marker, skip
        
    # Check if already has a placeholder
    if 'navbar-placeholder' in content[start_idx:start_idx+500]:
        print(f"Skipping {filepath} - already has placeholder")
        return

    # Find the end of the header tag
    header_end_marker = '</header>'
    end_idx = content.find(header_end_marker, start_idx)
    
    if end_idx == -1:
        print(f"End marker </header> not found in {filepath}")
        return
        
    end_idx += len(header_end_marker)
    
    # Check what's already there to avoid duplicates
    has_load_navbar = 'load-navbar.js' in content
    has_navbar_js = 'navbar.js' in content
    
    replacement = '<!-- ==================== DYNAMIC NAVBAR ==================== -->\n    <div id="navbar-placeholder"></div>'
    
    if not has_load_navbar:
        replacement += '\n    <script src="/script/load-navbar.js?v=33" defer></script>'
    
    if not has_navbar_js:
        replacement += '\n    <script src="/script/navbar.js?v=33" type="module"></script>'

    new_content = content[:start_idx] + replacement + content[end_idx:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Successfully replaced navbar in {filepath}")

# Find all HTML files recursively
html_files = glob.glob('**/*.html', recursive=True)

for html_file in html_files:
    if 'node_modules' in html_file or '.git' in html_file:
        continue
    replace_navbar(html_file)
