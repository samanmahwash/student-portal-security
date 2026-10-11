
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000";

const modules = [
  {
    id: "xss",
    title: "Cross-Site Scripting",
    short: "XSS",
    description: "Reflected, stored and DOM-based injection"
  },
  {
    id: "csrf",
    title: "Cross-Site Request Forgery",
    short: "CSRF",
    description: "Test forged requests against a state-changing action"
  },
  {
    id: "sql",
    title: "SQL Injection",
    short: "SQLi",
    description: "Explore easy, intermediate and advanced SQL injection"
  }
];

function App() {
  const [mode, setMode] = useState("safe");
  const [activeModule, setActiveModule] = useState("xss");
  const [xssType, setXssType] = useState("reflected");
  const [apiStatus, setApiStatus] = useState("Checking...");
  const [payload, setPayload] = useState("<img src=x onerror=alert('XSS')>");
  const [comment, setComment] = useState("");
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [selectedPost, setSelectedPost] = useState("1");
  const [sqlQuery, setSqlQuery] = useState("demo");
  const [sqlStage, setSqlStage] = useState("easy");
  const [sqlAdvancedLevel, setSqlAdvancedLevel] = useState("columns");
  const [csrfEmail, setCsrfEmail] = useState("changed-by-lab@example.com");
  const [csrfToken, setCsrfToken] = useState("");
  const [csrfSessionReady, setCsrfSessionReady] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const vulnerable = mode === "vulnerable";

  useEffect(() => {
    fetch(`${API}/`)
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json();
      })
      .then(() => setApiStatus("Connected"))
      .catch(() => setApiStatus("Offline"));
  }, []);

  useEffect(() => {
    fetch(`${API}/api/posts`)
      .then((response) => response.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]));
  }, []);

  async function loadComments(postId = selectedPost) {
    try {
      const response = await fetch(`${API}/api/posts/${postId}/comments`);
      const data = await response.json();
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Could not load comments. Check that the backend is running.");
    }
  }

  useEffect(() => {
    loadComments(selectedPost);
  }, [selectedPost]);

  function runReflectedTest() {
    setResult({ type: "reflected", value: payload });
    setMessage(
      vulnerable
        ? "Vulnerable rendering selected. Use only harmless lab payloads."
        : "Safe rendering selected. Input will be displayed as text."
    );
  }

  function runDomTest() {
    const hash = payload;
    window.history.replaceState(null, "", `#${encodeURIComponent(hash)}`);
    setResult({ type: "dom", value: hash });
    setMessage(
      vulnerable
        ? "Vulnerable DOM rendering selected."
        : "Safe DOM rendering selected."
    );
  }

  async function saveComment(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/posts/${selectedPost}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: comment })
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Comment could not be saved");
      }

      setComment("");
      await loadComments(selectedPost);
      setMessage("Comment saved to MySQL. Switch modes to compare rendering.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function createCsrfSession() {
    setBusy(true);
    setMessage("");
    setResult(null);
    setCsrfSessionReady(false);
    setCsrfToken("");

    try {
      const response = await fetch(`${API}/api/lab/csrf/session`, {
        method: "GET",
        credentials: "include"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create the lab session.");
      }

      if (!data.csrfToken) {
        throw new Error("The server did not return a CSRF token.");
      }

      setCsrfToken(data.csrfToken);
      setCsrfSessionReady(true);
      setMessage("Lab session created. You can now run the CSRF test.");
    } catch (error) {
      setMessage(`Session setup failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function runCsrfTest() {
    if (!csrfEmail.trim()) {
      setMessage("Enter a test email first.");
      return;
    }

    setBusy(true);
    setMessage("");
    setResult(null);

    try {
      const headers = { "Content-Type": "application/json" };

      if (!vulnerable) {
        if (!csrfSessionReady || !csrfToken) {
          throw new Error("Create a lab session first to obtain a CSRF token.");
        }
        headers["x-csrf-token"] = csrfToken;
      }

      const response = await fetch(`${API}/api/lab/csrf/change-email`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          email: csrfEmail.trim(),
          mode
        })
      });

      const data = await response.json();
      setResult({ type: "csrf", data, status: response.status });

      setMessage(
        response.ok
          ? `Request accepted in ${mode} mode.`
          : `Request rejected (${response.status}).`
      );
    } catch (error) {
      setMessage(error.message || "Could not connect to the CSRF endpoint.");
    } finally {
      setBusy(false);
    }
  }

  async function runInvalidCsrfTest() {
    if (!csrfSessionReady) {
      setMessage("Create a lab session first.");
      return;
    }

    setBusy(true);
    setMessage("");
    setResult(null);

    try {
      const response = await fetch(`${API}/api/lab/csrf/change-email`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": "invalid-token-for-testing"
        },
        body: JSON.stringify({
          email: csrfEmail.trim(),
          mode: "safe"
        })
      });

      const data = await response.json();
      setResult({ type: "csrf", data, status: response.status });

      setMessage(
        response.status === 403
          ? "PASS: Safe mode rejected the invalid CSRF token."
          : `FAIL: Expected HTTP 403, received HTTP ${response.status}.`
      );
    } catch {
      setMessage("Could not connect to the CSRF endpoint.");
    } finally {
      setBusy(false);
    }
  }

  async function runSqlTest(event) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    setMessage("");

    try {
      const params = new URLSearchParams({
        mode,
        q: sqlQuery,
        stage: sqlStage
      });

      if (sqlStage === "advanced") {
        params.set("level", sqlAdvancedLevel);
      }

      const response = await fetch(
        `${API}/api/lab/sql-search?${params.toString()}`
      );
      const data = await response.json();

      setResult({
        type: "sql",
        data,
        status: response.status
      });

      if (!response.ok) {
        setMessage(data.error || "The query was rejected.");
      } else {
        setMessage(`Request completed in ${mode} mode.`);
      }
    } catch {
      setMessage("Could not reach the backend. Start the server and retry.");
    } finally {
      setBusy(false);
    }
  }

  function renderXssOutput(value) {
    if (value == null) return null;

    if (vulnerable) {
      return (
        <div
          className="lab-output"
          dangerouslySetInnerHTML={{ __html: value }}
        />
      );
    }

    return <div className="lab-output">{value}</div>;
  }

  const active = modules.find((item) => item.id === activeModule);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">S</div>
          <div>
            <strong>SecureLab</strong>
            <span>Student Security Portal</span>
          </div>
        </div>

        <p className="nav-label">SECURITY LABS</p>

        {modules.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeModule === item.id ? "active" : ""}`}
            onClick={() => {
              setActiveModule(item.id);
              setResult(null);
              setMessage("");
            }}
          >
            <span className="nav-icon">{item.short}</span>
            <span>{item.title}</span>
          </button>
        ))}

        <div className="sidebar-bottom">
          <span
            className={`status-dot ${apiStatus === "Connected" ? "online" : ""}`}
          />
          API: {apiStatus}
          <p>Local educational environment</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">WEB APPLICATION SECURITY</p>
            <h1>{active.title}</h1>
            <p className="subtitle">{active.description}</p>
          </div>

          <div className="mode-control">
            <span>Test mode</span>
            <div className="mode-buttons">
              <button
                className={mode === "safe" ? "selected safe-selected" : ""}
                onClick={() => {
                  setMode("safe");
                  setResult(null);
                  setMessage("");
                }}
              >
                Safe
              </button>
              <button
                className={
                  mode === "vulnerable" ? "selected vulnerable-selected" : ""
                }
                onClick={() => {
                  setMode("vulnerable");
                  setResult(null);
                  setMessage("");
                }}
              >
                Vulnerable
              </button>
            </div>
          </div>
        </header>

        <div className={`mode-banner ${vulnerable ? "warning" : "protected"}`}>
          <strong>{vulnerable ? "Vulnerable lab mode" : "Safe mode"}</strong>
          <span>
            {vulnerable
              ? "Use only with the local seeded database. Never expose this mode publicly."
              : "Tests should use the protected implementation and reject unsafe input."}
          </span>
        </div>

        {activeModule === "xss" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">LAB 01</p>
                <h2>Cross-Site Scripting</h2>
              </div>
              <span className="tag">3 test types</span>
            </div>

            <div className="tabs">
              {["reflected", "stored", "dom"].map((type) => (
                <button
                  key={type}
                  className={xssType === type ? "tab active-tab" : "tab"}
                  onClick={() => {
                    setXssType(type);
                    setResult(null);
                    setMessage("");
                  }}
                >
                  {type === "dom"
                    ? "DOM-Based"
                    : type[0].toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {xssType === "reflected" && (
              <div className="lab-section">
                <h3>Reflected XSS</h3>
                <p>Submit text and compare how the selected mode displays it.</p>
                <label htmlFor="reflected-payload">Test input</label>
                <textarea
                  id="reflected-payload"
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  rows={3}
                />
                <button className="primary-button" onClick={runReflectedTest}>
                  Run reflected test
                </button>
                {result?.type === "reflected" && (
                  <div className="result-card">
                    <h4>Rendered output</h4>
                    {renderXssOutput(result.value)}
                  </div>
                )}
              </div>
            )}

            {xssType === "stored" && (
              <div className="lab-section">
                <h3>Stored XSS</h3>
                <p>Comments are saved in MySQL. Test how saved content is displayed.</p>
                <label htmlFor="post-select">Select post</label>
                <select
                  id="post-select"
                  value={selectedPost}
                  onChange={(event) => setSelectedPost(event.target.value)}
                >
                  {posts.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.title}
                    </option>
                  ))}
                  {posts.length === 0 && <option value="1">Post 1</option>}
                </select>

                <form onSubmit={saveComment}>
                  <label htmlFor="stored-comment">Comment content</label>
                  <textarea
                    id="stored-comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Enter a comment for the local lab"
                    rows={3}
                    required
                  />
                  <button className="primary-button" disabled={busy}>
                    {busy ? "Saving..." : "Save comment"}
                  </button>
                </form>

                <div className="result-card">
                  <div className="result-title">
                    <h4>Saved comments</h4>
                    <button
                      className="text-button"
                      onClick={() => loadComments()}
                    >
                      Refresh
                    </button>
                  </div>
                  {comments.map((item) => (
                    <div className="comment-item" key={item.id}>
                      <strong>{item.username}</strong>
                      {renderXssOutput(item.content)}
                    </div>
                  ))}
                  {comments.length === 0 && <p>No comments loaded yet.</p>}
                </div>
              </div>
            )}

            {xssType === "dom" && (
              <div className="lab-section">
                <h3>DOM-Based XSS</h3>
                <p>
                  This test puts the input in the URL fragment, then compares
                  unsafe HTML rendering with safe text rendering.
                </p>
                <label htmlFor="dom-payload">URL fragment input</label>
                <textarea
                  id="dom-payload"
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  rows={3}
                />
                <button className="primary-button" onClick={runDomTest}>
                  Run DOM test
                </button>
                {result?.type === "dom" && (
                  <div className="result-card">
                    <h4>DOM output</h4>
                    {renderXssOutput(result.value)}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {activeModule === "csrf" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">LAB 02</p>
                <h2>Cross-Site Request Forgery</h2>
              </div>
              <span className="tag">State-changing request</span>
            </div>

            <div className="lab-section">
              <h3>Change account email</h3>
              <p>
                Create a lab session first. Safe mode sends the session's CSRF
                token; Vulnerable mode intentionally omits that token for
                comparison.
              </p>

              <button
                className="primary-button"
                disabled={busy}
                onClick={createCsrfSession}
              >
                {busy ? "Please wait..." : "Create lab session"}
              </button>

              <div className="detail-row">
                <span>Lab session</span>
                <strong>{csrfSessionReady ? "Ready" : "Not created"}</strong>
              </div>

              <label htmlFor="csrf-email">New test email</label>
              <input
                id="csrf-email"
                type="email"
                value={csrfEmail}
                onChange={(event) => setCsrfEmail(event.target.value)}
                placeholder="Enter a test email"
                required
              />

              <div className="detail-row">
                <span>Current mode</span>
                <strong>{vulnerable ? "Vulnerable" : "Safe"}</strong>
              </div>

              <button
                className="primary-button"
                disabled={busy}
                onClick={runCsrfTest}
              >
                {busy ? "Sending request..." : "Send test request"}
              </button>

              <button
                className="primary-button"
                disabled={busy || !csrfSessionReady}
                onClick={runInvalidCsrfTest}
              >
                Test with Invalid CSRF Token
              </button>

              {result?.type === "csrf" && (
                <div className="result-card">
                  <h4>CSRF response · HTTP {result.status}</h4>
                  <pre>{JSON.stringify(result.data, null, 2)}</pre>
                </div>
              )}
            </div>
          </section>
        )}

        {activeModule === "sql" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">LAB 03</p>
                <h2>SQL Injection</h2>
              </div>
              <span className="tag">MySQL lab</span>
            </div>

            <div className="lab-section">
              <h3>Database search</h3>
              <p>
                Compare raw SQL construction with parameterized queries against
                the seeded demo users.
              </p>

              <label htmlFor="sql-stage">Demonstration stage</label>
              <select
                id="sql-stage"
                value={sqlStage}
                onChange={(event) => {
                  setSqlStage(event.target.value);
                  setResult(null);
                  setMessage("");
                }}
              >
                <option value="easy">Easy — input manipulation</option>
                <option value="intermediate">
                  Intermediate — query structure
                </option>
                <option value="advanced">
                  Advanced — columns, tables and data
                </option>
              </select>

              {sqlStage === "advanced" && (
                <>
                  <label htmlFor="sql-advanced-level">Advanced stage</label>
                  <select
                    id="sql-advanced-level"
                    value={sqlAdvancedLevel}
                    onChange={(event) => {
                      setSqlAdvancedLevel(event.target.value);
                      setResult(null);
                      setMessage("");
                    }}
                  >
                    <option value="columns">1. Columns</option>
                    <option value="tables">2. Tables</option>
                    <option value="data">3. Data</option>
                  </select>
                </>
              )}

              <form onSubmit={runSqlTest}>
                <label htmlFor="sql-query">Search input</label>
                <textarea
                  id="sql-query"
                  value={sqlQuery}
                  onChange={(event) => setSqlQuery(event.target.value)}
                  rows={3}
                  placeholder="Enter a search value"
                />
                <button className="primary-button" disabled={busy}>
                  {busy ? "Running..." : "Run SQL test"}
                </button>
              </form>

              {result?.type === "sql" && (
                <div className="result-card">
                  <h4>Backend response · HTTP {result.status}</h4>
                  <pre>{JSON.stringify(result.data, null, 2)}</pre>
                </div>
              )}
            </div>
          </section>
        )}

        {message && <div className="message-box">{message}</div>}

        <footer>
          Student Web Security Project · MySQL · Express · React
        </footer>
      </main>
    </div>
  );
}

export default App;
