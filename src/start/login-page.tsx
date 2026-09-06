import { useNavigate } from "@tanstack/react-router";
import { LoginForm } from "@/vite/login-form";
import { queryClient } from "@/vite/query-client";
import { queryKeys } from "@/vite/query-keys";

/** Start-native login screen; Go still owns the session cookie. */
export function LoginPage() {
  const navigate = useNavigate();
  return (
    <LoginForm
      onAuthenticated={async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.account() });
        await navigate({ to: "/" });
      }}
    />
  );
}
