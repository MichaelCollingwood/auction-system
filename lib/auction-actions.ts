import { prisma } from "./prisma";
import { realtime } from "./realtime";
import { Decimal } from "@prisma/client/runtime/library";
import {
  sendOutbidEmail,
  sendAuctionEndedEmail,
  sendYouWonEmail,
} from "./email";
import { sendPushToUser } from "./push";

const ANTI_SNIPING_SECONDS = 30;

async function notifySubscribers(
  auctionId: string,
  auctionItemName: string,
  type: "NEW_BID" | "OUTBID" | "AUCTION_ENDED" | "YOU_WON",
  userIds: string[],
  extra: { amount?: number; bidderName?: string; winnerName?: string }
) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/auctions/${auctionId}`;
  const titles: Record<string, string> = {
    NEW_BID: "New bid placed",
    OUTBID: "You've been outbid!",
    AUCTION_ENDED: "Auction ended",
    YOU_WON: "You won!",
  };
  const messages: Record<string, string> = {
    NEW_BID: `${auctionItemName}: $${extra.amount?.toFixed(2) ?? ""} by ${extra.bidderName ?? "someone"}`,
    OUTBID: `${auctionItemName}: You were outbid at $${extra.amount?.toFixed(2) ?? ""}`,
    AUCTION_ENDED: `${auctionItemName} ended. Winner: ${extra.winnerName ?? "No bids"}`,
    YOU_WON: `Congratulations! You won ${auctionItemName}`,
  };

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  for (const userId of userIds) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title: titles[type],
        message: messages[type],
        link: `/auctions/${auctionId}`,
      },
    });
    const userChannel = realtime.channel(`users:${userId}`);
    await userChannel.emit("notification.alert", {
      id: notification.id,
      type,
      title: notification.title,
      message: notification.message,
      link: `/auctions/${auctionId}`,
    });

    sendPushToUser(userId, {
      title: notification.title,
      body: notification.message,
      link: `/auctions/${auctionId}`,
    }).catch(() => {});

    const email = userMap.get(userId);
    if (email) {
      if (type === "OUTBID" && extra.amount != null) {
        sendOutbidEmail(email, auctionItemName, extra.amount, link).catch(() => {});
      } else if (type === "AUCTION_ENDED" && extra.winnerName) {
        sendAuctionEndedEmail(email, auctionItemName, extra.winnerName, link).catch(() => {});
      } else if (type === "YOU_WON") {
        sendYouWonEmail(email, auctionItemName, link).catch(() => {});
      }
    }
  }
}

export async function processBid(
  auctionId: string,
  amount: number,
  bidderId: string,
  bidderName?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
      include: { highBidder: true },
    });

    if (!auction) {
      return { success: false, error: "Auction not found" };
    }

    if (auction.status !== "ACTIVE") {
      return { success: false, error: "Auction has ended" };
    }

    const now = new Date();
    if (auction.endTime <= now) {
      await tx.auction.update({
        where: { id: auctionId },
        data: { status: "ENDED" },
      });
      return { success: false, error: "Auction has ended" };
    }

    const currentPrice = Number(auction.currentPrice);
    if (amount <= currentPrice) {
      return {
        success: false,
        error: `Bid must be higher than current price ($${currentPrice.toFixed(2)})`,
      };
    }

    let endTime = auction.endTime;
    const msRemaining = endTime.getTime() - now.getTime();
    if (msRemaining <= ANTI_SNIPING_SECONDS * 1000) {
      endTime = new Date(now.getTime() + ANTI_SNIPING_SECONDS * 1000);
      await tx.auction.update({
        where: { id: auctionId },
        data: { endTime },
      });
    }

    const prevHighBidderId = auction.highBidderId;

    const bid = await tx.bid.create({
      data: {
        amount: new Decimal(amount),
        bidderId,
        auctionId,
      },
      include: { bidder: true },
    });

    const updatedAuction = await tx.auction.update({
      where: { id: auctionId },
      data: {
        currentPrice: new Decimal(amount),
        highBidderId: bidderId,
        endTime,
      },
      include: {
        highBidder: true,
        bids: { orderBy: { createdAt: "desc" }, take: 10, include: { bidder: true } },
      },
    });

    const channel = realtime.channel(`auctions:${auctionId}`);

    await channel.emit("auction.bid", {
      amount,
      bidderId,
      bidderName: bidderName ?? bid.bidder.name ?? bid.bidder.email,
      timestamp: bid.createdAt.toISOString(),
      endTime: endTime.toISOString(),
    });

    const isEnded = endTime <= new Date();
    if (isEnded) {
      await tx.auction.update({
        where: { id: auctionId },
        data: { status: "ENDED" },
      });

      await channel.emit("auction.ended", {
        winnerId: bidderId,
        winnerName: bidderName ?? bid.bidder.name ?? bid.bidder.email,
        finalPrice: amount,
      });
    }

    return {
      prevHighBidderId,
      isEnded,
      winnerName: bidderName ?? bid.bidder.name ?? bid.bidder.email,
      bidderName: bidderName ?? bid.bidder.name ?? bid.bidder.email,
      success: true,
      currentState: {
        id: updatedAuction.id,
        itemName: updatedAuction.itemName,
        currentPrice: amount,
        highBidderId: bidderId,
        highBidderName: bidderName ?? bid.bidder.name ?? bid.bidder.email,
        endTime: endTime.toISOString(),
        status: isEnded ? "ENDED" : "ACTIVE",
        bidHistory: updatedAuction.bids.map((b) => ({
          id: b.id,
          amount: Number(b.amount),
          bidderId: b.bidderId,
          bidderName: b.bidder.name ?? b.bidder.email,
          createdAt: b.createdAt.toISOString(),
        })),
      },
    };
  });

  if (result.success && "prevHighBidderId" in result) {
    const r = result as {
      prevHighBidderId: string | null;
      isEnded: boolean;
      winnerName: string;
      bidderName: string;
      currentState: { itemName: string };
    };
    const { prevHighBidderId, isEnded, winnerName, bidderName } = r;
    const itemName = r.currentState.itemName;

    const subscribers = await prisma.auctionSubscription.findMany({
      where: { auctionId },
      select: { userId: true },
    });
    const subscriberIds = subscribers.map((s) => s.userId);

    for (const userId of subscriberIds) {
      if (isEnded && userId === bidderId) {
        await notifySubscribers(auctionId, itemName, "YOU_WON", [userId], { winnerName: bidderName });
      } else if (prevHighBidderId === userId && userId !== bidderId) {
        await notifySubscribers(auctionId, itemName, "OUTBID", [userId], { amount });
      } else if (isEnded) {
        await notifySubscribers(auctionId, itemName, "AUCTION_ENDED", [userId], { winnerName });
      } else if (userId !== bidderId) {
        await notifySubscribers(auctionId, itemName, "NEW_BID", [userId], { amount, bidderName });
      }
    }

    if (isEnded) {
      await realtime.channel("auctions:list").emit("auctionsList.auctionEnded", { auctionId });
    }
  }

  return result;
}
