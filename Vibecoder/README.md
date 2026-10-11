# Academic Doubt Forum 🎓
> **Vibecoder — Hackathon Project**
> A centralized, subject-wise Question & Answer web application designed to eliminate duplicate academic doubts and hesitation among students by connecting them with mentors (seniors, peers, faculty) and AI assistance.

---

## 📌 Problem Statement
Students often have small academic doubts but hesitate to ask in class. They resort to messaging peers individually, causing the exact same doubt to be answered repeatedly across fragmented personal chats instead of being indexed, verified, and publicly accessible for the entire class.

---

## 🚀 The 7 Core Features & Engine Scope.

| # | Feature | Description & Technical Mechanism |
|---|---|---|
| **1** | **Centralised Subject-Wise Q&A** | Categorized forum (CS, Mathematics, Physics, Electrical). Students post doubts; mentors (seniors, peers, faculty) provide verified solutions. |
| **2** | **AI Best-Fit Solution Analyzer** | When multiple answers exist, AI evaluates responses for depth, clarity, and correctness, automatically awarding an **"AI Best-Fit Solution"** badge to the top response. |
| **3** | **PDF Generation (Revision Notes)** | One-click export that compiles questions, top answers, and key takeaway points into a clean, printable PDF revision sheet for exam prep. |
| **4** | **Redundancy & Deduplication Engine** | Real-time semantic matching while typing. Detects existing similar doubts (>65% similarity) and links directly to solved answers to prevent thread duplication. |
| **5** | **AI Chatbot vs. Mentor Toggle** | Dual-mode routing: **[Ask AI]** for instant automated explanation, or **[Ask Mentors]** to post to the community forum for peer review. |
| **6** | **Kaggle-Style Feedback & Ratings** | Community upvotes/downvotes with "Verified Correct" status. Mentors earn reputation points and tier badges (*Novice 🥉 → Expert 🥈 → Master 🥇 → Grandmaster 👑*). |
| **7** | **Voice Assistance (STT & TTS)** | Speech-to-text input (Web Speech API / Whisper) for dictating doubts, and audio narration powered by `window.speechSynthesis` to read answers aloud. |
| **+** | **Gemini Multi-Key Fallback Engine** | Automated failover pool: If the primary Gemini API key hits rate limits or quota exhaustion (HTTP 429), it switches instantly to the secondary key with zero downtime. |

---

## 📂 Repository Folder Structure.

```text
Vibecoder/
├── docs/                               # Project documentation & architectural blueprints
├── public/                             # Static assets, icons, and branding
├── src/
│   ├── assets/                         # SVG icons, images, and illustrations
│   ├── components/                     # Modular UI components
│   │   ├── common/                     # Reusable UI primitives (buttons, badges, inputs, modals)
│   │   ├── forum/                      # Question cards, subject feed, answer sections, best-fit card
│   │   ├── ratings/                    # Kaggle voting controls, mentor tier badges, leaderboard
│   │   └── voice/                      # Microphone recorder button, audio player, TTS speaker
│   ├── lib/                            # Core integrations and engines
│   │   ├── ai/                         # Gemini multi-key fallback client, prompts, heuristic analyzer
│   │   ├── pdf/                        # Client-side PDF generation & revision note formatting
│   │   └── voice/                      # Web Speech STT recognizer & window.speechSynthesis controller
│   ├── services/                       # Data persistence, state management, and mock academic stores
│   ├── styles/                         # Tailwind utility configurations and print media queries
│   └── utils/                          # Text tokenizers, Jaccard/Cosine similarity math, date helpers
├── .gitignore                          # Standard git ignore rules
└── README.md                           # Project blueprint and documentation
```

---

## 🛠️ Technology Stack
- **Frontend**: Responsive Single-Page Application (HTML5, Tailwind CSS, ES6 / React)
- **AI Engine**: Google Gemini API with multi-key failover manager & smart offline heuristics
- **Voice APIs**: Web Speech API (`SpeechRecognition` for STT) and `window.speechSynthesis` (for TTS)
- **Document Export**: Browser vector print engine / jsPDF for instant revision sheet generation
- **State & Storage**: LocalStorage / Database persistence for questions, answers, and mentor reputation points

---

## 🎯 Live Hackathon Demonstration Flow (3 Minutes)
1. **0:00 - 0:40 | Voice Input & Intake**: Dictate a doubt using the voice microphone button (Speech-to-Text).
2. **0:40 - 1:15 | Redundancy Guard**: See duplicate detection suggest existing solved answers in real time.
3. **1:15 - 1:50 | Dual Mode & AI Best-Fit**: Demonstrate instant AI explanation vs. mentor answers and spotlighting of the best-fit solution.
4. **1:50 - 2:30 | Kaggle Ratings & Fallback**: Upvote answers, display mentor tier progression, and showcase uninterrupted Gemini multi-key failover.
5. **2:30 - 3:00 | Voice Out & PDF Export**: Listen to speech narration and export the clean revision PDF note.

---

## 👥 Team
- **Repository**: [yashsonawane18/Vibecoder](https://github.com/yashsonawane18/Vibecoder)
- **Branch**: `main`
