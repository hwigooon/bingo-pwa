import { describe, expect, it } from "vitest";
import { buildInviteUrl } from "./invite";

describe("buildInviteUrl", () => {
  it("GitHub Pages 경로를 유지한 초대 링크를 만든다", () => {
    expect(buildInviteUrl("https://hwigooon.github.io", "/bingo-pwa/", "abc123")).toBe(
      "https://hwigooon.github.io/bingo-pwa/?room=ABC123",
    );
  });
});
