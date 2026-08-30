import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.BindException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
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
    private final Database db;

    private final ConcurrentHashMap<String, String> sessions      = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> sessionUserId = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long>   sessionExpiry = new ConcurrentHashMap<>();
    private static final long TTL = 8 * 60 * 60 * 1000L;
    private static final String CORS_ORIGINS = System.getenv().getOrDefault("CORS_ORIGINS", "*");

    public Server(int port) throws SQLException {
        this.port = port;
        this.db   = createDatabase();
    }

    public int start() throws IOException {
        HttpServer srv = null;
        int tried = port;
        while (true) {
            try { srv = HttpServer.create(new InetSocketAddress("0.0.0.0", tried), 0); break; }
            catch (BindException e) { if (tried >= port + 10) throw e; tried++; }
        }
        this.port = tried;

        srv.createContext("/api/register",          this::handleRegister);
        srv.createContext("/api/login",             this::handleLogin);
        srv.createContext("/api/logout",            this::handleLogout);
        srv.createContext("/api/me",                this::handleMe);
        srv.createContext("/api/contacts",          this::handleContacts);
        srv.createContext("/api/dashboard",         this::handleDashboard);
        srv.createContext("/api/categories",        this::handleCategories);
        srv.createContext("/api/contacts/export",   this::handleExport);
        srv.createContext("/api/contacts/import",   this::handleImport);
        srv.createContext("/",                      this::serveRoot);

        srv.setExecutor(null);
        srv.start();
        return this.port;
    }

    // ── Session ───────────────────────────────────────────────────────────────

    private String newToken() {
        byte[] b = new byte[32];
        new SecureRandom().nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private String createSession(String username, String userId) {
        String tok = newToken();
        sessions.put(tok, username);
        sessionUserId.put(tok, userId);
        sessionExpiry.put(tok, System.currentTimeMillis() + TTL);
        return tok;
    }

    private void invalidate(String tok) {
        if (tok == null) return;
        sessions.remove(tok); sessionUserId.remove(tok); sessionExpiry.remove(tok);
    }

    private String authUser(HttpExchange ex) {
        String tok = bearer(ex);
        if (tok == null) return null;
        Long exp = sessionExpiry.get(tok);
        if (exp == null || System.currentTimeMillis() > exp) { invalidate(tok); return null; }
        return sessions.get(tok);
    }

    private String authUserId(HttpExchange ex) {
        String tok = bearer(ex);
        if (tok == null) return null;
        Long exp = sessionExpiry.get(tok);
        if (exp == null || System.currentTimeMillis() > exp) { invalidate(tok); return null; }
        return sessionUserId.get(tok);
    }

    private String bearer(HttpExchange ex) {
        String h = ex.getRequestHeaders().getFirst("Authorization");
        if (h == null || !h.startsWith("Bearer ")) return null;
        String tok = h.substring(7).trim();
        return tok.isEmpty() ? null : tok;
    }

    // ── Auth endpoints ────────────────────────────────────────────────────────

    private void handleRegister(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return; if (!meth(ex,"POST")) return;
        Map<String,String> p = parse(body(ex));
        String u = p.getOrDefault("username","").trim();
        String pw = p.getOrDefault("password","").trim();
        if (u.isEmpty()||pw.isEmpty()) { json(ex,400,err("Username and password required")); return; }
        if (u.length()<3)  { json(ex,400,err("Username must be at least 3 characters")); return; }
        if (pw.length()<6) { json(ex,400,err("Password must be at least 6 characters")); return; }
        try {
            if (db.userExists(u)) { json(ex,409,err("Username already taken")); return; }
            User user = db.createUser(u, pw);
            String tok = createSession(user.getUsername(), user.getId());
            json(ex,201,"{\"token\":\""+esc(tok)+"\",\"username\":\""+esc(user.getUsername())+"\"}");
        } catch (SQLException e) { err500(ex,e); }
    }

    private void handleLogin(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return; if (!meth(ex,"POST")) return;
        Map<String,String> p = parse(body(ex));
        String u = p.getOrDefault("username","").trim();
        String pw = p.getOrDefault("password","").trim();
        if (u.isEmpty()||pw.isEmpty()) { json(ex,400,err("Username and password required")); return; }
        try {
            User user = db.validateUser(u, pw);
            if (user==null) { json(ex,401,err("Invalid username or password")); return; }
            String tok = createSession(user.getUsername(), user.getId());
            json(ex,200,"{\"token\":\""+esc(tok)+"\",\"username\":\""+esc(user.getUsername())+"\"}");
        } catch (SQLException e) { err500(ex,e); }
    }

    private void handleLogout(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return; if (!meth(ex,"POST")) return;
        invalidate(bearer(ex));
        json(ex,200,"{\"status\":\"logged out\"}");
    }

    private void handleMe(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return;
        String u = authUser(ex);
        if (u==null) { json(ex,401,err("Unauthorized")); return; }
        json(ex,200,"{\"username\":\""+esc(u)+"\"}");
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    private void handleDashboard(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return; if (!meth(ex,"GET")) return;
        String uid = authUserId(ex);
        if (uid==null) { json(ex,401,err("Unauthorized")); return; }
        try { json(ex,200, db.getDashboardStats(uid)); }
        catch (SQLException e) { err500(ex,e); }
    }

    // ── Categories ────────────────────────────────────────────────────────────

    private void handleCategories(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return; if (!meth(ex,"GET")) return;
        String uid = authUserId(ex);
        if (uid==null) { json(ex,401,err("Unauthorized")); return; }
        List<String> cats = db.getCategories();
        StringBuilder sb = new StringBuilder("[");
        for (int i=0;i<cats.size();i++) {
            if (i>0) sb.append(",");
            sb.append("\"").append(esc(cats.get(i))).append("\"");
        }
        sb.append("]");
        json(ex,200,sb.toString());
    }

    // ── Export CSV ────────────────────────────────────────────────────────────

    private void handleExport(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return; if (!meth(ex,"GET")) return;
        String uid = authUserId(ex);
        if (uid==null) { json(ex,401,err("Unauthorized")); return; }
        try {
            String csv = db.exportCsv(uid);
            byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().set("Content-Type",        "text/csv; charset=UTF-8");
            ex.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"contacts.csv\"");
            ex.getResponseHeaders().set("Access-Control-Allow-Origin","*");
            ex.sendResponseHeaders(200, bytes.length);
            try (OutputStream out = ex.getResponseBody()) { out.write(bytes); }
            ex.close();
        } catch (SQLException e) { err500(ex,e); }
    }

    // ── Import CSV ────────────────────────────────────────────────────────────

    private void handleImport(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return; if (!meth(ex,"POST")) return;
        String uid = authUserId(ex);
        if (uid==null) { json(ex,401,err("Unauthorized")); return; }
        try {
            String csv = body(ex);
            int count = db.importCsv(uid, csv);
            json(ex,200,"{\"imported\":"+count+"}");
        } catch (SQLException e) { err500(ex,e); }
    }

    // ── Contacts ──────────────────────────────────────────────────────────────

    private void handleContacts(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return;
        String uid = authUserId(ex);
        if (uid==null) { json(ex,401,err("Unauthorized")); return; }

        String path   = ex.getRequestURI().getPath(); // /api/contacts[/{id}[/favorite]]
        String[] segs = path.replaceAll("^/+|/+$","").split("/");
        // segs: [api, contacts, {id}?, favorite?]
        String contactId = segs.length >= 3 ? segs[2] : null;
        boolean isFavToggle = segs.length >= 4 && "favorite".equals(segs[3]);
        String m = ex.getRequestMethod();

        try {
            // PUT /api/contacts/{id}/favorite
            if (contactId != null && isFavToggle) {
                if ("PUT".equals(m)||"POST".equals(m)) { toggleFav(ex,contactId,uid); return; }
                json(ex,405,err("Method not allowed")); return;
            }

            if (contactId == null) {
                // GET /api/contacts?search=&category=&favorites=&sort=
                if ("GET".equals(m))  { listContacts(ex,uid); return; }
                if ("POST".equals(m)) { createContact(ex,uid); return; }
            } else {
                if ("GET".equals(m))    { getContact(ex,contactId,uid); return; }
                if ("PUT".equals(m))    { updateContact(ex,contactId,uid); return; }
                if ("DELETE".equals(m)) { deleteContact(ex,contactId,uid); return; }
            }
            json(ex,405,err("Method not allowed"));
        } catch (SQLException e) { err500(ex,e); }
    }

    private void listContacts(HttpExchange ex, String uid) throws IOException, SQLException {
        Map<String,String> qs = queryParams(ex);
        String search   = qs.get("search");
        String category = qs.get("category");
        boolean favOnly = "true".equals(qs.get("favorites"));
        String sort     = qs.getOrDefault("sort","name_asc");

        List<Contact> contacts = db.listContacts(uid, search, category, favOnly, sort);
        StringBuilder sb = new StringBuilder("[");
        for (int i=0;i<contacts.size();i++) {
            if (i>0) sb.append(",");
            sb.append(Database.toJson(contacts.get(i)));
        }
        sb.append("]");
        json(ex,200,sb.toString());
    }

    private void getContact(HttpExchange ex, String id, String uid) throws IOException, SQLException {
        Contact c = db.getById(id, uid);
        if (c==null) { json(ex,404,err("Contact not found")); return; }
        json(ex,200,Database.toJson(c));
    }

    private void createContact(HttpExchange ex, String uid) throws IOException, SQLException {
        Map<String,String> p = parse(body(ex));
        String name = p.getOrDefault("name","").trim();
        if (name.isEmpty()) { json(ex,400,err("Name is required")); return; }
        // Basic email validation if provided
        String email = p.getOrDefault("email","").trim();
        if (!email.isEmpty() && !email.contains("@")) {
            json(ex,400,err("Invalid email address")); return;
        }
        Contact c = db.createContact(uid, name,
            p.getOrDefault("phone",""),
            email,
            p.getOrDefault("address",""),
            p.getOrDefault("category",""),
            p.getOrDefault("notes",""),
            "true".equals(p.getOrDefault("favorite","false")));
        json(ex,201,Database.toJson(c));
    }

    private void updateContact(HttpExchange ex, String id, String uid) throws IOException, SQLException {
        Map<String,String> p = parse(body(ex));
        String name = p.getOrDefault("name","").trim();
        if (name.isEmpty()) { json(ex,400,err("Name is required")); return; }
        String email = p.getOrDefault("email","").trim();
        if (!email.isEmpty() && !email.contains("@")) {
            json(ex,400,err("Invalid email address")); return;
        }
        Contact c = db.updateContact(id, uid, name,
            p.getOrDefault("phone",""),
            email,
            p.getOrDefault("address",""),
            p.getOrDefault("category",""),
            p.getOrDefault("notes",""),
            "true".equals(p.getOrDefault("favorite","false")));
        if (c==null) { json(ex,404,err("Contact not found")); return; }
        json(ex,200,Database.toJson(c));
    }

    private void toggleFav(HttpExchange ex, String id, String uid) throws IOException, SQLException {
        Contact c = db.toggleFavorite(id, uid);
        if (c==null) { json(ex,404,err("Contact not found")); return; }
        json(ex,200,Database.toJson(c));
    }

    private void deleteContact(HttpExchange ex, String id, String uid) throws IOException, SQLException {
        if (!db.deleteContact(id, uid)) { json(ex,404,err("Contact not found")); return; }
        json(ex,200,"{\"status\":\"deleted\"}");
    }

    // ── Root ──────────────────────────────────────────────────────────────────

    private void serveRoot(HttpExchange ex) throws IOException {
        cors(ex); if (pre(ex)) return; if (!meth(ex,"GET")) return;
        html(ex,200,"<h1>ContactFlow API is running</h1><p>Open frontend/index.html</p>");
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    private void cors(HttpExchange ex) {
        String origin = ex.getRequestHeaders().getFirst("Origin");
        boolean allowed = "*".equals(CORS_ORIGINS) || (origin != null &&
            java.util.Arrays.stream(CORS_ORIGINS.split(","))
                .map(String::trim).anyMatch(origin::equals));
        if (!allowed && origin != null) {
            allowed = java.util.Arrays.stream(CORS_ORIGINS.split(","))
                .map(String::trim)
                .anyMatch(host -> origin.equals("https://" + host) || origin.equals("http://" + host));
        }
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", allowed && origin != null ? origin : "*");
        if (allowed && origin != null) ex.getResponseHeaders().set("Vary", "Origin");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods","GET,POST,PUT,DELETE,OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers","Content-Type,Authorization");
    }

    private boolean pre(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) {
            ex.sendResponseHeaders(204,-1); ex.close(); return true;
        }
        return false;
    }

    private boolean meth(HttpExchange ex, String expected) throws IOException {
        if (!expected.equals(ex.getRequestMethod())) {
            json(ex,405,err("Method not allowed")); return false;
        }
        return true;
    }

    private String body(HttpExchange ex) throws IOException {
        return new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    private void json(HttpExchange ex, int code, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type","application/json; charset=UTF-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream out = ex.getResponseBody()) { out.write(bytes); }
        ex.close();
    }

    private void html(HttpExchange ex, int code, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type","text/html; charset=UTF-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream out = ex.getResponseBody()) { out.write(bytes); }
        ex.close();
    }

    private void err500(HttpExchange ex, Throwable e) throws IOException {
        e.printStackTrace();
        json(ex,500,err("Internal server error: "+e.getMessage()));
    }

    private String err(String msg) { return "{\"error\":\""+esc(msg)+"\"}"; }

    private String esc(String v) {
        if (v==null) return "";
        return v.replace("\\","\\\\").replace("\"","\\\"")
                .replace("\n","\\n").replace("\r","\\r").replace("\t","\\t");
    }

    /** Parse flat JSON object (string values and boolean/numeric literals). */
    private Map<String,String> parse(String body) {
        Map<String,String> map = new HashMap<>();
        if (body==null||body.isBlank()) return map;
        // string values
        Matcher ms = Pattern.compile("\"([^\"]+)\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"").matcher(body);
        while (ms.find()) map.put(ms.group(1), unescape(ms.group(2)));
        // boolean/number values not wrapped in quotes
        Matcher mb = Pattern.compile("\"([^\"]+)\"\\s*:\\s*(true|false|\\d+)").matcher(body);
        while (mb.find()) {
            if (!map.containsKey(mb.group(1))) map.put(mb.group(1), mb.group(2));
        }
        return map;
    }

    private String unescape(String s) {
        return s.replace("\\n","\n").replace("\\\"","\"").replace("\\\\","\\");
    }

    private Map<String,String> queryParams(HttpExchange ex) {
        Map<String,String> map = new HashMap<>();
        String query = ex.getRequestURI().getQuery();
        if (query==null||query.isBlank()) return map;
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq<0) map.put(decode(pair),"");
            else map.put(decode(pair.substring(0,eq)), decode(pair.substring(eq+1)));
        }
        return map;
    }

    private String decode(String s) {
        try { return java.net.URLDecoder.decode(s, StandardCharsets.UTF_8); }
        catch (Exception e) { return s; }
    }

    // ── Database factory ──────────────────────────────────────────────────────

    private static Database createDatabase() throws SQLException {
        String url  = System.getenv("POSTGRES_URL");
        String user = System.getenv("POSTGRES_USER");
        String pass = System.getenv("POSTGRES_PASSWORD");

        // Try DATABASE_URL first (set by Render)
        if (url==null||url.isEmpty()) url = System.getenv("DATABASE_URL");

        // Try PostgreSQL standard environment variables (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)
        if ((url==null||url.isEmpty()) && System.getenv("PGHOST")!=null) {
            String host = System.getenv("PGHOST");
            String dbp  = System.getenv().getOrDefault("PGPORT","5432");
            String db   = System.getenv().getOrDefault("PGDATABASE","contactflow");
            user = System.getenv().getOrDefault("PGUSER",   user!=null?user:"postgres");
            pass = System.getenv().getOrDefault("PGPASSWORD",pass!=null?pass:"postgres");
            url  = "jdbc:postgresql://"+host+":"+dbp+"/"+db;
        }

        // Default to local development if nothing is set
        if (url==null||url.isEmpty()) {
            System.out.println("[DB] No database URL found, using local defaults");
            url = "jdbc:postgresql://localhost:5432/contactflow";
        }

        // Parse postgresql:// and postgres:// URIs (from DATABASE_URL or fallbacks)
        if ((url.startsWith("postgres://")||url.startsWith("postgresql://"))&&!url.startsWith("jdbc:")) {
            try {
                URI uri = new URI(url);
                String info = uri.getUserInfo();
                if (info!=null) {
                    String[] parts = info.split(":",2);
                    user = java.net.URLDecoder.decode(parts[0], "UTF-8");
                    if (parts.length>1) pass = java.net.URLDecoder.decode(parts[1], "UTF-8");
                }
                String host = uri.getHost();
                int port = uri.getPort()==-1 ? 5432 : uri.getPort();
                String path = uri.getPath();
                if (path==null||path.isEmpty()) path = "/contactflow";
                url = "jdbc:postgresql://"+host+":"+port+path;
            } catch (URISyntaxException e) { 
                throw new SQLException("Bad DATABASE_URL format: " + url, e); 
            } catch (Exception e) {
                throw new SQLException("Error parsing DATABASE_URL", e);
            }
        }

        // Set defaults only if still not set
        if (user==null||user.isEmpty()) {
            System.out.println("[DB] WARNING: No database username provided, using default 'postgres'");
            user = "postgres";
        }
        if (pass==null||pass.isEmpty()) {
            System.out.println("[DB] WARNING: No database password provided, using default 'postgres'");
            pass = "postgres";
        }

        // Log connection info (with password masked)
        String displayUrl = url.replaceAll(":[^:@]+@",":*****@");
        System.out.println("[DB] Connecting to database: " + displayUrl);
        System.out.println("[DB] Database user: " + user);
        
        return new Database(url, user, pass);
    }
}
