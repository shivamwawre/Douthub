import { geminiEngine } from "../lib/ai/geminiEngine.js";

// Generates authentic Senior & Faculty answers for real-world prototype demonstration
export async function generateMentorResponses(subjectName, questionTitle, questionDesc) {
  const prompt = `Academic Subject: ${subjectName}
Question: ${questionTitle}
Context: ${questionDesc || "None"}

Generate TWO distinct, high-quality answers from two academic mentors:
1. Senior Student Mentor (concise, exam-oriented, algorithmic/practical tricks):
2. Faculty Member / Professor (rigorous, conceptual depth, proofs/theoretical intuition):

Format as JSON:
{
  "seniorAnswer": "<concise practical answer from Senior>",
  "facultyAnswer": "<rigorous in-depth answer from Faculty>"
}`;

  try {
    const result = await geminiEngine.callWithFallback(prompt, "You are a university academic portal simulator.");
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("Using offline simulated mentor responses", e);
  }

  // Realistic fallback responses tailored to academic inquiries
  const lower = questionTitle.toLowerCase();
  if (lower.includes("sort") || lower.includes("dijkstra") || lower.includes("tree") || lower.includes("graph")) {
    return {
      seniorAnswer: `From a practical competitive programming and exam perspective: \n\nFocus on the recurrence relation T(n) = 2T(n/2) + O(n). In the average case, randomized partitioning guarantees O(n log n). Remember that worst case occurs when pivots are consistently extremal (already sorted arrays without randomized pivot), causing degradation to O(n²)!`,
      facultyAnswer: `Let us examine the mathematical foundation. The partition algorithm executes in linear time Θ(n). By applying the Master Theorem case 2 to the balanced recurrence, we obtain the average expected depth of recursion as log₂(n), yielding an expected running time of O(n log n). For formal exam proofs, always cite Quicksort's in-place space complexity O(log n) auxiliary stack space.`
    };
  }

  return {
    seniorAnswer: `Key exam takeaway: Break the problem into its foundational components. Identify the invariant properties under the given constraints, compute boundary conditions, and test with edge cases to confirm correctness.`,
    facultyAnswer: `From a pedagogical standpoint, understand the governing theorem and definitions. Ensure you state all implicit assumptions regarding the domain and continuity before applying the transformation. Review chapter references for formal derivations.`
  };
}
