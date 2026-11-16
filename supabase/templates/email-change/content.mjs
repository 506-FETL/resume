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
                  确认新的账号邮箱
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
                  已申请更换邮箱。确认后，新地址将用于登录验证、密码恢复和安全通知。
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
                        padding: 15px 17px 5px;
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
                      {{ .NewEmail }}
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
                        >确认新邮箱</a
                      >
                    </td>
                  </tr>
                </table>
                <div
                  style="
                    padding: 14px 16px;
                    border: 1px solid #dfe6f4;
                    border-radius: 9px;
                    background: #f7f9ff;
                    color: #536075;
                    font-size: 13px;
                    line-height: 1.75;
                  "
                >
                  <strong
                    style="display: block; margin-bottom: 3px; color: #344054"
                    >账号数据保持不变</strong
                  >简历、历史版本、分享记录和求职进度仍保留在原账号中。
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
                    >非本人申请</strong
                  >请勿确认，并立即检查账号安全及修改密码。
                </div>
              </td>
            </tr>
`
