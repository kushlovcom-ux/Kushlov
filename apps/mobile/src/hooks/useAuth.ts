import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type LoginInput, type RegisterInput } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { signOutFirebase } from '@/services/firebase';
import { clearStoredPushToken } from '@/hooks/usePushTokenSync';
import { connectSocket, disconnectSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me(),
    enabled: !!accessToken && hydrated,
    staleTime: 60_000,
    retry: 1,
  });

  const loginMutation = useMutation({
    mutationFn: (body: LoginInput) => authApi.login(body),
    onSuccess: (data) => {
      setAuth(data);
      connectSocket(data.accessToken);
      qc.invalidateQueries();
    },
  });

  const registerMutation = useMutation({
    mutationFn: (body: RegisterInput) => authApi.register(body),
    onSuccess: (data) => {
      setAuth(data);
      connectSocket(data.accessToken);
      qc.invalidateQueries();
    },
  });

  const googleMutation = useMutation({
    mutationFn: (payload: { idToken: string; country?: string }) => authApi.google(payload),
    onSuccess: (data) => {
      setAuth(data);
      connectSocket(data.accessToken);
      qc.invalidateQueries();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await clearStoredPushToken();
      } catch {
        /* still log out */
      }
      try {
        await authApi.logout();
      } catch {
        // still clear local
      }
      await signOutFirebase();
    },
    onSettled: () => {
      disconnectSocket();
      clear();
      qc.clear();
    },
  });

  return {
    user: meQuery.data ?? user,
    accessToken,
    isAuthenticated: !!accessToken,
    hydrated,
    isLoadingMe: meQuery.isLoading,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    loginWithGoogle: googleMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    refreshMe: () => meQuery.refetch(),
    setUser,
    error:
      loginMutation.error ||
      registerMutation.error ||
      googleMutation.error
        ? getErrorMessage(
            loginMutation.error || registerMutation.error || googleMutation.error,
          )
        : null,
    isLoggingIn: loginMutation.isPending || googleMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}
