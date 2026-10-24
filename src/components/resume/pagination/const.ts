export const A4_PAGE_WIDTH = '210mm'

export const A4_PAGE_HEIGHT = '297mm'

export const BOUNDARY_EPSILON = 0.5

export const MAX_STABILITY_FRAMES = 8

export const RESUME_PRINT_PAGE_STYLE = `
  body {
    margin: 0;
  }
  /* 打印前校验也使用测量页的原点，避免 WebKit 居中偏移造成文字矩形精度差异。 */
  [data-resume-page] {
    margin: 0 !important;
  }
  @page {
    size: A4;
    margin: 0;
  }
  @media print {
    [data-resume-document] {
      gap: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    [data-resume-page] {
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      /* 固定纸张不再参与浏览器对子孙长流的二次分页，否则已计算的裁剪会丢行。 */
      contain: size;
      break-after: page;
    }
    [data-resume-page]:last-child {
      break-after: auto;
    }
  }
`
