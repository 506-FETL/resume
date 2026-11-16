export default String.raw`            <tr>
              <td class="mail-pad" style="padding: 8px 34px 28px">
                <p style="margin: 0 0 8px; color: #98a2b3; font-size: 11px">
                  按钮无法打开时，请复制以下链接：
                </p>
                <p
                  style="
                    margin: 0;
                    padding: 11px 12px;
                    background: #f5f6f8;
                    border-radius: 8px;
                    color: #475467;
                    font-size: 10px;
                    line-height: 1.55;
                    word-break: break-all;
                  "
                >
                  {{ .ConfirmationURL }}
                </p>
              </td>
            </tr>
            <tr>
              <td
                align="center"
                class="mail-pad"
                style="
                  padding: 18px 28px;
                  border-top: 1px solid #eceef1;
                  background: #fafbfc;
                  color: #98a2b3;
                  font-size: 11px;
                  line-height: 1.7;
                "
              >
                密码重置邮件发送至 {{ .Email }}，请勿转发。<br />GResume
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
