"use client";

import { VocabularyEntry } from "@/types/api";

type Props = {
  entries: VocabularyEntry[];
  selected: Set<number>;
  onToggle: (id: number) => void;
};

export function VocabGroupPanel({ entries, selected, onToggle }: Props) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {entry.originalWord}{" "}
                <span className="text-xs text-textSecondary">({entry.partOfSpeech})</span>
              </p>
              <p className="text-sm text-textSecondary">{entry.englishTranslation}</p>
              <p className="mt-1 text-sm text-textPrimary/90">{entry.contextSentence}</p>
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
