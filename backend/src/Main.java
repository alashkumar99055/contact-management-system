public class Main {
    public static void main(String[] args) throws Exception {
        int port = args.length > 0
            ? Integer.parseInt(args[0])
            : Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        Server server = new Server(port);
        int actualPort = server.start();
        System.out.println("ContactFlow server started on http://0.0.0.0:" + actualPort);
    }
}
