
import re

def find_illegal_return(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract script content
    scripts = re.finditer(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
    
    for script_match in scripts:
        script_content = script_match.group(1)
        start_line = content[:script_match.start()].count('\n') + 1
        
        lines = script_content.split('\n')
        brace_level = 0
        
        for i, line in enumerate(lines):
            # Remove comments
            clean_line = re.sub(r'//.*', '', line)
            clean_line = re.sub(r'/\*.*?\*/', '', clean_line)
            
            # Simple brace counting (not perfect but good generic check)
            brace_level += clean_line.count('{') - clean_line.count('}')
            
            if re.search(r'\breturn\b', clean_line):
                # Check if it's inside a function
                # We assume brace_level > 0 means inside a block. 
                # But inside a block doesn't mean inside a function (e.g. if (true) { return; } at top level is illegal).
                # This simple counter won't distinguish 'if' blocks from 'function' blocks.
                
                # However, usually top level returns are at brace_level 0 or 
                # inside a top-level if (brace_level 1).
                
                # Let's just print all returns with their brace level context to inspect.
                print(f"Line {start_line + i}: Level {brace_level}: {line.strip()}")

print("Scanning Presets.html...")
find_illegal_return(r'c:\Users\Willie\Desktop\OFFSZN\cuenta\Upload\Presets.html')

print("\nScanning planes.html...")
find_illegal_return(r'c:\Users\Willie\Desktop\OFFSZN\cuenta\planes.html')
