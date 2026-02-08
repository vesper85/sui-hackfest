import type { Context } from "hono";
import {
  issueNonce,
  consumeNonce,
  createAuthMessage,
} from "../services/nonce.service";
import {
  generateToken,
  getOrCreateUser,
  verifySuiSignature,
} from "../services/auth.service";
import {
  InternalServerError,
  UnauthorizedError,
  ValidationError,
} from "../types";
import type { AuthNonceRequest, AuthVerifyRequest } from "../types/auth";

export const requestNonce = async (c: Context) => {
  const body: AuthNonceRequest = await c.req.json();
  if (!body.walletAddress) {
    throw new ValidationError("Wallet address is required");
  }

  const { nonce, expiresAt, message } = issueNonce(body.walletAddress);

  return c.json({
    walletAddress: body.walletAddress,
    nonce,
    message,
    expiresAt,
  });
};

export const verifyWallet = async (c: Context) => {
  const body: AuthVerifyRequest = await c.req.json();

  const expectedMessage = createAuthMessage(body.walletAddress, body.nonce);
  if (body.message !== expectedMessage) {
    throw new ValidationError("Message does not match expected payload");
  }

  const nonceValid = consumeNonce(body.walletAddress, body.nonce);
  if (!nonceValid) {
    throw new UnauthorizedError("Invalid or expired nonce");
  }

  const signatureValid = await verifySuiSignature({
    walletAddress: body.walletAddress,
    message: expectedMessage,
    signature: body.signature,
  });

  if (!signatureValid) {
    throw new UnauthorizedError("Invalid signature");
  }

  const user = await getOrCreateUser(body.walletAddress);
  if (!user) {
    throw new InternalServerError("Failed to create user");
  }
  const token = await generateToken(body.walletAddress);

  return c.json({
    token,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      userType: user.userType,
      onboardingStatus: user.onboardingStatus,
      onboardingData: user.onboardingData,
      kycStatus: user.kycStatus,
    },
  });
};
