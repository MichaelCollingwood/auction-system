"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

type Auction = {
  id: string;
  itemName: string;
  currentPrice: number;
  endTime: string;
};

export function AuctionSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedFetch = useCallback(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/auctions/search?q=${encodeURIComponent(query)}&limit=10`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data.auctions ?? []);
        setHighlighted(0);
      })
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    const t = setTimeout(debouncedFetch, 300);
    return () => clearTimeout(t);
  }, [query, debouncedFetch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((p) => Math.min(p + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter" && results[highlighted]) {
      e.preventDefault();
      window.location.href = `/auctions/${results[highlighted].id}`;
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search auctions..."
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-400"
      />
      {open && query.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {loading ? (
            <div className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              No auctions found
            </div>
          ) : (
            <ul className="max-h-60 overflow-y-auto py-1">
              {results.map((auction, i) => (
                <li key={auction.id}>
                  <Link
                    href={`/auctions/${auction.id}`}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      i === highlighted ? "bg-zinc-100 dark:bg-zinc-800" : ""
                    }`}
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {auction.itemName}
                    </span>
                    <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                      ${auction.currentPrice.toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
