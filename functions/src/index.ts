import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { buildWelcomeEmail } from "./templates/welcome";

admin.initializeApp();

const db = admin.firestore();

/** Add/refresh a contact in a Brevo list. Best-effort — never throws. */
async function syncBrevoContact(
  email: string,
  displayName: string | undefined
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID;
  if (!apiKey || !listId) return;

  const [firstName, ...rest] = (displayName ?? "").split(" ");
  try {
    const res = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        email,
        attributes: { FIRSTNAME: firstName ?? "", LASTNAME: rest.join(" ") },
        listIds: [Number(listId)],
        updateEnabled: true,
      }),
    });
    if (!res.ok) {
      functions.logger.warn("Brevo contact sync failed", {
        status: res.status,
        email,
      });
    }
  } catch (err) {
    functions.logger.error("Brevo contact sync error", { err });
  }
}

/** Send a WhatsApp template via AiSensy. Best-effort — never throws.
 *  Only fires when the user signed up with a phone number. */
async function sendAisensyWelcome(
  phone: string,
  name: string
): Promise<void> {
  const apiKey = process.env.AISENSY_API_KEY;
  const campaign = process.env.AISENSY_WELCOME_CAMPAIGN;
  if (!apiKey || !campaign) return;

  try {
    const res = await fetch(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          campaignName: campaign,
          destination: phone,
          userName: name,
          templateParams: [name],
        }),
      }
    );
    if (!res.ok) {
      functions.logger.warn("AiSensy welcome failed", {
        status: res.status,
        phone,
      });
    }
  } catch (err) {
    functions.logger.error("AiSensy welcome error", { err });
  }
}

export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const name = user.displayName ?? user.email?.split("@")[0] ?? "there";
  const appUrl = process.env.APP_URL ?? "https://tresorcouture.in";
  const fromEmail = process.env.MAIL_FROM_EMAIL ?? "hello@tresorcouture.in";

  // 1. Welcome email — enqueued for the Firestore "Trigger Email" extension,
  //    which delivers it through the Brevo SMTP relay.
  if (user.email) {
    const { subject, html, text } = buildWelcomeEmail(name, appUrl);
    await db.collection("mail").add({
      to: user.email,
      message: { subject, html, text },
      from: `Tresor Couture <${fromEmail}>`,
    });
    // 2. Add to the Brevo marketing list.
    await syncBrevoContact(user.email, user.displayName ?? undefined);
  }

  // 3. WhatsApp welcome via AiSensy, only if we have a phone number.
  if (user.phoneNumber) {
    await sendAisensyWelcome(user.phoneNumber, name);
  }
});
