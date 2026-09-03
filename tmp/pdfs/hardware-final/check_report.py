from pathlib import Path
import json
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw
from pypdf import PdfReader

root = Path(__file__).resolve().parents[3]
out = Path(__file__).resolve().parent
report = root / '个人报告/SpeakSpace_Local_个人项目报告_Fan_latest_源文件/thesis.pdf'
reader = PdfReader(report)
texts = [page.extract_text() or '' for page in reader.pages]
assert len(reader.pages) == 38
assert all(len(text.strip()) > 80 for text in texts)
assert texts[8].startswith('1. Introduction and Context')
assert texts[18].startswith('References')
assert all(abs(float(page.mediabox.width) - 595.276) < 1 for page in reader.pages)
assert all(abs(float(page.mediabox.height) - 841.890) < 1 for page in reader.pages)
charts = list((root / 'docs/testing/charts').glob('*.svg'))
for chart in charts:
    ET.parse(chart)
    assert 'NaN' not in chart.read_text(encoding='utf-8'), chart
for chart in (root / 'docs/testing/charts').glob('cross-*.svg'):
    text = chart.read_text(encoding='utf-8')
    for cpu in ['i9-12900H', 'i5-12600', 'i7-12700H', 'M2 Pro']:
        assert cpu in text, (chart, cpu)
    for memory in ['6 GiB VRAM', '24 GiB VRAM', '4 GiB VRAM', '16 GiB unified memory']:
        assert memory in text, (chart, memory)
pages = sorted(out.glob('page-*.png'))
for first in range(0, len(pages), 8):
    canvas = Image.new('RGB', (1040, 1530), '#d7dde3')
    draw = ImageDraw.Draw(canvas)
    for index, page in enumerate(pages[first:first + 8]):
        im = Image.open(page).convert('RGB')
        im.thumbnail((490, 348))
        x, y = (index % 2) * 520 + 15, (index // 2) * 380 + 20
        draw.text((x, y - 15), f'PDF page {first + index + 1}', fill='black')
        canvas.paste(im, (x, y))
    canvas.save(out / f'contact-{first // 8 + 1}.png')
print(json.dumps({'pages': len(reader.pages), 'body_pages': 10, 'blank_pages': [], 'svg_count': len(charts), 'hardware_charts_checked': 5}))
