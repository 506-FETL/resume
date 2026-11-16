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
                  {{ .Email }} 的密码重置请求
                </h1>
                <p
                  style="
                    margin: 0 0 20px;
                    color: #5f6673;
                    font-size: 15px;
                    line-height: 1.8;
                  "
                >
                  点击按钮并按页面提示设置新密码。打开此邮件不会更改密码。
                </p>
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
                        >重置密码</a
                      >
                    </td>
                  </tr>
                </table>
                <div
                  style="
                    padding: 15px 16px;
                    border: 1px solid #e4e7ec;
                    border-radius: 9px;
                    background: #fafbfc;
                    color: #667085;
                    font-size: 13px;
                    line-height: 1.75;
                  "
                >
                  <strong
                    style="display: block; margin-bottom: 7px; color: #171a21"
                    >设置安全密码</strong
                  >请使用足够长且未在其他网站使用的密码，避免使用姓名、手机号等公开信息。
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
                  >请忽略此邮件；原密码不会改变。如频繁收到此邮件，请检查邮箱安全。
                </div>
              </td>
            </tr>
`
