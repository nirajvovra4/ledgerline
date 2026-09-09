import { useLogin, useLogout, useMe, useRegister } from '../api/auth';
import { errorMessage } from '../api/client';

/** Session state plus the auth mutations, in one place for pages and the shell. */
export function useAuth() {
  const me = useMe();
  const login = useLogin();
  const register = useRegister();
  const logout = useLogout();
  const user = me.data?.user ?? null;
  return {
    user,
    workspaces: me.data?.workspaces ?? [],
    isLoading: me.isLoading,
    isAuthenticated: Boolean(user),
    error: me.error ? errorMessage(me.error) : null,
    refetch: me.refetch,
    login,
    register,
    logout,
  };
}
