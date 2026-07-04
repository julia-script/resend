import { auth } from "@/lib/auth/serveractions";
import { queryOptions, useQuery } from "@tanstack/react-query"

export const sessionQueryOptions = queryOptions({
  queryKey: ["session"],
  queryFn: auth,
});


export const useSession = () => {
  return useQuery(sessionQueryOptions);
};