import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotificationBanner } from "./components/notification-banner";
import { ActiveAuctionsList } from "./components/active-auctions-list";
import { AuctionSearch } from "./components/auction-search";

export default async function HomePage() {
  const [session, auctions] = await Promise.all([
    getServerSession(authOptions),
    prisma.auction.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        highBidder: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Auction Platform
          </Link>
          <nav className="flex items-center gap-4">
            {session ? (
              <>
                <Link
                  href="/auctions/new"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Create Auction
                </Link>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {session.user.email}
                </span>
                <Link
                  href="/api/auth/signout"
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Sign out
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {session && <NotificationBanner />}

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Active Auctions
          </h1>
          <AuctionSearch />
        </div>

        <ActiveAuctionsList
          initialAuctions={auctions.map((a) => ({
            id: a.id,
            itemName: a.itemName,
            currentPrice: Number(a.currentPrice),
            endTime: a.endTime.toISOString(),
          }))}
          session={!!session}
        />
      </main>
    </div>
  );
}
