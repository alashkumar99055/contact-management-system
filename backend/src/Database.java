import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.*;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

public class Database {
    private final String url;
    private final String username;
    private final String password;

    public Database(String url, String username, String password) throws SQLException {
        this.url      = url;
        this.username = username;
        this.password = password;
        initSchema();
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(url, username, password);
    }

    // ── Schema initialisation ─────────────────────────────────────────────────

    private void initSchema() throws SQLException {
        String authSql =
            "CREATE TABLE IF NOT EXISTS authentication (" +
            "  id            UUID        PRIMARY KEY," +
            "  username      TEXT        NOT NULL UNIQUE," +
            "  password_hash TEXT        NOT NULL," +
            "  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()" +
            ")";

        String categoriesSql =
            "CREATE TABLE IF NOT EXISTS categories (" +
            "  id         UUID      PRIMARY KEY," +
            "  user_id    UUID      NOT NULL REFERENCES authentication(id) ON DELETE CASCADE," +
            "  name       TEXT      NOT NULL," +
            "  color      TEXT      NOT NULL DEFAULT '#a78bfa'," +
            "  created_at TIMESTAMP NOT NULL DEFAULT NOW()" +
            ")";

        String tasksSql =
            "CREATE TABLE IF NOT EXISTS tasks (" +
            "  id           UUID      PRIMARY KEY," +
            "  user_id      UUID      NOT NULL REFERENCES authentication(id) ON DELETE CASCADE," +
            "  title        TEXT      NOT NULL," +
            "  description  TEXT," +
            "  status       TEXT      NOT NULL DEFAULT 'pending'," +
            "  priority     TEXT      NOT NULL DEFAULT 'medium'," +
            "  due_date     DATE," +
            "  due_time     TEXT," +
            "  category_id  UUID      REFERENCES categories(id) ON DELETE SET NULL," +
            "  tags         TEXT      DEFAULT ''," +
            "  created_at   TIMESTAMP NOT NULL DEFAULT NOW()," +
            "  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()," +
            "  completed_at TIMESTAMP" +
            ")";

        String idxUserSql      = "CREATE INDEX IF NOT EXISTS idx_tasks_user_id      ON tasks(user_id)";
        String idxStatusSql    = "CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks(status)";
        String idxDueSql       = "CREATE INDEX IF NOT EXISTS idx_tasks_due_date      ON tasks(due_date)";
        String idxCatUserSql   = "CREATE INDEX IF NOT EXISTS idx_categories_user_id  ON categories(user_id)";

        // Drop the old passwords table only if tasks already exists (migration safety)
        String dropPasswordsSql =
            "DO $$ BEGIN " +
            "  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tasks') THEN " +
            "    DROP TABLE IF EXISTS passwords CASCADE; " +
            "  END IF; " +
            "END $$";

        try (Connection conn = getConnection(); Statement st = conn.createStatement()) {
            st.execute(authSql);
            st.execute(categoriesSql);
            st.execute(tasksSql);
            st.execute(idxUserSql);
            st.execute(idxStatusSql);
            st.execute(idxDueSql);
            st.execute(idxCatUserSql);
            st.execute(dropPasswordsSql);
        }
    }

    // ── Authentication ────────────────────────────────────────────────────────

    /** Hash a password using SHA-256 with a 16-byte random salt.
     *  Stored format: base64(salt) + ":" + base64(sha256(salt || password)) */
    public static String hashPassword(String plainPassword) {
        try {
            byte[] salt = new byte[16];
            new SecureRandom().nextBytes(salt);
            return computeHash(salt, plainPassword);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private static String computeHash(byte[] salt, String plain) throws NoSuchAlgorithmException {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        md.update(salt);
        md.update(plain.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(salt) + ":" +
               Base64.getEncoder().encodeToString(md.digest());
    }

    public static boolean verifyPassword(String plain, String stored) {
        try {
            String[] parts = stored.split(":", 2);
            if (parts.length != 2) return false;
            byte[] salt = Base64.getDecoder().decode(parts[0]);
            return computeHash(salt, plain).equals(stored);
        } catch (Exception e) {
            return false;
        }
    }

    public User createUser(String username, String plainPassword) throws SQLException {
        String id   = UUID.randomUUID().toString();
        String hash = hashPassword(plainPassword);
        String sql  = "INSERT INTO authentication (id, username, password_hash) VALUES (?, ?, ?)";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, UUID.fromString(id));
            ps.setString(2, username);
            ps.setString(3, hash);
            ps.executeUpdate();
        }
        return new User(id, username);
    }

    public boolean userExists(String username) throws SQLException {
        String sql = "SELECT 1 FROM authentication WHERE username = ?";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    public User validateUser(String username, String plainPassword) throws SQLException {
        String sql = "SELECT id, password_hash FROM authentication WHERE username = ?";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                if (!verifyPassword(plainPassword, rs.getString("password_hash"))) return null;
                return new User(rs.getString("id"), username);
            }
        }
    }

    // ── Categories ────────────────────────────────────────────────────────────

    public List<Category> listCategories(String userId) throws SQLException {
        List<Category> result = new ArrayList<>();
        String sql = "SELECT id, name, color, created_at FROM categories " +
                     "WHERE user_id = ? ORDER BY name";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, UUID.fromString(userId));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) result.add(mapCategoryRow(rs));
            }
        }
        return result;
    }

    public Category createCategory(String userId, String name, String color) throws SQLException {
        String id  = UUID.randomUUID().toString();
        String sql = "INSERT INTO categories (id, user_id, name, color) VALUES (?, ?, ?, ?) " +
                     "RETURNING id, name, color, created_at";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, UUID.fromString(id));
            ps.setObject(2, UUID.fromString(userId));
            ps.setString(3, name);
            ps.setString(4, color != null && !color.isEmpty() ? color : "#a78bfa");
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapCategoryRow(rs);
            }
        }
        return new Category(id, name, color, "");
    }

    public boolean deleteCategory(String id, String userId) throws SQLException {
        String sql = "DELETE FROM categories WHERE id = ? AND user_id = ?";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, UUID.fromString(id));
            ps.setObject(2, UUID.fromString(userId));
            return ps.executeUpdate() > 0;
        }
    }

    private Category mapCategoryRow(ResultSet rs) throws SQLException {
        Timestamp ts = rs.getTimestamp("created_at");
        return new Category(
            rs.getString("id"),
            rs.getString("name"),
            rs.getString("color"),
            ts != null ? ts.toInstant().toString() : ""
        );
    }

    // ── Tasks ─────────────────────────────────────────────────────────────────

    public List<Task> listTasks(String userId) throws SQLException {
        List<Task> result = new ArrayList<>();
        String sql =
            "SELECT t.id, t.title, t.description, t.status, t.priority, " +
            "       t.due_date, t.due_time, t.category_id, c.name AS category_name, " +
            "       t.tags, t.created_at, t.updated_at, t.completed_at " +
            "FROM tasks t " +
            "LEFT JOIN categories c ON t.category_id = c.id " +
            "WHERE t.user_id = ? " +
            "ORDER BY " +
            "  CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, " +
            "  t.due_date ASC NULLS LAST, " +
            "  t.created_at DESC";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, UUID.fromString(userId));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) result.add(mapTaskRow(rs));
            }
        }
        return result;
    }

    public Task createTask(String userId, String title, String description,
                           String priority, String dueDate, String dueTime,
                           String categoryId, String tags) throws SQLException {
        String id  = UUID.randomUUID().toString();
        String sql =
            "INSERT INTO tasks (id, user_id, title, description, status, priority, " +
            "  due_date, due_time, category_id, tags) " +
            "VALUES (?, ?, ?, ?, 'pending', ?, " +
            "  ?::date, ?, ?::uuid, ?) " +
            "RETURNING id, title, description, status, priority, " +
            "  due_date, due_time, category_id, tags, created_at, updated_at, completed_at";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, UUID.fromString(id));
            ps.setObject(2, UUID.fromString(userId));
            ps.setString(3, title);
            setNullableString(ps, 4, description);
            ps.setString(5, normalisePriority(priority));
            setNullableString(ps, 6, dueDate);
            setNullableString(ps, 7, dueTime);
            setNullableString(ps, 8, categoryId);
            ps.setString(9, tags != null ? tags : "");
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Task t = mapTaskRowMinimal(rs);
                    t.setCategoryName(resolveCategoryName(conn, categoryId));
                    return t;
                }
            }
        }
        return null;
    }

    public Task updateTask(String id, String userId, String title, String description,
                           String status, String priority, String dueDate, String dueTime,
                           String categoryId, String tags) throws SQLException {
        boolean completing = "completed".equals(status);
        String sql =
            "UPDATE tasks SET " +
            "  title        = ?, " +
            "  description  = ?, " +
            "  status       = ?, " +
            "  priority     = ?, " +
            "  due_date     = ?::date, " +
            "  due_time     = ?, " +
            "  category_id  = ?::uuid, " +
            "  tags         = ?, " +
            "  updated_at   = NOW(), " +
            "  completed_at = CASE WHEN ? THEN NOW() ELSE NULL END " +
            "WHERE id = ?::uuid AND user_id = ?::uuid " +
            "RETURNING id, title, description, status, priority, " +
            "  due_date, due_time, category_id, tags, created_at, updated_at, completed_at";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, title);
            setNullableString(ps, 2, description);
            ps.setString(3, normaliseStatus(status));
            ps.setString(4, normalisePriority(priority));
            setNullableString(ps, 5, dueDate);
            setNullableString(ps, 6, dueTime);
            setNullableString(ps, 7, categoryId);
            ps.setString(8, tags != null ? tags : "");
            ps.setBoolean(9, completing);
            ps.setString(10, id);
            ps.setString(11, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Task t = mapTaskRowMinimal(rs);
                    t.setCategoryName(resolveCategoryName(conn, categoryId));
                    return t;
                }
            }
        }
        return null; // not found or not owned
    }

    /** Toggle a single task's status between pending and completed. */
    public Task toggleTask(String id, String userId) throws SQLException {
        String sql =
            "UPDATE tasks SET " +
            "  status       = CASE WHEN status = 'pending' THEN 'completed' ELSE 'pending' END, " +
            "  completed_at = CASE WHEN status = 'pending' THEN NOW() ELSE NULL END, " +
            "  updated_at   = NOW() " +
            "WHERE id = ?::uuid AND user_id = ?::uuid " +
            "RETURNING id, title, description, status, priority, " +
            "  due_date, due_time, category_id, tags, created_at, updated_at, completed_at";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, id);
            ps.setString(2, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Task t = mapTaskRowMinimal(rs);
                    String catId = t.getCategoryId();
                    t.setCategoryName(resolveCategoryName(conn, catId));
                    return t;
                }
            }
        }
        return null;
    }

    public boolean deleteTask(String id, String userId) throws SQLException {
        String sql = "DELETE FROM tasks WHERE id = ?::uuid AND user_id = ?::uuid";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, id);
            ps.setString(2, userId);
            return ps.executeUpdate() > 0;
        }
    }

    // ── Mapping helpers ───────────────────────────────────────────────────────

    /** Map a full JOIN row (includes category_name from join). */
    private Task mapTaskRow(ResultSet rs) throws SQLException {
        return new Task(
            rs.getString("id"),
            rs.getString("title"),
            nullToEmpty(rs.getString("description")),
            rs.getString("status"),
            rs.getString("priority"),
            dateToString(rs.getDate("due_date")),
            nullToEmpty(rs.getString("due_time")),
            nullToEmpty(rs.getString("category_id")),
            nullToEmpty(rs.getString("category_name")),
            nullToEmpty(rs.getString("tags")),
            tsToString(rs.getTimestamp("created_at")),
            tsToString(rs.getTimestamp("updated_at")),
            tsToString(rs.getTimestamp("completed_at"))
        );
    }

    /** Map a RETURNING row (no category_name column — must resolve separately). */
    private Task mapTaskRowMinimal(ResultSet rs) throws SQLException {
        return new Task(
            rs.getString("id"),
            rs.getString("title"),
            nullToEmpty(rs.getString("description")),
            rs.getString("status"),
            rs.getString("priority"),
            dateToString(rs.getDate("due_date")),
            nullToEmpty(rs.getString("due_time")),
            nullToEmpty(rs.getString("category_id")),
            "",   // category_name resolved separately
            nullToEmpty(rs.getString("tags")),
            tsToString(rs.getTimestamp("created_at")),
            tsToString(rs.getTimestamp("updated_at")),
            tsToString(rs.getTimestamp("completed_at"))
        );
    }

    private String resolveCategoryName(Connection conn, String categoryId) throws SQLException {
        if (categoryId == null || categoryId.isEmpty()) return "";
        String sql = "SELECT name FROM categories WHERE id = ?::uuid";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, categoryId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString("name") : "";
            }
        }
    }

    // ── Utility helpers ───────────────────────────────────────────────────────

    private void setNullableString(PreparedStatement ps, int idx, String value) throws SQLException {
        if (value == null || value.isEmpty()) {
            ps.setNull(idx, Types.VARCHAR);
        } else {
            ps.setString(idx, value);
        }
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private String dateToString(java.sql.Date d) {
        return d == null ? "" : d.toString(); // "YYYY-MM-DD"
    }

    private String tsToString(Timestamp ts) {
        return ts == null ? "" : ts.toInstant().toString();
    }

    private String normalisePriority(String p) {
        if ("high".equals(p) || "low".equals(p)) return p;
        return "medium";
    }

    private String normaliseStatus(String s) {
        if ("completed".equals(s)) return "completed";
        return "pending";
    }
}
