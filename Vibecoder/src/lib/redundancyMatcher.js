// Feature 4: Redundancy & Deduplication Engine
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "what", "which", "who", "whom",
  "this", "that", "these", "those", "how", "why", "where", "when", "does", "do",
  "did", "in", "on", "at", "to", "for", "of", "with", "by", "from", "about",
  "can", "could", "would", "should", "and", "or", "but", "if", "then", "else"
]);

export function cleanTokens(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

export function calculateJaccardSimilarity(tokens1, tokens2) {
  if (!tokens1.length || !tokens2.length) return 0;
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  let intersectionCount = 0;
  for (const t of set1) {
    if (set2.has(t)) intersectionCount++;
  }
  const unionCount = new Set([...tokens1, ...tokens2]).size;
  return unionCount === 0 ? 0 : (intersectionCount / unionCount);
}

// Check against list of existing questions
export function checkDuplicateQuestion(inputTitle, inputDesc, existingQuestions, currentSubjectId) {
  if (!inputTitle || inputTitle.trim().length < 5) {
    return { isDuplicate: false, score: 0, matchedQuestion: null };
  }

  const inputTokens = cleanTokens(`${inputTitle} ${inputDesc || ""}`);
  let highestScore = 0;
  let bestMatch = null;

  for (const q of existingQuestions) {
    // Check either within same subject or globally
    const qTokens = cleanTokens(`${q.title} ${q.description || ""}`);
    const score = calculateJaccardSimilarity(inputTokens, qTokens);

    // Subject bonus if asking in same academic subject
    const subjectBonus = (currentSubjectId && currentSubjectId !== "all" && q.subjectId === currentSubjectId) ? 0.1 : 0;
    const finalScore = Math.min(1.0, score + subjectBonus);

    if (finalScore > highestScore) {
      highestScore = finalScore;
      bestMatch = q;
    }
  }

  const percentage = Math.round(highestScore * 100);
  // Threshold 50% triggers redundancy alert
  return {
    isDuplicate: percentage >= 50,
    score: percentage,
    matchedQuestion: bestMatch
  };
}
