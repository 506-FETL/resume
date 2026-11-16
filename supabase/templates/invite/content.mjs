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
                  接受 GResume 邀请
                </h1>
                <p
                  style="
                    margin: 0 0 20px;
                    color: #5f6673;
                    font-size: 15px;
                    line-height: 1.8;
                  "
                >
                  邀请已发送至
                  <strong style="color: #344054">{{ .Email }}</strong
                  >。接受后即可创建账号并使用简历工作台。
                </p>
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin-bottom: 22px;
                    background: #f9fafb;
                    border: 1px solid #e4e7ec;
                    border-radius: 10px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding: 15px 17px;
                        color: #667085;
                        font-size: 12px;
                      "
                    >
                      受邀邮箱
                    </td>
                  </tr>
                  <tr>
                    <td
                      style="
                        padding: 0 17px 16px;
                        font-size: 16px;
                        font-weight: 800;
                        word-break: break-all;
                      "
                    >
                      {{ .Email }}
                    </td>
                  </tr>
                </table>
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
                          padding: 14px 32px;
                          color: #fff;
                          text-decoration: none;
                          font-size: 15px;
                          font-weight: 800;
                        "
                        >接受邀请</a
                      >
                    </td>
                  </tr>
                </table>
                <div
                  style="
                    padding: 16px;
                    border: 1px solid #e4e7ec;
                    border-radius: 9px;
                    background: #fafbfc;
                  "
                >
                  <strong
                    style="display: block; margin-bottom: 8px; font-size: 13px"
                    >创建账号后</strong
                  >
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                  >
                    <tr>
                      <td
                        class="step-cell"
                        width="33.33%"
                        valign="top"
                        style="
                          padding-right: 8px;
                          color: #667085;
                          font-size: 12px;
                          line-height: 1.65;
                        "
                      >
                        <span style="color: #2f6bff; font-weight: 800">01</span
                        ><br />整理简历
                      </td>
                      <td
                        class="step-cell"
                        width="33.33%"
                        valign="top"
                        style="
                          padding: 0 4px;
                          color: #667085;
                          font-size: 12px;
                          line-height: 1.65;
                        "
                      >
                        <span style="color: #2f6bff; font-weight: 800">02</span
                        ><br />匹配岗位
                      </td>
                      <td
                        class="step-cell"
                        width="33.33%"
                        valign="top"
                        style="
                          padding-left: 8px;
                          color: #667085;
                          font-size: 12px;
                          line-height: 1.65;
                        "
                      >
                        <span style="color: #2f6bff; font-weight: 800">03</span
                        ><br />管理版本
                      </td>
                    </tr>
                  </table>
                </div>
                <div
                  style="
                    margin-top: 16px;
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
                    >来源不明</strong
                  >请忽略此邮件，不要打开或转发邀请链接。
                </div>
              </td>
            </tr>
`
