import { describe, expect, it } from "vitest";
import { contextLabel, fromPick, isUpload, withRefs } from "./context";

describe("attachment display", () => {
  const path = "C:\\Users\\person\\AppData\\Local\\Temp\\duskie-attachments\\01M5YN5QRA36E1Q63KX2CB51SP-image.png";
  it("hides temporary folders and generated IDs in upload labels", () => {
    expect(contextLabel(fromPick(path))).toBe("image.png");
    expect(contextLabel(fromPick("/tmp/duskie-attachments/01ABC-notes.pdf"))).toBe("notes.pdf");
  });
  it("keeps the complete quoted path available to the agent", () => {
    const spaced = path.replace("person", "a person");
    expect(withRefs("Look at this", [fromPick(spaced)])).toBe(`Look at this\n\n@"${spaced}"`);
  });
  it("preserves project context labels", () => {
    expect(isUpload("src/duskie-attachments-guide.md")).toBe(false);
    expect(contextLabel(fromPick("src/components/view.tsx"))).toBe("src/components");
  });
});
