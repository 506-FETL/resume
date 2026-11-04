"""从 README 指定的字体原件生成宣传页的 WOFF2 子集。"""

import argparse
import hashlib
from html import unescape
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


PAGE = Path(__file__).resolve().parents[1] / 'src/public-homepage'
LATIN_SHA = 'ee41ec4c06bfa0728665499de6f4b4019e7953119ab20b5aeb5917f1609c3b2a'
CJK_SHA = 'e2f68daf0e72777a8cf58bc83de1b98634b251e537ddbfca24b0ae50d1802da2'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('excalifont', type=Path)
    parser.add_argument('xiaolai', type=Path)
    args = parser.parse_args()

    latin = read_original(args.excalifont, LATIN_SHA)
    cjk = read_original(args.xiaolai, CJK_SHA)
    characters = set(range(0x20, 0x7F))

    for path in PAGE.rglob('*'):
        if path.suffix in {'.ts', '.tsx', '.css', '.svg'}:
            source = unescape(path.read_text(encoding='utf-8'))
            characters.update(
                ord(char) for char in source if char.isprintable()
            )

    latin_chars = characters.intersection(latin.getBestCmap())
    cjk_chars = (characters - latin_chars).intersection(cjk.getBestCmap())
    missing = characters - latin_chars - cjk_chars

    if missing:
        raise ValueError('两份原件都缺少下列字形：' + ''.join(map(chr, sorted(missing))))

    write_subset(latin, latin_chars, 'Latin')
    write_subset(cjk, cjk_chars, 'CJK')


def read_original(path, expected_sha):
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected_sha:
        raise ValueError(f'{path.name} 与 README 记录的 SHA-256 不符')

    return TTFont(path, recalcTimestamp=False)


def write_subset(font, codepoints, script):
    family = f'GResume Sketch {script}'
    postscript = family.replace(' ', '') + '-Regular'
    options = subset.Options()
    options.name_IDs = ['*']
    options.drop_tables.append('FFTM')
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)

    # 保留上游作者、版权和许可字段，子集使用独立的产品名称。
    names = {
        1: family,
        3: postscript,
        4: family + ' Regular',
        6: postscript,
        16: family,
    }
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())

    font.flavor = 'woff2'
    path = PAGE / 'assets' / f'sketch-{script.lower()}.woff2'
    font.save(path)
    print(f'{path.name}：{len(codepoints)} 个字符，{path.stat().st_size} 字节')


if __name__ == '__main__':
    main()
