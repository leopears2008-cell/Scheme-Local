"""Filled-PDF generation with proper Indic text shaping (fpdf2 + HarfBuzz) and pypdf for official forms."""
import io
import re
from datetime import datetime
from pathlib import Path

from fpdf import FPDF
from pypdf import PdfReader, PdfWriter

from config import FONTS_DIR, FORMS_DIR

SCRIPT_FONTS = [  # (first, last codepoint, font family, file)
    (0x0B80, 0x0BFF, "ta", "NotoSansTamil.ttf"), (0x0900, 0x097F, "dev", "NotoSansDevanagari.ttf"),
    (0x0980, 0x09FF, "bn", "NotoSansBengali.ttf"), (0x0C00, 0x0C7F, "te", "NotoSansTelugu.ttf"),
    (0x0A80, 0x0AFF, "gu", "NotoSansGujarati.ttf"), (0x0C80, 0x0CFF, "kn", "NotoSansKannada.ttf"),
    (0x0D00, 0x0D7F, "ml", "NotoSansMalayalam.ttf"), (0x0A00, 0x0A7F, "pa", "NotoSansGurmukhi.ttf"),
    (0x0B00, 0x0B7F, "or", "NotoSansOriya.ttf"), (0x0600, 0x06FF, "ur", "NotoSansArabic.ttf"),
]
LATIN_FONT = ("lat", "NotoSansDevanagari.ttf")  # Noto Sans Devanagari also covers Latin glyphs

# blank official forms shipped with the project (from FormSaathi) -> scheme_id
FORM_FOR_SCHEME = {
    "pm_kisan": "01-PM-KISAN-Application.pdf", "ration_card_nfsa": "02-Ration-Card-NFSA.pdf",
    "pmay_urban": "03-PM-Awas-Yojana-Urban.pdf", "pmay_gramin": "04-PM-Awas-Yojana-Rural.pdf",
    "sukanya_samriddhi": "05-Sukanya-Samriddhi.pdf", "pmfby": "06-PM-Fasal-Bima.pdf",
    "ayushman_bharat": "07-Ayushman-Bharat.pdf", "ujjwala": "08-PM-Ujjwala.pdf",
    "atal_pension": "09-National-Pension.pdf", "pm_mudra": "10-PM-Mudra-Yojana.pdf",
}


def _family_for(text: str) -> str:
    for ch in text:
        for lo, hi, fam, _ in SCRIPT_FONTS:
            if lo <= ord(ch) <= hi:
                return fam
    return LATIN_FONT[0]


def _pdf() -> FPDF:
    pdf = FPDF(unit="mm", format="A4")
    pdf.set_auto_page_break(True, margin=15)
    pdf.add_font(LATIN_FONT[0], "", str(FONTS_DIR / LATIN_FONT[1]))
    for _, _, fam, f in SCRIPT_FONTS:
        if (FONTS_DIR / f).exists():
            pdf.add_font(fam, "", str(FONTS_DIR / f))
    pdf.set_text_shaping(True)
    return pdf


def _write(pdf: FPDF, text: str, size=11, w=0, h=6, **kw):
    pdf.set_font(_family_for(text), size=size)
    pdf.multi_cell(w, h, text, new_x="LMARGIN", new_y="NEXT", **kw)


def summary_pdf(scheme: dict, fields: list[dict], lang_note: str = "", ref: str = "") -> bytes:
    """Readable application summary: scheme, applicant answers, documents to carry, official portal."""
    pdf = _pdf(); pdf.add_page()
    pdf.set_text_color(20, 20, 20)
    _write(pdf, "MySchemeGuide – Application Summary", 16, h=9)
    _write(pdf, scheme.get("name", ""), 13, h=7)
    pdf.set_text_color(110, 110, 110)
    _write(pdf, f"Reference: {ref}   Generated: {datetime.now():%d %b %Y %H:%M}", 9, h=5)
    pdf.set_text_color(20, 20, 20); pdf.ln(3)
    pdf.set_draw_color(200, 200, 200)
    for f in fields:
        label, value = str(f.get("label", "")), str(f.get("value") or "—")
        pdf.set_font(_family_for(label), size=8); pdf.set_text_color(110, 110, 110)
        pdf.multi_cell(0, 4.5, label, new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(20, 20, 20); _write(pdf, value, 11, h=6)
        pdf.line(pdf.l_margin, pdf.get_y() + 1, 210 - pdf.r_margin, pdf.get_y() + 1); pdf.ln(2.5)
    docs = scheme.get("documents_required") or []
    if docs:
        pdf.ln(2); _write(pdf, "Documents to carry", 12, h=7)
        for d in docs:
            _write(pdf, f"[  ]  {d}", 10, h=5.5)
    if scheme.get("source_url"):
        pdf.ln(3); _write(pdf, f"Official source: {scheme['source_url']}", 9, h=5)
    pdf.ln(2); pdf.set_text_color(130, 130, 130)
    _write(pdf, "Check every detail against the official form before you submit. "
                "This summary does not guarantee eligibility or approval.", 8, h=4.5)
    return bytes(pdf.output())


def _latin(v: str) -> bool:
    return all(ord(c) < 0x250 for c in v)


def fill_official_form(scheme_id: str, values: dict) -> tuple[bytes | None, list[str]]:
    """Fill the AcroForm of a shipped blank form. Returns (pdf_bytes|None, skipped_non_latin_fields)."""
    name = FORM_FOR_SCHEME.get(scheme_id)
    if not name or not (Path(FORMS_DIR) / name).exists():
        return None, []
    # clone the document so the interactive form (AcroForm) dictionaries are kept exactly as issued
    writer = PdfWriter(clone_from=str(Path(FORMS_DIR) / name))
    reader = writer  # field names are read from the same document
    form_fields = set((reader.get_fields() or {}).keys())
    fill, skipped = {}, []
    for k, v in values.items():
        if k in form_fields and v not in (None, ""):
            if _latin(str(v)):
                fill[k] = str(v)
            else:
                skipped.append(k)  # standard PDF fonts can't draw these; they go to the summary PDF instead
    for page in writer.pages:
        writer.update_page_form_field_values(page, fill, auto_regenerate=False)
    writer.set_need_appearances_writer(True)
    buf = io.BytesIO(); writer.write(buf)
    return buf.getvalue(), skipped


def overlay_form(background: bytes, fields: list[dict]) -> bytes:
    """Overlay values on a scanned form (image or PDF). fields: {value, x, y, width, height} in % of page."""
    is_pdf = background[:5] == b"%PDF-"
    if is_pdf:
        base = PdfReader(io.BytesIO(background)); page0 = base.pages[0]
        w_mm, h_mm = float(page0.mediabox.width) * 25.4 / 72, float(page0.mediabox.height) * 25.4 / 72
    else:
        from PIL import Image
        im = Image.open(io.BytesIO(background)); iw, ih = im.size
        w_mm, h_mm = (210, 210 * ih / iw) if iw <= ih * 1.4 else (297, 297 * ih / iw)
    pdf = FPDF(unit="mm", format=(w_mm, h_mm)); pdf.set_auto_page_break(False)
    pdf.add_font(LATIN_FONT[0], "", str(FONTS_DIR / LATIN_FONT[1]))
    for _, _, fam, f in SCRIPT_FONTS:
        if (FONTS_DIR / f).exists():
            pdf.add_font(fam, "", str(FONTS_DIR / f))
    pdf.set_text_shaping(True); pdf.add_page()
    if not is_pdf:
        pdf.image(io.BytesIO(background), x=0, y=0, w=w_mm, h=h_mm)
    pdf.set_text_color(10, 40, 160)
    for f in fields:
        v = str(f.get("value") or "")
        if not v:
            continue
        x, y = float(f["x"]) / 100 * w_mm, float(f["y"]) / 100 * h_mm
        bw, bh = max(float(f.get("width", 20)) / 100 * w_mm, 10), max(float(f.get("height", 3)) / 100 * h_mm, 4)
        size = max(6, min(11, bh * 2.2))
        pdf.set_font(_family_for(v), size=size); pdf.set_xy(x, y)
        pdf.cell(bw, bh, v, new_x="LMARGIN", new_y="NEXT")
    overlay = bytes(pdf.output())
    if not is_pdf:
        return overlay
    writer = PdfWriter(); writer.append(base)
    writer.pages[0].merge_page(PdfReader(io.BytesIO(overlay)).pages[0])
    buf = io.BytesIO(); writer.write(buf)
    return buf.getvalue()
