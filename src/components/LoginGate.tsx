import { useAccess, type AccessRecord } from "@/hooks/use-access";
import { LogIn } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

export function LoginGate({ children }: { children: ReactNode }) {
  const { access, ready, signIn } = useAccess();
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/public/access-check?email=${encodeURIComponent(normalizedEmail)}`,
        { headers: { Accept: "application/json" } },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        access?: AccessRecord;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.access) {
        setError(
          payload.error === "not_authorized"
            ? "هذا الإيميل غير موجود في قائمة Access."
            : "تعذر الوصول للسيرفر. حاول مرة أخرى.",
        );
        return;
      }
      signIn(payload.access, remember);
    } catch {
      setError("تعذر الوصول للسيرفر. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!access) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <main className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm" dir="rtl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LogIn className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">تسجيل الدخول</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              أدخل الإيميل المسجل في صفحة Access.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2 text-right">
              <label htmlFor="access-email" className="text-sm font-medium text-foreground">
                الإيميل
              </label>
              <input
                id="access-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-left text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                dir="ltr"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              تذكرني على هذا الجهاز
            </label>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? "جاري التحقق..." : "دخول"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}