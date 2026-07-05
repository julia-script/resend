import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isResponseError } from "up-fetch";
import { z } from "zod";
import {
  type PartialDomain,
  PartialDomainSchema,
} from "@/db/validationschemas";
import { api } from "@/lib/api/client";
import { useSession } from "./session";

const DomainResponse = z.object({ data: PartialDomainSchema });
const DomainListResponse = z.object({ data: z.array(PartialDomainSchema) });

export const isInGrace = (domain: PartialDomain) =>
  domain.status === "verified" && domain.gracePeriodStartedAt !== null;

export const domainsQueryOptions = queryOptions({
  queryKey: ["domains"],
  queryFn: () => api("/api/domains", { schema: DomainListResponse }),
});

export const useDomains = () => {
  const { data: session } = useSession();
  return useQuery({ ...domainsQueryOptions, enabled: !!session });
};

export const domainQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["domains", id],
    queryFn: () => api(`/api/domains/${id}`, { schema: DomainResponse }),
  });

export const useDomain = (id: string) =>
  useQuery({
    ...domainQueryOptions(id),
    refetchInterval: (query) => {
      const d = query.state.data?.data;
      if (!d) return false;
      return d.status === "in_progress" || isInGrace(d) ? 5000 : false;
    },
  });

export const useVerifyDomain = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api(`/api/domains/${id}/verify`, {
        method: "POST",
        schema: DomainResponse,
      }),
    onSuccess: (fresh) =>
      queryClient.setQueryData(domainQueryOptions(id).queryKey, fresh),
  });
};

export const useCreateDomain = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; enforce: boolean }) =>
      api("/api/domains", { method: "POST", body: data }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: domainsQueryOptions.queryKey }),
  });
};

/** True when create failed because another account has this name verified. */
export const isNameTakenError = (error: unknown): boolean =>
  isResponseError(error) && error.data?.code === "domains/name_taken";

export const useDeleteDomain = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: domainQueryOptions(id).queryKey });
      queryClient.invalidateQueries({ queryKey: domainsQueryOptions.queryKey });
    },
  });
};
