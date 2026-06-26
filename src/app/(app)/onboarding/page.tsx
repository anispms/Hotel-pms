import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { onboardingChecklist } from "@/lib/settings";
import { completeOnboarding } from "@/lib/admin-actions";
import { formatDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { steps, completed, total, percent, settings } = await onboardingChecklist();

  return (
    <div>
      <PageHeader
        title="Welcome to Hotel X PMS"
        subtitle="Let's get your property ready to sell"
      />

      {/* Progress overview */}
      <div className="card p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-4xl font-bold text-brand-600">{percent}%</div>
            <div className="mt-1 text-sm font-medium text-gray-600">
              {completed} of {total} steps complete
            </div>
          </div>
          <div className="text-right text-sm text-gray-400">
            {percent === 100 ? "You're all set 🎉" : "Keep going — you're almost there"}
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-brand-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="mt-6 space-y-3">
        {steps.map((step, i) => (
          <div key={step.key} className="card flex items-center gap-4 p-4">
            <div className="shrink-0">
              {step.done ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-base font-bold text-green-600">
                  ✓
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
                  {i + 1}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div
                className={`font-semibold ${
                  step.done ? "text-gray-400 line-through" : "text-gray-900"
                }`}
              >
                {step.title}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">{step.hint}</div>
            </div>

            <Link href={step.href} className="btn-secondary shrink-0">
              {step.done ? "Review" : "Set up →"}
            </Link>
          </div>
        ))}
      </div>

      {/* Finish */}
      <div className="card mt-6 p-6">
        <p className="text-sm text-gray-500">
          You can revisit onboarding any time from this page — nothing here is locked
          once you finish.
        </p>
        <form action={completeOnboarding} className="mt-4">
          <button type="submit" className="btn-primary">
            Finish onboarding &amp; go to dashboard
          </button>
        </form>
        {settings?.onboardedAt && (
          <div className="mt-3 text-xs text-gray-400">
            Already completed on {formatDate(settings.onboardedAt)}
          </div>
        )}
      </div>
    </div>
  );
}
