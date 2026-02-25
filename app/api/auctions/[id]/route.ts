import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { realtime } from "@/lib/realtime";
import { sendAuctionEndedEmail, sendYouWonEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      highBidder: { select: { id: true, name: true, email: true } },
      bids: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { bidder: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!auction) {
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }

  // End auction if past endTime and broadcast to realtime
  if (auction.status === "ACTIVE" && auction.endTime <= new Date()) {
    auction = await prisma.auction.update({
      where: { id },
      data: { status: "ENDED" },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        highBidder: { select: { id: true, name: true, email: true } },
        bids: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { bidder: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    const channel = realtime.channel(`auctions:${id}`);
    const winnerName = auction.highBidder?.name ?? auction.highBidder?.email ?? "No bids";
    await channel.emit("auction.ended", {
      winnerId: auction.highBidder?.id,
      winnerName,
      finalPrice: Number(auction.currentPrice),
    });

    await realtime.channel("auctions:list").emit("auctionsList.auctionEnded", { auctionId: id });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const link = `${baseUrl}/auctions/${id}`;

    const subscribers = await prisma.auctionSubscription.findMany({
      where: { auctionId: id },
      include: { user: { select: { email: true } } },
    });
    const winnerId = auction.highBidder?.id;
    for (const { userId, user } of subscribers) {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type: userId === winnerId ? "YOU_WON" : "AUCTION_ENDED",
          title: userId === winnerId ? "You won!" : "Auction ended",
          message:
            userId === winnerId
              ? `Congratulations! You won ${auction.itemName}`
              : `${auction.itemName} ended. Winner: ${winnerName}`,
          link: `/auctions/${id}`,
        },
      });
      const userChannel = realtime.channel(`users:${userId}`);
      await userChannel.emit("notification.alert", {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link ?? undefined,
      });

      sendPushToUser(userId, {
        title: notification.title,
        body: notification.message,
        link: notification.link ?? undefined,
      }).catch(() => {});

      if (user.email) {
        if (userId === winnerId) {
          sendYouWonEmail(user.email, auction.itemName, link).catch(() => {});
        } else {
          sendAuctionEndedEmail(user.email, auction.itemName, winnerName, link).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({
    id: auction.id,
    itemName: auction.itemName,
    description: auction.description,
    startingPrice: Number(auction.startingPrice),
    currentPrice: Number(auction.currentPrice),
    endTime: auction.endTime.toISOString(),
    status: auction.status,
    serverTime: new Date().toISOString(),
    creator: auction.creator,
    highBidder: auction.highBidder,
    bidHistory: auction.bids.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      bidderId: b.bidderId,
      bidderName: b.bidder.name ?? b.bidder.email,
      createdAt: b.createdAt.toISOString(),
    })),
  });
}
