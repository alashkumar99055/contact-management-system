public class Task {
    private String id;
    private String title;
    private String description;
    private String status;      // "pending" | "completed"
    private String priority;    // "low" | "medium" | "high"
    private String dueDate;     // ISO date string "YYYY-MM-DD" or null
    private String dueTime;     // "HH:MM" or null
    private String categoryId;  // UUID or null
    private String categoryName;// denormalized for convenience, not persisted
    private String tags;        // comma-separated
    private String createdAt;   // ISO timestamp
    private String updatedAt;   // ISO timestamp
    private String completedAt; // ISO timestamp or null

    public Task() {}

    public Task(String id, String title, String description, String status,
                String priority, String dueDate, String dueTime,
                String categoryId, String categoryName, String tags,
                String createdAt, String updatedAt, String completedAt) {
        this.id           = id;
        this.title        = title;
        this.description  = description;
        this.status       = status;
        this.priority     = priority;
        this.dueDate      = dueDate;
        this.dueTime      = dueTime;
        this.categoryId   = categoryId;
        this.categoryName = categoryName;
        this.tags         = tags;
        this.createdAt    = createdAt;
        this.updatedAt    = updatedAt;
        this.completedAt  = completedAt;
    }

    // ── Getters & Setters ─────────────────────────────────────

    public String getId()            { return id; }
    public void   setId(String id)   { this.id = id; }

    public String getTitle()               { return title; }
    public void   setTitle(String title)   { this.title = title; }

    public String getDescription()                   { return description; }
    public void   setDescription(String description) { this.description = description; }

    public String getStatus()              { return status; }
    public void   setStatus(String status) { this.status = status; }

    public String getPriority()                { return priority; }
    public void   setPriority(String priority) { this.priority = priority; }

    public String getDueDate()               { return dueDate; }
    public void   setDueDate(String dueDate) { this.dueDate = dueDate; }

    public String getDueTime()               { return dueTime; }
    public void   setDueTime(String dueTime) { this.dueTime = dueTime; }

    public String getCategoryId()                  { return categoryId; }
    public void   setCategoryId(String categoryId) { this.categoryId = categoryId; }

    public String getCategoryName()                    { return categoryName; }
    public void   setCategoryName(String categoryName) { this.categoryName = categoryName; }

    public String getTags()            { return tags; }
    public void   setTags(String tags) { this.tags = tags; }

    public String getCreatedAt()                 { return createdAt; }
    public void   setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt()                 { return updatedAt; }
    public void   setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }

    public String getCompletedAt()                   { return completedAt; }
    public void   setCompletedAt(String completedAt) { this.completedAt = completedAt; }
}
