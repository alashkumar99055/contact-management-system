import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.BindException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.sql.SQLException;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Server {
    private int port;
    private final Path workspaceRoot;
    private final Database database;

    // ── In-memory session store ───────────────────────────────────────────────
    private final ConcurrentHashMap<String, String> sessions     = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> sessionUserId = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long>   sessionExpiry = new ConcurrentHashMap<>();

    private static final long SESSION_TTL_MS = 8 * 60 * 60 * 1000L; // 8 hours

    public Server(int port) throws SQLException {
        this.port          = port;
        this.workspaceRoot = resolveWorkspaceRoot();
        this.database      = createDatabase();
    }

    public int start() throws IOException {
        HttpServer httpServer = null;
        int tried = port;
        while (true) {
            try {
                httpServer = HttpServer.create(new InetSocketAddress("0.0.0.0", tried), 0);
                break;
            } catch (BindException e) {
                if (tried >= port + 10) throw e;
                tried++;
            }
        }
        this.port = tried;

        // ── Auth routes ───────────────────────────────────────────────────────
        httpServer.createContext("/api/register",   this::handleRegister);
        httpServer.createContext("/api/login",      this::handleLogin);
        httpServer.createContext("/api/logout",     this::handleLogout);
        httpServer.createContext("/api/me",         this::handleMe);

        // ── Task routes ───────────────────────────────────────────────────────
        httpServer.createContext("/api/tasks",      this::handleTaskRequests);

        // ── Category routes ───────────────────────────────────────────────────
        httpServer.createContext("/api/categories", this::handleCategoryRequests);

        // ── Root info ─────────────────────────────────────────────────────────
        httpServer.createContext("/",               this::serveApiInfo);

        httpServer.setExecutor(null);
        httpServer.start();
        return this.port;
    }

    // ── Session helpers ───────────────────────────────────────────────────────

    private String generateToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String createSession(String username, String userId) {
        String token = generateToken();
        sessions.put(token, username);
        sessionUserId.put(token, userId);
        sessionExpiry.put(token, System.currentTimeMillis() + SESSION_TTL_MS);
        return token;
    }

    private void invalidateSession(String token) {
        sessions.remove(token);
        sessionUserId.remove(token);
        sessionExpiry.remove(token);
    }

    private String getAuthenticatedUser(HttpExchange ex) {
        String token = bearerToken(ex);
        if (token == null) return null;
        Long expiry = sessionExpiry.get(token);
        if (expiry == null || System.currentTimeMillis() > expiry) { invalidateSession(token); return null; }
        return sessions.get(token);
    }

    private String getAuthenticatedUserId(HttpExchange ex) {
        String token = bearerToken(ex);
        if (token == null) return null;
        Long expiry = sessionExpiry.get(token);
        if (expiry == null || System.currentTimeMillis() > expiry) { invalidateSession(token); return null; }
        return sessionUserId.get(token);
    }

    private String bearerToken(HttpExchange ex) {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return null;
        String token = header.substring(7).trim();
        return token.isEmpty() ? null : token;
    }

    // ── /api/register ─────────────────────────────────────────────────────────

    private void handleRegister(HttpExchange ex) throws IOException {
        addCorsHeaders(ex);
        if (preflight(ex)) return;
        if (!method(ex, "POST")) return;

        Map<String, String> p = parseJsonObject(readBody(ex));
        String username = p.getOrDefault("username", "").trim();
        String password = p.getOrDefault("password", "").trim();

        if (username.isEmpty() || password.isEmpty()) {
            sendJson(ex, 400, err("Username and password are required")); return;
        }
        if (username.length() < 3) {
            sendJson(ex, 400, err("Username must be at least 3 characters")); return;
        }
        if (password.length() < 6) {
            sendJson(ex, 400, err("Password must be at least 6 characters")); return;
        }

        try {
            if (database.userExists(username)) {
                sendJson(ex, 409, err("Username is already taken")); return;
            }
            User user  = database.createUser(username, password);
            String tok = createSession(user.getUsername(), user.getId());
            sendJson(ex, 201, "{\"token\":\"" + esc(tok) + "\",\"username\":\"" + esc(user.getUsername()) + "\"}");
        } catch (SQLException e) { sendError500(ex, e); }
    }

    // ── /api/login ────────────────────────────────────────────────────────────

    private void handleLogin(HttpExchange ex) throws IOException {
        addCorsHeaders(ex);
        if (preflight(ex)) return;
        if (!method(ex, "POST")) return;

        Map<String, String> p = parseJsonObject(readBody(ex));
        String username = p.getOrDefault("username", "").trim();
        String password = p.getOrDefault("password", "").trim();

        if (username.isEmpty() || password.isEmpty()) {
            sendJson(ex, 400, err("Username and password are required")); return;
        }

        try {
            User user = database.validateUser(username, password);
            if (user == null) { sendJson(ex, 401, err("Invalid username or password")); return; }
            String tok = createSession(user.getUsername(), user.getId());
            sendJson(ex, 200, "{\"token\":\"" + esc(tok) + "\",\"username\":\"" + esc(user.getUsername()) + "\"}");
        } catch (SQLException e) { sendError500(ex, e); }
    }

    // ── /api/logout ───────────────────────────────────────────────────────────

    private void handleLogout(HttpExchange ex) throws IOException {
        addCorsHeaders(ex);
        if (preflight(ex)) return;
        if (!method(ex, "POST")) return;
        String token = bearerToken(ex);
        if (token != null) invalidateSession(token);
        sendJson(ex, 200, "{\"status\":\"logged out\"}");
    }

    // ── /api/me ───────────────────────────────────────────────────────────────

    private void handleMe(HttpExchange ex) throws IOException {
        addCorsHeaders(ex);
        if (preflight(ex)) return;
        String username = getAuthenticatedUser(ex);
        if (username == null) { sendJson(ex, 401, err("Unauthorized")); return; }
        sendJson(ex, 200, "{\"username\":\"" + esc(username) + "\"}");
    }

    // ── /api/tasks ────────────────────────────────────────────────────────────

    private void handleTaskRequests(HttpExchange ex) throws IOException {
        addCorsHeaders(ex);
        if (preflight(ex)) return;

        String userId = getAuthenticatedUserId(ex);
        if (userId == null) { sendJson(ex, 401, err("Unauthorized")); return; }

        String path   = ex.getRequestURI().getPath(); // /api/tasks  or  /api/tasks/{id}  or  /api/tasks/{id}/toggle
        String[] segs = path.replaceAll("^/+|/+$", "").split("/");
        // segs[0]="api"  segs[1]="tasks"  segs[2]=id  segs[3]="toggle"
        String taskId  = segs.length >= 3 ? segs[2] : null;
        boolean toggle = segs.length >= 4 && "toggle".equals(segs[3]);
        String m = ex.getRequestMethod();

        try {
            if (taskId == null) {
                // Collection: GET list or POST create
                if ("GET".equals(m))        { sendJson(ex, 200, listTasksJson(userId)); return; }
                if ("POST".equals(m))       { createTask(ex, userId); return; }
            } else if (toggle) {
                // PUT /api/tasks/{id}/toggle — flip status
                if ("PUT".equals(m) || "POST".equals(m)) { toggleTask(ex, taskId, userId); return; }
            } else {
                // Item: PUT update or DELETE delete
                if ("PUT".equals(m))        { updateTask(ex, taskId, userId); return; }
                if ("DELETE".equals(m))     { deleteTask(ex, taskId, userId); return; }
            }
            sendJson(ex, 405, err("Method not allowed"));
        } catch (SQLException e) { sendError500(ex, e); }
    }

    private void createTask(HttpExchange ex, String userId) throws IOException, SQLException {
        Map<String, String> p = parseJsonObject(readBody(ex));
        String title = p.getOrDefault("title", "").trim();
        if (title.isEmpty()) { sendJson(ex, 400, err("Title is required")); return; }

        Task t = database.createTask(
            userId, title,
            p.getOrDefault("description", ""),
            p.getOrDefault("priority", "medium"),
            p.getOrDefault("dueDate", ""),
            p.getOrDefault("dueTime", ""),
            p.getOrDefault("categoryId", ""),
            p.getOrDefault("tags", "")
        );
        sendJson(ex, 201, toJson(t));
    }

    private void updateTask(HttpExchange ex, String taskId, String userId) throws IOException, SQLException {
        Map<String, String> p = parseJsonObject(readBody(ex));
        String title = p.getOrDefault("title", "").trim();
        if (title.isEmpty()) { sendJson(ex, 400, err("Title is required")); return; }

        Task t = database.updateTask(
            taskId, userId, title,
            p.getOrDefault("description", ""),
            p.getOrDefault("status", "pending"),
            p.getOrDefault("priority", "medium"),
            p.getOrDefault("dueDate", ""),
            p.getOrDefault("dueTime", ""),
            p.getOrDefault("categoryId", ""),
            p.getOrDefault("tags", "")
        );
        if (t == null) { sendJson(ex, 404, err("Task not found")); return; }
        sendJson(ex, 200, toJson(t));
    }

    private void toggleTask(HttpExchange ex, String taskId, String userId) throws IOException, SQLException {
        Task t = database.toggleTask(taskId, userId);
        if (t == null) { sendJson(ex, 404, err("Task not found")); return; }
        sendJson(ex, 200, toJson(t));
    }

    private void deleteTask(HttpExchange ex, String taskId, String userId) throws IOException, SQLException {
        boolean deleted = database.deleteTask(taskId, userId);
        if (!deleted) { sendJson(ex, 404, err("Task not found")); return; }
        sendJson(ex, 200, "{\"status\":\"deleted\"}");
    }

    // ── /api/categories ───────────────────────────────────────────────────────

    private void handleCategoryRequests(HttpExchange ex) throws IOException {
        addCorsHeaders(ex);
        if (preflight(ex)) return;

        String userId = getAuthenticatedUserId(ex);
        if (userId == null) { sendJson(ex, 401, err("Unauthorized")); return; }

        String path   = ex.getRequestURI().getPath();
        String[] segs = path.replaceAll("^/+|/+$", "").split("/");
        String catId  = segs.length >= 3 ? segs[2] : null;
        String m      = ex.getRequestMethod();

        try {
            if (catId == null) {
                if ("GET".equals(m))  { sendJson(ex, 200, listCategoriesJson(userId)); return; }
                if ("POST".equals(m)) { createCategory(ex, userId); return; }
            } else {
                if ("DELETE".equals(m)) { deleteCategory(ex, catId, userId); return; }
            }
            sendJson(ex, 405, err("Method not allowed"));
        } catch (SQLException e) { sendError500(ex, e); }
    }

    private void createCategory(HttpExchange ex, String userId) throws IOException, SQLException {
        Map<String, String> p = parseJsonObject(readBody(ex));
        String name = p.getOrDefault("name", "").trim();
        if (name.isEmpty()) { sendJson(ex, 400, err("Category name is required")); return; }
        String color = p.getOrDefault("color", "#a78bfa");
        Category c = database.createCategory(userId, name, color);
        sendJson(ex, 201, toJson(c));
    }

    private void deleteCategory(HttpExchange ex, String catId, String userId) throws IOException, SQLException {
        boolean deleted = database.deleteCategory(catId, userId);
        if (!deleted) { sendJson(ex, 404, err("Category not found")); return; }
        sendJson(ex, 200, "{\"status\":\"deleted\"}");
    }

    // ── Root ──────────────────────────────────────────────────────────────────

    private void serveApiInfo(HttpExchange ex) throws IOException {
        addCorsHeaders(ex);
        if (preflight(ex)) return;
        if (!method(ex, "GET")) return;
        sendHtml(ex, 200,
            "<!DOCTYPE html><html><body>" +
            "<h1>TaskFlow backend is running</h1>" +
            "<p>Open <a href=\"../frontend/index.html\">frontend/index.html</a> in your browser.</p>" +
            "</body></html>");
    }

    // ── JSON builders ─────────────────────────────────────────────────────────

    private String listTasksJson(String userId) throws SQLException {
        List<Task> tasks = database.listTasks(userId);
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < tasks.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(toJson(tasks.get(i)));
        }
        return sb.append("]").toString();
    }

    private String listCategoriesJson(String userId) throws SQLException {
        List<Category> cats = database.listCategories(userId);
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < cats.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(toJson(cats.get(i)));
        }
        return sb.append("]").toString();
    }

    private String toJson(Task t) {
        return "{" +
            "\"id\":"           + q(t.getId())           + "," +
            "\"title\":"        + q(t.getTitle())         + "," +
            "\"description\":"  + q(t.getDescription())   + "," +
            "\"status\":"       + q(t.getStatus())        + "," +
            "\"priority\":"     + q(t.getPriority())      + "," +
            "\"dueDate\":"      + q(t.getDueDate())       + "," +
            "\"dueTime\":"      + q(t.getDueTime())       + "," +
            "\"categoryId\":"   + q(t.getCategoryId())    + "," +
            "\"categoryName\":" + q(t.getCategoryName())  + "," +
            "\"tags\":"         + q(t.getTags())          + "," +
            "\"createdAt\":"    + q(t.getCreatedAt())     + "," +
            "\"updatedAt\":"    + q(t.getUpdatedAt())     + "," +
            "\"completedAt\":"  + q(t.getCompletedAt())   +
            "}";
    }

    private String toJson(Category c) {
        return "{" +
            "\"id\":"        + q(c.getId())        + "," +
            "\"name\":"      + q(c.getName())      + "," +
            "\"color\":"     + q(c.getColor())     + "," +
            "\"createdAt\":" + q(c.getCreatedAt()) +
            "}";
    }

    /** Wrap a value as a JSON string literal, handling null → empty string. */
    private String q(String value) {
        return "\"" + esc(value) + "\"";
    }

    /** JSON-escape a string value. */
    private String esc(String value) {
        if (value == null) return "";
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
    }

    /** Parse a flat JSON object containing only string-valued keys.
     *  Handles both quoted string values and bare null. */
    private Map<String, String> parseJsonObject(String body) {
        Map<String, String> map = new HashMap<>();
        if (body == null || body.isBlank()) return map;
        // Match  "key": "value"
        Matcher m = Pattern.compile("\"([^\"]+)\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"").matcher(body);
        while (m.find()) {
            map.put(m.group(1), unescape(m.group(2)));
        }
        return map;
    }

    private String unescape(String s) {
        return s.replace("\\n", "\n").replace("\\\"", "\"").replace("\\\\", "\\");
    }

    private String err(String msg) {
        return "{\"error\":\"" + esc(msg) + "\"}";
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    private String readBody(HttpExchange ex) throws IOException {
        InputStream is = ex.getRequestBody();
        return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }

    private void addCorsHeaders(HttpExchange ex) {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin",  "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    /** Returns true and sends 204 if this is a CORS preflight. */
    private boolean preflight(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) {
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return true;
        }
        return false;
    }

    /** Sends 405 if method doesn't match; returns false so caller can return early. */
    private boolean method(HttpExchange ex, String expected) throws IOException {
        if (!expected.equals(ex.getRequestMethod())) {
            sendJson(ex, 405, err("Method not allowed"));
            return false;
        }
        return true;
    }

    private void sendJson(HttpExchange ex, int code, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream out = ex.getResponseBody()) { out.write(bytes); }
        ex.close();
    }

    private void sendHtml(HttpExchange ex, int code, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream out = ex.getResponseBody()) { out.write(bytes); }
        ex.close();
    }

    private void sendError500(HttpExchange ex, Throwable e) throws IOException {
        e.printStackTrace();
        sendJson(ex, 500, err("Internal server error"));
    }

    // ── Workspace / DB factory ────────────────────────────────────────────────

    private static Path resolveWorkspaceRoot() {
        Path cur = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        if (Files.isDirectory(cur.resolve("frontend")) && Files.isDirectory(cur.resolve("backend")))
            return cur;
        Path par = cur.getParent();
        if (par != null && Files.isDirectory(par.resolve("frontend")) && Files.isDirectory(par.resolve("backend")))
            return par;
        return cur;
    }

    private Database createDatabase() throws SQLException {
        String url  = System.getenv("POSTGRES_URL");
        String user = System.getenv("POSTGRES_USER");
        String pass = System.getenv("POSTGRES_PASSWORD");

        if (url == null || url.isEmpty()) url = System.getenv("DATABASE_URL");

        if ((url == null || url.isEmpty()) && System.getenv("PGHOST") != null) {
            String host   = System.getenv("PGHOST");
            String dbPort = System.getenv().getOrDefault("PGPORT", "5432");
            String db     = System.getenv().getOrDefault("PGDATABASE", "taskflow");
            user = System.getenv().getOrDefault("PGUSER",     user != null ? user : "postgres");
            pass = System.getenv().getOrDefault("PGPASSWORD", pass != null ? pass : "postgres");
            url  = "jdbc:postgresql://" + host + ":" + dbPort + "/" + db;
        }

        if (url == null || url.isEmpty()) url = "jdbc:postgresql://localhost:5432/taskflow";
        if (user == null || user.isEmpty()) user = "postgres";
        if (pass == null || pass.isEmpty()) pass = "postgres";

        // Accept bare postgres:// or postgresql:// URLs (Render-style)
        if ((url.startsWith("postgres://") || url.startsWith("postgresql://")) && !url.startsWith("jdbc:")) {
            try {
                URI uri = new URI(url);
                String uInfo = uri.getUserInfo();
                if (uInfo != null) {
                    String[] parts = uInfo.split(":", 2);
                    user = parts[0];
                    if (parts.length > 1) pass = parts[1];
                }
                url = "jdbc:postgresql://" + uri.getHost() + ":" +
                      (uri.getPort() == -1 ? 5432 : uri.getPort()) + uri.getPath();
            } catch (URISyntaxException e) {
                throw new SQLException("Invalid DATABASE_URL format", e);
            }
        }

        return new Database(url, user, pass);
    }
}
