import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const auction = await prisma.auction.findUnique({ where: { id } });
  if (!auction) {
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }

  await prisma.auctionSubscription.upsert({
    where: {
      userId_auctionId: { userId: session.user.id, auctionId: id },
    },
    create: { userId: session.user.id, auctionId: id },
    update: {},
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.auctionSubscription.deleteMany({
    where: {
      userId: session.user.id,
      auctionId: id,
    },
  });

  return NextResponse.json({ success: true });
}
