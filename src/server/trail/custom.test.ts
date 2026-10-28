import { describe, expect, it } from "vitest";
import { checkCustomSteps, customTourInput } from "./custom";

const files = new Map([
  ["src/app.ts", "\n\nexport function start() {\n  listen();\n}\n"],
  ["README.md", "# Hi"],
]);
const atlas = { nodes: [{ id: "core", label: "Core", kind: "core", purpose: "", files: ["src/app.ts"] }] } as Parameters<typeof checkCustomSteps>[2];

describe("checkCustomSteps", () => {
  it("anchors each step on its first non-blank line and assigns its module", () => {
    const input = customTourInput.parse({ title: "My tour", steps: [{ file: "src/app.ts", startLine: 1, endLine: 4, title: "Start" }] });
    const { steps, problems } = checkCustomSteps(input, files, atlas);
    expect(problems).toEqual([]);
    expect(steps[0]).toMatchObject({ node: "core", file: "src/app.ts", startLine: 1, endLine: 4, anchor: "export function start() {", narration: "", corrected: false });
  });

  it("names steps that point at missing files or lines, and clamps a range to the file", () => {
    const input = customTourInput.parse({
      title: "Broken",
      steps: [
        { file: "nope.ts", startLine: 1, endLine: 2, title: "A" },
        { file: "README.md", startLine: 9, endLine: 9, title: "B" },
        { file: "src/app.ts", startLine: 3, endLine: 99, title: "C" },
      ],
    });
    const { steps, problems } = checkCustomSteps(input, files, atlas);
    expect(problems).toEqual(['Step 1 ("A"): nope.ts isn\'t a file in this commit.', 'Step 2 ("B"): README.md has 1 lines; line 9 doesn\'t exist.']);
    expect(steps[0]).toMatchObject({ startLine: 3, endLine: 6 });
  });
});
