export default String.raw`            <tr>
              <td class="mail-pad" style="padding: 30px 34px 18px">
                <h1
                  style="
                    margin: 0 0 12px;
                    font-size: 25px;
                    line-height: 1.4;
                    letter-spacing: -0.02em;
                  "
                >
                  {{ .Email }} 的登录请求
                </h1>
                <p
                  style="
                    margin: 0 0 18px;
                    color: #5f6673;
                    font-size: 15px;
                    line-height: 1.8;
                  "
                >
                  点击按钮登录，或在原登录页面输入验证码。
                </p>
                <div
                  style="
                    margin-bottom: 8px;
                    text-align: center;
                    color: #667085;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                  "
                >
                  一次性验证码
                </div>
                <div
                  style="
                    margin-bottom: 22px;
                    padding: 18px 14px;
                    text-align: center;
                    background: #f5f7fb;
                    border: 1px solid #dce3ef;
                    border-radius: 10px;
                    color: #171a21;
                    font-family: Consolas, 'Courier New', monospace;
                    font-size: 34px;
                    font-weight: 850;
                    letter-spacing: 9px;
                  "
                >
                  {{ .Token }}
                </div>
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  align="center"
                  style="margin: 0 auto 24px"
                >
                  <tr>
                    <td bgcolor="#171a21" style="border-radius: 9px">
                      <a
                        href="{{ .ConfirmationURL }}"
                        style="
                          display: inline-block;
                          padding: 14px 34px;
                          color: #fff;
                          text-decoration: none;
                          font-size: 15px;
                          font-weight: 800;
                        "
                        >登录 GResume</a
                      >
                    </td>
                  </tr>
                </table>
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="margin-bottom: 18px"
                >
                  <tr>
                    <td
                      class="method-cell"
                      width="50%"
                      valign="top"
                      style="padding-right: 6px"
                    >
                      <div
                        style="
                          min-height: 72px;
                          padding: 14px;
                          border: 1px solid #e4e7ec;
                          border-radius: 9px;
                          color: #667085;
                          font-size: 12px;
                          line-height: 1.65;
                        "
                      >
                        <strong
                          style="
                            display: block;
                            margin-bottom: 4px;
                            color: #171a21;
                          "
                          >登录链接</strong
                        >在当前设备完成验证。
                      </div>
                    </td>
                    <td
                      class="method-cell"
                      width="50%"
                      valign="top"
                      style="padding-left: 6px"
                    >
                      <div
                        style="
                          min-height: 72px;
                          padding: 14px;
                          border: 1px solid #e4e7ec;
                          border-radius: 9px;
                          color: #667085;
                          font-size: 12px;
                          line-height: 1.65;
                        "
                      >
                        <strong
                          style="
                            display: block;
                            margin-bottom: 4px;
                            color: #171a21;
                          "
                          >验证码</strong
                        >在原登录页面输入。
                      </div>
                    </td>
                  </tr>
                </table>
                <div
                  style="
                    padding: 14px 16px;
                    border: 1px solid #f1d7d4;
                    border-radius: 9px;
                    background: #fff8f7;
                    color: #7a443f;
                    font-size: 13px;
                    line-height: 1.75;
                  "
                >
                  <strong
                    style="display: block; margin-bottom: 3px; color: #b42318"
                    >非本人操作</strong
                  >请忽略此邮件，不要点击链接或泄露验证码。
                </div>
              </td>
            </tr>
`
