import { useSelector } from 'react-redux';
import { RootState } from '../store';

/**
 * Hook to access the current user's organization context.
 * Provides organizationId and convenience helpers.
 */
export const useOrganization = () => {
  const user = useSelector((state: RootState) => state.auth.user);

  return {
    organizationId: user?.organizationId ?? null,
    hasOrganization: Boolean(user?.organizationId),
  };
};
