import type { RouteQuote } from "./evidence.js";

/** Pancake/Uniswap V3 exactInputSingle(address,address,uint24,address,uint256,uint256,uint256,uint160). */
export function decodeV3ExactInputSingle(calldata: string): {
  tokenIn: string; tokenOut: string; recipient: string; inputRaw: bigint;
  minimumOutputRaw: bigint; deadlineSeconds: bigint; feeTier: number;
} | null {
  if (!/^0x414bf389[0-9a-fA-F]{512}$/.test(calldata)) return null;
  const words = Array.from({ length: 8 }, (_, index) => calldata.slice(10 + index * 64, 74 + index * 64));
  const address = (index: number): string | null => {
    const word = words[index]!;
    return /^0{24}/.test(word) && !/^0{64}$/.test(word) ? `0x${word.slice(24).toLowerCase()}` : null;
  };
  const tokenIn = address(0); const tokenOut = address(1); const recipient = address(3);
  if (!tokenIn || !tokenOut || !recipient || BigInt(`0x${words[2]}`) > 1_000_000n
    || BigInt(`0x${words[7]}`) !== 0n) return null;
  return { tokenIn, tokenOut, recipient, feeTier: Number(BigInt(`0x${words[2]}`)),
    deadlineSeconds: BigInt(`0x${words[4]}`),
    inputRaw: BigInt(`0x${words[5]}`), minimumOutputRaw: BigInt(`0x${words[6]}`) };
}

export function routeMatchesCalldata(quote: RouteQuote): boolean {
  const decoded = decodeV3ExactInputSingle(quote.calldata);
  if (!decoded) return false;
  const deadline = Date.parse(quote.onchainDeadline);
  return Number.isFinite(deadline) && BigInt(deadline) === decoded.deadlineSeconds * 1000n
    && quote.tokenIn.toLowerCase() === decoded.tokenIn
    && quote.tokenOut.toLowerCase() === decoded.tokenOut
    && quote.recipient.toLowerCase() === decoded.recipient
    && quote.inputRaw === decoded.inputRaw && quote.minimumOutputRaw === decoded.minimumOutputRaw;
}
