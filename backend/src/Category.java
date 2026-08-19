public class Category {
    private String id;
    private String name;
    private String color;   // hex color e.g. "#a78bfa"
    private String createdAt;

    public Category() {}

    public Category(String id, String name, String color, String createdAt) {
        this.id        = id;
        this.name      = name;
        this.color     = color;
        this.createdAt = createdAt;
    }

    // ── Getters & Setters ─────────────────────────────────────

    public String getId()          { return id; }
    public void   setId(String id) { this.id = id; }

    public String getName()            { return name; }
    public void   setName(String name) { this.name = name; }

    public String getColor()             { return color; }
    public void   setColor(String color) { this.color = color; }

    public String getCreatedAt()                 { return createdAt; }
    public void   setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
