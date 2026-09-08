import { INITIAL_SUBJECTS, INITIAL_MENTORS, INITIAL_QUESTIONS, INITIAL_ANSWERS } from "./seedData.js";

const STORAGE_KEYS = {
  QUESTIONS: "ADF_QUESTIONS",
  ANSWERS: "ADF_ANSWERS",
  MENTORS: "ADF_MENTORS",
  CURRENT_USER: "ADF_CURRENT_USER",
  USER_VOTES: "ADF_USER_VOTES"
};

export const DEFAULT_DEMO_USERS = [
  {
    id: "user-junior-1",
    name: "Rohan Sharma",
    email: "rohan@college.edu",
    password: "password123",
    role: "Junior Student",
    yearOrTitle: "1st Year",
    department: "Computer Science",
    type: "junior",
    avatar: "🧑‍🎓",
    badge: "🥉 Junior",
    points: 20
  },
  {
    id: "user-senior-3rd",
    name: "Aarav Mehta",
    email: "aarav@college.edu",
    password: "password123",
    role: "Senior Mentor",
    yearOrTitle: "3rd Year",
    department: "Computer Science",
    type: "senior",
    avatar: "👨‍💻",
    badge: "👑 Grandmaster",
    tier: "Grandmaster",
    points: 580
  },
  {
    id: "user-faculty-1",
    name: "Dr. Sunita Rao",
    email: "sunita@university.edu",
    password: "password123",
    role: "Faculty Member",
    yearOrTitle: "Associate Professor",
    department: "Computer Science",
    type: "faculty",
    avatar: "👩‍🏫",
    badge: "🥇 Master",
    tier: "Master",
    points: 420
  }
];

class Store {
  constructor() {
    this.subjects = INITIAL_SUBJECTS;
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) {
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(INITIAL_QUESTIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ANSWERS)) {
      localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(INITIAL_ANSWERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MENTORS)) {
      localStorage.setItem(STORAGE_KEYS.MENTORS, JSON.stringify(INITIAL_MENTORS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USER_VOTES)) {
      localStorage.setItem(STORAGE_KEYS.USER_VOTES, JSON.stringify({}));
    }
  }

  // Database status
  async checkDbStatus() {
    try {
      const res = await fetch("/api/db/status");
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("DB Status check offline:", e);
    }
    return { status: "local_cache", database: "academic_forum.db (cached)" };
  }

  // Database synchronization
  async syncWithDatabase() {
    try {
      const resp = await fetch("/api/questions");
      if (resp.ok) {
        const data = await resp.json();
        if (data.questions && data.questions.length > 0) {
          localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(data.questions));
        }
        if (data.answers && data.answers.length > 0) {
          localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(data.answers));
        }
      }

      const mResp = await fetch("/api/mentors");
      if (mResp.ok) {
        const mData = await mResp.json();
        if (mData.mentors && mData.mentors.length > 0) {
          localStorage.setItem(STORAGE_KEYS.MENTORS, JSON.stringify(mData.mentors));
        }
      }
    } catch (e) {
      console.warn("Using offline cache, sync skipped:", e);
    }
  }

  // Auth & Session
  getCurrentUser() {
    try {
      const u = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  async loginWithApi(email, password) {
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || "Invalid email or password." };
      }
    } catch (err) {
      console.warn("Backend login failed, checking seeded users:", err);
      const demo = DEFAULT_DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (demo && (password === demo.password || !password)) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(demo));
        return { success: true, user: demo };
      }
      return { success: false, error: "Connection error: Unable to reach database server." };
    }
  }

  async signupWithApi(userData) {
    try {
      const resp = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || "Signup failed." };
      }
    } catch (err) {
      console.warn("Backend signup failed, saving locally:", err);
      const user = this.login(userData);
      return { success: true, user };
    }
  }

  login(userData) {
    const user = {
      id: userData.id || ("user-" + Date.now()),
      name: userData.name || "Student",
      email: userData.email || "",
      role: userData.role || "Junior Student",
      yearOrTitle: userData.yearOrTitle || "1st Year",
      department: userData.department || "Computer Science",
      type: userData.role.includes("Faculty") ? "faculty" : (userData.role.includes("Senior") ? "senior" : "junior"),
      avatar: userData.role.includes("Faculty") ? "👩‍🏫" : (userData.role.includes("Senior") ? "👨‍💻" : "🧑‍🎓"),
      badge: userData.badge || (userData.role.includes("Faculty") ? "🥇 Master" : (userData.role.includes("Senior") ? "🥈 Expert" : "Junior")),
      tier: userData.tier || (userData.role.includes("Faculty") ? "Master" : (userData.role.includes("Senior") ? "Expert" : "Novice")),
      points: userData.points || (userData.role.includes("Faculty") ? 300 : (userData.role.includes("Senior") ? 150 : 10))
    };
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    return user;
  }

  logout() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  getQuestions() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || [];
    } catch {
      return INITIAL_QUESTIONS;
    }
  }

  getAnswers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ANSWERS)) || [];
    } catch {
      return INITIAL_ANSWERS;
    }
  }

  getMentors() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.MENTORS)) || [];
    } catch {
      return INITIAL_MENTORS;
    }
  }

  getQuestionById(id) {
    return this.getQuestions().find(q => q.id === id) || null;
  }

  getAnswersForQuestion(questionId) {
    return this.getAnswers().filter(a => a.questionId === questionId);
  }

  addQuestion(questionData) {
    const questions = this.getQuestions();
    const newQ = {
      id: "q-" + Date.now(),
      createdAt: new Date().toISOString(),
      isResolved: false,
      bestFitAnswerId: null,
      visibility: "public",
      ...questionData
    };
    questions.unshift(newQ);
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));

    fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newQ)
    }).catch(e => console.warn("Failed to sync question to server:", e));

    return newQ;
  }

  addAnswer(answerData) {
    const answers = this.getAnswers();
    const newA = {
      id: "ans-" + Date.now(),
      upvotes: 0,
      downvotes: 0,
      isBestFit: false,
      isVerified: false,
      avgRating: 0,
      ratingCount: 0,
      createdAt: new Date().toISOString(),
      ...answerData
    };
    answers.push(newA);
    localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(answers));

    const questions = this.getQuestions();
    const q = questions.find(item => item.id === newA.questionId);
    if (q) {
      q.isResolved = true;
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    }

    fetch("/api/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newA)
    }).catch(e => console.warn("Failed to sync answer to server:", e));

    return newA;
  }

  async resolveQuestion(questionId, userId, userRole) {
    const questions = this.getQuestions();
    const q = questions.find(item => item.id === questionId);
    if (!q) return null;

    try {
      const resp = await fetch("/api/questions/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, userId, userRole })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          q.isResolved = data.isResolved;
          localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
          return q;
        }
      }
    } catch (e) {
      console.warn("Resolve backend offline, toggling locally:", e);
    }

    q.isResolved = !q.isResolved;
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    return q;
  }

  async voteAnswer(answerId, delta, userId) {
    const answers = this.getAnswers();
    const target = answers.find(a => a.id === answerId);
    if (!target) return null;

    // Track user votes locally
    let userVotes = {};
    try {
      userVotes = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_VOTES)) || {};
    } catch {}

    const voteKey = `${userId}_${answerId}`;
    const prevVote = userVotes[voteKey];
    const targetType = delta > 0 ? 1 : -1;

    try {
      const resp = await fetch("/api/answers/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, delta, userId })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          target.upvotes = data.upvotes;
          target.downvotes = data.downvotes;
          if (prevVote === targetType) {
            delete userVotes[voteKey];
          } else {
            userVotes[voteKey] = targetType;
          }
          localStorage.setItem(STORAGE_KEYS.USER_VOTES, JSON.stringify(userVotes));
          localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(answers));
          return target;
        }
      }
    } catch (e) {
      console.warn("Vote offline fallback:", e);
    }

    // Local fallback
    if (delta > 0) {
      target.upvotes = (target.upvotes || 0) + 1;
    } else {
      target.downvotes = (target.downvotes || 0) + 1;
    }
    localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(answers));
    if (target.authorId) {
      this.recalculateMentorPoints(target.authorId, delta > 0 ? 10 : -5);
    }
    return target;
  }

  async submitFeedback(answerId, rating, comment, userId, userName) {
    try {
      const resp = await fetch("/api/answers/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, rating, comment, userId, userName })
      });
      if (resp.ok) {
        await this.syncWithDatabase();
        return true;
      }
    } catch (e) {
      console.warn("Feedback offline fallback:", e);
    }
    return false;
  }

  async getAnswerFeedback(answerId) {
    try {
      const resp = await fetch(`/api/answers/feedback?answerId=${encodeURIComponent(answerId)}`);
      if (resp.ok) {
        const data = await resp.json();
        return data.feedback || [];
      }
    } catch (e) {
      console.warn("Get feedback error:", e);
    }
    return [];
  }

  setBestFitAnswer(questionId, answerId) {
    const questions = this.getQuestions();
    const q = questions.find(item => item.id === questionId);
    if (q) {
      q.bestFitAnswerId = answerId;
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    }

    const answers = this.getAnswers();
    answers.forEach(a => {
      if (a.questionId === questionId) {
        a.isBestFit = (a.id === answerId);
        if (a.isBestFit && a.authorId) {
          this.recalculateMentorPoints(a.authorId, 30);
        }
      }
    });
    localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(answers));

    fetch("/api/questions/best-fit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, answerId })
    }).catch(e => console.warn("Failed to sync best-fit to server:", e));
  }

  recalculateMentorPoints(mentorId, pointsChange) {
    const mentors = this.getMentors();
    const mentor = mentors.find(m => m.id === mentorId);
    if (!mentor) return;

    mentor.points = Math.max(0, (mentor.points || 0) + pointsChange);
    
    if (mentor.points >= 500) {
      mentor.tier = "Grandmaster";
      mentor.badge = "👑";
    } else if (mentor.points >= 200) {
      mentor.tier = "Master";
      mentor.badge = "🥇";
    } else if (mentor.points >= 50) {
      mentor.tier = "Expert";
      mentor.badge = "🥈";
    } else {
      mentor.tier = "Novice";
      mentor.badge = "🥉";
    }

    localStorage.setItem(STORAGE_KEYS.MENTORS, JSON.stringify(mentors));
  }
}

export const store = new Store();
