import { useQuery } from "@tanstack/react-query";
import { fetchSignalHeatmap, fetchSentimentTrend } from "@/lib/api";

export function useSignalHeatmap() {
  return useQuery({
    queryKey: ["analytics", "signals"],
    queryFn: fetchSignalHeatmap,
    staleTime: 10 * 60_000,
  });
}

export function useSentimentTrend() {
  return useQuery({
    queryKey: ["analytics", "sentiment-trend"],
    queryFn: fetchSentimentTrend,
    staleTime: 10 * 60_000,
  });
}
