import { store, DEFAULT_DEMO_USERS } from "./services/store.js";
import { geminiEngine } from "./lib/ai/geminiEngine.js";
import { voiceController } from "./lib/voice/voiceController.js";
import { checkDuplicateQuestion } from "./lib/redundancyMatcher.js";
import { generateRevisionNotePdf } from "./lib/pdf/pdfGenerator.js";
import { generateMentorResponses } from "./services/mentorSimulator.js";

// State
let currentSubject = "all";
let currentFilter = "all"; // "all" | "solved" | "open" | "private"
let currentSort = "newest"; // "newest" | "votes" | "answers"
let searchQuery = "";
let expandedQuestionId = "q-101";
let isVoiceListening = false;
let feedbackExpandedAnswerId = null;

export async function initApp() {
  checkAuthAndRender();
  setupEventListeners();
  try {
    await store.syncWithDatabase();
    if (store.getCurrentUser()) {
      renderFeed();
      renderLeaderboardSidebar();
    }
  } catch (e) {
    console.warn("Offline or sync skipped:", e);
  }
}

// 1. Auth Routing (Login View vs Working Forum View)
export function checkAuthAndRender() {
  const currentUser = store.getCurrentUser();
  const authView = document.getElementById("auth-view");
  const appView = document.getElementById("app-view");

  if (!currentUser) {
    if (authView) authView.classList.remove("hidden");
    if (appView) appView.classList.add("hidden");
    renderDemoLoginOptions();
    if (window.location.hash === "#signup") {
      window.switchAuthTab("signup");
    }
  } else {
    if (authView) authView.classList.add("hidden");
    if (appView) appView.classList.remove("hidden");
    renderUserHeader();
    renderSubjectNav();
    renderLeaderboardSidebar();
    renderEngineStatus();
    renderFeed();
  }
}

// Render Quick Demo Logins in Login Screen (Matching Stitch Demo Profiles)
function renderDemoLoginOptions() {
  const container = document.getElementById("quick-demo-logins");
  if (!container) return;

  const colorStyles = [
    { bg: "bg-primary-container text-on-primary-container", text: "text-primary" },
    { bg: "bg-secondary-container text-on-secondary-container", text: "text-secondary" },
    { bg: "bg-tertiary-container text-on-tertiary-container", text: "text-tertiary" }
  ];

  container.innerHTML = DEFAULT_DEMO_USERS.map((u, idx) => {
    const initials = u.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    const style = colorStyles[idx % colorStyles.length];

    return `
      <button 
        type="button"
        onclick="window.handleQuickLogin('${u.id}')"
        class="flex flex-col items-center p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-all text-left group border border-outline-variant/30">
        <div class="w-10 h-10 rounded-full ${style.bg} flex items-center justify-center font-bold text-xs mb-2 group-hover:scale-105 transition-transform shadow-sm">
          ${initials}
        </div>
        <span class="text-xs font-bold text-on-surface truncate w-full text-center group-hover:text-primary transition-colors">${escapeHtml(u.name)}</span>
        <span class="text-[10px] ${style.text} text-center font-medium">${escapeHtml(u.role)}</span>
      </button>
    `;
  }).join("");
}

function showAlert(message, type = "info") {
  const alertBox = document.getElementById("auth-alert");
  if (!alertBox) return;
  alertBox.classList.remove(
    "hidden",
    "bg-rose-950/60", "border-rose-800/50", "text-rose-300",
    "bg-emerald-950/60", "border-emerald-800/50", "text-emerald-300",
    "bg-primary-container/20", "border-primary/40", "text-primary"
  );
  if (type === "error") {
    alertBox.classList.add("bg-rose-950/60", "border-rose-800/50", "text-rose-300");
  } else if (type === "success") {
    alertBox.classList.add("bg-emerald-950/60", "border-emerald-800/50", "text-emerald-300");
  } else {
    alertBox.classList.add("bg-primary-container/20", "border-primary/40", "text-primary");
  }
  alertBox.innerHTML = message;
}

window.switchAuthTab = (tab) => {
  const signinBtn = document.getElementById("tab-btn-signin");
  const signupBtn = document.getElementById("tab-btn-signup");
  const signinForm = document.getElementById("auth-form-signin");
  const signupForm = document.getElementById("auth-form-signup");
  const alertBox = document.getElementById("auth-alert");
  if (alertBox) alertBox.classList.add("hidden");

  if (tab === "signin") {
    if (signinBtn) signinBtn.className = "flex-1 py-2.5 rounded-lg text-xs font-bold transition-all bg-primary text-on-primary shadow-sm";
    if (signupBtn) signupBtn.className = "flex-1 py-2.5 rounded-lg text-xs font-bold transition-all text-on-surface-variant hover:text-on-surface";
    if (signinForm) signinForm.classList.remove("hidden");
    if (signupForm) signupForm.classList.add("hidden");
  } else {
    if (signupBtn) signupBtn.className = "flex-1 py-2.5 rounded-lg text-xs font-bold transition-all bg-primary text-on-primary shadow-sm";
    if (signinBtn) signinBtn.className = "flex-1 py-2.5 rounded-lg text-xs font-bold transition-all text-on-surface-variant hover:text-on-surface";
    if (signupForm) signupForm.classList.remove("hidden");
    if (signinForm) signinForm.classList.add("hidden");
  }
};

window.handleQuickLogin = async (demoUserId) => {
  const target = DEFAULT_DEMO_USERS.find(u => u.id === demoUserId);
  if (target) {
    const emailInput = document.getElementById("signin-email");
    const pwdInput = document.getElementById("signin-password");
    if (emailInput) emailInput.value = target.email;
    if (pwdInput) pwdInput.value = target.password;
    
    showAlert(`Authenticating ${escapeHtml(target.name)}...`, "info");
    const res = await store.loginWithApi(target.email, target.password);
    if (res.success) {
      checkAuthAndRender();
    } else {
      showAlert(res.error || "Login failed", "error");
    }
  }
};

window.handleFormSignIn = async (event) => {
  event.preventDefault();
  const emailInput = document.getElementById("signin-email");
  const pwdInput = document.getElementById("signin-password");
  const submitBtn = document.getElementById("signin-submit-btn");

  const email = emailInput ? emailInput.value.trim() : "";
  const password = pwdInput ? pwdInput.value : "";

  if (!email || !password) {
    showAlert("Please enter both university email and password.", "error");
    return;
  }

  const originalText = submitBtn ? submitBtn.innerHTML : "";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Verifying credentials...</span>`;
  }

  const res = await store.loginWithApi(email, password);
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }

  if (res.success) {
    showAlert("Login verified! Redirecting to forum...", "success");
    setTimeout(() => {
      checkAuthAndRender();
    }, 200);
  } else {
    showAlert(res.error || "Invalid email or password.", "error");
  }
};

window.handleFormSignUp = async (event) => {
  event.preventDefault();
  const nameInput = document.getElementById("signup-name");
  const emailInput = document.getElementById("signup-email");
  const pwdInput = document.getElementById("signup-password");
  const roleSelect = document.getElementById("signup-role");
  const yearSelect = document.getElementById("signup-year-title");
  const deptSelect = document.getElementById("signup-dept");
  const submitBtn = document.getElementById("signup-submit-btn");

  const name = nameInput ? nameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const password = pwdInput ? pwdInput.value : "";
  const role = roleSelect ? roleSelect.value : "Junior Student";
  const yearOrTitle = yearSelect ? yearSelect.value : "1st Year";
  const department = deptSelect ? deptSelect.value : "Computer Science";

  if (!name || !email || !password) {
    showAlert("Please fill in all required fields.", "error");
    return;
  }

  if (password.length < 6) {
    showAlert("Password must be at least 6 characters long.", "error");
    return;
  }

  const originalText = submitBtn ? submitBtn.innerHTML : "";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Creating account...</span>`;
  }

  const res = await store.signupWithApi({
    name,
    email,
    password,
    role,
    yearOrTitle,
    department
  });

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }

  if (res.success) {
    showAlert("Account registered successfully! Opening forum...", "success");
    setTimeout(() => {
      checkAuthAndRender();
    }, 300);
  } else {
    showAlert(res.error || "Registration failed.", "error");
  }
};

window.handleLogout = () => {
  store.logout();
  checkAuthAndRender();
};

window.updateYearOrTitleOptions = () => {
  const roleSelect = document.getElementById("signup-role");
  const select = document.getElementById("signup-year-title");
  if (!roleSelect || !select) return;

  const role = roleSelect.value;
  if (role === "Junior Student") {
    select.innerHTML = `
      <option value="1st Year">1st Year Junior</option>
      <option value="2nd Year">2nd Year Junior</option>
    `;
  } else if (role === "Senior Mentor") {
    select.innerHTML = `
      <option value="3rd Year" selected>3rd Year Senior</option>
      <option value="4th Year">4th Year Senior</option>
    `;
  } else {
    select.innerHTML = `
      <option value="Assistant Professor">Assistant Professor</option>
      <option value="Associate Professor" selected>Associate Professor</option>
      <option value="Professor & HOD">Professor & HOD</option>
    `;
  }
};

// 2. User Header in Working Project
export function renderUserHeader() {
  const currentUser = store.getCurrentUser();
  const userBtn = document.getElementById("user-profile-btn");
  if (!userBtn || !currentUser) return;

  const initials = currentUser.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  userBtn.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-on-primary text-xs shadow-sm">
      ${initials}
    </div>
    <div class="hidden sm:flex flex-col text-left">
      <div class="text-xs font-bold text-on-surface leading-tight flex items-center gap-1.5">
        <span>${escapeHtml(currentUser.name)}</span>
        <span class="text-[9px] px-1.5 py-0.2 rounded font-extrabold ${
          currentUser.type === 'faculty' ? 'bg-purple-950/80 text-purple-300 border border-purple-800/40' :
          currentUser.type === 'senior' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/40' :
          'bg-primary/20 text-primary border border-primary/30'
        }">${currentUser.yearOrTitle || currentUser.role}</span>
      </div>
      <span class="text-[10px] text-on-surface-variant">${escapeHtml(currentUser.department)}</span>
    </div>
  `;
}

// 3. Subject Navigation
function renderSubjectNav() {
  const container = document.getElementById("subject-nav");
  if (!container) return;

  const questions = store.getQuestions();

  const iconMap = {
    all: "hub",
    cs: "terminal",
    math: "calculate",
    physics: "science",
    electrical: "bolt"
  };

  container.innerHTML = store.subjects.map(s => {
    const count = s.id === "all" 
      ? questions.length 
      : questions.filter(q => q.subjectId === s.id).length;
    const isActive = currentSubject === s.id;
    const matIcon = iconMap[s.id] || "school";

    return `
      <button 
        data-subject="${s.id}" 
        class="subject-btn w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
          isActive 
            ? 'bg-primary-container text-on-primary-container font-bold shadow-sm' 
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
        }">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-[18px]">${matIcon}</span>
          <span>${s.name}</span>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isActive ? 'bg-primary/20 text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'
        }">
          ${count}
        </span>
      </button>
    `;
  }).join("");

  container.querySelectorAll(".subject-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentSubject = btn.getAttribute("data-subject");
      renderSubjectNav();
      renderFeed();
    });
  });
}

// Handle Feed Sorting
window.handleSortChange = (val) => {
  currentSort = val;
  renderFeed();
};

// 4. Question Feed
export function renderFeed() {
  const feedContainer = document.getElementById("question-feed");
  const countLabel = document.getElementById("feed-count");
  if (!feedContainer) return;

  const currentUser = store.getCurrentUser();
  if (!currentUser) return;

  let questions = store.getQuestions();

  // Subject filter
  if (currentSubject !== "all") {
    questions = questions.filter(q => q.subjectId === currentSubject);
  }

  // Filter tabs
  if (currentFilter === "solved") {
    questions = questions.filter(q => q.isResolved);
  } else if (currentFilter === "open") {
    questions = questions.filter(q => !q.isResolved);
  } else if (currentFilter === "private") {
    questions = questions.filter(q => q.visibility === "private");
  }

  // Universal vs Private visibility check
  questions = questions.filter(q => {
    if (q.visibility !== "private") return true;
    if (currentUser.type === "senior" || currentUser.type === "faculty") return true;
    if (q.author?.id === currentUser.id || q.author?.name === currentUser.name) return true;
    return false;
  });

  // Search query
  if (searchQuery.trim()) {
    const qLower = searchQuery.toLowerCase();
    questions = questions.filter(q => 
      q.title.toLowerCase().includes(qLower) || 
      (q.description && q.description.toLowerCase().includes(qLower))
    );
  }

  // Feed Sorting
  if (currentSort === "votes") {
    questions.sort((a, b) => {
      const aAnswers = store.getAnswersForQuestion(a.id);
      const bAnswers = store.getAnswersForQuestion(b.id);
      const aVotes = aAnswers.reduce((sum, item) => sum + (item.upvotes || 0) - (item.downvotes || 0), 0);
      const bVotes = bAnswers.reduce((sum, item) => sum + (item.upvotes || 0) - (item.downvotes || 0), 0);
      return bVotes - aVotes;
    });
  } else if (currentSort === "answers") {
    questions.sort((a, b) => {
      return store.getAnswersForQuestion(b.id).length - store.getAnswersForQuestion(a.id).length;
    });
  } else {
    questions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  if (countLabel) {
    countLabel.textContent = `${questions.length} discussion${questions.length === 1 ? '' : 's'}`;
  }

  if (questions.length > 0 && (!expandedQuestionId || !questions.some(q => q.id === expandedQuestionId))) {
    expandedQuestionId = questions[0].id;
  }

  if (questions.length === 0) {
    feedContainer.innerHTML = `
      <div class="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-12 text-center shadow-sm">
        <div class="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center text-xl mx-auto mb-3 text-primary">
          <span class="material-symbols-outlined text-[24px]">search</span>
        </div>
        <h3 class="text-sm font-bold text-on-surface mb-1">No academic doubts found</h3>
        <p class="text-xs text-on-surface-variant max-w-sm mx-auto mb-4">Post a new doubt or clear your search and filter criteria.</p>
        <button onclick="window.openAskModal()" class="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-md transition hover:opacity-95">
          + Ask a Doubt
        </button>
      </div>
    `;
    return;
  }

  feedContainer.innerHTML = questions.map(q => {
    const answers = store.getAnswersForQuestion(q.id);
    const bestFitAnswer = answers.find(a => a.id === q.bestFitAnswerId);
    const isExpanded = (expandedQuestionId === q.id);
    const totalVotes = answers.reduce((acc, a) => acc + (a.upvotes || 0) - (a.downvotes || 0), 0);
    const isPrivate = (q.visibility === "private");
    const canResolve = (q.author?.id === currentUser.id || currentUser.type === "senior" || currentUser.type === "faculty");

    const authorInitials = (q.author?.name || "Student").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

    return `
      <article class="doubt-card flex flex-col bg-surface-container-low border ${
        isExpanded ? 'border-primary/50 ring-1 ring-primary/20 shadow-md' : 'border-outline-variant/30 hover:border-outline-variant/60'
      } rounded-2xl p-5 lg:p-6 transition-all gap-4" id="card-${q.id}">
        
        <!-- Header -->
        <div class="flex items-start justify-between gap-4 cursor-pointer" onclick="window.toggleQuestion('${q.id}')">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              ${authorInitials}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold text-on-surface">${escapeHtml(q.author?.name || 'Junior Student')}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
                  ${q.author?.yearOrTitle || q.author?.role || 'Student'}
                </span>
                <span class="text-[11px] text-on-surface-variant">${new Date(q.createdAt).toLocaleDateString()}</span>
              </div>
              <span class="text-[11px] text-on-surface-variant">Posted in ${escapeHtml(q.subjectName || "Academic Domain")}</span>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            ${q.isResolved ? `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Solved
              </span>
            ` : `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/40">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Open Doubt
              </span>
            `}

            ${isPrivate ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-container-high text-on-surface-variant">
                <span class="material-symbols-outlined text-[13px]">lock</span>
                Private
              </span>
            ` : `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                Universal
              </span>
            `}

            ${bestFitAnswer ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                <span class="material-symbols-outlined text-[13px]">auto_awesome</span>
                AI Selected
              </span>
            ` : ''}
          </div>
        </div>

        <!-- Question Content -->
        <div class="flex flex-col gap-1.5 cursor-pointer" onclick="window.toggleQuestion('${q.id}')">
          <h2 class="text-base font-bold text-on-surface hover:text-primary transition-colors leading-snug">
            ${escapeHtml(q.title)}
          </h2>
          ${q.description ? `
            <p class="text-xs text-on-surface-variant leading-relaxed ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}">
              ${escapeHtml(q.description)}
            </p>
          ` : ''}
        </div>

        <!-- AI Best-Fit Solution Box -->
        ${bestFitAnswer ? `
          <div class="flex flex-col bg-surface-container p-4 rounded-xl gap-2.5 border-l-4 border-primary">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm">
                  <span class="material-symbols-outlined text-[16px]">verified</span>
                </div>
                <span class="text-xs font-bold text-on-surface">Best-Fit Solution by ${escapeHtml(bestFitAnswer.authorName)}</span>
                <span class="text-[10px] text-on-surface-variant">(${bestFitAnswer.authorRole || 'Mentor'})</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-primary font-semibold">AI Verified Best Solution</span>
                <button data-read-text="${escapeHtml(bestFitAnswer.content)}" class="speak-btn text-primary hover:text-on-surface text-xs flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">volume_up</span>
                </button>
              </div>
            </div>
            <p class="text-xs text-on-surface leading-relaxed pl-9 whitespace-pre-wrap">${escapeHtml(bestFitAnswer.content)}</p>
          </div>
        ` : ''}

        <!-- Card Footer Controls -->
        <div class="flex items-center justify-between pt-2 border-t border-surface-container-high/60 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <button onclick="window.toggleQuestion('${q.id}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-all">
              <span class="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
              <span>${answers.length} Answers</span>
              <span class="material-symbols-outlined text-[14px]">${isExpanded ? 'expand_less' : 'expand_more'}</span>
            </button>
            <button data-read-text="${escapeHtml(q.title + '. ' + (q.description || ''))}" title="Listen to doubt" class="speak-btn flex items-center p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-all text-xs">
              <span class="material-symbols-outlined text-[16px]">volume_up</span>
            </button>
          </div>

          <!-- Actions: Resolve, Simulate, AI Best Fit, PDF -->
          <div class="flex items-center gap-2 flex-wrap">
            ${canResolve ? `
              <button 
                onclick="window.handleResolveQuestion('${q.id}')"
                class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  q.isResolved 
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                }">
                <span class="material-symbols-outlined text-[15px]">check_circle</span>
                <span>${q.isResolved ? 'Resolved (Reopen)' : 'Mark Resolved'}</span>
              </button>
            ` : ''}

            <button 
              onclick="window.triggerMentorSimulation('${q.id}')"
              title="Generate authentic answers from Senior & Faculty"
              class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold hover:opacity-90 transition-all">
              <span class="material-symbols-outlined text-[15px]">smart_toy</span>
              <span class="hidden sm:inline">Simulate Mentors</span>
            </button>

            <button 
              onclick="window.triggerAiBestFit('${q.id}')"
              class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold hover:opacity-90 transition-all">
              <span class="material-symbols-outlined text-[15px]">psychology</span>
              <span>AI Best-Fit</span>
            </button>

            <button 
              onclick="window.exportQuestionPdf('${q.id}')"
              title="Download Revision Note PDF"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs font-semibold transition-all">
              <span class="material-symbols-outlined text-[16px]">description</span>
            </button>
          </div>
        </div>

        <!-- Expanded Community Answers Section -->
        ${isExpanded ? `
          <div class="flex flex-col gap-3 pt-3 border-t border-surface-container-high/60">
            <span class="text-xs font-bold text-on-surface">
              Peer & Faculty Solutions (${answers.length})
            </span>

            <!-- Answers List -->
            <div class="flex flex-col gap-3">
              ${answers.map(ans => {
                const isFormOpen = (feedbackExpandedAnswerId === ans.id);
                const ansInitials = (ans.authorName || "Mentor").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

                return `
                  <div class="bg-surface-container border border-outline-variant/30 rounded-xl p-4 flex flex-col gap-3">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-bold text-xs">
                          ${ansInitials}
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-on-surface">${escapeHtml(ans.authorName)}</span>
                            <span class="px-2 py-0.2 rounded-full text-[10px] font-bold bg-primary/20 text-primary">
                              ${ans.authorBadge || '🥉'} ${ans.authorTier || 'Mentor'}
                            </span>
                            <span class="text-[11px] text-on-surface-variant">(${ans.authorRole || 'Mentor'})</span>
                          </div>
                        </div>
                      </div>

                      <!-- Vote, Review, Speak Buttons -->
                      <div class="flex items-center gap-1.5">
                        <!-- Upvote -->
                        <button 
                          onclick="window.voteAnswer('${ans.id}', 1)"
                          title="Upvote (+10 mentor pts)"
                          class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface text-xs font-bold transition-all border border-outline-variant/30">
                          <span class="material-symbols-outlined text-[15px] text-emerald-400">thumb_up</span>
                          <span>${ans.upvotes || 0}</span>
                        </button>
                        <!-- Downvote -->
                        <button 
                          onclick="window.voteAnswer('${ans.id}', -1)"
                          title="Downvote"
                          class="flex items-center p-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-rose-400 transition-all border border-outline-variant/30">
                          <span class="material-symbols-outlined text-[15px]">thumb_down</span>
                        </button>
                        <!-- Star Review Form Toggle -->
                        <button 
                          onclick="window.toggleAnswerFeedbackForm('${ans.id}')"
                          title="Submit 1-5 Star Review"
                          class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-amber-400 text-xs font-semibold transition-all border border-outline-variant/30">
                          <span class="material-symbols-outlined text-[15px]">star</span>
                          <span>Review</span>
                        </button>
                        <!-- Read text button -->
                        <button 
                          data-read-text="${escapeHtml(ans.content)}"
                          title="Read aloud"
                          class="speak-btn flex items-center p-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-all">
                          <span class="material-symbols-outlined text-[16px]">volume_up</span>
                        </button>
                      </div>
                    </div>

                    <!-- Answer Content -->
                    <p class="text-xs text-on-surface leading-relaxed whitespace-pre-wrap pl-10">${escapeHtml(ans.content)}</p>

                    <!-- Feedback / Review Form (if expanded) -->
                    ${isFormOpen ? `
                      <div class="ml-10 p-3.5 bg-surface-container-low border border-outline-variant/40 rounded-xl space-y-2.5">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-bold text-on-surface">Academic Quality Review</span>
                          <span class="text-[10px] text-on-surface-variant">1 (Needs Work) to 5 (Mastery)</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-medium text-on-surface-variant">Rating:</span>
                          <div class="flex items-center gap-1">
                            ${[1, 2, 3, 4, 5].map(star => `
                              <button 
                                type="button" 
                                id="star-${ans.id}-${star}"
                                onclick="window.selectStarRating('${ans.id}', ${star})"
                                class="star-btn-${ans.id} text-base cursor-pointer hover:scale-125 transition text-amber-400">
                                ★
                              </button>
                            `).join('')}
                          </div>
                          <input type="hidden" id="selected-rating-${ans.id}" value="5" />
                        </div>
                        <input 
                          type="text" 
                          id="feedback-comment-${ans.id}" 
                          placeholder="e.g. In-depth algorithmic breakdown with correct edge case handling!" 
                          class="w-full text-xs p-2.5 bg-surface-container border border-outline-variant/40 text-on-surface rounded-lg focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/60" />
                        <div class="flex justify-end gap-2 pt-1">
                          <button 
                            type="button" 
                            onclick="window.toggleAnswerFeedbackForm('${ans.id}')" 
                            class="px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface bg-surface-container hover:bg-surface-container-high rounded-lg font-semibold transition">
                            Cancel
                          </button>
                          <button 
                            type="button" 
                            onclick="window.submitAnswerFeedback('${ans.id}')" 
                            class="px-3.5 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold shadow-sm hover:opacity-95 transition">
                            Submit Rating
                          </button>
                        </div>
                      </div>
                    ` : ''}

                  </div>
                `;
              }).join("")}
            </div>

            <!-- Post New Answer Composer -->
            <div class="bg-surface-container border border-outline-variant/40 rounded-xl p-4 flex flex-col gap-2.5 mt-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-primary">edit</span>
                  <span>Write Academic Answer as: <strong class="text-primary">${escapeHtml(currentUser.name)} (${currentUser.role})</strong></span>
                </label>
                <button onclick="window.handleLogout()" class="text-[10px] text-primary hover:underline">
                  Switch Account &rarr;
                </button>
              </div>
              <textarea 
                id="answer-input-${q.id}" 
                rows="2" 
                placeholder="Share your verified derivation, proof, code snippets, or literature citations..."
                class="w-full text-xs p-3 bg-surface-container-low border border-outline-variant/40 text-on-surface rounded-xl focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-on-surface-variant/60"></textarea>
              <div class="flex justify-end">
                <button 
                  onclick="window.submitAnswer('${q.id}')"
                  class="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md hover:opacity-95 transition">
                  Submit Solution
                </button>
              </div>
            </div>

          </div>
        ` : ''}

      </article>
    `;
  }).join("");

  feedContainer.querySelectorAll(".speak-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = btn.getAttribute("data-read-text");
      if (text) voiceController.speak(text);
    });
  });
}

// 5. Mentor Simulation
window.triggerMentorSimulation = async (questionId) => {
  const q = store.getQuestionById(questionId);
  if (!q) return;

  const btn = event?.currentTarget;
  if (btn) {
    btn.innerHTML = `<span class="material-symbols-outlined text-[15px] animate-spin">refresh</span><span>Simulating...</span>`;
    btn.disabled = true;
  }

  try {
    const responses = await generateMentorResponses(q.subjectName, q.title, q.description);
    
    store.addAnswer({
      questionId: q.id,
      authorId: "user-senior-3rd",
      authorName: "Aarav Mehta",
      authorRole: "3rd Year Senior Mentor",
      authorTier: "Grandmaster",
      authorBadge: "👑",
      content: responses.seniorAnswer,
      upvotes: 8
    });

    store.addAnswer({
      questionId: q.id,
      authorId: "user-faculty-1",
      authorName: "Dr. Sunita Rao",
      authorRole: "Faculty (Associate Professor)",
      authorTier: "Master",
      authorBadge: "🥇",
      content: responses.facultyAnswer,
      upvotes: 12
    });

    const allAnswers = store.getAnswersForQuestion(q.id);
    const analysis = await geminiEngine.analyzeBestFitAnswer(q.id, q.title, allAnswers);
    if (analysis && analysis.bestAnswerId) {
      store.setBestFitAnswer(q.id, analysis.bestAnswerId);
    }

    renderFeed();
    renderLeaderboardSidebar();
  } catch (err) {
    alert("Simulation error: " + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = `<span class="material-symbols-outlined text-[15px]">smart_toy</span><span class="hidden sm:inline">Simulate Mentors</span>`;
      btn.disabled = false;
    }
  }
};

// Global Quick Action Mentor Simulation
window.triggerGlobalMentorSimulate = async () => {
  const questions = store.getQuestions();
  if (questions.length === 0) return;
  const targetQ = questions.find(q => !q.isResolved) || questions[0];
  expandedQuestionId = targetQ.id;
  renderFeed();
  await window.triggerMentorSimulation(targetQ.id);
};

// 6. Right Sidebar: Kaggle Leaderboard (Matching Stitch Mentor Tiers)
function renderLeaderboardSidebar() {
  const container = document.getElementById("sidebar-leaderboard");
  if (!container) return;

  const mentors = store.getMentors().sort((a, b) => (b.points || 0) - (a.points || 0));

  const rankPillColors = [
    { bg: "bg-amber-400 text-slate-900", badge: "bg-amber-500" },
    { bg: "bg-slate-300 text-slate-900", badge: "bg-slate-400" },
    { bg: "bg-amber-700 text-white", badge: "bg-amber-800" }
  ];

  container.innerHTML = mentors.slice(0, 4).map((m, idx) => {
    const initials = m.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    const rankColor = rankPillColors[idx] || { bg: "bg-surface-container-high text-on-surface", badge: "bg-surface-container-highest" };

    return `
      <div class="flex items-center justify-between p-3 bg-surface-container hover:bg-surface-container-high rounded-xl transition-all border border-outline-variant/20">
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative shrink-0">
            <div class="w-9 h-9 rounded-full ${rankColor.bg} flex items-center justify-center font-bold text-xs shadow-sm">
              ${initials}
            </div>
            <span class="absolute -bottom-1 -right-1 w-4 h-4 ${rankColor.badge} rounded-full border border-surface flex items-center justify-center text-[8px] font-bold text-white">
              ${idx + 1}
            </span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="text-xs font-bold text-on-surface truncate">${escapeHtml(m.name)}</span>
            <span class="text-[10px] text-primary flex items-center gap-1 truncate">
              <span class="material-symbols-outlined text-[12px]">workspace_premium</span>
              <span>${m.tier || 'Mentor'} Tier</span>
            </span>
          </div>
        </div>
        <div class="flex flex-col items-end shrink-0 pl-2">
          <span class="text-xs font-bold text-primary">${m.points || 0}</span>
          <span class="text-[9px] text-emerald-400 font-medium">+15 wk</span>
        </div>
      </div>
    `;
  }).join("");
}

// 7. Header Engine Status
export function renderEngineStatus() {
  const badge = document.getElementById("engine-status-badge");
  if (!badge) return;

  const type = geminiEngine.activeKeyType;
  if (type === "primary") {
    badge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/40";
    badge.textContent = "● Primary Key Active";
  } else if (type === "secondary") {
    badge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/40";
    badge.textContent = "● Secondary Key Active";
  } else {
    badge.className = "text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-primary border border-outline-variant/30";
    badge.textContent = "● Heuristic Engine Ready";
  }
}

// 8. Redundancy & Similar Doubt Live Checker for Ask Modal
export function setupRedundancyWatcher() {
  const titleInput = document.getElementById("ask-title");
  const descInput = document.getElementById("ask-desc");
  const alertContainer = document.getElementById("redundancy-alert-box");

  async function runCheck() {
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();
    const subject = document.getElementById("ask-subject").value;

    if (title.length < 4) {
      alertContainer.classList.add("hidden");
      alertContainer.innerHTML = "";
      return;
    }

    // Backend AI similarity check
    try {
      const simResult = await geminiEngine.checkSimilarDoubts(title, desc, subject);
      if (simResult && simResult.hasSimilar && simResult.matches && simResult.matches.length > 0) {
        const topMatch = simResult.matches[0];
        alertContainer.classList.remove("hidden");
        alertContainer.innerHTML = `
          <div class="p-3 bg-amber-950/60 border border-amber-800/50 rounded-xl text-amber-200 text-xs shadow-sm">
            <div class="font-bold flex items-center justify-between mb-1">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-amber-400">warning</span>
                AI Similar Doubt Detected (${topMatch.similarityScore}% match)
              </span>
              <span class="text-[10px] bg-amber-900/80 text-amber-300 px-2 py-0.5 rounded-full font-bold">Instant Solved</span>
            </div>
            <p class="text-on-surface font-medium my-1.5 line-clamp-1">"${escapeHtml(topMatch.title)}"</p>
            <button 
              type="button" 
              onclick="window.viewExistingDoubt('${topMatch.id}')"
              class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition flex items-center gap-1">
              <span>View Solved Thread</span> &rarr;
            </button>
          </div>
        `;
        return;
      }
    } catch (e) {
      console.warn("AI similarity check error:", e);
    }

    // Client fallback check
    const result = checkDuplicateQuestion(title, desc, store.getQuestions(), subject);
    if (result.isDuplicate && result.matchedQuestion) {
      alertContainer.classList.remove("hidden");
      alertContainer.innerHTML = `
        <div class="p-3 bg-amber-950/60 border border-amber-800/50 rounded-xl text-amber-200 text-xs shadow-sm">
          <div class="font-bold flex items-center justify-between mb-1">
            <span class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px] text-amber-400">warning</span>
              Similar Question Found (${result.score}% match)
            </span>
            <span class="text-[10px] bg-amber-900/80 text-amber-300 px-2 py-0.5 rounded-full font-bold">Avoid Duplicate</span>
          </div>
          <p class="text-on-surface font-medium my-1.5 line-clamp-1">"${escapeHtml(result.matchedQuestion.title)}"</p>
          <button 
            type="button" 
            onclick="window.viewExistingDoubt('${result.matchedQuestion.id}')"
            class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition">
            View Solved Thread &rarr;
          </button>
        </div>
      `;
    } else {
      alertContainer.classList.add("hidden");
      alertContainer.innerHTML = "";
    }
  }

  titleInput.addEventListener("input", debounce(runCheck, 250));
  descInput.addEventListener("input", debounce(runCheck, 250));
}

// 9. Voice Input Handler
export function toggleVoiceInput(targetInputId) {
  const micBtn = document.getElementById("mic-btn");
  const statusEl = document.getElementById("voice-status");
  const targetInput = document.getElementById(targetInputId);

  if (isVoiceListening) {
    voiceController.stopListening();
    isVoiceListening = false;
    micBtn.classList.remove("text-rose-400", "animate-pulse");
    micBtn.classList.add("text-on-surface-variant");
    if (statusEl) statusEl.textContent = "";
    return;
  }

  voiceController.startListening(
    (transcript) => {
      targetInput.value = transcript;
      targetInput.dispatchEvent(new Event("input"));
    },
    (listening) => {
      isVoiceListening = listening;
      if (listening) {
        micBtn.classList.remove("text-on-surface-variant");
        micBtn.classList.add("text-rose-400", "animate-pulse");
        if (statusEl) statusEl.textContent = "Listening... Speak clearly";
      } else {
        micBtn.classList.remove("text-rose-400", "animate-pulse");
        micBtn.classList.add("text-on-surface-variant");
        if (statusEl) statusEl.textContent = "";
      }
    },
    (err) => {
      alert(err);
      if (statusEl) statusEl.textContent = "";
    }
  );
}

// Global Handlers
window.toggleQuestion = (id) => {
  expandedQuestionId = (expandedQuestionId === id) ? null : id;
  renderFeed();
};

window.viewExistingDoubt = (id) => {
  window.closeAskModal();
  expandedQuestionId = id;
  renderFeed();
  const el = document.getElementById(`card-${id}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
};

// Deduplicated Vote Handler passing userId
window.voteAnswer = async (answerId, delta) => {
  const currentUser = store.getCurrentUser();
  if (!currentUser) return;
  await store.voteAnswer(answerId, delta, currentUser.id);
  renderFeed();
  renderLeaderboardSidebar();
};

// Resolve Doubt Workflow Handler
window.handleResolveQuestion = async (questionId) => {
  const currentUser = store.getCurrentUser();
  if (!currentUser) return;
  const updated = await store.resolveQuestion(questionId, currentUser.id, currentUser.role);
  if (updated) {
    renderFeed();
    renderSubjectNav();
  }
};

// Feedback Handlers
window.toggleAnswerFeedbackForm = (answerId) => {
  feedbackExpandedAnswerId = (feedbackExpandedAnswerId === answerId) ? null : answerId;
  renderFeed();
};

window.selectStarRating = (ansId, starValue) => {
  const hidden = document.getElementById(`selected-rating-${ansId}`);
  if (hidden) hidden.value = starValue;
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`star-${ansId}-${i}`);
    if (btn) {
      if (i <= starValue) {
        btn.className = "star-btn-" + ansId + " text-amber-400 text-base cursor-pointer hover:scale-125 transition";
      } else {
        btn.className = "star-btn-" + ansId + " text-surface-container-highest text-base cursor-pointer hover:scale-125 transition";
      }
    }
  }
};

window.submitAnswerFeedback = async (answerId) => {
  const currentUser = store.getCurrentUser();
  if (!currentUser) return;
  const hidden = document.getElementById(`selected-rating-${answerId}`);
  const commentInput = document.getElementById(`feedback-comment-${answerId}`);
  const rating = parseInt(hidden?.value || "5", 10);
  const comment = commentInput ? commentInput.value.trim() : "";

  const ok = await store.submitFeedback(answerId, rating, comment, currentUser.id, currentUser.name);
  if (ok) {
    feedbackExpandedAnswerId = null;
    await store.syncWithDatabase();
    renderFeed();
  } else {
    alert("Feedback submission failed. Please try again.");
  }
};

window.submitAnswer = (questionId) => {
  const input = document.getElementById(`answer-input-${questionId}`);
  if (!input || !input.value.trim()) return;

  const currentUser = store.getCurrentUser();
  if (!currentUser) return;

  store.addAnswer({
    questionId,
    authorId: currentUser.id,
    authorName: currentUser.name,
    authorRole: `${currentUser.role} (${currentUser.yearOrTitle})`,
    authorTier: currentUser.tier || "Novice",
    authorBadge: currentUser.badge || "🥉",
    content: input.value.trim()
  });

  input.value = "";
  renderFeed();
  renderLeaderboardSidebar();
};

window.triggerAiBestFit = async (questionId) => {
  const q = store.getQuestionById(questionId);
  const answers = store.getAnswersForQuestion(questionId);
  if (!q || answers.length === 0) {
    alert("Please post or simulate answers first.");
    return;
  }

  const btn = event?.currentTarget;
  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.innerHTML = `<span class="material-symbols-outlined text-[15px] animate-spin">refresh</span><span>Analyzing...</span>`;
    btn.disabled = true;
  }

  try {
    const analysis = await geminiEngine.analyzeBestFitAnswer(questionId, q.title, answers);
    if (analysis && analysis.bestAnswerId) {
      store.setBestFitAnswer(questionId, analysis.bestAnswerId);
      renderFeed();
      renderLeaderboardSidebar();
      renderEngineStatus();
    }
  } catch (err) {
    alert("AI Best-Fit Error: " + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
};

window.exportQuestionPdf = (questionId) => {
  const q = store.getQuestionById(questionId);
  const answers = store.getAnswersForQuestion(questionId);
  const bestFit = answers.find(a => a.id === q.bestFitAnswerId);
  generateRevisionNotePdf(q, answers, bestFit);
};

// Modals
window.openAskModal = () => {
  const m = document.getElementById("ask-modal");
  if (m) m.classList.remove("hidden");
  setupRedundancyWatcher();
};

window.closeAskModal = () => {
  const m = document.getElementById("ask-modal");
  if (m) m.classList.add("hidden");
  const title = document.getElementById("ask-title");
  const desc = document.getElementById("ask-desc");
  const alert = document.getElementById("redundancy-alert-box");
  if (title) title.value = "";
  if (desc) desc.value = "";
  if (alert) alert.classList.add("hidden");
  voiceController.stopListening();
};

window.openSettingsModal = () => {
  const m = document.getElementById("settings-modal");
  if (m) m.classList.remove("hidden");
  const pk = document.getElementById("primary-key-input");
  const sk = document.getElementById("secondary-key-input");
  if (pk) pk.value = geminiEngine.primaryKey;
  if (sk) sk.value = geminiEngine.secondaryKey;
  renderEngineLogs();
};

window.closeSettingsModal = () => {
  const m = document.getElementById("settings-modal");
  if (m) m.classList.add("hidden");
};

window.saveSettings = () => {
  const pKey = document.getElementById("primary-key-input").value;
  const sKey = document.getElementById("secondary-key-input").value;
  geminiEngine.setKeys(pKey, sKey);
  renderEngineStatus();
  renderEngineLogs();
  alert("API Key Fallback settings updated!");
};

// Doubt Submission with Universal vs Private Option
window.handleDoubtSubmission = async () => {
  const currentUser = store.getCurrentUser();
  if (!currentUser) return;

  const subjectId = document.getElementById("ask-subject").value;
  const title = document.getElementById("ask-title").value.trim();
  const desc = document.getElementById("ask-desc").value.trim();
  const visibility = document.querySelector('input[name="doubt-visibility"]:checked').value;
  const mode = document.querySelector('input[name="doubt-mode"]:checked').value;

  if (!title) {
    alert("Please enter a question title.");
    return;
  }

  const subjectObj = store.subjects.find(s => s.id === subjectId) || { name: "Academic" };
  const submitBtn = document.getElementById("submit-doubt-btn");
  const originalText = submitBtn.innerHTML;

  if (mode === "ai") {
    submitBtn.innerHTML = `<span>⏳ Generating AI Solution...</span>`;
    submitBtn.disabled = true;

    try {
      const aiResponse = await geminiEngine.generateInstantAnswer(subjectObj.name, title, desc);
      
      const newQ = store.addQuestion({
        subjectId,
        subjectName: subjectObj.name,
        title,
        description: desc,
        author: { id: currentUser.id, name: currentUser.name, role: currentUser.role, yearOrTitle: currentUser.yearOrTitle },
        visibility,
        mode: "ai"
      });

      const newAns = store.addAnswer({
        questionId: newQ.id,
        authorId: null,
        authorName: "Gemini Academic AI",
        authorRole: `AI Assistant (${aiResponse.source.toUpperCase()})`,
        authorTier: "Grandmaster",
        authorBadge: "🤖",
        content: aiResponse.text,
        upvotes: 1
      });

      store.setBestFitAnswer(newQ.id, newAns.id);

      window.closeAskModal();
      expandedQuestionId = newQ.id;
      renderSubjectNav();
      renderFeed();
      renderEngineStatus();
    } catch (e) {
      alert("AI Generation Error: " + e.message);
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  } else {
    submitBtn.innerHTML = `<span>⏳ Publishing Doubt...</span>`;
    submitBtn.disabled = true;

    try {
      const newQ = store.addQuestion({
        subjectId,
        subjectName: subjectObj.name,
        title,
        description: desc,
        author: { id: currentUser.id, name: currentUser.name, role: currentUser.role, yearOrTitle: currentUser.yearOrTitle },
        visibility,
        mode: "mentor"
      });

      const mentorAnswers = await generateMentorResponses(subjectObj.name, title, desc);

      store.addAnswer({
        questionId: newQ.id,
        authorId: "user-senior-3rd",
        authorName: "Aarav Mehta",
        authorRole: "3rd Year Senior Mentor",
        authorTier: "Grandmaster",
        authorBadge: "👑",
        content: mentorAnswers.seniorAnswer,
        upvotes: 5
      });

      store.addAnswer({
        questionId: newQ.id,
        authorId: "user-faculty-1",
        authorName: "Dr. Sunita Rao",
        authorRole: "Faculty (Associate Professor)",
        authorTier: "Master",
        authorBadge: "🥇",
        content: mentorAnswers.facultyAnswer,
        upvotes: 9
      });

      const allAnswers = store.getAnswersForQuestion(newQ.id);
      const analysis = await geminiEngine.analyzeBestFitAnswer(newQ.id, title, allAnswers);
      if (analysis && analysis.bestAnswerId) {
        store.setBestFitAnswer(newQ.id, analysis.bestAnswerId);
      }

      window.closeAskModal();
      expandedQuestionId = newQ.id;
      renderSubjectNav();
      renderFeed();
      renderLeaderboardSidebar();
    } catch (e) {
      console.warn(e);
      window.closeAskModal();
      renderFeed();
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }
};

function renderEngineLogs() {
  const container = document.getElementById("engine-logs-console");
  if (!container) return;
  container.innerHTML = geminiEngine.lastLogs.length 
    ? geminiEngine.lastLogs.map(l => `<div>${escapeHtml(l)}</div>`).join("") 
    : "<div class='text-on-surface-variant/60 italic'>No failover events logged yet. Engine ready.</div>";
}

function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderFeed();
    });
  }

  // Filter tabs
  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(t => {
        t.className = "filter-tab px-3.5 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface transition-all";
      });
      tab.className = "filter-tab px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary-container transition-all";
      currentFilter = tab.getAttribute("data-filter");
      renderFeed();
    });
  });

  const headerVoiceBtn = document.getElementById("header-voice-btn");
  if (headerVoiceBtn) {
    headerVoiceBtn.addEventListener("click", () => {
      window.openAskModal();
      toggleVoiceInput("ask-title");
    });
  }
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
