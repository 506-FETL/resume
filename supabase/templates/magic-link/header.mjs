export default String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>登录 GResume</title>
    <style>
      @media only screen and (max-width: 620px) {
        .mail-shell {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
          word-break: break-word !important;
        }
        .mail-pad {
          box-sizing: border-box !important;
          width: 100% !important;
          padding-left: 22px !important;
          padding-right: 22px !important;
        }
        .hero-copy,
        .hero-art {
          display: block !important;
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .hero-copy {
          padding: 24px 22px 8px !important;
        }
        .hero-art {
          padding: 0 14px 14px !important;
          text-align: center !important;
        }
        .hero-image {
          width: 250px !important;
          max-width: 100% !important;
          margin: 0 auto !important;
        }
        .method-cell {
          display: block !important;
          box-sizing: border-box !important;
          width: 100% !important;
          padding: 0 0 10px !important;
        }
      }
    </style>
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      background: #f7f8fa;
      color: #171a21;
      font-family:
        Inter,
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        'Microsoft YaHei',
        Arial,
        sans-serif;
    "
  >
    <div
      style="
        display: none;
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        color: transparent;
        mso-hide: all;
      "
    >
      使用一次性链接或验证码登录 GResume。
    </div>
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="width: 100%; background: #f7f8fa"
    >
      <tr>
        <td align="center" style="padding: 30px 12px">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            class="mail-shell"
            style="
              width: 100% !important;
              max-width: 600px;
              table-layout: fixed;
              word-break: break-word;
              background: #fff;
              border: 1px solid #e4e7ec;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(23, 26, 33, 0.07);
            "
          >
            <tr>
              <td
                class="mail-pad"
                style="padding: 16px 28px; border-bottom: 1px solid #eceef1"
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                >
                  <tr>
                    <td>
                      <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                      >
                        <tr>
                          <td
                            style="
                              width: 30px;
                              height: 30px;
                              text-align: center;
                              border-radius: 8px;
                              background: #eef3ff;
                              color: #2f6bff;
                              font-size: 15px;
                              font-weight: 900;
                            "
                          >
                            G
                          </td>
                          <td
                            style="
                              padding-left: 10px;
                              font-size: 16px;
                              font-weight: 800;
                            "
                          >
                            GResume
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right">
                      <span
                        style="
                          display: inline-block;
                          padding: 5px 9px;
                          border: 1px solid #e4e7ec;
                          border-radius: 999px;
                          color: #667085;
                          font-size: 11px;
                          font-weight: 700;
                        "
                        >一次性登录</span
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
`
