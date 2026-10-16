"use client";

// Development page: the skills library against the browser mock.

import { SkillLibrary } from "@/components/settings/SkillLibrary";

export default function SkillsDev() {
  return (
    <main className="island-settings mx-auto min-h-screen max-w-xl bg-black p-6">
      <SkillLibrary onError={(e) => console.error(e)} />
    </main>
  );
}
