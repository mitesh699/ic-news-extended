import { useQuery } from "@tanstack/react-query";
import { fetchSectors } from "@/lib/api";

export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: fetchSectors,
    staleTime: 5 * 60_000,
  });
}
