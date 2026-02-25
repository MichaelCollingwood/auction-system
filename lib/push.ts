import webpush from "web-push";
import { prisma } from "./prisma";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails("mailto:app@auction.local", VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; link?: string }
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = payload.link ? `${baseUrl}${payload.link}` : baseUrl;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    link: payload.link ?? "/",
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
        { TTL: 60 }
      );
    } catch (err) {
      if (err && typeof err === "object" && "statusCode" in err && (err.statusCode === 404 || err.statusCode === 410)) {
        await prisma.pushSubscription.deleteMany({
          where: { userId, endpoint: sub.endpoint },
        });
      }
    }
  }
}
