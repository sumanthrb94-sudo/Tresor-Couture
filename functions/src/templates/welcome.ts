/** Branded welcome email — matches the voice and visual system in branding/BRAND.md.
 *  Curated, restrained, archival. No exclamation marks. Second person, present tense. */
export function buildWelcomeEmail(name: string, appUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Welcome to Tresor Couture";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Tresor Couture</title>
</head>
<body style="margin:0;padding:0;background:#F5ECDC;font-family:Georgia,'Times New Roman',serif;color:#2A1F12">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:#F5ECDC;padding:48px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
        style="background:#FBF5EA;border:1px solid #EAD9BA;max-width:560px;width:100%">

        <!-- Header -->
        <tr><td style="padding:36px 40px 16px 40px;text-align:center">
          <div style="font-size:11px;letter-spacing:0.28em;color:#B8893A;
                      font-family:Helvetica,Arial,sans-serif;font-weight:600">
            TRESOR &middot; COUTURE
          </div>
          <div style="height:1px;background:linear-gradient(to right,transparent,#B8893A,transparent);
                      width:120px;margin:14px auto 0 auto"></div>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:20px 40px 0 40px">
          <p style="font-size:24px;font-style:italic;margin:0 0 20px 0;
                    color:#2A1F12;line-height:1.3">
            Dear ${name},
          </p>
          <p style="font-size:15px;line-height:1.75;margin:0 0 16px 0;color:#2A1F12">
            Your atelier account is ready.
          </p>
          <p style="font-size:15px;line-height:1.75;margin:0 0 16px 0;color:#2A1F12">
            Tresor Couture is a curated house of heritage textiles — silks, handwoven cottons,
            bridal lehengas, and rare fabric bolts sourced from master weavers across India.
            Every piece is chosen for its craft, not its commerce.
          </p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:20px 40px 0 40px">
          <div style="height:1px;background:#EAD9BA"></div>
        </td></tr>

        <!-- Member privileges -->
        <tr><td style="padding:24px 40px 0 40px">
          <div style="font-size:10px;letter-spacing:0.24em;color:#B8893A;
                      font-family:Helvetica,Arial,sans-serif;font-weight:600;margin-bottom:16px">
            YOUR MEMBER PRIVILEGES
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding:8px 0;vertical-align:top;width:20px;color:#B8893A;font-size:14px">&#8212;</td>
              <td style="padding:8px 0;font-size:14px;line-height:1.6;color:#3D362B">
                A permanent wishlist, kept across every device and session
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;vertical-align:top;width:20px;color:#B8893A;font-size:14px">&#8212;</td>
              <td style="padding:8px 0;font-size:14px;line-height:1.6;color:#3D362B">
                One-step checkout with saved shipping details
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;vertical-align:top;width:20px;color:#B8893A;font-size:14px">&#8212;</td>
              <td style="padding:8px 0;font-size:14px;line-height:1.6;color:#3D362B">
                Full order history and live status tracking
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;vertical-align:top;width:20px;color:#B8893A;font-size:14px">&#8212;</td>
              <td style="padding:8px 0;font-size:14px;line-height:1.6;color:#3D362B">
                Early access to private bridal previews and new drops
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:24px 40px 0 40px">
          <div style="height:1px;background:#EAD9BA"></div>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:28px 40px 0 40px;text-align:center">
          <p style="font-size:14px;line-height:1.7;margin:0 0 24px 0;color:#2A1F12">
            The current collection is waiting.
          </p>
          <a href="${appUrl}/shop"
            style="display:inline-block;background:#B8893A;color:#FBF5EA;
                   font-family:Helvetica,Arial,sans-serif;font-size:12px;
                   letter-spacing:0.2em;font-weight:600;
                   padding:14px 36px;text-decoration:none">
            BROWSE THE COLLECTION
          </a>
        </td></tr>

        <!-- Sign-off -->
        <tr><td style="padding:32px 40px 28px 40px">
          <p style="font-size:14px;line-height:1.7;margin:0 0 4px 0;
                    font-style:italic;color:#2A1F12">
            &mdash; The Tresor Couture team
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 40px;border-top:1px solid #EAD9BA;
                       font-size:11px;color:#98917F;
                       font-family:Helvetica,Arial,sans-serif;text-align:center;
                       line-height:1.6">
          A reply to this message reaches us directly.<br/>
          <a href="${appUrl}" style="color:#B8893A;text-decoration:none">
            ${appUrl.replace(/^https?:\/\//, '')}
          </a>
          &nbsp;&middot;&nbsp;
          <a href="${appUrl}/account" style="color:#B8893A;text-decoration:none">
            Manage your account
          </a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Dear ${name},`,
    "",
    "Your atelier account is ready.",
    "",
    "Tresor Couture is a curated house of heritage textiles — silks, handwoven cottons,",
    "bridal lehengas, and rare fabric bolts sourced from master weavers across India.",
    "Every piece is chosen for its craft, not its commerce.",
    "",
    "YOUR MEMBER PRIVILEGES",
    "  — A permanent wishlist, kept across every device and session",
    "  — One-step checkout with saved shipping details",
    "  — Full order history and live status tracking",
    "  — Early access to private bridal previews and new drops",
    "",
    `Browse the collection: ${appUrl}/shop`,
    "",
    "— The Tresor Couture team",
    "",
    `${appUrl.replace(/^https?:\/\//, "")}`,
  ].join("\n");

  return { subject, html, text };
}
