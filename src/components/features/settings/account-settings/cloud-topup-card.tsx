import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { CreditCard, ExternalLink, Loader2, Check } from "lucide-react";
import { BrandButton } from "#/components/features/settings/brand-button";
import {
  fetchPaystackConfig,
  paystackInitialize,
  paystackVerify,
  type PaystackConfig,
  type PaystackInit,
} from "#/api/cloud/exeaon-billing.api";

const PRESETS_USD = [5, 10, 20, 50];

type Phase = "idle" | "starting" | "awaiting" | "verifying" | "done" | "error";

/**
 * Top up the Exeaon Cloud balance via Paystack hosted checkout. Desktop flow:
 * initialize → open the checkout URL in the OS browser → the user pays →
 * "I've paid" verifies the reference and credits the account (idempotent). A
 * funded, active account is what flips the plan to Pro.
 */
export function CloudTopUpCard({
  tenantId,
  email,
  onCredited,
}: {
  tenantId: number;
  email: string;
  onCredited: () => void;
}) {
  const [config, setConfig] = React.useState<PaystackConfig | null>(null);
  const [amount, setAmount] = React.useState(10);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState("");
  const [init, setInit] = React.useState<PaystackInit | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchPaystackConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only render when the gateway has Paystack configured.
  if (!config?.enabled) return null;

  const localAmount =
    config.fxRate > 0 ? Math.round(amount * config.fxRate) : null;

  const start = async () => {
    if (amount < 2) {
      setError("Minimum top-up is $2.");
      setPhase("error");
      return;
    }
    setPhase("starting");
    setError("");
    try {
      const res = await paystackInitialize(tenantId, email, amount);
      setInit(res);
      setPhase("awaiting");
      invoke("open_external", { url: res.authorizationUrl }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setPhase("error");
    }
  };

  const verify = async () => {
    if (!init) return;
    setPhase("verifying");
    setError("");
    try {
      const res = await paystackVerify(tenantId, init.reference);
      if (res.credited) {
        setPhase("done");
        onCredited();
      } else {
        setError("Payment not confirmed yet. Complete it in the browser, then verify again.");
        setPhase("awaiting");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
      setPhase("awaiting");
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[var(--oh-border)] bg-base-secondary p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 text-[#FFD026]" />
        <h3 className="text-sm font-medium text-white">Top up · Pay as you go</h3>
      </div>

      {phase === "done" ? (
        <p className="flex items-center gap-2 text-sm text-[#8BD98B]">
          <Check className="size-4" /> Payment confirmed — your balance has been
          credited.
        </p>
      ) : (
        <>
          <p className="text-xs text-[var(--oh-muted)]">
            Add credits with Paystack. A funded, active account unlocks Pro.
          </p>

          <div className="flex flex-wrap gap-2">
            {PRESETS_USD.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  amount === v
                    ? "border-[#FFD026] bg-[#FFD026]/10 text-[#FFD026]"
                    : "border-[var(--oh-border)] text-[var(--oh-foreground)] hover:border-[#FFD026]/40"
                }`}
              >
                ${v}
              </button>
            ))}
            <div className="flex items-center gap-1 rounded-lg border border-[var(--oh-border)] px-2">
              <span className="text-sm text-[var(--oh-muted)]">$</span>
              <input
                type="number"
                min={2}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-16 bg-transparent py-1.5 text-sm text-white outline-none"
              />
            </div>
          </div>

          {localAmount != null && (
            <p className="text-xs text-[var(--oh-muted)]">
              You&apos;ll be charged ≈ {config.currency}{" "}
              {localAmount.toLocaleString()} for ${amount} in credits.
            </p>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            {phase === "awaiting" || phase === "verifying" ? (
              <>
                <a
                  href={init?.authorizationUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    if (init)
                      invoke("open_external", {
                        url: init.authorizationUrl,
                      }).catch(() => {});
                  }}
                  className="flex items-center gap-1.5 text-xs text-[#FFD026] underline"
                >
                  <ExternalLink className="size-3.5" /> Reopen checkout
                </a>
                <BrandButton
                  type="button"
                  variant="primary"
                  className="text-xs"
                  onClick={verify}
                  isDisabled={phase === "verifying"}
                >
                  {phase === "verifying" ? (
                    <>
                      <Loader2 className="mr-1 size-3.5 animate-spin" /> Verifying…
                    </>
                  ) : (
                    "I've paid — verify"
                  )}
                </BrandButton>
              </>
            ) : (
              <BrandButton
                type="button"
                variant="primary"
                className="text-xs"
                onClick={start}
                isDisabled={phase === "starting"}
              >
                {phase === "starting" ? (
                  <>
                    <Loader2 className="mr-1 size-3.5 animate-spin" /> Starting…
                  </>
                ) : (
                  `Top up $${amount} with Paystack`
                )}
              </BrandButton>
            )}
          </div>
        </>
      )}
    </section>
  );
}
