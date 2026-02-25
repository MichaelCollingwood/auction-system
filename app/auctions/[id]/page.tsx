import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LiveAuctionView } from "./live-auction-view";

export default async function AuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, auction] = await Promise.all([
    getServerSession(authOptions),
    prisma.auction.findUnique({
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
  }),
  ]);

  if (!auction) notFound();

  const subscription =
    session?.user?.id
      ? await prisma.auctionSubscription.findUnique({
          where: {
            userId_auctionId: { userId: session.user.id, auctionId: id },
          },
        })
      : null;
  const isSubscribed = !!subscription;

  const initialData = {
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
  };

  return (
    <LiveAuctionView
      auctionId={id}
      initialData={initialData}
      isSubscribed={isSubscribed}
    />
  );
}
