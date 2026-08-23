import java.net.URI;
import java.net.URISyntaxException;
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

    // ── Schema ────────────────────────────────────────────────────────────────

    private void initSchema() throws SQLException {
        String authSql =
            "CREATE TABLE IF NOT EXISTS authentication (" +
            "  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()," +
            "  username      TEXT        NOT NULL UNIQUE," +
            "  password_hash TEXT        NOT NULL," +
            "  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()" +
            ")";

        String contactsSql =
            "CREATE TABLE IF NOT EXISTS contacts (" +
            "  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid()," +
            "  user_id    UUID        NOT NULL REFERENCES authentication(id) ON DELETE CASCADE," +
            "  name       TEXT        NOT NULL," +
            "  phone      TEXT        NOT NULL DEFAULT ''," +
            "  email      TEXT        NOT NULL DEFAULT ''," +
            "  address    TEXT        NOT NULL DEFAULT ''," +
            "  category   TEXT        NOT NULL DEFAULT ''," +
            "  notes      TEXT        NOT NULL DEFAULT ''," +
            "  favorite   BOOLEAN     NOT NULL DEFAULT FALSE," +
            "  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()," +
            "  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()" +
            ")";

        // Safe migrations for existing deployments that have old schema
        String addCategory  = "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''";
        String addFavorite  = "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE";

        String idxUser      = "CREATE INDEX IF NOT EXISTS idx_contacts_user_id  ON contacts(user_id)";
        String idxName      = "CREATE INDEX IF NOT EXISTS idx_contacts_name     ON contacts(user_id, lower(name))";
        String idxFavorite  = "CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON contacts(user_id, favorite)";
        String idxCategory  = "CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(user_id, category)";

        try (Connection c = getConnection(); Statement st = c.createStatement()) {
            st.execute(authSql);
            st.execute(contactsSql);
            st.execute(addCategory);
            st.execute(addFavorite);
            st.execute(idxUser);
            st.execute(idxName);
            st.execute(idxFavorite);
            st.execute(idxCategory);
        }
    }

    // ── Authentication ────────────────────────────────────────────────────────

    public static String hashPassword(String plain) {
        try {
            byte[] salt = new byte[16];
            new SecureRandom().nextBytes(salt);
            return computeHash(salt, plain);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
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
            String[] p = stored.split(":", 2);
            if (p.length != 2) return false;
            byte[] salt = Base64.getDecoder().decode(p[0]);
            return computeHash(salt, plain).equals(stored);
        } catch (Exception e) { return false; }
    }

    public User createUser(String uname, String plain) throws SQLException {
        String sql = "INSERT INTO authentication (username, password_hash) VALUES (?,?) RETURNING id";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, uname);
            ps.setString(2, hashPassword(plain));
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return new User(rs.getString("id"), uname);
            }
        }
    }

    public boolean userExists(String uname) throws SQLException {
        String sql = "SELECT 1 FROM authentication WHERE username=?";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, uname);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        }
    }

    public User validateUser(String uname, String plain) throws SQLException {
        String sql = "SELECT id, password_hash FROM authentication WHERE username=?";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, uname);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                if (!verifyPassword(plain, rs.getString("password_hash"))) return null;
                return new User(rs.getString("id"), uname);
            }
        }
    }

    // ── Contacts — list/search ─────────────────────────────────────────────────

    /**
     * List contacts with optional filters.
     * @param userId   owner
     * @param search   partial match on name/phone/email (null = no filter)
     * @param category exact match on category (null = no filter)
     * @param favOnly  true = only favorites
     * @param sort     "name_asc" | "name_desc" | "recent" (default: name_asc)
     */
    public List<Contact> listContacts(String userId, String search, String category,
                                      boolean favOnly, String sort) throws SQLException {
        StringBuilder sql = new StringBuilder(
            "SELECT id,name,phone,email,address,category,notes,favorite,created_at,updated_at " +
            "FROM contacts WHERE user_id=?::uuid");

        List<Object> params = new ArrayList<>();
        params.add(userId);

        if (search != null && !search.isBlank()) {
            sql.append(" AND (lower(name) LIKE ? OR lower(phone) LIKE ? OR lower(email) LIKE ?)");
            String pat = "%" + search.toLowerCase().trim() + "%";
            params.add(pat); params.add(pat); params.add(pat);
        }
        if (category != null && !category.isBlank()) {
            sql.append(" AND category=?");
            params.add(category);
        }
        if (favOnly) {
            sql.append(" AND favorite=TRUE");
        }

        switch (sort == null ? "name_asc" : sort) {
            case "name_desc" -> sql.append(" ORDER BY lower(name) DESC");
            case "recent"    -> sql.append(" ORDER BY created_at DESC");
            default          -> sql.append(" ORDER BY lower(name) ASC");
        }

        List<Contact> result = new ArrayList<>();
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) ps.setObject(i + 1, params.get(i));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) result.add(mapRow(rs));
            }
        }
        return result;
    }

    public Contact getById(String id, String userId) throws SQLException {
        String sql =
            "SELECT id,name,phone,email,address,category,notes,favorite,created_at,updated_at " +
            "FROM contacts WHERE id=?::uuid AND user_id=?::uuid";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, id);
            ps.setString(2, userId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapRow(rs) : null;
            }
        }
    }

    // ── Contacts — CRUD ───────────────────────────────────────────────────────

    public Contact createContact(String userId, String name, String phone, String email,
                                 String address, String category, String notes,
                                 boolean favorite) throws SQLException {
        String sql =
            "INSERT INTO contacts (user_id,name,phone,email,address,category,notes,favorite) " +
            "VALUES (?::uuid,?,?,?,?,?,?,?) RETURNING id";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, userId);
            ps.setString(2, name);
            ps.setString(3, nn(phone));
            ps.setString(4, nn(email));
            ps.setString(5, nn(address));
            ps.setString(6, nn(category));
            ps.setString(7, nn(notes));
            ps.setBoolean(8, favorite);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return getByIdInternal(c, rs.getString("id"));
            }
        }
    }

    public Contact updateContact(String id, String userId, String name, String phone,
                                 String email, String address, String category,
                                 String notes, boolean favorite) throws SQLException {
        String sql =
            "UPDATE contacts SET name=?,phone=?,email=?,address=?,category=?,notes=?," +
            "favorite=?,updated_at=NOW() " +
            "WHERE id=?::uuid AND user_id=?::uuid";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, name);
            ps.setString(2, nn(phone));
            ps.setString(3, nn(email));
            ps.setString(4, nn(address));
            ps.setString(5, nn(category));
            ps.setString(6, nn(notes));
            ps.setBoolean(7, favorite);
            ps.setString(8, id);
            ps.setString(9, userId);
            if (ps.executeUpdate() == 0) return null;
            return getByIdInternal(c, id);
        }
    }

    public Contact toggleFavorite(String id, String userId) throws SQLException {
        String sql =
            "UPDATE contacts SET favorite = NOT favorite, updated_at=NOW() " +
            "WHERE id=?::uuid AND user_id=?::uuid";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, id);
            ps.setString(2, userId);
            if (ps.executeUpdate() == 0) return null;
            return getByIdInternal(c, id);
        }
    }

    public boolean deleteContact(String id, String userId) throws SQLException {
        String sql = "DELETE FROM contacts WHERE id=?::uuid AND user_id=?::uuid";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, id);
            ps.setString(2, userId);
            return ps.executeUpdate() > 0;
        }
    }

    // ── Dashboard stats ───────────────────────────────────────────────────────

    /** Returns: total, favorites, and per-category counts as a JSON-ready string */
    public String getDashboardStats(String userId) throws SQLException {
        String totalSql    = "SELECT COUNT(*) FROM contacts WHERE user_id=?::uuid";
        String favSql      = "SELECT COUNT(*) FROM contacts WHERE user_id=?::uuid AND favorite=TRUE";
        String catSql      = "SELECT category, COUNT(*) AS cnt FROM contacts WHERE user_id=?::uuid GROUP BY category ORDER BY cnt DESC";
        String recentSql   =
            "SELECT id,name,phone,email,address,category,notes,favorite,created_at,updated_at " +
            "FROM contacts WHERE user_id=?::uuid ORDER BY created_at DESC LIMIT 5";

        long total = 0, favs = 0;
        try (Connection c = getConnection()) {
            try (PreparedStatement ps = c.prepareStatement(totalSql)) {
                ps.setString(1, userId);
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) total = rs.getLong(1); }
            }
            try (PreparedStatement ps = c.prepareStatement(favSql)) {
                ps.setString(1, userId);
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) favs = rs.getLong(1); }
            }

            StringBuilder cats = new StringBuilder("[");
            try (PreparedStatement ps = c.prepareStatement(catSql)) {
                ps.setString(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    boolean first = true;
                    while (rs.next()) {
                        if (!first) cats.append(",");
                        String cat = rs.getString("category");
                        if (cat == null || cat.isBlank()) cat = "Uncategorized";
                        cats.append("{\"category\":\"").append(esc(cat))
                            .append("\",\"count\":").append(rs.getLong("cnt")).append("}");
                        first = false;
                    }
                }
            }
            cats.append("]");

            StringBuilder recent = new StringBuilder("[");
            try (PreparedStatement ps = c.prepareStatement(recentSql)) {
                ps.setString(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    boolean first = true;
                    while (rs.next()) {
                        if (!first) recent.append(",");
                        recent.append(toJson(mapRow(rs)));
                        first = false;
                    }
                }
            }
            recent.append("]");

            return "{" +
                "\"total\":"    + total + "," +
                "\"favorites\":" + favs + "," +
                "\"byCategory\":" + cats + "," +
                "\"recent\":"   + recent +
                "}";
        }
    }

    // ── Categories list ───────────────────────────────────────────────────────

    /** Returns the distinct categories in use by this user, plus the fixed set. */
    public List<String> getCategories() {
        return List.of("Family", "Friends", "Work", "College", "Other");
    }

    // ── Import / Export ───────────────────────────────────────────────────────

    /** Returns all contacts as CSV (name,phone,email,address,category,notes,favorite) */
    public String exportCsv(String userId) throws SQLException {
        StringBuilder sb = new StringBuilder("name,phone,email,address,category,notes,favorite\n");
        String sql =
            "SELECT name,phone,email,address,category,notes,favorite " +
            "FROM contacts WHERE user_id=?::uuid ORDER BY lower(name) ASC";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    sb.append(csvField(rs.getString("name"))).append(",")
                      .append(csvField(rs.getString("phone"))).append(",")
                      .append(csvField(rs.getString("email"))).append(",")
                      .append(csvField(rs.getString("address"))).append(",")
                      .append(csvField(rs.getString("category"))).append(",")
                      .append(csvField(rs.getString("notes"))).append(",")
                      .append(rs.getBoolean("favorite")).append("\n");
                }
            }
        }
        return sb.toString();
    }

    /** Parses CSV (skipping header) and bulk-inserts; returns count inserted. */
    public int importCsv(String userId, String csv) throws SQLException {
        String[] lines = csv.split("\\r?\\n");
        int count = 0;
        String sql =
            "INSERT INTO contacts (user_id,name,phone,email,address,category,notes,favorite) " +
            "VALUES (?::uuid,?,?,?,?,?,?,?)";
        try (Connection c = getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 1; i < lines.length; i++) {  // skip header
                String line = lines[i].trim();
                if (line.isEmpty()) continue;
                String[] cols = parseCsvLine(line);
                if (cols.length < 1 || cols[0].isBlank()) continue;
                ps.setString(1, userId);
                ps.setString(2, cols.length > 0 ? cols[0].trim() : "");
                ps.setString(3, cols.length > 1 ? cols[1].trim() : "");
                ps.setString(4, cols.length > 2 ? cols[2].trim() : "");
                ps.setString(5, cols.length > 3 ? cols[3].trim() : "");
                ps.setString(6, cols.length > 4 ? cols[4].trim() : "");
                ps.setString(7, cols.length > 5 ? cols[5].trim() : "");
                ps.setBoolean(8, cols.length > 6 && "true".equalsIgnoreCase(cols[6].trim()));
                ps.addBatch();
                count++;
            }
            if (count > 0) ps.executeBatch();
        }
        return count;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Contact getByIdInternal(Connection c, String id) throws SQLException {
        String sql =
            "SELECT id,name,phone,email,address,category,notes,favorite,created_at,updated_at " +
            "FROM contacts WHERE id=?::uuid";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapRow(rs) : null;
            }
        }
    }

    private Contact mapRow(ResultSet rs) throws SQLException {
        return new Contact(
            rs.getString("id"),
            rs.getString("name"),
            nn(rs.getString("phone")),
            nn(rs.getString("email")),
            nn(rs.getString("address")),
            nn(rs.getString("category")),
            nn(rs.getString("notes")),
            rs.getBoolean("favorite"),
            ts(rs.getTimestamp("created_at")),
            ts(rs.getTimestamp("updated_at"))
        );
    }

    static String toJson(Contact c) {
        return "{" +
            "\"id\":"         + q(c.getId())        + "," +
            "\"name\":"       + q(c.getName())      + "," +
            "\"phone\":"      + q(c.getPhone())     + "," +
            "\"email\":"      + q(c.getEmail())     + "," +
            "\"address\":"    + q(c.getAddress())   + "," +
            "\"category\":"   + q(c.getCategory())  + "," +
            "\"notes\":"      + q(c.getNotes())     + "," +
            "\"favorite\":"   + c.isFavorite()      + "," +
            "\"createdAt\":"  + q(c.getCreatedAt()) + "," +
            "\"updatedAt\":"  + q(c.getUpdatedAt()) +
            "}";
    }

    private static String q(String v)   { return "\"" + esc(v) + "\""; }
    private static String nn(String s)  { return s == null ? "" : s; }
    private static String ts(Timestamp t) { return t == null ? "" : t.toInstant().toString(); }

    static String esc(String v) {
        if (v == null) return "";
        return v.replace("\\","\\\\").replace("\"","\\\"")
                .replace("\n","\\n").replace("\r","\\r").replace("\t","\\t");
    }

    private static String csvField(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    /** Very simple CSV line parser (handles quoted fields). */
    private static String[] parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (inQuotes) {
                if (ch == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') { cur.append('"'); i++; }
                    else inQuotes = false;
                } else cur.append(ch);
            } else {
                if (ch == '"') inQuotes = true;
                else if (ch == ',') { fields.add(cur.toString()); cur.setLength(0); }
                else cur.append(ch);
            }
        }
        fields.add(cur.toString());
        return fields.toArray(new String[0]);
    }
}
