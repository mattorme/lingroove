export type VocabularyEntry = {
  id: number;
  originalWord: string;
  infinitiveForm: string | null;
  englishTranslation: string;
  conjugatedTranslation: string | null;
  contextSentence: string;
  partOfSpeech: "verb" | "noun" | "adjective" | string;
  isSelected: boolean;
};

export type AnalyzeResponse = {
  songId: number;
  cleanedLyrics: string;
  grouped: Record<string, VocabularyEntry[]>;
  entries: VocabularyEntry[];
};
