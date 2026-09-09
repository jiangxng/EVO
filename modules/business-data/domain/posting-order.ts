import type { PostingOrderKey } from '../api/contracts.js';

export function comparePostingOrder(
  left: PostingOrderKey,
  right: PostingOrderKey
): number {
  const effectiveDelta =
    left.effectiveAt.getTime() - right.effectiveAt.getTime();

  if (effectiveDelta !== 0) return effectiveDelta < 0 ? -1 : 1;

  if (left.postingPriority !== right.postingPriority) {
    return left.postingPriority < right.postingPriority ? -1 : 1;
  }

  if (left.postingSequence === right.postingSequence) return 0;
  return left.postingSequence < right.postingSequence ? -1 : 1;
}

export function isRetroactivePostingInput(
  candidate: PostingOrderKey,
  authoritativeHighWater: PostingOrderKey | null
): boolean {
  if (authoritativeHighWater === null) return false;
  return comparePostingOrder(candidate, authoritativeHighWater) <= 0;
}
