import { useEffect } from "react";

/** Ctrl S save, Ctrl ` terminal, Ctrl P open, Ctrl Shift F search, Esc close. */
export function useEditorKeys({
  save,
  onClose,
  quick,
  find,
  setQuick,
  setFind,
  setTerm,
}: {
  save: () => Promise<void>;
  onClose: () => void;
  quick: string | null;
  find: string | null;
  setQuick: (q: string | null) => void;
  setFind: (f: string | null) => void;
  setTerm: (f: (t: boolean) => boolean) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      } else if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        setTerm((t) => !t);
      } else if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuick("");
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFind("");
      } else if (e.key === "Escape") {
        if (quick !== null || find !== null) {
          setQuick(null);
          setFind(null);
        } else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, onClose, quick, find, setQuick, setFind, setTerm]);
}
