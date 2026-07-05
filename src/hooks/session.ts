import { queryOptions, useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/auth/serveractions";

const sessionQueryOptions = queryOptions({
  queryKey: ["session"],
  queryFn: auth,
});

export const useSession = () => {
  return useQuery(sessionQueryOptions);
};
