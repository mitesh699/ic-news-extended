import { useQuery } from "@tanstack/react-query";
import { fetchCompetitors } from "@/lib/api";

export function useCompetitors(companyId: string | undefined) {
  return useQuery({
    queryKey: ["competitors", companyId],
    queryFn: () => fetchCompetitors(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  });
}
