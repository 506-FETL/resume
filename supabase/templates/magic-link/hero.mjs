export default String.raw`            <tr>
              <td style="background: #f7f9ff; border-bottom: 1px solid #e7ecf7">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                >
                  <tr>
                    <td
                      class="hero-copy"
                      width="55%"
                      valign="middle"
                      style="padding: 27px 10px 27px 30px"
                    >
                      <div
                        style="
                          margin-bottom: 9px;
                          color: #2f6bff;
                          font-size: 11px;
                          font-weight: 800;
                          letter-spacing: 0.08em;
                        "
                      >
                        一次性登录
                      </div>
                      <div
                        style="
                          font-size: 24px;
                          line-height: 1.35;
                          font-weight: 850;
                        "
                      >
                        登录凭证已生成
                      </div>
                      <p
                        style="
                          margin: 9px 0 0;
                          color: #5f6673;
                          font-size: 13px;
                          line-height: 1.75;
                        "
                      >
                        请使用下方链接或验证码完成登录。
                      </p>
                    </td>
                    <td
                      class="hero-art"
                      width="45%"
                      align="right"
                      valign="bottom"
                      style="padding: 8px 12px 0 0"
                    >
                      <img
                        class="hero-image"
                        src="{{ .SiteURL }}/email/magic-link-assistant-v2.png"
                        width="250"
                        alt="GResume 一次性登录插图"
                        style="
                          display: block;
                          width: 250px;
                          max-width: 100%;
                          height: auto;
                          border: 0;
                          margin-left: auto;
                        "
                      />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
`
