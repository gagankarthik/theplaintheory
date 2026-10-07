/**
 * Invite someone to the Plain Theory staff console: creates their account in the staff Cognito pool
 * (Cognito e-mails a temporary password from its default sender, valid for 1 day) and adds them to the
 * role's platform-<role> group. This is how the first superadmin is created; after that, superadmins
 * invite people from /admin/staff.
 *
 *   npm run staff:invite -- <email> "<Full Name>" <role>
 *   npm run staff:invite -- ops@theplaintheory.in "Ops Person" superadmin
 *   npm run staff:invite -- ops@theplaintheory.in "Ops Person" superadmin --resend   (new temporary password)
 *
 * Roles: superadmin, support, billing, analyst.
 *
 * Reads COGNITO_STAFF_POOL_ID (and COGNITO_REGION) from .env.local. AWS credentials come from the
 * default chain, meaning your AWS CLI profile (or AWS_PROFILE): AWS keys that are only in .env.local
 * are ignored, so the app's own keys are never used for this. Run it from an admin profile.
 */
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { PLATFORM_ROLES, PLATFORM_ROLE_INFO, isPlatformRole, staffGroupName } from "../src/lib/auth/platform.ts";

const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const resend = process.argv.includes("--resend");
const [emailRaw, nameRaw, roleRaw] = args;
const usage = `Usage: npm run staff:invite -- <email> "<Full Name>" <${PLATFORM_ROLES.join("|")}> [--resend]`;
if (!emailRaw || !nameRaw || !roleRaw) fail(usage);
const email = emailRaw.trim().toLowerCase();
const name = nameRaw.trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail(`"${emailRaw}" isn't an email address.\n${usage}`);
if (name.length < 2 || name.length > 100) fail(`Give their full name (2 to 100 characters).\n${usage}`);
if (!isPlatformRole(roleRaw)) fail(`"${roleRaw}" isn't a staff role. Use one of: ${PLATFORM_ROLES.join(", ")}.`);
const role = roleRaw as (typeof PLATFORM_ROLES)[number];

const poolId = process.env.COGNITO_STAFF_POOL_ID ?? fail("COGNITO_STAFF_POOL_ID isn't set (run with --env-file=.env.local).");
const region = process.env.COGNITO_REGION || process.env.PT_AWS_REGION || "ap-south-1";

// Use the CLI profile, not keys that --env-file loaded from .env.local.
try {
  const fileEnv = parseEnv(readFileSync(".env.local", "utf8"));
  for (const k of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"]) {
    if (fileEnv[k] !== undefined && process.env[k] === fileEnv[k]) delete process.env[k];
  }
} catch {
  // no .env.local: nothing to ignore
}

const cognito = new CognitoIdentityProviderClient({ region });
const errName = (e: unknown) => (e && typeof e === "object" && "name" in e ? String((e as { name: unknown }).name) : "UnknownError");

async function main() {
  const label = PLATFORM_ROLE_INFO[role].label;
  let username: string | undefined;
  let created = false;
  try {
    const r = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: email,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: name },
        ],
        DesiredDeliveryMediums: ["EMAIL"],
      }),
    );
    username = r.User?.Username;
    created = true;
  } catch (e) {
    if (errName(e) !== "UsernameExistsException") throw e;
    const existing = await cognito.send(new AdminGetUserCommand({ UserPoolId: poolId, Username: email }));
    username = existing.Username;
    if (resend) {
      if (existing.UserStatus !== "FORCE_CHANGE_PASSWORD") fail(`${email} has already signed in, so there's no invite to resend. A superadmin can reset their password at /admin/staff.`);
      await cognito.send(new AdminCreateUserCommand({ UserPoolId: poolId, Username: email, MessageAction: "RESEND", DesiredDeliveryMediums: ["EMAIL"] }));
      console.log(`Sent ${email} a new temporary password.`);
    } else {
      console.log(`${email} already has a staff account (${existing.UserStatus}). Making sure they're in ${staffGroupName(role)}.${existing.UserStatus === "FORCE_CHANGE_PASSWORD" ? " Add --resend to email a new temporary password." : ""}`);
    }
  }
  if (!username) fail("Cognito didn't return a username.");
  try {
    await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: poolId, Username: username, GroupName: staffGroupName(role) }));
  } catch (e) {
    if (created) await cognito.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: username })).catch(() => undefined);
    throw e;
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.theplaintheory.in").replace(/\/$/, "");
  if (created) console.log(`Invited ${email} as ${label}. Cognito has emailed a temporary password (valid for 1 day).`);
  console.log(`Sign in at ${site}/admin/login: choose a new password, then set up an authenticator app.`);
}

main().catch((e) => {
  const n = errName(e);
  if (n === "AccessDeniedException" || n === "UnrecognizedClientException" || n === "CredentialsProviderError")
    fail(`AWS refused the request (${n}). Run this with an admin AWS profile, for example AWS_PROFILE=<admin> npm run staff:invite -- ...`);
  fail(`Invite failed: ${n}${e instanceof Error && e.message ? ` (${e.message})` : ""}`);
});
