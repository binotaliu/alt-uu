import { ErrorRetryView } from '@altuu/ui';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';

import type { ServiceError } from '../services/serviceError';
import { useConnectivityStore } from '../services/stores';

export interface ErrorRetryProps {
  /** The error from a service hook, or a plain message for local failures. */
  error: ServiceError | Error | string;
  onRetry: () => void;
  retrying?: boolean;
}

/**
 * Legacy ErrorRetry. Shows the message with its operation code, an expandable
 * detail panel, and nudges the connectivity prompt when the user keeps
 * retrying a network / school-system failure.
 *
 * @example
 * if (query.error) {
 *     return <ErrorRetry error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} />;
 * }
 */
export function ErrorRetry({
  error,
  onRetry,
  retrying = false,
}: ErrorRetryProps) {
  const noteRetry = useConnectivityStore((state) => state.noteRetry);
  const serviceError =
    typeof error === 'string' || !('displayCode' in error) ? null : error;
  const message = typeof error === 'string' ? error : error.message;

  const handleRetry = () => {
    if (serviceError === null || serviceError.isConnectivityFailure) {
      noteRetry();
    }

    onRetry();
  };

  return (
    <ErrorRetryView
      message={message}
      retrying={retrying}
      onRetry={handleRetry}
      detail={
        serviceError === null
          ? null
          : {
              displayCode: serviceError.displayCode,
              stageLabel: serviceError.stageLabel,
              operationLabel: serviceError.operation.label,
              status: serviceError.status,
              upstreamStatus: serviceError.upstreamStatus,
              requestId: serviceError.requestId,
              durationMs: serviceError.durationMs,
              exception: `${serviceError.exception.class}: ${serviceError.exception.message}`,
            }
      }
      onCopy={
        serviceError === null
          ? undefined
          : async () => {
              try {
                await Clipboard.setStringAsync(serviceError.toReport());

                return true;
              } catch {
                return false;
              }
            }
      }
      onOpenLog={() => router.push('/settings/diagnostics/log')}
    />
  );
}
