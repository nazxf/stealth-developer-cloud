import { useNavigate } from "@tanstack/react-router";
import { LoginForm } from "@/features/auth/login-form";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

/** Start-native login screen; Go still owns the session cookie. */
export function LoginPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
      <LoginForm
        onAuthenticated={async () => {
          await queryClient.invalidateQueries({ queryKey: queryKeys.account() });
          await navigate({ to: "/" });
        }}
      />
    </div>
  );
}
