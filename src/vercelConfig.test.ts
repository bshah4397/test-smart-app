import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel routing config", () => {
  it("rewrites direct SPA routes back to index.html", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf-8")
    );

    expect(config.rewrites).toContainEqual({
      source: "/(.*)",
      destination: "/index.html"
    });
  });
});
