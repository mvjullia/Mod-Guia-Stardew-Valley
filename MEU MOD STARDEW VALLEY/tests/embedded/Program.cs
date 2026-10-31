using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.IO;
using System.Linq;
using StardewRealtimeTelemetry;
namespace StardewModdingAPI { public enum LogLevel {Info,Warn,Trace} public interface IMonitor {void Log(string text, LogLevel level);} }
class TestMonitor:StardewModdingAPI.IMonitor { public void Log(string text, StardewModdingAPI.LogLevel level) {Console.WriteLine(text);} }
class Program
{
    static async Task Main()
    {
        string albumRoot = Path.Combine(Path.GetTempPath(), "stardew-embedded-albums-test-" + Guid.NewGuid().ToString("N"));
        try {
        var albums = new AlbumStore(albumRoot); albums.Select("123", "456");
        byte[] png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDZ8AAAAASUVORK5CYII=");
        var photo = albums.Add(png, null, "center-arrival", "Trouxe o item", "Entrando no Centro", "Maria", "CommunityCenter", 1, "spring", 2, 900, 12)!;
        using var server = new EmbeddedGuide(new TestMonitor(), albums);
        server.Start();
        using var handler = new HttpClientHandler { UseCookies = true };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(5) };
        var bad = await client.GetAsync(server.Origin + "/api/events");
        if (bad.StatusCode != HttpStatusCode.Unauthorized) throw new Exception("SSE sem sessão");
        if ((await client.GetAsync(server.Origin + "/api/albums")).StatusCode != HttpStatusCode.Unauthorized) throw new Exception("Álbuns sem sessão");
        if ((await client.GetAsync(server.Origin + "/api/albums/photos/" + photo.ImageId + ".png")).StatusCode != HttpStatusCode.Unauthorized) throw new Exception("Foto sem sessão");
        var pageRequest = new HttpRequestMessage(HttpMethod.Get, server.Origin + "/");
        pageRequest.Headers.Add("Sec-Fetch-Site", "none");
        var page = await client.SendAsync(pageRequest);
        if (!(await page.Content.ReadAsStringAsync()).Contains("window.embeddedGuide=true")) throw new Exception("marcador ausente");
        foreach (var file in new[] { "items.json", "item-fields.json", "item-catalog.js", "game-ui.js", "game-cursor.png", "menu-hover.wav", "menu-select.wav", "menu-open.wav", "menu-close.wav", "game-ui-sources.json", "season.js", "season-guide.json", "albums.js", "album-moments.json", "Pixellari.ttf", "community-center.png" })
        {
            using var asset = await client.GetAsync(server.Origin + "/" + file);
            asset.EnsureSuccessStatusCode();
            var expected = System.IO.Path.GetExtension(file) switch { ".json" => "application/json", ".png" => "image/png", ".wav" => "audio/wav", ".ttf" => "font/ttf", _ => "text/javascript" };
            if (asset.Content.Headers.ContentType?.MediaType != expected) throw new Exception("MIME inválido: " + file);
            if (file == "items.json" || file == "item-fields.json")
            {
                using var parsed = System.Text.Json.JsonDocument.Parse(await asset.Content.ReadAsStringAsync());
                if (file == "items.json" && parsed.RootElement.GetProperty("schemaVersion").GetInt32() != 2)
                    throw new Exception("Versão do catálogo inválida");
                var count = file == "items.json" ? parsed.RootElement.GetProperty("items").GetArrayLength() : parsed.RootElement.GetArrayLength();
                if (file == "items.json" ? count == 0 : count != 35) throw new Exception("Catálogo incompleto: " + file);
            }
            if (file.EndsWith(".wav") || file.EndsWith(".png"))
            {
                byte[] bytes = await asset.Content.ReadAsByteArrayAsync();
                bool valid = file.EndsWith(".wav") ? bytes.Length > 44 && System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF"
                    : bytes.Length > 24 && bytes[0] == 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71;
                if (!valid) throw new Exception("Recurso binário inválido: " + file);
            }
        }
        using (var albumJson = System.Text.Json.JsonDocument.Parse(await client.GetStringAsync(server.Origin + "/api/albums")))
            if (albumJson.RootElement.GetProperty("photos")[0].GetProperty("id").GetString() != photo.Id) throw new Exception("Álbum ausente ou nomes JSON incompatíveis");
        if (!(await client.GetByteArrayAsync(server.Origin + "/api/albums/photos/" + photo.ImageId + ".png")).SequenceEqual(png)) throw new Exception("Bytes da foto divergentes");
        albums.Select("123", "789");
        if ((await client.GetAsync(server.Origin + "/api/albums/photos/" + photo.ImageId + ".png")).StatusCode != HttpStatusCode.NotFound) throw new Exception("Foto exposta para outro jogador");
        server.Publish("{\"teste\":true}");
        using var response = await client.GetAsync(server.Origin + "/api/events", HttpCompletionOption.ResponseHeadersRead);
        using var reader = new System.IO.StreamReader(await response.Content.ReadAsStreamAsync());
        string? line;
        bool found = false;
        while ((line = await reader.ReadLineAsync()) != null && line != "")
            if (line.Contains("\"teste\":true")) found = true;
        if (!found) throw new Exception("snapshot não recebido");
        Console.WriteLine("OK: página, sessão, SSE, catálogo JSON, cursor, sons e álbuns privados integrados");
        } finally {
            string resolved = Path.GetFullPath(albumRoot);
            if (!resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(resolved).StartsWith("stardew-embedded-albums-test-")) throw new Exception("Diretório de limpeza inválido");
            if (Directory.Exists(resolved)) Directory.Delete(resolved, true);
        }
    }
}
