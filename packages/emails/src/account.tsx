import { Button, Heading, Text } from "@react-email/components";
import { colors, Layout } from "./components/layout.tsx";

const buttonStyle = {
  backgroundColor: colors.accent,
  borderRadius: 6,
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 600,
  padding: "10px 16px",
};

export interface WelcomeEmailProps {
  login: string;
  dashboardUrl: string;
  docsUrl: string;
}

export function WelcomeEmail({ login, dashboardUrl, docsUrl }: WelcomeEmailProps) {
  return (
    <Layout
      preview="Welcome to Open Source Guru"
      footerLinks={[
        { label: "Dashboard", href: dashboardUrl },
        { label: "Documentation", href: docsUrl },
      ]}
    >
      <Heading as="h1" style={{ fontSize: 20, margin: "0 0 12px" }}>
        Welcome, {login}!
      </Heading>
      <Text style={{ fontSize: 15 }}>
        Follow the repositories you'd like to contribute to, pick the labels you care about (like
        "help wanted" or "good first issue"), and we'll email you when matching issues appear.
      </Text>
      <Button href={dashboardUrl} style={buttonStyle}>
        Add your first subscription
      </Button>
    </Layout>
  );
}

export interface VerifyEmailProps {
  address: string;
  verifyUrl: string;
}

export function VerifyEmail({ address, verifyUrl }: VerifyEmailProps) {
  return (
    <Layout
      preview="Confirm your email address"
      footerNote="If you didn't add this address to Open Source Guru, you can ignore this email."
    >
      <Heading as="h1" style={{ fontSize: 20, margin: "0 0 12px" }}>
        Confirm your email address
      </Heading>
      <Text style={{ fontSize: 15 }}>
        Confirm that you want to receive Open Source Guru notifications at {address}. The link is
        valid for 24 hours.
      </Text>
      <Button href={verifyUrl} style={buttonStyle}>
        Confirm email address
      </Button>
    </Layout>
  );
}
