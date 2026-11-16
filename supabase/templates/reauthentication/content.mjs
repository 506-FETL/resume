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
                  {{ .Email }} 的身份验证
                </h1>
                <p
                  style="
                    margin: 0 0 18px;
                    color: #5f6673;
                    font-size: 15px;
                    line-height: 1.8;
                  "
                >
                  返回 GResume
                  原页面，输入下方验证码。验证码仅用于本次操作，过期后需重新获取。
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
                  身份验证码
                </div>
                <div
                  style="
                    margin-bottom: 20px;
                    padding: 19px 14px;
                    text-align: center;
                    background: #f5f7fb;
                    border: 1px solid #dce3ef;
                    border-radius: 10px;
                    color: #171a21;
                    font-family: Consolas, 'Courier New', monospace;
                    font-size: 35px;
                    font-weight: 850;
                    letter-spacing: 10px;
                  "
                >
                  {{ .Token }}
                </div>
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
                    >仅在原页面输入</strong
                  >GResume 不会通过电话、聊天或邮件索要验证码。
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
                    >非本人操作</strong
                  >请勿输入或转发验证码，并检查账号密码和登录方式。
                </div>
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  align="center"
                  style="margin: 22px auto 2px"
                >
                  <tr>
                    <td style="border: 1px solid #cfd4dc; border-radius: 9px">
                      <a
                        href="{{ .SiteURL }}/profile"
                        style="
                          display: inline-block;
                          padding: 12px 25px;
                          color: #344054;
                          text-decoration: none;
                          font-size: 14px;
                          font-weight: 800;
                        "
                        >检查账号安全</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
`
