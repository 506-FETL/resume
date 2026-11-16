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
                  登录密码已更新
                </h1>
                <p
                  style="
                    margin: 0 0 20px;
                    color: #5f6673;
                    font-size: 15px;
                    line-height: 1.8;
                  "
                >
                  账号
                  <strong style="color: #344054">{{ .Email }}</strong>
                  的密码已更改。此邮件不会显示或索要密码。
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
                        padding: 15px 17px 5px;
                        color: #667085;
                        font-size: 12px;
                      "
                    >
                      变更项目
                    </td>
                  </tr>
                  <tr>
                    <td
                      style="
                        padding: 0 17px 16px;
                        font-size: 17px;
                        font-weight: 850;
                      "
                    >
                      GResume 登录密码
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
                          min-height: 112px;
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
                        >无需其他操作。请勿在其他网站重复使用新密码。
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
                          min-height: 112px;
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
                        >请立即重置密码，并检查邮箱和登录方式。
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
                        >重置密码</a
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
                    >查看登录设置</a
                  >
                </p>
              </td>
            </tr>
`
