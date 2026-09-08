// SmartDoubt Secure AI Client — Calls backend AI services (No API keys exposed to browser)

export class GeminiEngine {
  constructor() {
    this.activeKeyType = "primary";
    this.lastLogs = [];
  }

  log(msg) {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.lastLogs.unshift(entry);
    if (this.lastLogs.length > 20) this.lastLogs.pop();
    console.log(entry);
  }

  // 1. Instant AI Chatbot Explanation (Routed through /api/ai/chat)
  async generateInstantAnswer(subject, title, description) {
    this.log(`Requesting AI Instant Answer for: "${title}" via backend...`);
    try {
      const resp = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, title, description })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          this.log(`AI response received successfully (Source: ${data.source})`);
          return { success: true, text: data.answer, source: data.source || "gemini-3.5-flash" };
        }
      }
    } catch (err) {
      this.log(`Backend AI call warning: ${err.message}. Using academic heuristic.`);
    }

    // Offline heuristic fallback
    return { success: true, text: this.offlineAcademicEngine(title + " " + (description || "")), source: "offline-heuristic" };
  }

  // 2. AI Best-Fit Solution Analyzer (Routed through /api/ai/analyze-answers)
  async analyzeBestFitAnswer(questionId, questionTitle, answersList) {
    if (!answersList || answersList.length === 0) return null;
    if (answersList.length === 1) {
      return { bestAnswerId: answersList[0].id, explanation: "Single verified mentor answer accepted as top solution." };
    }

    this.log(`Requesting AI Answer Analysis for question ${questionId}...`);
    try {
      const resp = await fetch("/api/ai/analyze-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.bestAnswerId) {
          this.log(`AI selected Best-Fit: ${data.bestAnswerId}`);
          return { bestAnswerId: data.bestAnswerId, explanation: data.explanation };
        }
      }
    } catch (e) {
      this.log(`Backend analyze error: ${e.message}. Using consensus fallback.`);
    }

    // Consensus heuristic fallback
    let best = answersList[0];
    let maxScore = -999;
    for (const a of answersList) {
      const score = (a.upvotes * 2) - a.downvotes + (a.content.length / 50);
      if (score > maxScore) {
        maxScore = score;
        best = a;
      }
    }
    return {
      bestAnswerId: best.id,
      explanation: `Selected based on high community consensus (+${best.upvotes} upvotes) and detailed explanation.`
    };
  }

  // 3. Semantic Similar Doubt Detection (Routed through /api/ai/similar-doubts)
  async checkSimilarDoubts(title, description, subjectId) {
    try {
      const resp = await fetch("/api/ai/similar-doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, subjectId })
      });
      if (resp.ok) {
        const data = await resp.json();
        return data;
      }
    } catch (e) {
      console.warn("Similar doubts check error:", e);
    }
    return { hasSimilar: false, matches: [] };
  }

  // 4. Smart Offline Academic Heuristic Fallback
  offlineAcademicEngine(query) {
    const p = (query || "").toLowerCase();
    if (p.includes("dijkstra") || p.includes("a*") || p.includes("algorithm")) {
      return `### Core Concept Breakdown
Dijkstra's Algorithm and A* Search are both graph traversal algorithms that find the shortest path from a start node to destinations.

**1. Dijkstra's Algorithm (Uniform Cost):**
- Explores outward equally in all directions based purely on actual cost from start: g(n).
- Guaranteed to find the optimal path in graphs with non-negative edge weights.

**2. A* Search Algorithm (Heuristic-Guided):**
- Guided by evaluation function: f(n) = g(n) + h(n), where h(n) is an admissible heuristic estimating distance to target.
- Prunes unpromising search paths, reaching the goal significantly faster than Dijkstra.

**Key Exam Takeaway:**
Dijkstra is mathematically identical to A* when the heuristic function h(n) = 0 for all nodes.`;
    } else if (p.includes("eigen") || p.includes("matrix") || p.includes("algebra")) {
      return `### Core Concept Breakdown
In Linear Algebra, when a matrix transformation acts on vectors, most vectors rotate and change direction.

**1. Eigenvector (v):**
A non-zero vector whose direction remains completely invariant under linear transformation A. It is only stretched, shrunk, or flipped.

**2. Eigenvalue (λ):**
The scalar multiplier determining by how much the eigenvector scales:
$$A \\cdot v = \\lambda \\cdot v$$

**Key Exam Takeaway:**
To find eigenvalues, solve the characteristic polynomial: $\\det(A - \\lambda I) = 0$.`;
    } else {
      return `### Academic Solution
1. **Core Principle**: Formulate the foundational equations and constraints.
2. **Analysis**: Break down the problem step-by-step applying standard coursework definitions.
3. **Key Takeaway**: Verify edge conditions and review lecture proof steps.`;
    }
  }
}

export const geminiEngine = new GeminiEngine();
