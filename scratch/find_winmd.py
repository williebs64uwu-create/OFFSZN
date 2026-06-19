import os

search_paths = [
    r"C:\Windows\System32\WinMetadata",
    r"C:\Program Files (x86)\Windows Kits",
    r"C:\Program Files\Windows Kits",
]

found = []
for p in search_paths:
    if os.path.exists(p):
        for root, dirs, files in os.walk(p):
            for file in files:
                if file.lower().endswith(".winmd"):
                    full_path = os.path.join(root, file)
                    found.append(full_path)
                    print(f"Found: {full_path}")

if not found:
    # Try a broader search in C:\Windows
    print("No .winmd found in standard paths. Searching C:\\Windows...")
    for root, dirs, files in os.walk(r"C:\Windows"):
        for file in files:
            if file.lower() == "windows.winmd":
                full_path = os.path.join(root, file)
                found.append(full_path)
                print(f"Found in Windows: {full_path}")
                break
        if len(found) >= 5:
            break
