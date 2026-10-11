
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { pool, connectDB } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

// Middleware
app.use(helmet());

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false
  })
);

// Lab-only vulnerable behavior. Disabled in production.
function isVulnerable(mode) {
  return (
    mode === "vulnerable" &&
    process.env.NODE_ENV !== "production"
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function getCookie(req, name) {
  const cookies = (req.headers.cookie || "").split(";");

  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");

    if (separator === -1) continue;

    const key = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }

  return null;
}

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "Student Portal Security API is running"
  });
});

// Load posts from MySQL
app.get("/api/posts", async (req, res) => {
  try {
    const [posts] = await pool.execute(`
      SELECT p.id, p.title, p.content, p.created_at, u.username
      FROM posts p
      JOIN users u ON u.id = p.author_id
      ORDER BY p.id DESC
    `);

    res.json(posts);
  } catch (error) {
    console.error("Posts query failed:", error.message);
    res.status(500).json({ error: "Could not load posts" });
  }
});

// Load comments from MySQL
app.get("/api/posts/:id/comments", async (req, res) => {
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId) || postId < 1) {
    return res.status(400).json({ error: "Invalid post ID" });
  }

  try {
    const [comments] = await pool.execute(
      `SELECT c.id, c.content, c.created_at, u.username
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id = ?
       ORDER BY c.id`,
      [postId]
    );

    res.json(comments);
  } catch (error) {
    console.error("Comments query failed:", error.message);
    res.status(500).json({ error: "Could not load comments" });
  }
});

// Save a comment to MySQL.
// built my student of fast cfd
app.post("/api/posts/:id/comments", async (req, res) => {
  const postId = Number(req.params.id);
  const content = String(req.body.content || "")
    .trim()
    .slice(0, 2000);

  if (!Number.isInteger(postId) || postId < 1 || !content) {
    return res.status(400).json({
      error: "A valid post ID and comment are required."
    });
  }

  try {
    const [posts] = await pool.execute(
      "SELECT id FROM posts WHERE id = ?",
      [postId]
    );

    if (!posts.length) {
      return res.status(404).json({ error: "Post not found" });
    }

    const [users] = await pool.execute(
      "SELECT id FROM users WHERE username = ?",
      ["demo_student"]
    );

    if (!users.length) {
      return res.status(400).json({ error: "Demo user not found" });
    }

    const [result] = await pool.execute(
      `INSERT INTO comments (post_id, author_id, content)
       VALUES (?, ?, ?)`,
      [postId, users[0].id, content]
    );

    res.status(201).json({
      id: result.insertId,
      postId,
      content,
      message: "Comment saved successfully"
    });
  } catch (error) {
    console.error("Comment submission failed:", error.message);
    res.status(500).json({ error: "Could not save comment" });
  }
});

// Reflected XSS demonstration
app.get("/api/lab/xss/reflected", (req, res) => {
  const vulnerable = isVulnerable(req.query.mode);
  const input = String(req.query.q || "").slice(0, 1000);
  const displayed = vulnerable ? input : escapeHtml(input);

  if (vulnerable) {
    res.removeHeader("Content-Security-Policy");
  }

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reflected XSS Lab</title>
</head>
<body>
<h1>Reflected XSS Lab</h1>
<p>Mode: ${vulnerable ? "Vulnerable" : "Safe"}</p>
<h2>Search result</h2>
<div>${displayed}</div>
</body>
</html>`);
});

// CSRF training sessions
// Demonstration only; these are not production authentication sessions.
const csrfSessions = new Map();

app.get("/api/lab/csrf/session", (req, res) => {
  const sessionId = crypto.randomBytes(24).toString("hex");
  const csrfToken = crypto.randomBytes(32).toString("hex");

  csrfSessions.set(sessionId, {
    csrfToken,
    email: "student@example.test"
  });

  res.cookie("lab_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60 * 1000
  });

  res.json({
    message: "Lab session created",
    email: "student@example.test",
    csrfToken
  });
});

// State-changing CSRF demonstration endpoint
app.post("/api/lab/csrf/change-email", (req, res) => {
  const requestedMode = req.query.mode || req.body.mode;

  // Safe is the default. Only an explicit vulnerable mode bypasses
  // token validation, and that mode is disabled in production.
  const vulnerable = isVulnerable(requestedMode);

  console.log("CSRF route reached");
  console.log("Requested mode:", requestedMode);
  console.log("Vulnerable mode:", vulnerable);

  const sessionId = getCookie(req, "lab_session");
  const session = csrfSessions.get(sessionId);

  if (!session) {
    return res.status(401).json({
      error: "Create a lab session first."
    });
  }

  const email = String(req.body.email || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: "Invalid email address"
    });
  }

  if (!vulnerable) {
    const origin = req.get("Origin");
    const suppliedToken = req.get("X-CSRF-Token");

    console.log("Safe validation reached");
    console.log("Origin matches:", origin === CLIENT_URL);
    console.log("Token received:", Boolean(suppliedToken));
    console.log(
      "Token matches session:",
      suppliedToken === session.csrfToken
    );

    if (origin !== CLIENT_URL) {
      return res.status(403).json({
        error: "Blocked: request origin is not trusted."
      });
    }

    if (
      typeof suppliedToken !== "string" ||
      suppliedToken.length === 0 ||
      suppliedToken !== session.csrfToken
    ) {
      return res.status(403).json({
        error: "Blocked: CSRF token is missing or invalid."
      });
    }
  }

  // State changes only after Safe mode validation passes.
  session.email = email;

  return res.json({
    mode: vulnerable ? "vulnerable" : "safe",
    message: "Email updated successfully",
    email: session.email
  });
});

// SQL Injection Lab
// Vulnerable mode intentionally concatenates SQL input.
// Safe mode uses parameterized queries.

app.get("/api/lab/sql-search", async (req, res) => {
  const mode = isVulnerable(req.query.mode)
    ? "vulnerable"
    : "safe";

  const stage = [
    "easy",
    "intermediate",
    "advanced"
  ].includes(req.query.stage)
    ? req.query.stage
    : "easy";

  const search = String(req.query.q || "").slice(0, 500);

  try {
    let rows = [];
    let sql;
    let params = [];

    if (stage === "easy") {
      // Easy: search by username.
      sql = `
        SELECT id, username, email, role
        FROM users
        WHERE username LIKE ?
      `;
      params = [`%${search}%`];
    } else if (stage === "intermediate") {
      // Intermediate: search by username or email.
      sql = `
        SELECT id, username, email, role
        FROM users
        WHERE username LIKE ? OR email LIKE ?
      `;
      params = [`%${search}%`, `%${search}%`];
    } else {
      // Advanced stages are selected through the q parameter.
      const advancedStage = req.query.level;

      if (advancedStage === "columns") {
        rows = [
          { column_name: "id" },
          { column_name: "username" },
          { column_name: "email" },
          { column_name: "role" }
        ];
      } else if (advancedStage === "tables") {
        sql = `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = DATABASE()
            AND table_name = ?
        `;
        params = ["users"];
      } else if (advancedStage === "data") {
        sql = `
          SELECT id, username, email, role
          FROM users
          WHERE username LIKE ?
        `;
        params = [`%${search}%`];
      } else {
        return res.status(400).json({
          mode,
          stage,
          error: "For Advanced mode, select a level: columns, tables, or data."
        });
      }
    }

    if (sql) {
      if (mode === "vulnerable" && stage !== "advanced") {
        // Intentionally unsafe construction for the local lab.
        if (stage === "easy") {
          sql = `
            SELECT id, username, email, role
            FROM users
            WHERE username LIKE '%${search}%'
          `;
        } else {
          sql = `
            SELECT id, username, email, role
            FROM users
            WHERE username LIKE '%${search}%'
               OR email LIKE '%${search}%'
          `;
        }

        console.log(`[SQLi Lab / ${stage}] Raw SQL: ${sql}`);
        [rows] = await pool.query(sql);
      } else {
        [rows] = await pool.execute(sql, params);
      }
    }

    res.json({
      mode,
      stage,
      level: req.query.level || null,
      count: rows.length,
      results: rows
    });
  } catch (error) {
    console.error("SQL lab query failed:", error.message);

    res.status(400).json({
      mode,
      stage,
      error:
        mode === "vulnerable"
          ? "The SQL query failed. Check the lab input and server log."
          : "The request could not be completed safely."
    });
  }
});

// Start after MySQL connects successfully
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

startServer();
