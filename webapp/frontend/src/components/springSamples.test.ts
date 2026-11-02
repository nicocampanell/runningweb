import { describe, expect, it } from "vitest";
import { springSamples } from "./HoverCard";

describe("springSamples", () => {
  it("settles at 1, overshooting only when bouncy", () => {
    const calm = springSamples(0, 0.3);
    const bouncy = springSamples(0.585, 0.4);
    for (const { samples } of [calm, bouncy]) {
      expect(samples[0]).toBeCloseTo(0, 6);
      expect(samples[samples.length - 1]).toBe(1);
    }
    expect(Math.max(...calm.samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...bouncy.samples)).toBeGreaterThan(1.1);
    expect(bouncy.ms).toBeGreaterThan(calm.ms);
  });
});
