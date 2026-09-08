export const INITIAL_SUBJECTS = [
  { id: "all", name: "All Subjects", icon: "📚" },
  { id: "cs", name: "Computer Science", icon: "💻" },
  { id: "math", name: "Mathematics", icon: "📐" },
  { id: "physics", name: "Physics", icon: "⚡" },
  { id: "electrical", name: "Electrical & Electronics", icon: "🔌" }
];

export const INITIAL_MENTORS = [
  { id: "m1", name: "Aarav Sharma", role: "Senior (4th Year)", points: 580, tier: "Grandmaster", avatar: "👨‍💻", badge: "👑" },
  { id: "m2", name: "Dr. Sunita Rao", role: "Faculty (Associate Prof)", points: 420, tier: "Master", avatar: "👩‍🏫", badge: "🥇" },
  { id: "m3", name: "Neha Patel", role: "Senior (3rd Year)", points: 190, tier: "Expert", avatar: "👩‍💻", badge: "🥈" },
  { id: "m4", name: "Rohan Verma", role: "Peer Mentor", points: 35, tier: "Novice", avatar: "🧑‍🎓", badge: "🥉" }
];

export const INITIAL_QUESTIONS = [
  {
    id: "q-101",
    subjectId: "cs",
    subjectName: "Computer Science",
    title: "What is the key difference between Dijkstra and A* Search Algorithm?",
    description: "I am preparing for algorithms exam. Both find the shortest path, but how does the heuristic function in A* actually change the search space compared to Dijkstra's greedy traversal?",
    author: { name: "Ananya Gupta", role: "Student (2nd Year)" },
    createdAt: "2026-09-08T09:15:00Z",
    mode: "mentor",
    isResolved: true,
    bestFitAnswerId: "ans-201"
  },
  {
    id: "q-102",
    subjectId: "math",
    subjectName: "Mathematics",
    title: "Intuitive explanation of Eigenvalues and Eigenvectors in Linear Algebra?",
    description: "I can calculate det(A - lambda*I) = 0 algebraically, but geometrically what does it actually represent during coordinate transformations?",
    author: { name: "Kabir Singh", role: "Student (1st Year)" },
    createdAt: "2026-09-08T10:00:00Z",
    mode: "mentor",
    isResolved: true,
    bestFitAnswerId: "ans-203"
  },
  {
    id: "q-103",
    subjectId: "physics",
    subjectName: "Physics",
    title: "Why does total internal reflection only occur from a denser to a rarer medium?",
    description: "Why can light not experience total internal reflection when traveling from air into glass? What happens to Snell's law at the critical angle?",
    author: { name: "Pooja Mehta", role: "Student (1st Year)" },
    createdAt: "2026-09-08T10:45:00Z",
    mode: "mentor",
    isResolved: false,
    bestFitAnswerId: null
  }
];

export const INITIAL_ANSWERS = [
  {
    id: "ans-201",
    questionId: "q-101",
    authorId: "m1",
    authorName: "Aarav Sharma",
    authorRole: "Senior (4th Year)",
    authorTier: "Grandmaster",
    authorBadge: "👑",
    content: "Dijkstra is essentially a special case of A* where the heuristic function h(n) = 0 for all nodes. Dijkstra expands nodes radially in all directions based purely on path cost g(n) from start. \n\nIn contrast, A* uses f(n) = g(n) + h(n), where h(n) is an admissible heuristic estimating distance to target. This pulls the search frontier directly towards the goal, drastically pruning unpromising branches!",
    upvotes: 24,
    downvotes: 0,
    isBestFit: true,
    isVerified: true,
    createdAt: "2026-09-08T09:30:00Z"
  },
  {
    id: "ans-202",
    questionId: "q-101",
    authorId: "m4",
    authorName: "Rohan Verma",
    authorRole: "Peer Mentor",
    authorTier: "Novice",
    authorBadge: "🥉",
    content: "A* uses heuristics to guide it so it searches faster towards destination. Dijkstra checks all directions until it hits the node.",
    upvotes: 4,
    downvotes: 1,
    isBestFit: false,
    isVerified: false,
    createdAt: "2026-09-08T09:40:00Z"
  },
  {
    id: "ans-203",
    questionId: "q-102",
    authorId: "m2",
    authorName: "Dr. Sunita Rao",
    authorRole: "Faculty (Associate Prof)",
    authorTier: "Master",
    authorBadge: "🥇",
    content: "Geometrically, when a matrix transformation acts on space, most vectors get rotated and knocked off their original span. \n\nAn **Eigenvector** is a special non-zero vector whose direction remains completely unchanged—it only gets scaled (stretched, shrunk, or flipped). The **Eigenvalue (λ)** is the exact scalar factor by which that eigenvector stretches: A · v = λ · v.",
    upvotes: 31,
    downvotes: 0,
    isBestFit: true,
    isVerified: true,
    createdAt: "2026-09-08T10:15:00Z"
  }
];
