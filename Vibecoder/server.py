import os, sys, json, sqlite3, hashlib, secrets, mimetypes, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Ensure proper MIME types on Windows
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/json', '.json')

DB_FILE = os.path.join(os.path.dirname(__file__), "academic_forum.db")
PORT = int(os.environ.get("PORT", 3000))

# Backend-Secured API Keys (Protected from browser exposure)
GEMINI_PRIMARY_KEY = os.environ.get("GEMINI_PRIMARY_KEY", "AQ.Ab8RN6L-5YD8-4hcmR17XHR4-XmpdbavTGcHl38cMI_6bYVHeA")
GEMINI_SECONDARY_KEY = os.environ.get("GEMINI_SECONDARY_KEY", "AQ.Ab8RN6LheFsWCah7Bnbb8N0PbYHc5QYO8tBGTF_b3CDB5M_UtA")
SUPPORTED_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"]

# ----------------- DATABASE INITIALIZATION -----------------
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    # 1. Users table
    c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL,
        year_title TEXT NOT NULL,
        department TEXT NOT NULL,
        points INTEGER DEFAULT 10,
        tier TEXT DEFAULT 'Novice',
        badge TEXT DEFAULT '🥉',
        avatar TEXT DEFAULT '🧑‍🎓',
        created_at TEXT NOT NULL
    )
    ''')

    # 2. Questions table
    c.execute('''
    CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL,
        author_year_title TEXT,
        subject_id TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        visibility TEXT DEFAULT 'public',
        mode TEXT DEFAULT 'mentor',
        is_resolved INTEGER DEFAULT 0,
        resolved_by TEXT,
        best_fit_answer_id TEXT,
        created_at TEXT NOT NULL
    )
    ''')

    # Add resolved_by column if missing
    try:
        c.execute("ALTER TABLE questions ADD COLUMN resolved_by TEXT")
    except sqlite3.OperationalError:
        pass

    # 3. Answers table
    c.execute('''
    CREATE TABLE IF NOT EXISTS answers (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        author_id TEXT,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL,
        author_tier TEXT DEFAULT 'Novice',
        author_badge TEXT DEFAULT '🥉',
        content TEXT NOT NULL,
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        is_best_fit INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    ''')

    # 4. Answer Votes table (Enforces 1 vote per user per answer)
    c.execute('''
    CREATE TABLE IF NOT EXISTS answer_votes (
        id TEXT PRIMARY KEY,
        answer_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        vote_type INTEGER NOT NULL, -- 1 for upvote, -1 for downvote
        created_at TEXT NOT NULL,
        UNIQUE(answer_id, user_id)
    )
    ''')

    # 5. Answer Feedback & Ratings table (1-5 stars + reviews)
    c.execute('''
    CREATE TABLE IF NOT EXISTS answer_feedback (
        id TEXT PRIMARY KEY,
        answer_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TEXT NOT NULL
    )
    ''')

    # Seed Default Users if empty
    c.execute("SELECT COUNT(*) FROM users")
    if c.fetchone()[0] == 0:
        seed_users = [
            ("user-junior-1", "Rohan Sharma", "rohan@college.edu", "password123", "Junior Student", "1st Year", "Computer Science", 20, "Novice", "🥉", "🧑‍🎓"),
            ("user-senior-3rd", "Aarav Mehta", "aarav@college.edu", "password123", "Senior Mentor", "3rd Year", "Computer Science", 580, "Grandmaster", "👑", "👨‍💻"),
            ("user-faculty-1", "Dr. Sunita Rao", "sunita@university.edu", "password123", "Faculty Member", "Associate Professor", "Computer Science", 420, "Master", "🥇", "👩‍🏫")
        ]
        for uid, name, email, pwd, role, yr, dept, pts, tier, bdg, av in seed_users:
            salt = secrets.token_hex(16)
            pwd_hash = hashlib.pbkdf2_hmac('sha256', pwd.encode(), salt.encode(), 100000).hex()
            c.execute('''
            INSERT INTO users (id, name, email, password_hash, salt, role, year_title, department, points, tier, badge, avatar, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ''', (uid, name, email, pwd_hash, salt, role, yr, dept, pts, tier, bdg, av))

    # Seed Default Questions & Answers if empty
    c.execute("SELECT COUNT(*) FROM questions")
    if c.fetchone()[0] == 0:
        c.execute('''
        INSERT INTO questions (id, author_id, author_name, author_role, author_year_title, subject_id, subject_name, title, description, visibility, mode, is_resolved, resolved_by, best_fit_answer_id, created_at)
        VALUES ('q-101', 'user-junior-1', 'Ananya Gupta', 'Junior Student', '2nd Year', 'cs', 'Computer Science', 
        'What is the key difference between Dijkstra and A* Search Algorithm?', 
        'I am preparing for algorithms exam. Both find the shortest path, but how does the heuristic function in A* actually change the search space compared to Dijkstra greedy traversal?', 
        'public', 'mentor', 1, 'user-junior-1', 'ans-201', datetime('now'))
        ''')

        c.execute('''
        INSERT INTO answers (id, question_id, author_id, author_name, author_role, author_tier, author_badge, content, upvotes, downvotes, is_best_fit, is_verified, created_at)
        VALUES ('ans-201', 'q-101', 'user-senior-3rd', 'Aarav Mehta', 'Senior Mentor (3rd Year)', 'Grandmaster', '👑',
        'Dijkstra is essentially a special case of A* where the heuristic function h(n) = 0 for all nodes. Dijkstra expands nodes radially in all directions based purely on path cost g(n) from start.\n\nIn contrast, A* uses f(n) = g(n) + h(n), where h(n) is an admissible heuristic estimating distance to target. This pulls the search frontier directly towards the goal, drastically pruning unpromising branches!',
        24, 0, 1, 1, datetime('now'))
        ''')

        c.execute('''
        INSERT INTO answers (id, question_id, author_id, author_name, author_role, author_tier, author_badge, content, upvotes, downvotes, is_best_fit, is_verified, created_at)
        VALUES ('ans-202', 'q-101', 'user-faculty-1', 'Dr. Sunita Rao', 'Faculty (Associate Professor)', 'Master', '🥇',
        'From a theoretical perspective, when h(n) is consistent (monotone), A* is guaranteed to find an optimal solution without reopening any closed nodes. Dijkstra achieves this with uniform-cost progression, but lacks directional guidance.',
        14, 0, 0, 1, datetime('now'))
        ''')

        c.execute('''
        INSERT INTO questions (id, author_id, author_name, author_role, author_year_title, subject_id, subject_name, title, description, visibility, mode, is_resolved, resolved_by, best_fit_answer_id, created_at)
        VALUES ('q-102', 'user-junior-1', 'Kabir Singh', 'Junior Student', '1st Year', 'math', 'Mathematics', 
        'Intuitive explanation of Eigenvalues and Eigenvectors in Linear Algebra?', 
        'I can calculate det(A - lambda*I) = 0 algebraically, but geometrically what does it actually represent during coordinate transformations?', 
        'public', 'mentor', 1, 'user-junior-1', 'ans-203', datetime('now'))
        ''')

        c.execute('''
        INSERT INTO answers (id, question_id, author_id, author_name, author_role, author_tier, author_badge, content, upvotes, downvotes, is_best_fit, is_verified, created_at)
        VALUES ('ans-203', 'q-102', 'user-faculty-1', 'Dr. Sunita Rao', 'Faculty (Associate Professor)', 'Master', '🥇',
        'Geometrically, when a matrix transformation acts on space, most vectors get rotated and knocked off their original span.\n\nAn Eigenvector is a special non-zero vector whose direction remains completely unchanged—it only gets scaled (stretched, shrunk, or flipped). The Eigenvalue (λ) is the exact scalar factor by which that eigenvector stretches: A · v = λ · v.',
        31, 0, 1, 1, datetime('now'))
        ''')

    conn.commit()
    conn.close()

# ----------------- BACKEND AI ENGINE WITH MULTI-KEY FALLBACK -----------------
def execute_gemini_call(api_key, model, prompt, system_instruction=""):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
    
    data_bytes = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data_bytes, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=12) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['candidates'][0]['content']['parts'][0]['text']

def call_gemini_fallback(prompt, system_instruction=""):
    keys = []
    if GEMINI_PRIMARY_KEY:
        keys.append(("primary", GEMINI_PRIMARY_KEY))
    if GEMINI_SECONDARY_KEY:
        keys.append(("secondary", GEMINI_SECONDARY_KEY))

    for key_type, key in keys:
        for model in SUPPORTED_MODELS:
            try:
                text = execute_gemini_call(key, model, prompt, system_instruction)
                return {"success": True, "text": text, "source": f"{key_type} ({model})"}
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    print(f"Key [{key_type.upper()}] quota exhausted (HTTP 429). Switching to next key...")
                    break # break model loop, switch to next key
                else:
                    print(f"Model {model} returned HTTP {e.code}: {e.reason}")
            except Exception as e:
                print(f"Gemini call error on {model}: {e}")

    # Offline Heuristic Fallback
    return {"success": True, "text": offline_academic_heuristic(prompt), "source": "offline-heuristic"}

def offline_academic_heuristic(prompt):
    p = prompt.lower()
    if "dijkstra" in p or "a*" in p or "algorithm" in p:
        return """### Core Concept Breakdown
Dijkstra's Algorithm and A* Search are both graph traversal algorithms that find the shortest path from a start node to destinations.

**1. Dijkstra's Algorithm (Uniform Cost):**
- Explores outward equally in all directions based purely on actual cost from start: g(n).
- Guaranteed to find the optimal path in graphs with non-negative edge weights.

**2. A* Search Algorithm (Heuristic-Guided):**
- Guided by evaluation function: f(n) = g(n) + h(n), where h(n) is an admissible heuristic estimating distance to target.
- Prunes unpromising search paths, reaching the goal significantly faster than Dijkstra.

**Key Exam Takeaway:**
Dijkstra is mathematically identical to A* when the heuristic function h(n) = 0 for all nodes."""
    elif "eigen" in p or "matrix" in p or "algebra" in p:
        return """### Core Concept Breakdown
In Linear Algebra, when a matrix transformation acts on vectors, most vectors rotate and change direction.

**1. Eigenvector (v):**
A non-zero vector whose direction remains completely invariant under linear transformation A. It is only stretched, shrunk, or flipped.

**2. Eigenvalue (λ):**
The scalar multiplier determining by how much the eigenvector scales:
$$A \\cdot v = \\lambda \\cdot v$$

**Key Exam Takeaway:**
To find eigenvalues, solve the characteristic polynomial: $\\det(A - \\lambda I) = 0$."""
    else:
        return """### Academic Explanation
1. **Definition & Context**: This question addresses core conceptual principles in your academic coursework.
2. **Analysis**: Review the foundational definitions and boundary conditions governing this problem.
3. **Key Takeaway**: Ensure you verify edge cases and formulate step-by-step proofs for exam presentation."""

# ----------------- HTTP REQUEST HANDLER -----------------
class ForumHandler(SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        try:
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(length).decode('utf-8')
        body = json.loads(post_data) if post_data else {}

        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        # 1. SIGNUP
        if parsed.path == '/api/auth/signup':
            name = body.get('name', '').strip()
            email = body.get('email', '').strip().lower()
            password = body.get('password', '')
            role = body.get('role', 'Junior Student')
            year_title = body.get('yearOrTitle', '1st Year')
            department = body.get('department', 'Computer Science')

            if not name or not email or not password:
                conn.close()
                return self.send_json({'success': False, 'error': 'Name, email, and password are required.'}, 400)

            c.execute("SELECT id FROM users WHERE email = ?", (email,))
            if c.fetchone():
                conn.close()
                return self.send_json({'success': False, 'error': 'An account with this email already exists.'}, 409)

            uid = "user-" + secrets.token_hex(6)
            salt = secrets.token_hex(16)
            pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()

            is_faculty = 'Faculty' in role
            is_senior = 'Senior' in role
            tier = 'Master' if is_faculty else ('Expert' if is_senior else 'Novice')
            badge = '🥇 Master' if is_faculty else ('🥈 Expert' if is_senior else 'Junior')
            avatar = '👩‍🏫' if is_faculty else ('👨‍💻' if is_senior else '🧑‍🎓')
            points = 300 if is_faculty else (150 if is_senior else 20)

            c.execute('''
            INSERT INTO users (id, name, email, password_hash, salt, role, year_title, department, points, tier, badge, avatar, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ''', (uid, name, email, pwd_hash, salt, role, year_title, department, points, tier, badge, avatar))
            conn.commit()

            user_obj = {
                'id': uid, 'name': name, 'email': email, 'role': role,
                'yearOrTitle': year_title, 'department': department,
                'points': points, 'tier': tier, 'badge': badge, 'avatar': avatar,
                'type': 'faculty' if is_faculty else ('senior' if is_senior else 'junior')
            }
            conn.close()
            return self.send_json({'success': True, 'user': user_obj})

        # 2. LOGIN
        elif parsed.path == '/api/auth/login':
            email = body.get('email', '').strip().lower()
            password = body.get('password', '')

            c.execute("SELECT id, name, email, password_hash, salt, role, year_title, department, points, tier, badge, avatar FROM users WHERE email = ?", (email,))
            row = c.fetchone()
            if not row:
                conn.close()
                return self.send_json({'success': False, 'error': 'Invalid email or password.'}, 401)

            uid, name, uemail, pwd_hash, salt, role, yr, dept, pts, tier, bdg, av = row
            check_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()

            if check_hash != pwd_hash:
                conn.close()
                return self.send_json({'success': False, 'error': 'Invalid email or password.'}, 401)

            user_obj = {
                'id': uid, 'name': name, 'email': uemail, 'role': role,
                'yearOrTitle': yr, 'department': dept, 'points': pts,
                'tier': tier, 'badge': bdg, 'avatar': av,
                'type': 'faculty' if 'Faculty' in role else ('senior' if 'Senior' in role else 'junior')
            }
            conn.close()
            return self.send_json({'success': True, 'user': user_obj})

        # 3. CREATE QUESTION
        elif parsed.path == '/api/questions':
            title = body.get('title', '').strip()
            if not title:
                conn.close()
                return self.send_json({'success': False, 'error': 'Title is required.'}, 400)

            qid = body.get('id') or ("q-" + secrets.token_hex(6))
            author = body.get('author', {})
            c.execute('''
            INSERT INTO questions (id, author_id, author_name, author_role, author_year_title, subject_id, subject_name, title, description, visibility, mode, is_resolved, resolved_by, best_fit_answer_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ''', (
                qid, author.get('id', ''), author.get('name', 'Student'), author.get('role', 'Student'),
                author.get('yearOrTitle', ''), body.get('subjectId', 'cs'), body.get('subjectName', 'Computer Science'),
                title, body.get('description', ''), body.get('visibility', 'public'),
                body.get('mode', 'mentor'), 0, None, None
            ))
            conn.commit()
            conn.close()
            return self.send_json({'success': True, 'id': qid})

        # 4. RESOLVE QUESTION (Only author, senior, or faculty allowed)
        elif parsed.path == '/api/questions/resolve':
            qid = body.get('questionId')
            user_id = body.get('userId')
            user_role = body.get('userRole', '')

            c.execute("SELECT author_id, is_resolved FROM questions WHERE id = ?", (qid,))
            row = c.fetchone()
            if not row:
                conn.close()
                return self.send_json({'success': False, 'error': 'Question not found.'}, 404)

            author_id, current_resolved = row
            # Permission check: Author or Senior/Faculty
            can_resolve = (user_id == author_id) or ('Senior' in user_role) or ('Faculty' in user_role)
            if not can_resolve:
                conn.close()
                return self.send_json({'success': False, 'error': 'Only the question author or faculty/mentors can mark resolved.'}, 403)

            if 'targetStatus' in body:
                new_status = 1 if body['targetStatus'] else 0
            else:
                new_status = 0 if current_resolved else 1
            c.execute("UPDATE questions SET is_resolved = ?, resolved_by = ? WHERE id = ?", (new_status, user_id if new_status else None, qid))
            conn.commit()
            conn.close()
            return self.send_json({'success': True, 'isResolved': bool(new_status)})

        # 5. CREATE ANSWER
        elif parsed.path == '/api/answers':
            content = body.get('content', '').strip()
            qid = body.get('questionId')
            if not content or not qid:
                conn.close()
                return self.send_json({'success': False, 'error': 'Content and questionId are required.'}, 400)

            ans_id = body.get('id') or ("ans-" + secrets.token_hex(6))
            author = body.get('author', {})
            c.execute('''
            INSERT INTO answers (id, question_id, author_id, author_name, author_role, author_tier, author_badge, content, upvotes, downvotes, is_best_fit, is_verified, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, datetime('now'))
            ''', (
                ans_id, qid, author.get('id') or body.get('authorId', ''),
                author.get('name') or body.get('authorName', 'Mentor'),
                author.get('role') or body.get('authorRole', 'Mentor'),
                author.get('tier') or body.get('authorTier', 'Novice'),
                author.get('badge') or body.get('authorBadge', '🥉'),
                content
            ))
            # Answers are posted to discussion; question resolution is controlled explicitly by author/mentor
            conn.commit()
            conn.close()
            return self.send_json({'success': True, 'id': ans_id})

        # 6. VOTE ANSWER WITH DUPLICATE PREVENTION
        elif parsed.path == '/api/answers/vote':
            ans_id = body.get('answerId')
            delta = int(body.get('delta', 1))
            user_id = body.get('userId', 'anonymous')

            c.execute("SELECT id, vote_type FROM answer_votes WHERE answer_id = ? AND user_id = ?", (ans_id, user_id))
            existing_vote = c.fetchone()

            vote_target_type = 1 if delta > 0 else -1

            if existing_vote:
                vote_id, prev_type = existing_vote
                if prev_type == vote_target_type:
                    # Clicking same vote removes it (toggle unvote)
                    c.execute("DELETE FROM answer_votes WHERE id = ?", (vote_id,))
                    if prev_type == 1:
                        c.execute("UPDATE answers SET upvotes = MAX(0, upvotes - 1) WHERE id = ?", (ans_id,))
                    else:
                        c.execute("UPDATE answers SET downvotes = MAX(0, downvotes - 1) WHERE id = ?", (ans_id,))
                    pts_delta = -10 if prev_type == 1 else 5
                else:
                    # Changing from upvote to downvote or vice versa
                    c.execute("UPDATE answer_votes SET vote_type = ? WHERE id = ?", (vote_target_type, vote_id))
                    if vote_target_type == 1:
                        c.execute("UPDATE answers SET upvotes = upvotes + 1, downvotes = MAX(0, downvotes - 1) WHERE id = ?", (ans_id,))
                        pts_delta = 15
                    else:
                        c.execute("UPDATE answers SET upvotes = MAX(0, upvotes - 1), downvotes = downvotes + 1 WHERE id = ?", (ans_id,))
                        pts_delta = -15
            else:
                # Fresh vote
                vote_id = "v-" + secrets.token_hex(6)
                c.execute("INSERT INTO answer_votes (id, answer_id, user_id, vote_type, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
                          (vote_id, ans_id, user_id, vote_target_type))
                if vote_target_type == 1:
                    c.execute("UPDATE answers SET upvotes = upvotes + 1 WHERE id = ?", (ans_id,))
                    pts_delta = 10
                else:
                    c.execute("UPDATE answers SET downvotes = downvotes + 1 WHERE id = ?", (ans_id,))
                    pts_delta = -5

            # Recalculate author Kaggle points and tier
            c.execute("SELECT author_id, upvotes, downvotes FROM answers WHERE id = ?", (ans_id,))
            ans_row = c.fetchone()
            if ans_row and ans_row[0]:
                author_id = ans_row[0]
                c.execute("UPDATE users SET points = MAX(0, points + ?) WHERE id = ?", (pts_delta, author_id))
                c.execute("SELECT points FROM users WHERE id = ?", (author_id,))
                pts = c.fetchone()[0]
                new_tier = 'Grandmaster' if pts >= 500 else ('Master' if pts >= 200 else ('Expert' if pts >= 50 else 'Novice'))
                new_badge = '👑' if pts >= 500 else ('🥇' if pts >= 200 else ('🥈' if pts >= 50 else '🥉'))
                c.execute("UPDATE users SET tier = ?, badge = ? WHERE id = ?", (new_tier, new_badge, author_id))

            conn.commit()
            upvotes = ans_row[1] if ans_row else 0
            downvotes = ans_row[2] if ans_row else 0
            conn.close()
            return self.send_json({'success': True, 'upvotes': upvotes, 'downvotes': downvotes})

        # 7. SUBMIT ANSWER FEEDBACK / RATING
        elif parsed.path == '/api/answers/feedback':
            ans_id = body.get('answerId')
            user_id = body.get('userId', 'student')
            user_name = body.get('userName', 'Student')
            rating = int(body.get('rating', 5))
            comment = body.get('comment', '').strip()

            if rating < 1 or rating > 5:
                conn.close()
                return self.send_json({'success': False, 'error': 'Rating must be between 1 and 5.'}, 400)

            fid = "fb-" + secrets.token_hex(6)
            c.execute("INSERT INTO answer_feedback (id, answer_id, user_id, user_name, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
                      (fid, ans_id, user_id, user_name, rating, comment))
            conn.commit()
            conn.close()
            return self.send_json({'success': True, 'id': fid})

        # 8. BEST-FIT ANSWER
        elif parsed.path == '/api/questions/best-fit':
            qid = body.get('questionId')
            ans_id = body.get('answerId')
            c.execute("UPDATE questions SET best_fit_answer_id = ? WHERE id = ?", (ans_id, qid))
            c.execute("UPDATE answers SET is_best_fit = (id = ?) WHERE question_id = ?", (ans_id, qid))
            c.execute("SELECT author_id FROM answers WHERE id = ?", (ans_id,))
            row = c.fetchone()
            if row and row[0]:
                c.execute("UPDATE users SET points = points + 30 WHERE id = ?", (row[0],))
            conn.commit()
            conn.close()
            return self.send_json({'success': True})

        # 9. BACKEND AI: CHATBOT INSTANT ANSWER (Protects API Keys on Server)
        elif parsed.path == '/api/ai/chat':
            subject = body.get('subject', 'Academic')
            title = body.get('title', '').strip()
            desc = body.get('description', '').strip()

            if not title:
                conn.close()
                return self.send_json({'success': False, 'error': 'Question title is required.'}, 400)

            prompt = f"""You are a university academic mentor helping a student with a doubt in {subject}.
Question: {title}
Details: {desc or "None provided"}

Provide a clear, pedagogical, step-by-step academic explanation:
1. Core Concept Definition
2. Intuitive Step-by-Step Breakdown
3. Mathematical Formula or Code Example
4. Key Exam/Concept Takeaway. Keep it structured, crisp, and student-friendly."""

            result = call_gemini_fallback(prompt, "You are a university academic professor and expert tutor.")
            conn.close()
            return self.send_json({
                'success': True,
                'answer': result['text'],
                'text': result['text'],
                'source': result['source'],
                'model': result.get('model', 'gemini-3.5-flash')
            })

        # 10. BACKEND AI: SIMILAR DOUBTS DETECTION
        elif parsed.path == '/api/ai/similar-doubts':
            title = body.get('title', '').strip()
            desc = body.get('description', '').strip()
            subject_id = body.get('subjectId', 'all')

            if not title or len(title) < 5:
                conn.close()
                return self.send_json({'success': True, 'hasSimilar': False, 'matches': []})

            c.execute("SELECT id, title, description, subject_id, subject_name, is_resolved FROM questions")
            all_questions = [dict(zip(['id', 'title', 'description', 'subjectId', 'subjectName', 'isResolved'], r)) for r in c.fetchall()]
            conn.close()

            if not all_questions:
                return self.send_json({'success': True, 'hasSimilar': False, 'matches': []})

            # Fast local pre-filter
            input_words = set([w.lower() for w in title.split() if len(w) > 3])
            candidates = []
            for q in all_questions:
                q_words = set([w.lower() for w in (q['title'] + " " + (q['description'] or "")).split() if len(w) > 3])
                overlap = len(input_words.intersection(q_words))
                if overlap > 0 or (subject_id != 'all' and q['subjectId'] == subject_id):
                    candidates.append(q)

            if not candidates:
                return self.send_json({'success': True, 'hasSimilar': False, 'matches': []})

            candidate_summaries = "\n".join([f"- [{q['id']}] {q['title']} (Subject: {q['subjectName']})" for q in candidates[:6]])
            ai_prompt = f"""Student is asking: "{title}"
Existing questions in database:
{candidate_summaries}

Task: Find if any existing questions are semantically asking the same or very similar academic doubt.
Respond with ONLY valid JSON:
{{
  "hasSimilar": true,
  "matches": [
    {{
      "id": "<id of match>",
      "similarity": <integer 50-100>,
      "reason": "<1-sentence why they are similar>"
    }}
  ]
}}
If no questions are at least 50% similar, respond with:
{{"hasSimilar": false, "matches": []}}"""

            ai_res = call_gemini_fallback(ai_prompt, "You are an academic similarity search engine.")
            try:
                raw_text = ai_res['text']
                json_start = raw_text.find('{')
                json_end = raw_text.rfind('}') + 1
                if json_start != -1 and json_end > json_start:
                    parsed_match = json.loads(raw_text[json_start:json_end])
                    # Enrich matches with question details
                    for m in parsed_match.get('matches', []):
                        target = next((q for q in all_questions if q['id'] == m['id']), None)
                        if target:
                            m['title'] = target['title']
                            m['isResolved'] = target['isResolved']
                            m['subjectName'] = target['subjectName']
                        if 'similarity' in m and 'similarityScore' not in m:
                            m['similarityScore'] = m['similarity']
                    parsed_match['success'] = True
                    return self.send_json(parsed_match)
            except Exception as e:
                print(f"Similarity JSON parse fallback: {e}")

            # Heuristic keyword match fallback
            heuristic_matches = []
            for q in candidates:
                q_words = set([w.lower() for w in (q['title'] + " " + (q['description'] or "")).split() if len(w) > 3])
                overlap = len(input_words.intersection(q_words))
                if overlap >= 2:
                    score = min(95, 50 + overlap * 15)
                    heuristic_matches.append({
                        'id': q['id'],
                        'title': q['title'],
                        'isResolved': q['isResolved'],
                        'subjectName': q['subjectName'],
                        'similarityScore': score,
                        'similarity': score,
                        'reason': 'High conceptual and keyword overlap found in database doubt'
                    })
            if heuristic_matches:
                return self.send_json({'success': True, 'hasSimilar': True, 'matches': heuristic_matches})

            return self.send_json({'success': True, 'hasSimilar': False, 'matches': []})

        # 11. BACKEND AI: ANALYZE BEST-FIT ANSWER
        elif parsed.path == '/api/ai/analyze-answers':
            qid = body.get('questionId')
            c.execute("SELECT title FROM questions WHERE id = ?", (qid,))
            q_row = c.fetchone()
            if not q_row:
                conn.close()
                return self.send_json({'success': False, 'error': 'Question not found'}, 404)

            q_title = q_row[0]
            c.execute("SELECT id, author_name, author_role, content, upvotes FROM answers WHERE question_id = ?", (qid,))
            ans_rows = c.fetchall()
            conn.close()

            if not ans_rows:
                return self.send_json({'success': False, 'error': 'No answers to analyze'}, 400)

            if len(ans_rows) == 1:
                return self.send_json({
                    'success': True,
                    'bestAnswerId': ans_rows[0][0],
                    'explanation': 'Single verified answer accepted as top solution.'
                })

            answers_formatted = "\n\n---\n\n".join([f"[Answer ID: {r[0]}] by {r[1]} ({r[2]}, +{r[4]} Upvotes):\n{r[3]}" for r in ans_rows])
            prompt = f"""Academic Question: "{q_title}"
Compare the following answers submitted by community mentors:

{answers_formatted}

Determine which Answer ID provides the most conceptually accurate, comprehensive, and clear explanation.
Return ONLY valid JSON:
{{
  "bestAnswerId": "<id>",
  "explanation": "<2-sentence rationale on why this was selected as the best solution>"
}}"""

            ai_res = call_gemini_fallback(prompt, "You are a senior academic grading chair.")
            try:
                raw_text = ai_res['text']
                json_start = raw_text.find('{')
                json_end = raw_text.rfind('}') + 1
                if json_start != -1 and json_end > json_start:
                    parsed_res = json.loads(raw_text[json_start:json_end])
                    # Persist best fit in DB
                    conn = sqlite3.connect(DB_FILE)
                    c = conn.cursor()
                    c.execute("UPDATE questions SET best_fit_answer_id = ? WHERE id = ?", (parsed_res['bestAnswerId'], qid))
                    c.execute("UPDATE answers SET is_best_fit = (id = ?) WHERE question_id = ?", (parsed_res['bestAnswerId'], qid))
                    conn.commit()
                    conn.close()
                    return self.send_json({'success': True, 'bestAnswerId': parsed_res['bestAnswerId'], 'explanation': parsed_res['explanation']})
            except Exception as e:
                print(f"Analyze answers parse error: {e}")

            # Heuristic fallback: highest upvotes
            best_ans = max(ans_rows, key=lambda r: r[4])
            return self.send_json({
                'success': True,
                'bestAnswerId': best_ans[0],
                'explanation': f"Selected based on highest community consensus (+{best_ans[4]} upvotes)."
            })

        conn.close()
        return self.send_json({'error': 'Not found'}, 404)

    def do_GET(self):
        parsed = urlparse(self.path)

        # 1. DB Status
        if parsed.path == '/api/db/status':
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM users")
            user_count = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM questions")
            question_count = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM answers")
            answer_count = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM answer_votes")
            vote_count = c.fetchone()[0]
            conn.close()
            return self.send_json({
                'status': 'connected',
                'database': 'academic_forum.db',
                'engine': 'Relational ACID Database (Persistent SQL)',
                'security': 'PBKDF2-HMAC-SHA256 (100k rounds + Cryptographic Salt)',
                'stats': {
                    'users': user_count,
                    'questions': question_count,
                    'answers': answer_count,
                    'votes': vote_count
                }
            })

        # 2. Questions with nested answers and feedback ratings
        elif parsed.path == '/api/questions':
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            
            c.execute("SELECT * FROM questions ORDER BY created_at DESC")
            questions = [dict(row) for row in c.fetchall()]

            c.execute("SELECT * FROM answers ORDER BY created_at ASC")
            answers = [dict(row) for row in c.fetchall()]

            c.execute("SELECT answer_id, AVG(rating) as avg_rating, COUNT(id) as count FROM answer_feedback GROUP BY answer_id")
            ratings = {r['answer_id']: {'avg': round(r['avg_rating'], 1), 'count': r['count']} for r in c.fetchall()}
            conn.close()

            for q in questions:
                q['author'] = {
                    'id': q['author_id'],
                    'name': q['author_name'],
                    'role': q['author_role'],
                    'yearOrTitle': q['author_year_title']
                }
                q['isResolved'] = bool(q['is_resolved'])
                q['resolvedBy'] = q.get('resolved_by')
                q['subjectId'] = q['subject_id']
                q['subjectName'] = q['subject_name']
                q['bestFitAnswerId'] = q['best_fit_answer_id']
                q['createdAt'] = q['created_at']

            for a in answers:
                a['questionId'] = a['question_id']
                a['authorId'] = a['author_id']
                a['authorName'] = a['author_name']
                a['authorRole'] = a['author_role']
                a['authorTier'] = a['author_tier']
                a['authorBadge'] = a['author_badge']
                a['isBestFit'] = bool(a['is_best_fit'])
                a['isVerified'] = bool(a['is_verified'])
                a['createdAt'] = a['created_at']
                rating_info = ratings.get(a['id'], {'avg': 0, 'count': 0})
                a['avgRating'] = rating_info['avg']
                a['ratingCount'] = rating_info['count']

            return self.send_json({'questions': questions, 'answers': answers})

        # 3. Mentors Leaderboard
        elif parsed.path == '/api/mentors':
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT id, name, role, year_title as yearOrTitle, department, points, tier, badge, avatar FROM users ORDER BY points DESC")
            mentors = [dict(row) for row in c.fetchall()]
            conn.close()
            return self.send_json({'mentors': mentors})

        # 4. Answer feedback list
        elif parsed.path == '/api/answers/feedback':
            query = parse_qs(parsed.query)
            ans_id = query.get('answerId', [''])[0]
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT * FROM answer_feedback WHERE answer_id = ? ORDER BY created_at DESC", (ans_id,))
            feedbacks = [dict(row) for row in c.fetchall()]
            conn.close()
            return self.send_json({'feedback': feedbacks})

        # Static files fallback
        super().do_GET()

if __name__ == '__main__':
    init_db()
    print(f"SmartDoubt Database Initialized: {DB_FILE}")
    server = ThreadingHTTPServer(('0.0.0.0', PORT), ForumHandler)
    print(f"SmartDoubt Full-Stack Server running at http://localhost:{PORT}")
    server.serve_forever()
