public class Contact {
    private String id;
    private String name;
    private String phone;
    private String email;
    private String address;
    private String category;   // Family | Friends | Work | College | Other | ""
    private String notes;
    private boolean favorite;
    private String createdAt;
    private String updatedAt;

    public Contact() {}

    public Contact(String id, String name, String phone, String email,
                   String address, String category, String notes,
                   boolean favorite, String createdAt, String updatedAt) {
        this.id        = id;
        this.name      = name;
        this.phone     = phone;
        this.email     = email;
        this.address   = address;
        this.category  = category;
        this.notes     = notes;
        this.favorite  = favorite;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String  getId()        { return id; }
    public void    setId(String id) { this.id = id; }

    public String  getName()          { return name; }
    public void    setName(String n)  { this.name = n; }

    public String  getPhone()           { return phone; }
    public void    setPhone(String p)   { this.phone = p; }

    public String  getEmail()           { return email; }
    public void    setEmail(String e)   { this.email = e; }

    public String  getAddress()             { return address; }
    public void    setAddress(String a)     { this.address = a; }

    public String  getCategory()            { return category; }
    public void    setCategory(String c)    { this.category = c; }

    public String  getNotes()           { return notes; }
    public void    setNotes(String n)   { this.notes = n; }

    public boolean isFavorite()             { return favorite; }
    public void    setFavorite(boolean f)   { this.favorite = f; }

    public String  getCreatedAt()               { return createdAt; }
    public void    setCreatedAt(String c)       { this.createdAt = c; }

    public String  getUpdatedAt()               { return updatedAt; }
    public void    setUpdatedAt(String u)       { this.updatedAt = u; }
}
