# 随应用分发的字体与图标许可

本目录随 Vite 的 `public` 资源一起复制到生产构建的 `/licenses/`，用于保留项目自托管字体和 Devicon 图标字体的版权及许可证文本。

| 资源             | 锁定包版本                                 | 许可证      | 随附文本                       |
| ---------------- | ------------------------------------------ | ----------- | ------------------------------ |
| Noto Sans SC     | `@fontsource-variable/noto-sans-sc@5.2.10` | SIL OFL 1.1 | `noto-sans-sc-OFL-1.1.txt`     |
| Noto Serif SC    | `@fontsource-variable/noto-serif-sc@5.2.9` | SIL OFL 1.1 | `noto-serif-sc-OFL-1.1.txt`    |
| LXGW WenKai      | `@fontsource/lxgw-wenkai@5.2.5`            | SIL OFL 1.1 | `lxgw-wenkai-OFL-1.1.txt`      |
| IBM Plex Sans SC | `@ibm/plex-sans-sc@1.1.0`                  | SIL OFL 1.1 | `ibm-plex-sans-sc-OFL-1.1.txt` |
| Arimo            | `@fontsource-variable/arimo@5.2.8`         | Apache 2.0  | `arimo-Apache-2.0.txt`         |
| ZCOOL XiaoWei    | `@fontsource/zcool-xiaowei@5.2.8`          | SIL OFL 1.1 | `zcool-xiaowei-OFL-1.1.txt`    |
| Devicon          | `devicon@2.17.0`                           | MIT         | `devicon-MIT.txt`              |

以上许可文本来自对应的依赖包，字体和图标的上游地址见各包的 `package.json`。

宣传页另有两份自托管的手写字体子集。英文字母和数字使用 Excalifont，中文等其余字形使用小赖 v3.126。修改宣传页文字后，用 Python、fonttools 4.58.2 和 brotli 1.0.9 运行以下命令。两个参数分别是 [README 图示字体说明](../../docs/assets/readme/fonts/README.md) 列出的原始文件。

```sh
python scripts/subset-homepage-fonts.py /path/to/Excalifont-Regular.woff2 /path/to/Xiaolai-Regular.ttf
```

生成脚本会核对原件的 SHA-256，并将子集命名为 `GResume Sketch Latin` 和 `GResume Sketch CJK`。两种字体均使用 SIL Open Font License 1.1，随附 [Excalifont 许可](./excalifont-OFL-1.1.txt) 和 [小赖许可](./xiaolai-OFL-1.1.txt)。
