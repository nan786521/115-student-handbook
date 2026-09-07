"""把 pdf/ 內的 PDF 轉成頁面圖，組出可部署的靜態網站。

用法（在 repo 根目錄）：
    python tools/build.py            # 輸出到 dist/
    python tools/build.py --out 路徑

規則：
- pdf/A.pdf → dist/assets/pages/A/page-001.jpg …（檔名＝冊別，對應 config.json 的 books）
- 管理後台上傳的 PDF 會切成 pdf/A.pdf.000、.001 …（GitHub API 單檔上限），這裡自動接回
- 自動寫 dist/pages.json：{"A": 232, "B": 276}，網頁用它決定頁數，不必手改
- index.html / app.js / styles.css / config.json / assets/handbook-bg.png 原樣複製
GitHub Actions 會自動跑這支，本機只有要預覽時才需要（pip install pymupdf）。
"""
import argparse
import json
import shutil
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
DPI = 120          # 原版頁面圖 700x993（A5 @ 120dpi）
JPG_QUALITY = 82
SITE_FILES = ["index.html", "app.js", "styles.css", "config.json", "assets/handbook-bg.png"]


def locate_pdf(book: str, work: Path) -> Path:
    """整檔優先；否則把 pdf/<book>.pdf.000 … 接回一個暫存檔。"""
    whole = ROOT / "pdf" / f"{book}.pdf"
    parts = sorted((ROOT / "pdf").glob(f"{book}.pdf.[0-9][0-9][0-9]"))
    if parts:
        work.mkdir(parents=True, exist_ok=True)
        joined = work / f"{book}.pdf"
        with joined.open("wb") as fh:
            for part in parts:
                fh.write(part.read_bytes())
        print(f"{book} 冊：接回 {len(parts)} 個分割檔")
        return joined
    if whole.exists():
        return whole
    raise SystemExit(f"找不到 {book} 冊 PDF：pdf/ 裡沒有 {book}.pdf 也沒有 {book}.pdf.000")


def convert(pdf: Path, out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("page-*.jpg"):
        old.unlink()
    doc = fitz.open(pdf)
    for i, page in enumerate(doc, 1):
        pix = page.get_pixmap(dpi=DPI, colorspace=fitz.csRGB)
        pix.save(out_dir / f"page-{i:03d}.jpg", jpg_quality=JPG_QUALITY)
    return doc.page_count


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "dist"))
    out = Path(ap.parse_args().out).resolve()
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    for rel in SITE_FILES:
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dst)
    (out / ".nojekyll").touch()

    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    pages = {}
    work = out / "_work"
    for book in config["books"]:
        pdf = locate_pdf(book, work)
        pages[book] = convert(pdf, out / "assets" / "pages" / book)
        print(f"{book} 冊：{pages[book]} 頁")
    shutil.rmtree(work, ignore_errors=True)
    (out / "pages.json").write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    print(f"完成 → {out}")


if __name__ == "__main__":
    main()
