export const A4_PAGE_WIDTH = '210mm'
export const A4_PAGE_HEIGHT = '297mm'
export const BOUNDARY_EPSILON = 0.5
export const MAX_STABILITY_FRAMES = 8

export const RESUME_PRINT_PAGE_STYLE = `
  @page {
    size: A4;
    margin: 0;
  }
  @media print {
    [data-resume-document] {
      gap: 0 !important;
    }
    [data-resume-page] {
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      break-after: page;
    }
    [data-resume-page]:last-child {
      break-after: auto;
    }
  }
`
