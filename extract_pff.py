import pdfplumber

PDF_PATH = "pff-stats-2026-04-01-with-alignment-snaps.pdf"
OUTPUT_FILE = "pff_raw.txt"

all_text = ""

with pdfplumber.open(PDF_PATH) as pdf:
    for i, page in enumerate(pdf.pages):
        print(f"Reading page {i+1}/{len(pdf.pages)}...")
        
        text = page.extract_text()
        if text:
            all_text += text + "\n\n"

with open(OUTPUT_FILE, "w") as f:
    f.write(all_text)

print("Done. Output saved to pff_raw.txt")