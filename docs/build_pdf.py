#!/usr/bin/env python3
"""Build LINGROOVE_PROJECT_GUIDE.pdf from LINGROOVE_PROJECT_GUIDE.md using ReportLab."""

from __future__ import annotations

import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _strip_inline_md(s: str) -> str:
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"`(.+?)`", r"\1", s)
    return s


def main() -> None:
    base = Path(__file__).resolve().parent
    md_path = base / "LINGROOVE_PROJECT_GUIDE.md"
    out_path = base / "LINGROOVE_PROJECT_GUIDE.pdf"

    raw = md_path.read_text(encoding="utf-8")
    lines = raw.splitlines()

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="TitleCustom",
        parent=styles["Title"],
        fontSize=22,
        spaceAfter=16,
        textColor=colors.HexColor("#111111"),
    )
    h1_style = ParagraphStyle(
        name="H1Custom",
        parent=styles["Heading1"],
        fontSize=16,
        spaceBefore=14,
        spaceAfter=8,
        textColor=colors.HexColor("#0d47a1"),
    )
    h2_style = ParagraphStyle(
        name="H2Custom",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=10,
        spaceAfter=6,
        textColor=colors.HexColor("#1565c0"),
    )
    body_style = ParagraphStyle(
        name="BodyCustom",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        spaceAfter=4,
    )
    bullet_style = ParagraphStyle(
        name="BulletCustom",
        parent=body_style,
        leftIndent=18,
        bulletIndent=8,
    )
    meta_style = ParagraphStyle(
        name="MetaCustom",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#555555"),
        spaceAfter=12,
    )

    story: list = []

    i = 0
    if lines and lines[0].startswith("# "):
        story.append(Paragraph(escape(lines[0][2:].strip()), title_style))
        i = 1
        while i < len(lines) and lines[i].strip() == "":
            i += 1
        if i < len(lines) and lines[i].startswith("**") and lines[i].endswith("**"):
            story.append(Paragraph(escape(lines[i].strip("* ").strip()), meta_style))
            i += 1

    in_code = False
    code_buf: list[str] = []

    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            if not in_code:
                in_code = True
                code_buf = []
            else:
                in_code = False
                story.append(
                    Preformatted("\n".join(code_buf), styles["Code"], maxLineLength=120)
                )
                story.append(Spacer(1, 8))
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if line.strip() == "":
            story.append(Spacer(1, 6))
            i += 1
            continue

        if line.startswith("---"):
            story.append(Spacer(1, 6))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
            story.append(Spacer(1, 6))
            i += 1
            continue

        if line.startswith("# "):
            story.append(Paragraph(escape(_strip_inline_md(line[2:].strip())), h1_style))
            i += 1
            continue

        if line.startswith("## "):
            story.append(Paragraph(escape(_strip_inline_md(line[3:].strip())), h2_style))
            i += 1
            continue

        if line.startswith("### "):
            story.append(Paragraph(escape(_strip_inline_md(line[4:].strip())), h2_style))
            i += 1
            continue

        if re.match(r"^\|.+\|$", line) and i + 1 < len(lines) and "|--" in lines[i + 1]:
            header = [c.strip() for c in line.strip("|").split("|")]
            i += 2
            rows = [header]
            while i < len(lines) and "|" in lines[i] and lines[i].strip():
                rows.append([c.strip() for c in lines[i].strip("|").split("|")])
                i += 1
            t = Table(rows, hAlign="LEFT")
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e3f2fd")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0d47a1")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            story.append(t)
            story.append(Spacer(1, 10))
            continue

        if line.lstrip().startswith("- ") or line.lstrip().startswith("* "):
            txt = _strip_inline_md(line.lstrip()[2:].strip())
            story.append(Paragraph(escape(txt), bullet_style, bulletText="•"))
            i += 1
            continue

        if re.match(r"^\d+\.\s", line.lstrip()):
            txt = _strip_inline_md(re.sub(r"^\d+\.\s", "", line.lstrip()))
            story.append(Paragraph(escape(txt), body_style))
            i += 1
            continue

        story.append(Paragraph(escape(_strip_inline_md(line.strip())), body_style))
        i += 1

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title="Lingroove Project Guide",
        author="Lingroove",
    )
    doc.build(story)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
