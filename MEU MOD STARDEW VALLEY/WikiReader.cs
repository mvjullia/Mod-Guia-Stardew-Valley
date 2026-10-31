using System;
using System.Net.Http;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Tasks;
namespace StardewRealtimeTelemetry;
internal static class WikiReader
{
    private static readonly HttpClient client = new() { Timeout=TimeSpan.FromSeconds(20) };
    private static readonly ConcurrentDictionary<string,string> cache = new();
    public static async Task<string> Fetch(string title, string language)
    {
        if(string.IsNullOrWhiteSpace(title)||title.Length>180)throw new ArgumentException("Título inválido");
        string lang=language=="en"?"en":"pt";string key=lang+":"+title;
        if(cache.TryGetValue(key,out var result))return result;
        string host=lang=="pt"?"pt.stardewvalleywiki.com":"stardewvalleywiki.com";
        string url="https://"+host+"/mediawiki/api.php?action=parse&format=json&redirects=1&prop=text&page="+Uri.EscapeDataString(title);
        using var request=new HttpRequestMessage(HttpMethod.Get,url);request.Headers.UserAgent.ParseAdd("StardewGuideMod/1.0");
        using var response=await client.SendAsync(request);response.EnsureSuccessStatusCode();
        string body=await response.Content.ReadAsStringAsync();if(body.Length>4000000)throw new Exception("Página muito grande");
        using var document=JsonDocument.Parse(body);
        if(!document.RootElement.TryGetProperty("parse",out var parsed))throw new Exception("Página não encontrada na Wiki");
        result=JsonSerializer.Serialize(new {title=parsed.GetProperty("title").GetString(),html=parsed.GetProperty("text").GetProperty("*").GetString(),language=lang,source="https://"+host+"/"+Uri.EscapeDataString(title),license="CC BY-NC-SA — Stardew Valley Wiki"});
        if(cache.Count>100)cache.Clear();cache[key]=result;return result;
    }
}
