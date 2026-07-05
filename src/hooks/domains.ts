import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isResponseError } from "up-fetch";
import { api } from "@/lib/api/client";
import {
  type CreateDomainInput,
  DomainListResponseSchema,
  DomainResponseSchema,
} from "@/shared/api";
import type { PartialDomain } from "@/shared/domain";
import { useSession } from "./session";

export const isInGrace = (domain: PartialDomain) =>
  domain.status === "verified" && domain.gracePeriodStartedAt !== null;

const domainsQueryOptions = queryOptions({
  queryKey: ["domains"],
  queryFn: () => api("/api/domains", { schema: DomainListResponseSchema }),
});

export const useDomains = () => {
  const { data: session } = useSession();
  return useQuery({ ...domainsQueryOptions, enabled: !!session });
};

const domainQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["domains", id],
    queryFn: () => api(`/api/domains/${id}`, { schema: DomainResponseSchema }),
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
        schema: DomainResponseSchema,
      }),
    onSuccess: (fresh) =>
      queryClient.setQueryData(domainQueryOptions(id).queryKey, fresh),
  });
};

export const useCreateDomain = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDomainInput) =>
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
