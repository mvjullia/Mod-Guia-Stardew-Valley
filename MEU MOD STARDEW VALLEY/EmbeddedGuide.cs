using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using StardewModdingAPI;

namespace StardewRealtimeTelemetry;

internal sealed class EmbeddedGuide : IDisposable
{
    private HttpListener listener = new();
    private readonly ConcurrentDictionary<Guid, HttpListenerResponse> clients = new();
    private readonly string secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private readonly string session = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private readonly IMonitor monitor;
    private string? latest;
    private long updateId;
    public string Origin { get; private set; } = "";
    public string StartUrl => Origin + "/#connect=" + secret;
    public EmbeddedGuide(IMonitor monitor) { this.monitor = monitor; }
    public void Start()
    {
        Exception? last = null;
        for (int port = 8787; port <= 8807; port++) {
            try { Origin = $"http://127.0.0.1:{port}"; listener.Prefixes.Clear(); listener.Prefixes.Add(Origin + "/"); listener.Start(); _ = Loop(); return; }
            catch (HttpListenerException e) { last = e; listener.Close(); listener = new HttpListener(); }
        }
        throw new InvalidOperationException("Não foi possível abrir uma porta local para o guia.", last);
    }
    public void Publish(string snapshot)
    {
        Interlocked.Exchange(ref latest, snapshot);
        long update = Interlocked.Increment(ref updateId);
        monitor.Log($"Atualização #{update} publicada; navegadores conectados: {clients.Count}.", LogLevel.Info);
        byte[] bytes = Encoding.UTF8.GetBytes("event: snapshot\ndata: " + snapshot + "\n\n");
        foreach (var pair in clients) _ = Send(pair.Key, pair.Value, bytes);
    }
    private async Task Send(Guid id, HttpListenerResponse response, byte[] bytes)
    {
        try { await response.OutputStream.WriteAsync(bytes); await response.OutputStream.FlushAsync(); }
        catch (Exception ex) { if (clients.TryRemove(id, out _)) monitor.Log($"Navegador desconectado ({ex.GetType().Name}); conexões ativas: {clients.Count}.", LogLevel.Info); try { response.Close(); } catch {} }
    }
    private async Task Loop()
    {
        while (listener.IsListening) {
            try { var context = await listener.GetContextAsync(); _ = Handle(context); }
            catch (HttpListenerException) { break; } catch (ObjectDisposedException) { break; }
        }
    }
    private async Task Handle(HttpListenerContext ctx)
    {
        var req = ctx.Request; var res = ctx.Response;
        try {
            res.Headers["X-Content-Type-Options"] = "nosniff";
            if (req.UserHostName != new Uri(Origin).Authority || (req.Headers["Origin"] != null && req.Headers["Origin"] != Origin)) { res.StatusCode=403; res.Close(); return; }
            var route = req.Url?.AbsolutePath;
            if(route == "/api/wiki" && req.HttpMethod == "GET") {
                if(req.Cookies["guia_embedded"]?.Value != session){res.StatusCode=401;res.Close();return;}
                try {string content=await WikiReader.Fetch(req.QueryString["title"]??"",req.QueryString["lang"]??"pt");res.ContentType="application/json; charset=utf-8";await res.OutputStream.WriteAsync(Encoding.UTF8.GetBytes(content));}
                catch(Exception error){monitor.Log("Falha ao consultar Wiki: "+error.GetType().Name,LogLevel.Warn);res.StatusCode=502;res.ContentType="application/json";await res.OutputStream.WriteAsync(Encoding.UTF8.GetBytes("{\"error\":\"Não foi possível carregar esta página da Wiki. Verifique a conexão e tente novamente.\"}"));}
                res.Close();return;
            }
            if (route == "/api/session" && req.HttpMethod == "POST") {
                if (req.Headers["Origin"] != Origin || req.ContentLength64 < 0 || req.ContentLength64 > 1024) { res.StatusCode=403; res.Close(); return; }
                using var reader = new StreamReader(req.InputStream, Encoding.UTF8); using var document = JsonDocument.Parse(await reader.ReadToEndAsync());
                if (!document.RootElement.TryGetProperty("token", out var supplied) || supplied.GetString() != secret) { monitor.Log("Sessão recusada: chave inválida. Abra o guia pelo comando guia_abrir.", LogLevel.Warn); res.StatusCode=401; res.Close(); return; }
                monitor.Log("Sessão do navegador autenticada.", LogLevel.Info);
                res.Headers.Add("Set-Cookie", $"guia_embedded={session}; HttpOnly; SameSite=Strict; Path=/api"); res.ContentType="application/json";
                byte[] ok=Encoding.UTF8.GetBytes("{\"ok\":true}"); await res.OutputStream.WriteAsync(ok); res.Close(); return;
            }
            if (route == "/api/events" && req.HttpMethod == "GET") {
                if (req.Cookies["guia_embedded"]?.Value != session) { monitor.Log("Conexão SSE recusada: navegador sem sessão. Use guia_abrir.", LogLevel.Warn); res.StatusCode=401; res.Close(); return; }
                res.ContentType="text/event-stream"; res.Headers["Cache-Control"]="no-cache, no-transform"; res.SendChunked=true;
                Guid id=Guid.NewGuid(); clients[id]=res; monitor.Log($"Navegador conectado ao guia; conexões ativas: {clients.Count}.", LogLevel.Info);
                string? snapshot=Volatile.Read(ref latest); if(snapshot != null) await Send(id,res,Encoding.UTF8.GetBytes("event: snapshot\ndata: "+snapshot+"\n\n"));
                while(listener.IsListening && clients.ContainsKey(id)) { await Task.Delay(15000); await Send(id,res,Encoding.UTF8.GetBytes(": heartbeat\n\n")); }
                return;
            }
            if (req.HttpMethod != "GET") { res.StatusCode=405;res.Close();return; }
            string? resource = route switch { "/" or "/index.html" => "index.html", "/telemetry.js" => "telemetry.js", "/realtime.js" => "realtime.js", "/embedded.js" => "embedded.js", "/visual.js" => "visual.js", "/polish.js" => "polish.js", "/acquisition.js" => "acquisition.js", "/profile.js" => "profile.js", "/time-format.js" => "time-format.js", "/knowledge.js" => "knowledge.js", "/Pixellari.ttf" => "Pixellari.ttf", "/community-center.png" => "community-center.png", "/community-center-mask.png" => "community-center-mask.png", _ => null };
            if (resource == null) { res.StatusCode=404;res.Close();return; }
            using Stream? file=typeof(EmbeddedGuide).Assembly.GetManifestResourceStream("Guide."+resource);
            if(file == null) {res.StatusCode=500;res.Close();return;}
            res.ContentType=resource.EndsWith(".html") ? "text/html; charset=utf-8" : resource.EndsWith(".ttf") ? "font/ttf" : resource.EndsWith(".png") ? "image/png" : "text/javascript; charset=utf-8";
            res.Headers["Cache-Control"]="no-store";
            if (resource == "index.html") {
                string? fetchSite=req.Headers["Sec-Fetch-Site"];
                if(fetchSite == "none" || fetchSite == "same-origin") res.Headers.Add("Set-Cookie", $"guia_embedded={session}; HttpOnly; SameSite=Strict; Path=/api");
                using var htmlReader = new StreamReader(file, Encoding.UTF8);
                string html=(await htmlReader.ReadToEndAsync()).Replace("<script src=\"embedded.js\">", "<script>window.embeddedGuide=true;</script><script src=\"embedded.js\">");
                byte[] page=Encoding.UTF8.GetBytes(html); await res.OutputStream.WriteAsync(page);
            } else await file.CopyToAsync(res.OutputStream);
            res.Close();
        } catch (Exception e) { monitor.Log($"Guia local: erro ao processar requisição ({e.GetType().Name}: {e.Message}).", LogLevel.Warn);try{res.Close();}catch{} }
    }
    public void Dispose() { try { listener.Stop();listener.Close(); } catch (ObjectDisposedException) {}foreach(var entry in clients) {try{entry.Value.Close();}catch{}}clients.Clear(); }
}
