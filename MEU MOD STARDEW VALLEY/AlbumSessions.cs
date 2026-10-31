using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StardewRealtimeTelemetry;

internal sealed record AlbumSession(string Id, string Kind, string Collection, string InitiatorId, string[] PlayerIds, string[] PlayerNames,
    int Year, string Season, int Day, DateTimeOffset CreatedAt, bool Automatic = false,
    Dictionary<string, string>? Photos = null, Dictionary<string, string>? Receipts = null,
    Dictionary<string, string>? Failures = null, string? Digest = null, string? CompositePhotoId = null)
{
    public string Status => Digest != null && PlayerIds.All(id => Receipts?.GetValueOrDefault(id) == Digest) ? "synchronized" :
        Failures?.Count > 0 ? "capture-failed" : Photos?.Count >= PlayerIds.Length ? "confirming" : "pending";
}

/// <summary>Durable session journal. Receipts describe possession of both originals and their immutable metadata.</summary>
internal sealed class AlbumSessions
{
    private readonly string path;
    private readonly Action changed;
    private readonly object gate = new();
    private Dictionary<string, AlbumSession> sessions = new();
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };
    public AlbumSessions(string directory, Action changed)
    {
        path = Path.Combine(directory, "sessions.json"); this.changed = changed;
        if (File.Exists(path)) {
            var list = JsonSerializer.Deserialize<AlbumSession[]>(File.ReadAllText(path), Json) ?? throw new InvalidDataException("Sessões inválidas.");
            foreach (var session in list) { if (!Valid(session) || sessions.ContainsKey(session.Id)) throw new InvalidDataException("Sessão corrompida."); sessions.Add(session.Id, session); }
        }
    }
    public static bool Valid(AlbumSession session) => Regex.IsMatch(session.Id ?? "", "^[a-f0-9]{32}$") && session.PlayerIds?.Length == 2 &&
        session.PlayerIds.Distinct().Count() == 2 && session.PlayerIds.All(id => Regex.IsMatch(id ?? "", @"^-?\d+$")) && session.PlayerIds.Contains(session.InitiatorId) &&
        session.PlayerNames?.Length == 2 && session.PlayerNames.All(name => name != null && name.Length <= 200) && session.Kind?.Length is > 0 and <= 100 &&
        session.Collection?.Length is > 0 and <= 50 && session.Year > 0 && session.Day is >= 1 and <= 28 && new[] { "spring", "summer", "fall", "winter" }.Contains(session.Season) &&
        (session.Photos == null || session.Photos.All(pair => session.PlayerIds.Contains(pair.Key) && Regex.IsMatch(pair.Value ?? "", "^[a-f0-9]{32}$"))) &&
        (session.Receipts == null || session.Receipts.All(pair => session.PlayerIds.Contains(pair.Key) && Regex.IsMatch(pair.Value ?? "", "^[a-f0-9]{64}$"))) &&
        (session.Failures == null || session.Failures.All(pair => session.PlayerIds.Contains(pair.Key) && pair.Value?.Length <= 200)) &&
        (session.Digest == null || Regex.IsMatch(session.Digest, "^[a-f0-9]{64}$") && session.Photos?.Count == 2);
    public AlbumSession[] Snapshot() { lock (gate) return sessions.Values.OrderByDescending(session => session.CreatedAt).ToArray(); }
    public AlbumSession? Find(string id) { lock (gate) return sessions.GetValueOrDefault(id); }
    public bool Start(AlbumSession definition)
    {
        lock (gate) {
            if (!Valid(definition)) return false;
            if (sessions.TryGetValue(definition.Id, out var existing)) return existing.Kind == definition.Kind && existing.PlayerIds.SequenceEqual(definition.PlayerIds) &&
                existing.InitiatorId == definition.InitiatorId && existing.Collection == definition.Collection &&
                existing.Year == definition.Year && existing.Season == definition.Season && existing.Day == definition.Day;
            Save(definition with { Photos = new(), Receipts = new(), Failures = new(), Digest = null, CompositePhotoId = null }); return true;
        }
    }
    public void PhotoArrived(AlbumPhoto photo)
    {
        lock (gate) {
            if (photo.SessionId == null || photo.IsComposite || photo.OwnerId == null || !Regex.IsMatch(photo.Id, "^[a-f0-9]{32}$") || !sessions.TryGetValue(photo.SessionId, out var session) || !session.PlayerIds.Contains(photo.OwnerId)) return;
            var photos = new Dictionary<string, string>(session.Photos ?? new());
            if (photos.TryGetValue(photo.OwnerId, out string? prior) && prior == photo.Id) return;
            photos[photo.OwnerId] = photo.Id; var failures = new Dictionary<string, string>(session.Failures ?? new()); failures.Remove(photo.OwnerId);
            Save(session with { Photos = photos, Failures = failures, Digest = null, Receipts = new(), CompositePhotoId = null });
        }
    }
    public void Failed(string id, string player, string reason)
    {
        lock (gate) { if (!sessions.TryGetValue(id, out var session) || !session.PlayerIds.Contains(player) || session.Photos?.ContainsKey(player) == true) return;
            var failures = new Dictionary<string, string>(session.Failures ?? new()) { [player] = reason.Length > 200 ? reason[..200] : reason }; Save(session with { Failures = failures }); }
    }
    public void SetDigest(string id, string digest)
    {
        lock (gate) { if (!sessions.TryGetValue(id, out var session) || session.Photos?.Count != session.PlayerIds.Length || session.Digest == digest || !Regex.IsMatch(digest, "^[a-f0-9]{64}$")) return; Save(session with { Digest = digest, Receipts = new() }); }
    }
    public bool Confirm(string id, string player, string digest)
    {
        lock (gate) { if (!sessions.TryGetValue(id, out var session) || session.Digest != digest || !session.PlayerIds.Contains(player)) return false;
            if (session.Receipts?.GetValueOrDefault(player) == digest) return true;
            var receipts = new Dictionary<string, string>(session.Receipts ?? new()) { [player] = digest }; Save(session with { Receipts = receipts }); return true; }
    }
    public void Composite(string id, string photoId)
    {
        lock (gate) { if (sessions.TryGetValue(id, out var session) && session.CompositePhotoId != photoId) Save(session with { CompositePhotoId = photoId }); }
    }
    private void Save(AlbumSession session)
    {
        var updated = new Dictionary<string, AlbumSession>(sessions) { [session.Id] = session };
        File.WriteAllText(path + ".tmp", JsonSerializer.Serialize(updated.Values.ToArray(), Json)); File.Move(path + ".tmp", path, true); sessions = updated; changed();
    }
}
