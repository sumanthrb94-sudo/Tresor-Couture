import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { buildWelcomeEmail } from "./templates/welcome";

admin.initializeApp();

const db = admin.firestore();

export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const name = user.displayName ?? user.email?.split("@")[0] ?? "there";
  const appUrl = process.env.APP_URL ?? "https://tresorcouture.com";
  const fromEmail =
    process.env.USESEND_FROM_EMAIL ?? "hello@tresorcouture.com";

  const { subject, html, text } = buildWelcomeEmail(name, appUrl);

  // Enqueue welcome email via the "Trigger Email from Firestore" extension.
  await db.collection("mail").add({
    to: user.email,
    message: { subject, html, text },
    from: `Tresor Couture <${fromEmail}>`,
  });

  // Sync contact to useSend marketing list (best-effort — don't fail the
  // trigger if the external call errors).
  const apiUrl = process.env.USESEND_API_URL;
  const apiKey = process.env.USESEND_API_KEY;
  const listId = process.env.USESEND_LIST_ID;

  if (apiUrl && apiKey && listId && user.email) {
    try {
      const res = await fetch(`${apiUrl}/api/contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          email: user.email,
          firstName: user.displayName?.split(" ")[0] ?? "",
          lastName: user.displayName?.split(" ").slice(1).join(" ") ?? "",
          listIds: [listId],
        }),
      });
      if (!res.ok) {
        functions.logger.warn("useSend contact sync failed", {
          status: res.status,
          email: user.email,
        });
      }
    } catch (err) {
      functions.logger.error("useSend contact sync error", { err });
    }
  }
});
