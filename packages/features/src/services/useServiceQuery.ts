import {
    useMutation,
    useQuery,
    type QueryKey,
    type UseMutationOptions,
    type UseMutationResult,
    type UseQueryOptions,
    type UseQueryResult,
} from '@tanstack/react-query';

import { useServiceRuntime } from './AppServicesProvider';
import type { OperationKey } from './operations';
import type { ServiceError } from './serviceError';
import type { AppServices } from './types';

export interface UseServiceQueryOptions<TData> extends Omit<
    UseQueryOptions<TData, ServiceError, TData, QueryKey>,
    'queryFn' | 'queryKey'
> {
    /** Operation key (see operations.ts); shows up in the diagnostics log. */
    op: OperationKey;
    queryKey: QueryKey;
    queryFn: (services: AppServices) => Promise<TData> | TData;
}

/**
 * `useQuery` over a service call with the legacy `useApi` semantics: the call
 * runs as a tracked operation, failures reject with a {@link ServiceError}
 * (user-facing `message`, `displayCode`), and a dead session starts the
 * re-login flow. Pass `enabled: false` for conditional fetching.
 *
 * @example
 * const courses = useServiceQuery({
 *     op: 'courses.list',
 *     queryKey: ['courses'],
 *     queryFn: (services) => services.course.listCourses(),
 * });
 * if (courses.error) return <ErrorRetry error={courses.error} onRetry={courses.refetch} />;
 */
export function useServiceQuery<TData>(
    options: UseServiceQueryOptions<TData>,
): UseQueryResult<TData, ServiceError> {
    const runtime = useServiceRuntime();
    const { op, queryFn, ...queryOptions } = options;

    return useQuery<TData, ServiceError, TData, QueryKey>({
        ...queryOptions,
        queryFn: () => runtime.run(op, () => queryFn(runtime.services)),
    });
}

export interface UseServiceMutationOptions<TData, TVariables> extends Omit<
    UseMutationOptions<TData, ServiceError, TVariables>,
    'mutationFn'
> {
    op: OperationKey;
    mutationFn: (
        variables: TVariables,
        services: AppServices,
    ) => Promise<TData> | TData;
}

/** `useMutation` counterpart of {@link useServiceQuery}. */
export function useServiceMutation<TData, TVariables = void>(
    options: UseServiceMutationOptions<TData, TVariables>,
): UseMutationResult<TData, ServiceError, TVariables> {
    const runtime = useServiceRuntime();
    const { op, mutationFn, ...mutationOptions } = options;

    return useMutation<TData, ServiceError, TVariables>({
        ...mutationOptions,
        mutationFn: (variables) =>
            runtime.run(op, () => mutationFn(variables, runtime.services)),
    });
}
