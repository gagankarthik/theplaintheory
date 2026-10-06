import "server-only";
import { createHmac } from "node:crypto";
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? "ap-south-1" });
const CLIENT_ID = process.env.COGNITO_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;

const secretHash = (username: string) =>
  CLIENT_SECRET ? createHmac("sha256", CLIENT_SECRET).update(username + CLIENT_ID).digest("base64") : undefined;

const message = (e: unknown) => {
  const name = (e as { name?: string }).name;
  if (name === "UsernameExistsException") return "An account with this email already exists. Sign in instead.";
  if (name === "InvalidPasswordException") return "Use at least 12 characters with a number and a symbol.";
  if (name === "UserNotConfirmedException") return "Confirm your email first. We sent you a link.";
  if (name === "NotAuthorizedException" || name === "UserNotFoundException") return "That email and password don't match an account.";
  return "Sign-in is unavailable right now. Try again in a minute.";
};

export async function cognitoSignUp(email: string, password: string, name: string) {
  try {
    const r = await client.send(
      new SignUpCommand({
        ClientId: CLIENT_ID,
        SecretHash: secretHash(email),
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name },
        ],
      }),
    );
    return { ok: true as const, sub: r.UserSub! };
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}

export async function cognitoSignIn(email: string, password: string) {
  try {
    const r = await client.send(
      new InitiateAuthCommand({
        ClientId: CLIENT_ID,
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: email, PASSWORD: password, ...(CLIENT_SECRET ? { SECRET_HASH: secretHash(email)! } : {}) },
      }),
    );
    if (r.ChallengeName) return { ok: false as const, error: "Finish the MFA challenge in the hosted sign-in page." };
    const u = await client.send(new GetUserCommand({ AccessToken: r.AuthenticationResult!.AccessToken! }));
    const sub = u.UserAttributes?.find((a) => a.Name === "sub")?.Value ?? u.Username!;
    return { ok: true as const, sub };
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}
