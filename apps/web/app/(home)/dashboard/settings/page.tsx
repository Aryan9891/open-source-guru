import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DeleteAccount } from "./_components/DeleteAccount";
import { DeliverySettings } from "./_components/DeliverySettings";
import { EmailAddresses } from "./_components/EmailAddresses";
import { MotivationEmails } from "./_components/MotivationEmails";
import { ProfileSettings } from "./_components/ProfileSettings";
import { StreakSettings } from "./_components/StreakSettings";

export const metadata: Metadata = { title: "Settings" };

function Section({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-5 rounded-lg border bg-surface p-6 ${danger ? "border-danger" : "border-border"}`}
    >
      <div className="flex flex-col gap-1">
        <h2 className={`font-display text-xl font-extrabold ${danger ? "text-danger" : ""}`}>
          {title}
        </h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-subtle">
          Where and when we email you, your public profile, streaks, and your account.
        </p>
      </header>
      <Section title="Email delivery" description="Used for daily digests.">
        <DeliverySettings />
      </Section>
      <Section
        title="Email addresses"
        description="Your GitHub primary email is added when you sign up. Add others to send some subscriptions elsewhere."
      >
        <EmailAddresses />
      </Section>
      <Section title="Profile" description="Your Open Source Contributions, for everyone to see.">
        <ProfileSettings />
      </Section>
      <Section
        title="Motivation emails"
        description="Optional emails about your streak and goals. Each one has a link to stop them."
      >
        <MotivationEmails />
      </Section>
      <Section
        title="Streaks"
        description="Count your streak in weeks or days with at least one Open Source Contribution."
      >
        <StreakSettings />
      </Section>
      <Section title="Delete account" description="Permanently remove your data." danger>
        <DeleteAccount />
      </Section>
    </div>
  );
}
