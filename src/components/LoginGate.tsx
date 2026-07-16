import { useAccess, type AccessRecord } from "@/hooks/use-access";
import { AuxLogo } from "@/components/AuxLogo";
import { ArrowLeft, ShieldCheck, TrendingUp, Zap } from "lucide-react";
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
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-5 bg-background">
        {/* Left: Brand panel */}
        <aside
          className="relative hidden lg:flex lg:col-span-3 flex-col justify-between overflow-hidden p-12 text-white"
          style={{ background: "var(--gradient-sidebar)" }}
        >
          <div className="absolute inset-0 opacity-20 pointer-events-none"
               style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #7FB3FF 0, transparent 40%), radial-gradient(circle at 80% 80%, #F59E0B 0, transparent 35%)" }} />
          <div className="relative">
            <AuxLogo variant="light" className="h-11 w-auto" />
          </div>
          <div className="relative space-y-8">
            <div>
              <h2 className="text-4xl font-bold leading-tight tracking-tight">
                Operations intelligence,<br/>engineered for AUX.
              </h2>
              <p className="mt-4 max-w-md text-base text-white/70">
                Real-time KPIs, ASC performance, call center analytics and spare parts — all in one command center.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-md">
              <Feature icon={TrendingUp} label="Live KPIs" />
              <Feature icon={ShieldCheck} label="Role-based" />
              <Feature icon={Zap} label="Fast & scoped" />
            </div>
          </div>
          <div className="relative text-xs text-white/50">
            © {new Date().getFullYear()} AUX — Authorized Service Centers
          </div>
        </aside>

        {/* Right: Form */}
        <main className="lg:col-span-2 flex items-center justify-center px-6 py-12" dir="rtl">
          <div className="w-full max-w-sm animate-rise">
            <div className="lg:hidden mb-8 flex justify-center">
              <AuxLogo className="h-10 w-auto" />
            </div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground">أهلاً بك في AUX</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                أدخل الإيميل المسجّل في قائمة Access للوصول للوحة التحكم.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2 text-right">
                <label htmlFor="access-email" className="text-sm font-medium text-foreground">
                  البريد الإلكتروني
                </label>
                <input
                  id="access-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@aux.com"
                  className="h-12 w-full rounded-lg border border-input bg-card px-4 text-left text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
                  dir="ltr"
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                تذكرني على هذا الجهاز
              </label>

              {error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
                style={{ background: "var(--gradient-primary)" }}
              >
                {loading ? "جاري التحقق..." : (<>
                  <span>دخول</span>
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </>)}
              </button>

              <p className="text-center text-xs text-muted-foreground pt-2">
                للوصول اتصل بمسؤول الحسابات لإضافة إيميلك.
              </p>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}

function Feature({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <Icon className="h-5 w-5 text-white/90" />
      <span className="text-xs font-medium text-white/80">{label}</span>
    </div>
  );
}