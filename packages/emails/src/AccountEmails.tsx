import { Heading, Text } from "@react-email/components";
import {
  type BrandProps,
  headingStyle,
  Layout,
  PrimaryButton,
  textStyle,
} from "./components/Layout.tsx";

export interface WelcomeEmailProps extends BrandProps {
  login: string;
  dashboardUrl: string;
  docsUrl: string;
}

export function WelcomeEmail({ login, dashboardUrl, docsUrl, logoUrl }: WelcomeEmailProps) {
  return (
    <Layout
      logoUrl={logoUrl}
      preview="Welcome to Open Source Guru"
      footerLinks={[
        { label: "Dashboard", href: dashboardUrl },
        { label: "Documentation", href: docsUrl },
      ]}
    >
      <Heading as="h1" style={headingStyle}>
        Welcome, {login}!
      </Heading>
      <Text style={textStyle}>
        Follow the repositories you'd like to contribute to, pick the labels you care about (like
        "help wanted" or "good first issue"), and we'll email you when matching issues appear.
      </Text>
      <Text style={{ ...textStyle, margin: "0 0 20px" }}>
        Your Open Source Contributions, streaks and goals are on your dashboard too.
      </Text>
      <PrimaryButton href={dashboardUrl}>Add your first subscription</PrimaryButton>
    </Layout>
  );
}

export interface VerifyEmailProps extends BrandProps {
  address: string;
  verifyUrl: string;
}

export function VerifyEmail({ address, verifyUrl, logoUrl }: VerifyEmailProps) {
  return (
    <Layout
      logoUrl={logoUrl}
      preview="Confirm your email address"
      footerNote="If you didn't add this address to Open Source Guru, you can ignore this email."
    >
      <Heading as="h1" style={headingStyle}>
        Confirm your email address
      </Heading>
      <Text style={{ ...textStyle, margin: "0 0 20px" }}>
        Confirm that you want to receive Open Source Guru notifications at{" "}
        <strong>{address}</strong>. The link is valid for 24 hours.
      </Text>
      <PrimaryButton href={verifyUrl}>Confirm email address</PrimaryButton>
    </Layout>
  );
}

export interface AccountDeletedEmailProps extends BrandProps {
  login?: string;
}

export function AccountDeletedEmail({ login, logoUrl }: AccountDeletedEmailProps) {
  return (
    <Layout
      logoUrl={logoUrl}
      preview="Your Open Source Guru account has been deleted"
      footerNote="If you did not request this deletion, please reach out to support immediately."
    >
      <Heading as="h1" style={headingStyle}>
        Account deleted
      </Heading>
      <Text style={textStyle}>
        {login ? `Hi ${login}, your` : "Your"} Open Source Guru account and all associated data have
        been permanently deleted.
      </Text>
      <Text style={{ ...textStyle, margin: "0 0 20px" }}>
        Your subscriptions, notification channels, and API keys have been removed. We're sorry to
        see you go!
      </Text>
    </Layout>
  );
}
