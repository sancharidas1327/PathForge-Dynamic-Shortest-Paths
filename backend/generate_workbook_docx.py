"""
Generate a formatted Microsoft Word (.docx) file of the completed PathForge Research Assessment Workbook
using pure Python standard library (zipfile + xml.etree.ElementTree).
"""

import html
import re
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
MD_PATH = ROOT_DIR / "docs" / "WORKBOOK_COMPLETED.md"
DOCX_OUT = ROOT_DIR / "docs" / "PathForge_Research_Assessment_Workbook.docx"
DESKTOP_OUT = Path(r"C:\Users\sancharidas\Desktop\PathForge_Research_Assessment_Workbook.docx")


def clean_md_text(s: str) -> str:
    s = s.replace("<br>", "\n")
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = s.replace("**", "").replace("*", "").replace("`", "")
    s = s.replace("\\le", "≤").replace("\\ge", "≥").replace("\\neq", "≠")
    s = s.replace("\\times", "×").replace("\\in", "∈").replace("\\notin", "∉")
    s = s.replace("\\setminus", "\\").replace("\\epsilon", "ε").replace("\\tau", "τ")
    s = s.replace("\\Theta", "Θ").replace("\\lfloor", "⌊").replace("\\rfloor", "⌋")
    s = s.replace("\\lceil", "⌈").replace("\\rceil", "⌉").replace("\\to", "→")
    s = s.replace("\\leftrightarrow", "↔").replace("\\partial", "∂")
    s = s.replace("$", "")
    return s.strip()


def make_run_xml(text: str, bold: bool = False, size_half_pt: int = 19, color: str = "1E293B") -> str:
    lines = text.split("\n")
    parts = []
    b_tag = "<w:b/>" if bold else ""
    rpr = f'<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="{color}"/><w:sz w:val="{size_half_pt}"/><w:szCs w:val="{size_half_pt}"/>{b_tag}</w:rPr>'
    for idx, line in enumerate(lines):
        escaped = html.escape(line)
        br = "<w:br/>" if idx > 0 else ""
        parts.append(f'<w:r>{rpr}{br}<w:t xml:space="preserve">{escaped}</w:t></w:r>')
    return "".join(parts)


def make_paragraph_xml(text: str, bold: bool = False, size_half_pt: int = 20, color: str = "0F172A", space_after: int = 120) -> str:
    run = make_run_xml(text, bold=bold, size_half_pt=size_half_pt, color=color)
    return f'<w:p><w:pPr><w:spacing w:after="{space_after}"/></w:pPr>{run}</w:p>'


def make_table_xml(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    num_cols = len(rows[0])
    # Landscape Letter page width ~ 15840 twips; margins 1440 -> ~12960 twips usable
    col_w = max(1800, 12960 // max(1, num_cols))
    grid_cols = "".join(f'<w:gridCol w:w="{col_w}"/>' for _ in range(num_cols))

    tr_xmls = []
    for r_idx, row in enumerate(rows):
        is_header = r_idx == 0
        bg_fill = "0F172A" if is_header else ("F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
        txt_color = "FFFFFF" if is_header else "1E293B"
        tc_xmls = []
        for c_idx, cell_text in enumerate(row):
            cleaned = clean_md_text(cell_text)
            cell_bold = is_header or (c_idx == 0)
            p_xml = f'<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>{make_run_xml(cleaned, bold=cell_bold, size_half_pt=18, color=txt_color)}</w:p>'
            tc_xmls.append(
                f"""<w:tc>
                    <w:tcPr>
                        <w:tcW w:w="{col_w}" w:type="dxa"/>
                        <w:shd w:val="clear" w:color="auto" w:fill="{bg_fill}"/>
                        <w:tcMar>
                            <w:top w:w="100" w:type="dxa"/>
                            <w:bottom w:w="100" w:type="dxa"/>
                            <w:left w:w="120" w:type="dxa"/>
                            <w:right w:w="120" w:type="dxa"/>
                        </w:tcMar>
                    </w:tcPr>
                    {p_xml}
                </w:tc>"""
            )
        tr_xmls.append(f"<w:tr>{''.join(tc_xmls)}</w:tr>")

    return f"""
    <w:tbl>
        <w:tblPr>
            <w:tblW w:w="5000" w:type="pct"/>
            <w:tblBorders>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            </w:tblBorders>
        </w:tblPr>
        <w:tblGrid>{grid_cols}</w:tblGrid>
        {''.join(tr_xmls)}
    </w:tbl>
    <w:p/>
    """


def build_docx(md_content: str, out_paths: list[Path]) -> None:
    lines = md_content.splitlines()
    body_elements = []
    current_table: list[list[str]] = []

    def flush_table():
        nonlocal current_table
        if current_table:
            body_elements.append(make_table_xml(current_table))
            current_table = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if all(re.match(r"^:?-{2,}:?$", c) for c in cells):
                continue
            current_table.append(cells)
            continue
        else:
            flush_table()

        if not stripped or stripped == "---":
            continue
        if stripped.startswith("# "):
            body_elements.append(make_paragraph_xml(clean_md_text(stripped[2:]), bold=True, size_half_pt=32, color="0F172A", space_after=180))
        elif stripped.startswith("## "):
            body_elements.append(make_paragraph_xml(clean_md_text(stripped[3:]), bold=True, size_half_pt=26, color="1E3A8A", space_after=140))
        elif stripped.startswith("### "):
            body_elements.append(make_paragraph_xml(clean_md_text(stripped[4:]), bold=True, size_half_pt=22, color="0F172A", space_after=100))
        else:
            body_elements.append(make_paragraph_xml(clean_md_text(stripped), bold=False, size_half_pt=20, color="334155", space_after=90))

    flush_table()

    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(body_elements)}
    <w:sectPr>
      <w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""

    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    for out_p in out_paths:
        try:
            out_p.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(out_p, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("[Content_Types].xml", content_types_xml)
                zf.writestr("_rels/.rels", rels_xml)
                zf.writestr("word/document.xml", document_xml)
            print(f"Created Word document: {out_p} ({out_p.stat().st_size} bytes)")
        except Exception as exc:
            print(f"Skipped {out_p}: {exc}")


if __name__ == "__main__":
    md_text = MD_PATH.read_text(encoding="utf-8")
    build_docx(md_text, [DOCX_OUT, DESKTOP_OUT])
