# README 图示字体

图示以 **Excalifont** 为主字体。它不包含汉字，因此沿用 Excalidraw 的回退方案，由 **Xiaolai（小赖）** 补齐中文。英文产品名保留原名，其余说明使用中文。

## Excalifont

- 官方介绍：[Excalifont](https://plus.excalidraw.com/excalifont)
- 原始文件：[Excalifont-Regular.woff2](https://excalidraw.nyc3.cdn.digitaloceanspaces.com/fonts/Excalifont-Regular.woff2)
- SHA-256：`ee41ec4c06bfa0728665499de6f4b4019e7953119ab20b5aeb5917f1609c3b2a`
- 许可：[SIL Open Font License 1.1](./OFL-Excalifont.txt)

## 中文回退

- 字体来源：[LXGW / kose-font，v3.126](https://github.com/lxgw/kose-font/releases/tag/v3.126)
- 原始文件：[Xiaolai-Regular.ttf](https://github.com/lxgw/kose-font/releases/download/v3.126/Xiaolai-Regular.ttf)
- SHA-256：`e2f68daf0e72777a8cf58bc83de1b98634b251e537ddbfca24b0ae50d1802da2`
- 许可：[SIL Open Font License 1.1](./OFL-Xiaolai.txt)，也随字体子集嵌入每张 SVG。
- Excalidraw 参考：[回退配置](https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts)、[中文字库](https://github.com/excalidraw/excalidraw/tree/master/packages/excalidraw/fonts/Xiaolai)。这里使用同源完整字库生成子集，并非复制其分片文件。

## 维护

每张 SVG 嵌入自身所需的两种 WOFF2 字形子集，内部命名分别为 `GResume Sketch Latin` 和 `GResume Sketch CJK`，并附带许可。通过 Markdown 的图片标签显示时，不依赖本机字体或外部请求。文字保留为可编辑的 SVG 文本。

修改图中的文字后，需要重新生成字形子集。在安装了 `fonttools` 和 `brotli` 的 Python 环境中，从仓库根目录运行：

```bash
python scripts/embed-readme-fonts.py /path/to/Excalifont-Regular.woff2 /path/to/Xiaolai-Regular.ttf
```

原始完整字体无需加入仓库。更新后检查文字边界和图片引用模式下的字形，避免新文字超出已有卡片。
