import os
import csv

download_dir = r"C:\Users\Willie\Downloads"
target_file = None

# Look for files containing 'ohWl' in the name
for f in os.listdir(download_dir):
    if "ohWlZQHWa09BmjzCXwFr" in f:
        target_file = os.path.join(download_dir, f)
        break

if not target_file:
    print("File not found in Downloads.")
else:
    print(f"Found file: {target_file}")
    # Let's read first few lines and check header and email count
    try:
        with open(target_file, "r", encoding="utf-8", errors="ignore") as file:
            sample = file.read(2048)
            print("\nSample content:")
            print(sample[:500])
            
            # Count total rows and emails
            file.seek(0)
            # Try to sniff delimiter
            dialect = csv.Sniffer().sniff(sample) if ',' in sample or ';' in sample else None
            delimiter = dialect.delimiter if dialect else ','
            
            file.seek(0)
            reader = csv.reader(file, delimiter=delimiter)
            header = next(reader, None)
            print(f"\nHeader: {header}")
            
            email_idx = -1
            if header:
                for idx, col in enumerate(header):
                    if "email" in col.lower() or "mail" in col.lower():
                        email_idx = idx
                        break
            
            # If no header matches, search first row values
            file.seek(0)
            rows = list(reader)
            
            # Find which column contains '@'
            if email_idx == -1 and len(rows) > 1:
                first_row = rows[1]
                for idx, val in enumerate(first_row):
                    if "@" in val:
                        email_idx = idx
                        break
            
            emails = []
            for r in rows[1:]:
                if email_idx < len(r):
                    email = r[email_idx].strip()
                    if email and "@" in email:
                        emails.append(email)
            
            print(f"\nTotal rows: {len(rows)}")
            print(f"Total emails extracted: {len(emails)}")
            print("First 5 emails:")
            for e in emails[:5]:
                print(f"  - {e}")
                
            # Let's save a clean list of emails and names to a text file for him
            output_clean = os.path.join(r"c:\Users\Willie\Desktop\OFFSZN\cursos", "lista_emails_limpia.txt")
            with open(output_clean, "w", encoding="utf-8") as out:
                out.write(f"Lista de Emails Extraidos ({len(emails)}):\\n")
                for e in emails:
                    out.write(f"{e}\\n")
            print(f"Clean list written to {output_clean}")
            
    except Exception as e:
        print(f"Error reading file: {e}")
