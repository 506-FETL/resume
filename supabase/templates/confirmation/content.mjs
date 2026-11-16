export default String.raw`            <tr>
              <td class="mail-pad" style="padding: 30px 34px 18px">
                <h1
                  style="
                    margin: 0 0 12px;
                    color: #171a21;
                    font-size: 25px;
                    line-height: 1.4;
                    letter-spacing: -0.02em;
                  "
                >
                  确认注册邮箱
                </h1>
                <p
                  style="
                    margin: 0 0 20px;
                    color: #5f6673;
                    font-size: 15px;
                    line-height: 1.8;
                  "
                >
                  点击下方按钮，将
                  <strong style="color: #344054">{{ .Email }}</strong>
                  绑定至你的 GResume 账号。
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
                      注册邮箱
                    </td>
                  </tr>
                  <tr>
                    <td
                      style="
                        padding: 0 17px 16px;
                        color: #171a21;
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
                          color: #ffffff;
                          text-decoration: none;
                          font-size: 15px;
                          font-weight: 800;
                        "
                        >确认邮箱</a
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
                  style="margin-bottom: 20px"
                >
                  <tr>
                    <td
                      class="feature-cell"
                      width="33.33%"
                      valign="top"
                      style="padding-right: 6px"
                    >
                      <div
                        style="
                          min-height: 76px;
                          padding: 13px;
                          border: 1px solid #e7e9ee;
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
                          >编辑简历</strong
                        >整理经历与项目
                      </div>
                    </td>
                    <td
                      class="feature-cell"
                      width="33.33%"
                      valign="top"
                      style="padding: 0 3px"
                    >
                      <div
                        style="
                          min-height: 76px;
                          padding: 13px;
                          border: 1px solid #e7e9ee;
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
                          >岗位匹配</strong
                        >检查简历与岗位要求
                      </div>
                    </td>
                    <td
                      class="feature-cell"
                      width="33.33%"
                      valign="top"
                      style="padding-left: 6px"
                    >
                      <div
                        style="
                          min-height: 76px;
                          padding: 13px;
                          border: 1px solid #e7e9ee;
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
                          >版本管理</strong
                        >保存与分享不同版本
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
                    >非本人注册</strong
                  >请忽略此邮件，不要点击或转发确认链接。
                </div>
              </td>
            </tr>
`
