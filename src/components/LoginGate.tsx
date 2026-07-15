import { useAccess } from "@/hooks/use-access";
import { useEffect, type ReactNode } from "react";

const LOGIN_URL = "https://moahedyounes-debug.github.io/Aux-DB/";

export function LoginGate({ children }: { children: ReactNode }) {
  const { access, ready } = useAccess();

  useEffect(() => {
    if (ready && !access && typeof window !== "undefined") {
      // Avoid loop if the login page is embedded on the same origin.
      if (window.location.href !== LOGIN_URL) {
        window.location.replace(LOGIN_URL);
      }
    }
  }, [ready, access]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!access) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          يرجى تسجيل الدخول
        </h1>
        <p className="text-sm text-muted-foreground">
          سيتم تحويلك إلى صفحة الدخول...
        </p>
        <a
          href={LOGIN_URL}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          الذهاب إلى صفحة الدخول
        </a>
      </div>
    );
  }

  return <>{children}</>;
}