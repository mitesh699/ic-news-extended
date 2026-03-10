import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCompanies, refreshNews } from "@/lib/api";
import { mockCompanies } from "@/lib/mock-data";
import { toast } from "@/hooks/use-toast";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: USE_MOCK ? () => Promise.resolve(mockCompanies) : fetchCompanies,
    staleTime: 5 * 60 * 1000, // 5 minutes — data only changes on explicit refresh
  });
}

export function useRefreshNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: USE_MOCK
      ? () => new Promise<void>((resolve) => setTimeout(resolve, 1500))
      : refreshNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "News refreshed", description: "All company news has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Refresh failed", description: err.message || "Could not refresh news. Try again.", variant: "destructive" });
    },
  });
}
