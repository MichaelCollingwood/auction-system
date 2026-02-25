import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { realtime } from "@/lib/realtime";

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
    await channel.emit("auction.ended", {
      winnerId: auction.highBidder?.id,
      winnerName: auction.highBidder?.name ?? auction.highBidder?.email,
      finalPrice: Number(auction.currentPrice),
    });
  }

  return NextResponse.json({
    id: auction.id,
    itemName: auction.itemName,
    description: auction.description,
    startingPrice: Number(auction.startingPrice),
    currentPrice: Number(auction.currentPrice),
    endTime: auction.endTime.toISOString(),
    status: auction.status,
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
