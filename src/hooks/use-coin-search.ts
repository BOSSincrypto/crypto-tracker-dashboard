import { useQuery } from "@tanstack/react-query";
import { searchCoins } from "../lib/crypto/coingecko";

export function useCoinSearch(query: string) {
  return useQuery({
    queryKey: ["coin-search", query],
    queryFn: () => searchCoins(query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
    retry: 0,
  });
}