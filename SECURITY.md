# Security policy

**Open Source Guru** stores GitHub access tokens (encrypted), email addresses and API keys, so we take
security reports seriously.

## Supported versions

Only the latest version on `main`, which is what runs on
[open-source-guru.dev](https://open-source-guru.dev), receives security fixes. If you self-host,
keep your deployment up to date with `main`.

## Reporting a vulnerability

**Please don't report vulnerabilities in public issues, pull requests or on Discord.**

Report them privately through GitHub:
[**Report a vulnerability**](https://github.com/tem-ctrl/open-source-guru/security/advisories/new)
(the "Security" tab of the repository, then "Report a vulnerability").

Please include:

- what the vulnerability is and what an attacker could do with it,
- the steps to reproduce it, or a proof of concept,
- the affected part (web app, API, worker, emails, deployment) and, if you know it, the code
  involved.

## What to expect

- We acknowledge your report within **3 business days**.
- We keep you informed while we investigate and fix the issue.
- Once a fix is deployed, we publish a security advisory and credit you, unless you prefer to stay
  anonymous.

## Scope

In scope: this repository's code and the hosted service at open-source-guru.dev, for example
authentication and sessions, API key handling, access to another user's data, signed email links
(unsubscribe, address verification), and injection in emails or pages.

Out of scope: vulnerabilities in GitHub itself or in third-party dependencies that are already
public (please still tell us if we're affected and haven't updated), denial of service through
traffic volume, and social engineering.

When testing, use your own accounts only, don't access or change other users' data, and don't
degrade the service for others.
