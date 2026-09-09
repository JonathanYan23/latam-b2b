import pypdf, os
d = "C:/Users/JONY/OneDrive/xwechat_files/wxid_krkf8qukid4x32_876d/msg/file/2026-09"
fn = None
for n in os.listdir(d):
    if n.endswith(".pdf") and "完整需求清单" in n:
        fn = os.path.join(d, n)
        break
print("FILE:", fn)
r = pypdf.PdfReader(fn)
print("PAGES:", len(r.pages))
out = []
for i, pg in enumerate(r.pages):
    out.append(f"\n===== PAGE {i+1} =====\n")
    out.append(pg.extract_text() or "")
txt = "".join(out)
open("D:/latam-b2b/.pdf-req3.txt", "w", encoding="utf-8").write(txt)
print("chars:", len(txt))
