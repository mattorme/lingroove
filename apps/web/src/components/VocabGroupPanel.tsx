"use client";

import { VocabularyEntry } from "@/types/api";

type Props = {
  entries: VocabularyEntry[];
  selected: Set<number>;
  onToggle: (id: number) => void;
};

function showInfinitiveLine(entry: VocabularyEntry): boolean {
  if (entry.partOfSpeech !== "verb" || !entry.infinitiveForm) return false;
  return entry.infinitiveForm.toLowerCase() !== entry.originalWord.toLowerCase();
}

function isReflexive(entry: VocabularyEntry): boolean {
  return entry.partOfSpeech === "verb" && (entry.infinitiveForm?.endsWith("rse") ?? false);
}

export function VocabGroupPanel({ entries, selected, onToggle }: Props) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {entry.originalWord}{" "}
                <span className="text-xs text-textSecondary">
                  ({isReflexive(entry) ? "reflexive verb" : entry.partOfSpeech})
                </span>
              </p>
              {showInfinitiveLine(entry) ? (
                <p className="mt-0.5 text-xs text-textSecondary">
                  Infinitive:{" "}
                  <span className="font-medium text-textPrimary">{entry.infinitiveForm}</span>
                </p>
              ) : null}
              {entry.conjugatedTranslation ? (
                <>
                  <p className="mt-1 text-sm font-medium text-accent">{entry.conjugatedTranslation}</p>
                  <p className="mt-0.5 text-xs text-textSecondary">
                    infinitive:{" "}
                    <span className="font-medium">{entry.englishTranslation}</span>
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm font-medium text-accent">{entry.englishTranslation}</p>
              )}
              <p className="mt-2 text-sm italic text-textPrimary/80">
                &ldquo;{entry.contextSentence}&rdquo;
              </p>
            </div>
            <input
              type="checkbox"
              checked={selected.has(entry.id)}
              onChange={() => onToggle(entry.id)}
              className="h-5 w-5 accent-accent"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
