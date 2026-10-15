import { Heading, Section, Text } from "@react-email/components";
import {
  type BrandProps,
  colors,
  headingStyle,
  Layout,
  PrimaryButton,
  textStyle,
} from "./components/Layout.tsx";

export interface StreakReminderEmailProps extends BrandProps {
  period: "week" | "day";
  /** Current streak, in periods. */
  length: number;
  contributionsUrl: string;
  /** Turns streak reminders off. */
  stopUrl: string;
  settingsUrl: string;
}

const streak = (length: number, period: "week" | "day") => `${length}-${period} streak`;

export const streakReminderSubject = ({
  length,
  period,
}: Pick<StreakReminderEmailProps, "length" | "period">) =>
  `Keep your ${streak(length, period)} going`;

/** Sent when the current week (Friday) or day (evening) has no Open Source Contribution yet. */
export function StreakReminderEmail({
  period,
  length,
  contributionsUrl,
  stopUrl,
  settingsUrl,
  logoUrl,
}: StreakReminderEmailProps) {
  const when = period === "week" ? "this week" : "today";
  return (
    <Layout
      logoUrl={logoUrl}
      preview={`No Open Source Contribution ${when} yet: one keeps your streak going.`}
      footerNote="You get this reminder because you turned streak reminders on."
      footerLinks={[
        { label: "Settings", href: settingsUrl },
        { label: "Stop streak reminders", href: stopUrl },
      ]}
    >
      <Text style={{ margin: "0 0 14px" }}>
        <span
          style={{
            backgroundColor: colors.coral,
            borderRadius: 999,
            color: colors.plum,
            fontSize: 13,
            fontWeight: 700,
            padding: "4px 14px",
          }}
        >
          {streak(length, period)}
        </span>
      </Text>
      <Heading as="h1" style={headingStyle}>
        Keep your streak going
      </Heading>
      <Text style={{ ...textStyle, margin: "0 0 20px" }}>
        You haven't made an Open Source Contribution {when} yet. A commit, a pull request, a review,
        an issue or a discussion in someone else's open-source project is enough to keep your{" "}
        {streak(length, period)} alive.
      </Text>
      <PrimaryButton href={contributionsUrl}>See your contributions</PrimaryButton>
    </Layout>
  );
}

export interface AchievedGoal {
  /** e.g. "30 Open Source Contributions a month" */
  title: string;
  progress: number;
  target: number;
  /** e.g. "October 2026", "the week of Oct 11, 2026" */
  periodLabel: string;
}

export interface GoalAchievedEmailProps extends BrandProps {
  goals: AchievedGoal[];
  goalsUrl: string;
  stopUrl: string;
  settingsUrl: string;
}

export const goalAchievedSubject = ({ goals }: Pick<GoalAchievedEmailProps, "goals">) => {
  const [first] = goals;
  return goals.length === 1 && first
    ? `Goal achieved: ${first.title}`
    : `${goals.length} goals achieved`;
};

/** Congratulations, after a sync completes one goal period or more. */
export function GoalAchievedEmail({
  goals,
  goalsUrl,
  stopUrl,
  settingsUrl,
  logoUrl,
}: GoalAchievedEmailProps) {
  return (
    <Layout
      logoUrl={logoUrl}
      preview={goalAchievedSubject({ goals })}
      footerNote="You get this email because you turned goal emails on."
      footerLinks={[
        { label: "Settings", href: settingsUrl },
        { label: "Stop goal emails", href: stopUrl },
      ]}
    >
      <Heading as="h1" style={headingStyle}>
        {goals.length === 1 ? "Goal achieved!" : "Goals achieved!"}
      </Heading>
      <Text style={{ ...textStyle, margin: "0 0 16px" }}>
        Well done: your Open Source Contributions reached{" "}
        {goals.length === 1 ? "a goal" : "these goals"}.
      </Text>
      {goals.map((goal) => (
        <Section
          key={`${goal.title}-${goal.periodLabel}`}
          style={{
            backgroundColor: colors.mist,
            borderLeft: `3px solid ${colors.coral}`,
            borderRadius: 8,
            margin: "0 0 10px",
            padding: "10px 14px",
          }}
        >
          <Text style={{ color: colors.plum, fontSize: 15, fontWeight: 700, margin: 0 }}>
            {goal.title}
          </Text>
          <Text style={{ color: colors.dusk, fontSize: 13, margin: "2px 0 0" }}>
            {goal.progress} / {goal.target} · {goal.periodLabel}
          </Text>
        </Section>
      ))}
      <Section style={{ marginTop: 20 }}>
        <PrimaryButton href={goalsUrl}>See your goals</PrimaryButton>
      </Section>
    </Layout>
  );
}
