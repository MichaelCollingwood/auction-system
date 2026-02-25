import { prisma } from "./prisma";
import { realtime } from "./realtime";
import { Decimal } from "@prisma/client/runtime/library";

const ANTI_SNIPING_SECONDS = 30;

export async function processBid(
  auctionId: string,
  amount: number,
  bidderId: string,
  bidderName?: string
) {
  return prisma.$transaction(async (tx) => {
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
}
