export default String.raw`            <tr>
              <td class="mail-pad" style="padding: 30px 34px 24px">
                <h1
                  style="
                    margin: 0 0 12px;
                    font-size: 25px;
                    line-height: 1.4;
                    letter-spacing: -0.02em;
                  "
                >
                  主要邮箱已更新
                </h1>
                <p
                  style="
                    margin: 0 0 20px;
                    color: #5f6673;
                    font-size: 15px;
                    line-height: 1.8;
                  "
                >
                  登录验证、密码恢复和安全通知将发送至新邮箱。
                </p>
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin-bottom: 18px;
                    background: #f9fafb;
                    border: 1px solid #e4e7ec;
                    border-radius: 10px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding: 14px 17px 5px;
                        color: #667085;
                        font-size: 12px;
                      "
                    >
                      原邮箱
                    </td>
                  </tr>
                  <tr>
                    <td
                      style="
                        padding: 0 17px 13px;
                        color: #667085;
                        font-size: 15px;
                        font-weight: 700;
                        word-break: break-all;
                      "
                    >
                      {{ .OldEmail }}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style="
                        padding: 13px 17px 5px;
                        border-top: 1px solid #e4e7ec;
                        color: #667085;
                        font-size: 12px;
                      "
                    >
                      新邮箱
                    </td>
                  </tr>
                  <tr>
                    <td
                      style="
                        padding: 0 17px 16px;
                        font-size: 17px;
                        font-weight: 850;
                        word-break: break-all;
                      "
                    >
                      {{ .Email }}
                    </td>
                  </tr>
                </table>
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                >
                  <tr>
                    <td
                      class="check-cell"
                      width="50%"
                      valign="top"
                      style="padding-right: 6px"
                    >
                      <div
                        style="
                          min-height: 105px;
                          padding: 15px;
                          border: 1px solid #d9eadf;
                          border-radius: 9px;
                          background: #f7fbf8;
                          color: #4f6757;
                          font-size: 13px;
                          line-height: 1.7;
                        "
                      >
                        <strong
                          style="
                            display: block;
                            margin-bottom: 5px;
                            color: #28623d;
                          "
                          >本人操作</strong
                        >请确认新邮箱可以正常接收邮件，并更新密码管理器中的账号记录。
                      </div>
                    </td>
                    <td
                      class="check-cell"
                      width="50%"
                      valign="top"
                      style="padding-left: 6px"
                    >
                      <div
                        style="
                          min-height: 105px;
                          padding: 15px;
                          border: 1px solid #f0d5d3;
                          border-radius: 9px;
                          background: #fff8f7;
                          color: #7a443f;
                          font-size: 13px;
                          line-height: 1.7;
                        "
                      >
                        <strong
                          style="
                            display: block;
                            margin-bottom: 5px;
                            color: #b42318;
                          "
                          >非本人操作</strong
                        >请立即重置密码并保护原邮箱。
                      </div>
                    </td>
                  </tr>
                </table>
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  align="center"
                  style="margin: 23px auto 11px"
                >
                  <tr>
                    <td bgcolor="#d92d20" style="border-radius: 9px">
                      <a
                        href="{{ .SiteURL }}/forgot-password"
                        style="
                          display: inline-block;
                          padding: 14px 30px;
                          color: #fff;
                          text-decoration: none;
                          font-size: 15px;
                          font-weight: 800;
                        "
                        >检查账号安全</a
                      >
                    </td>
                  </tr>
                </table>
                <p style="margin: 0; text-align: center; font-size: 12px">
                  <a
                    href="{{ .SiteURL }}/profile"
                    style="
                      color: #2f6bff;
                      text-decoration: none;
                      font-weight: 750;
                    "
                    >查看账号资料</a
                  >
                </p>
              </td>
            </tr>
`
