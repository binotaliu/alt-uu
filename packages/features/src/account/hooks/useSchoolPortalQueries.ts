import type {
  SchoolPortalCourseExamScopes,
  SchoolPortalExamAgendaItem,
  SchoolPortalGrade,
} from '@altuu/core';

import { useAccounts } from '../../services/hooks';
import { useServiceQuery } from '../../services/useServiceQuery';

export const schoolPortalKeys = {
  grades: (allAccounts: boolean) => ['account', 'grades', allAccounts] as const,
  examAgenda: (allAccounts: boolean) =>
    ['account', 'exam-agenda', allAccounts] as const,
  examScopes: (allAccounts: boolean) =>
    ['account', 'exam-scopes', allAccounts] as const,
};

/** Whether the 目前帳號 / 所有帳號 switch is worth showing. */
export function useHasMultipleAccounts(): boolean {
  const accounts = useAccounts();

  return (accounts.data?.length ?? 0) > 1;
}

export function useGrades(allAccounts: boolean) {
  return useServiceQuery<SchoolPortalGrade[]>({
    op: 'schoolPortal.grades',
    queryKey: schoolPortalKeys.grades(allAccounts),
    queryFn: (services) =>
      services.schoolPortalDomain.getAllCourseGrades({ allAccounts }),
    staleTime: 0,
  });
}

export function useExamAgenda(allAccounts: boolean) {
  return useServiceQuery<SchoolPortalExamAgendaItem[]>({
    op: 'schoolPortal.examAgenda',
    queryKey: schoolPortalKeys.examAgenda(allAccounts),
    queryFn: (services) =>
      services.schoolPortalDomain.getExamAgenda({ allAccounts }),
    staleTime: 0,
  });
}

export function useExamScopes(allAccounts: boolean) {
  return useServiceQuery<SchoolPortalCourseExamScopes[]>({
    op: 'schoolPortal.examScopes',
    queryKey: schoolPortalKeys.examScopes(allAccounts),
    queryFn: (services) =>
      services.schoolPortalDomain.getExamScopes({ allAccounts }),
    staleTime: 0,
  });
}
