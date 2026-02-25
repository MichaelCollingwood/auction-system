import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? "notifications@resend.dev";

export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string
) {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("Email send error:", err);
  }
}

export async function sendOutbidEmail(
  to: string,
  itemName: string,
  amount: number,
  link: string
) {
  await sendNotificationEmail(
    to,
    `You've been outbid on ${itemName}`,
    `<p>You were outbid on <strong>${itemName}</strong> at $${amount.toFixed(2)}.</p><p><a href="${link}">View auction</a></p>`
  );
}

export async function sendAuctionEndedEmail(
  to: string,
  itemName: string,
  winnerName: string,
  link: string
) {
  await sendNotificationEmail(
    to,
    `Auction ended: ${itemName}`,
    `<p><strong>${itemName}</strong> has ended. Winner: ${winnerName}</p><p><a href="${link}">View auction</a></p>`
  );
}

export async function sendYouWonEmail(
  to: string,
  itemName: string,
  link: string
) {
  await sendNotificationEmail(
    to,
    `You won: ${itemName}!`,
    `<p>Congratulations! You won <strong>${itemName}</strong>.</p><p><a href="${link}">View auction</a></p>`
  );
}
