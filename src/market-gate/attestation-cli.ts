import { readFile } from "node:fs/promises";
import { createOwnerEligibilityStatement, ownerAttestationSignRequest,
  verifyOwnerEligibilityAttestation, type SignedOwnerAttestation } from "./owner-attestation.js";

const [action, ...args] = process.argv.slice(2);
if (action === "challenge" && args.length === 6) {
  const [wallet, token, router, venueId, side, affirmation] = args as [string, string, string, string, string, string];
  if (affirmation !== "I_ATTEST_ELIGIBLE" || (side !== "buy" && side !== "sell"))
    throw new Error("Read the issuer rules and explicitly attest eligibility before creating a challenge");
  const statement = createOwnerEligibilityStatement({ wallet, token, router, venueId, side,
    notProhibited: true, restrictionsSatisfied: true, termsAcknowledged: true });
  process.stdout.write(`${JSON.stringify({ statement, signRequest: ownerAttestationSignRequest(statement) }, null, 2)}\n`);
} else if (action === "verify" && args.length === 7) {
  const [signedPath, revocationsPath, wallet, token, router, venueId, side] = args as [string, string, string, string, string, string, string];
  const signed = JSON.parse(await readFile(signedPath, "utf8")) as SignedOwnerAttestation;
  const revocations = JSON.parse(await readFile(revocationsPath, "utf8")) as unknown;
  if (!Array.isArray(revocations) || !revocations.every((item) => typeof item === "string"))
    throw new Error("Revocations must be a JSON array of nonces");
  if (side !== "buy" && side !== "sell") throw new Error("Invalid side");
  const valid = verifyOwnerEligibilityAttestation(signed, { wallet, token, router, venueId, side },
    new Date(), (nonce) => revocations.includes(nonce));
  process.stdout.write(`${JSON.stringify({ valid, expiresAt: signed.statement?.expiresAt })}\n`);
  if (!valid) process.exitCode = 1;
} else {
  process.stderr.write("Usage: npm run attestation -- challenge <wallet> <token> <router> <venueId> <buy|sell> I_ATTEST_ELIGIBLE\n"
    + "   or: npm run attestation -- verify <signed.json> <revocations.json> <wallet> <token> <router> <venueId> <buy|sell>\n");
  process.exitCode = 2;
}
