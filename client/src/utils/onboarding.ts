export const ONBOARDING_EVENT = "owlet:open-onboarding";

export function openOnboardingAt(step: number) {
  window.dispatchEvent(new CustomEvent<number>(ONBOARDING_EVENT, { detail: step }));
}
