"""用 Poppler 验证真实打印副本的页数、文本、边界和背景开关像素一致性。"""
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).parent / 'artifacts'
report = json.loads((root / 'browser-report.json').read_text())
results = []
for entry in report:
    if not entry.get('printCaptured'):
        continue
    name = f"{entry['template']}-{entry['mode']}"
    off, on = [root / f'{name}-background-{value}.pdf' for value in ('false', 'true')]
    info = subprocess.check_output(['pdfinfo', str(off)], text=True)
    pages = int(re.search(r'Pages:\s+(\d+)', info).group(1))
    assert pages == entry['pages'], name
    text = subprocess.check_output(['pdftotext', str(off), '-'], text=True)
    assert '自我评价' in text, (name, text[-300:])
    if entry['mode'] == 'long':
        assert 'END-DECLARATIVE-2026' in text, (name, 'missing end')
        assert '第18段长内容经历' in text.replace(' ', '').replace('\n', ''), (name, 'missing final experience')
    bbox = subprocess.check_output(['pdftotext', '-bbox', str(off), '-'], text=True)
    tree = ET.fromstring(bbox)
    ns = {'x': 'http://www.w3.org/1999/xhtml'}
    for page in tree.findall('.//x:page', ns):
        width, height = float(page.attrib['width']), float(page.attrib['height'])
        assert abs(width-595.28)<1 and abs(height-841.89)<1
        for word in page:
            bounds = [float(word.attrib[key]) for key in ['xMin','yMin','xMax','yMax']]
            assert bounds[0]>=-0.5 and bounds[1]>=-0.5 and bounds[2]<=width+0.5 and bounds[3]<=height+0.5, (name, bounds)
    for value, document in [('false',off),('true',on)]:
        subprocess.run(['pdftoppm','-scale-to','1000','-png',str(document),str(root/f'{name}-{value}')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for file in root.glob(f'{name}-false-*.png'):
        assert file.read_bytes() == Path(str(file).replace('-false-','-true-')).read_bytes(), (name, 'background mismatch')
    results.append({'fixture':name,'pages':pages,'characters':len(text),'backgroundPixelsEqual':True,'endTextVerified':entry['mode']=='long'})
(root / 'pdf-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps(results, ensure_ascii=False))
