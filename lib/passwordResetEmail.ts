/**
 * HTML email template for password reset (Austrian German, McDonald's style).
 * Clean white background, dark green/gold accents.
 */
export function getPasswordResetEmailHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="de-AT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Passwort zurücksetzen</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.06); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #1a3826 0%, #0c1f15 100%); padding: 28px 32px; text-align: left;">
              <span style="font-size: 24px; font-weight: 800; color: #ffffff;">AIW</span>
              <span style="font-size: 24px; font-weight: 800; color: #FFC72C;"> Services</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #1a3826;">
                Passwort zurücksetzen
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #334155;">
                Hallo,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #334155;">
                Sie haben eine Zurücksetzung Ihres Passworts angefordert. Klicken Sie auf den untenstehenden Button, um Ihr Passwort neu zu setzen.
              </p>
              <p style="margin: 0 0 24px 0;">
                <a href="${resetUrl}" style="display: inline-block; background-color: #1a3826; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px;">
                  Passwort zurücksetzen
                </a>
              </p>
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                Der Link ist 1 Stunde gültig. Wenn Sie die Zurücksetzung nicht angefordert haben, ignorieren Sie diese E-Mail.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © AIW Services – McDonald's Österreich
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}
