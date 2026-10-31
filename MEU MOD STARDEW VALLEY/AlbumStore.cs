using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Security.Cryptography;

namespace StardewRealtimeTelemetry;

internal sealed record AlbumPhoto(string Id, string ImageId, string Kind, string Title, string Description,
    string PlayerName, string Location, int Year, string Season, int Day, int Time, DateTimeOffset CapturedAt,
    string? Collection = null, string? PairKey = null, string[]? Participants = null, string? EpisodeKey = null, string? OwnerId = null, string? Evidence = null,
    string? SessionId = null, bool IsComposite = false, string? ImageHash = null);

/// <summary>Local, per-save/per-player album. Never deletes older photographs.</summary>
internal sealed class AlbumStore
{
    private readonly string root;
    private readonly object gate = new();
    private string? activeDirectory;
    private List<AlbumPhoto> photos = new();
    public AlbumSessions? Sessions { get; private set; }
    public string? ActiveDirectory { get { lock (gate) return activeDirectory; } }
    public long Version { get; private set; }
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };
    public AlbumStore(string root) { this.root = Path.GetFullPath(root); }
    public void Select(string saveId, string playerId)
    {
        if (!Regex.IsMatch(saveId, @"^\d+$") || !Regex.IsMatch(playerId, @"^-?\d+$")) throw new ArgumentException("Identidade de álbum inválida.");
        lock (gate)
        {
            activeDirectory = null; photos = new(); Sessions = null;
            string directory = Path.Combine(root, saveId, playerId), index = Path.Combine(directory, "index.json");
            var loaded = File.Exists(index) ? JsonSerializer.Deserialize<List<AlbumPhoto>>(File.ReadAllText(index), Json) ?? throw new InvalidDataException("Índice de álbum inválido.") : new();
            if (loaded.Any(photo => !ValidId(photo.Id) || !ValidId(photo.ImageId))) throw new InvalidDataException("Identificador de foto inválido.");
            Directory.CreateDirectory(directory); var journal = new AlbumSessions(directory, () => Version++);
            photos = loaded; activeDirectory = directory; Sessions = journal; Version++;
        }
    }
    public void Deactivate() { lock (gate) { activeDirectory = null; photos = new(); Sessions = null; Version++; } }
    public object List()
    {
        lock (gate) return new { supported = true, active = activeDirectory != null, photos = photos.OrderByDescending(p => p.CapturedAt).ToArray(), sessions = Sessions?.Snapshot() ?? Array.Empty<AlbumSession>() };
    }
    public AlbumPhoto[] Snapshot() { lock (gate) return photos.ToArray(); }
    public AlbumPhoto? FindPhoto(string id) { lock (gate) return photos.Find(photo => photo.Id == id); }
    public bool HasEpisode(string? key) { lock (gate) return key != null && photos.Any(photo => photo.EpisodeKey == key); }
    public AlbumPhoto? Add(byte[]? png, string? reuseImageId, string kind, string title, string description,
        string playerName, string location, int year, string season, int day, int time, int dailyLimit,
        string? collection = null, string? pairKey = null, string[]? participants = null, string? episodeKey = null, string? ownerId = null, string? evidence = null, string? sessionId = null)
    {
        lock (gate)
        {
            if (activeDirectory == null || HasEpisode(episodeKey)) return null;
            if (collection is not "joja" and not "nights" and not "mishaps" && photos.Count(p => !p.IsComposite && (p.OwnerId == null || p.OwnerId == ownerId) && p.Collection is not "joja" and not "nights" and not "mishaps" && p.Year == year && p.Season == season && p.Day == day) >= dailyLimit) return null;
            if (episodeKey == null && photos.Any(p => p.Kind == kind && p.Year == year && p.Season == season && p.Day == day && p.Description == description)) return null;
            string id = Guid.NewGuid().ToString("N"), imageId = id;
            if (reuseImageId != null)
            {
                if (!ValidId(reuseImageId) || !photos.Any(p => p.ImageId == reuseImageId) || !File.Exists(Path.Combine(activeDirectory, reuseImageId + ".png"))) return null;
                imageId = reuseImageId;
            }
            else
            {
                if (png == null || png.Length < 24 || png[0] != 137 || png[1] != 80 || png[2] != 78 || png[3] != 71) throw new InvalidDataException("Foto não contém um PNG.");
                string image = Path.Combine(activeDirectory, imageId + ".png"), temporary = image + ".tmp";
                File.WriteAllBytes(temporary, png); File.Move(temporary, image);
            }
            var photo = new AlbumPhoto(id, imageId, kind, title, description, playerName, location, year, season, day, time, DateTimeOffset.UtcNow,
                collection, pairKey, participants, episodeKey, ownerId, evidence, sessionId, false,
                png != null ? Hash(png) : photos.First(p => p.ImageId == imageId).ImageHash ?? Hash(File.ReadAllBytes(Path.Combine(activeDirectory, imageId + ".png"))));
            if (reuseImageId != null) {
                var original = photos.First(p => p.ImageId == reuseImageId);
                photo = photo with { Location = original.Location, Year = original.Year, Season = original.Season,
                    Day = original.Day, Time = original.Time, CapturedAt = original.CapturedAt };
            }
            var updated = new List<AlbumPhoto>(photos) { photo };
            string index = Path.Combine(activeDirectory, "index.json");
            File.WriteAllText(index + ".tmp", JsonSerializer.Serialize(updated, Json));
            File.Move(index + ".tmp", index, true); photos = updated; Version++;
            Sessions?.PhotoArrived(photo);
            return photo;
        }
    }
    public bool Import(AlbumPhoto photo, byte[] png, string senderId)
    {
        lock (gate) {
            if (activeDirectory == null || photo.OwnerId != senderId || !ValidId(photo.Id) || !ValidId(photo.ImageId)) return false;
            if (png.Length < 24 || png.Length > 4 * 1024 * 1024 || png[0] != 137 || png[1] != 80 || png[2] != 78 || png[3] != 71) return false;
            string hash = Hash(png); if (photo.ImageHash != null && photo.ImageHash != hash) return false; photo = photo with { ImageHash = hash };
            var existing = photos.Find(p => p.Id == photo.Id); if (existing != null && (existing.OwnerId != senderId || existing.ImageId != photo.ImageId || existing.ImageHash != null && existing.ImageHash != hash)) return false;
            string image = Path.Combine(activeDirectory, photo.ImageId + ".png");
            if (File.Exists(image)) { if (!File.ReadAllBytes(image).SequenceEqual(png)) { if (existing == null) return false; File.WriteAllBytes(image + ".tmp", png); File.Move(image + ".tmp", image, true); } }
            else { File.WriteAllBytes(image + ".tmp", png); File.Move(image + ".tmp", image); }
            var updated = photos.Where(p => p.Id != photo.Id).Append(photo).ToList(); string index = Path.Combine(activeDirectory, "index.json");
            File.WriteAllText(index + ".tmp", JsonSerializer.Serialize(updated, Json)); File.Move(index + ".tmp", index, true); photos = updated; Version++; Sessions?.PhotoArrived(photo); return true;
        }
    }
    public bool ValidImage(AlbumPhoto photo) { var bytes = ReadImage(photo.ImageId); return bytes != null && (photo.ImageHash == null || Hash(bytes) == photo.ImageHash); }
    public static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    public static string StableId(string key) => Hash(System.Text.Encoding.UTF8.GetBytes(key))[..32];
    public static string MetadataHash(AlbumPhoto photo) => Hash(System.Text.Encoding.UTF8.GetBytes(JsonSerializer.Serialize(photo, Json)));
    public string? SessionDigest(string id)
    {
        lock (gate) {
            var session = Sessions?.Find(id); if (session?.Photos?.Count != 2) return null;
            var originals = session.PlayerIds.Select(owner => photos.Find(photo => photo.Id == session.Photos.GetValueOrDefault(owner) && photo.OwnerId == owner && !photo.IsComposite)).ToArray();
            if (originals.Any(photo => photo == null || !ValidImage(photo))) return null;
            return Hash(System.Text.Encoding.UTF8.GetBytes(string.Join("|", originals.Select(photo => photo!.OwnerId + ":" + photo.Id + ":" + MetadataHash(photo)))));
        }
    }
    public AlbumPhoto? SaveComposite(string expectedDirectory, AlbumSession session, byte[] png, string ownerId)
    {
        lock (gate) {
            var journal = Sessions;
            if (activeDirectory != expectedDirectory || journal == null || session.Digest == null || journal.Find(session.Id)?.Digest != session.Digest || session.Photos?.Count != 2) return null;
            string id = StableId(session.Id + "/composite-meta"), imageId = StableId(session.Id + "/composite-image");
            var originals = session.PlayerIds.Select(owner => photos.First(photo => photo.Id == session.Photos[owner])).ToArray(); var first = originals[0];
            var composite = new AlbumPhoto(id, imageId, session.Kind + "-combined", first.Title,
                string.Join("\n", originals.Select(photo => photo.Description)), string.Join(" & ", session.PlayerNames), "Duas perspectivas", session.Year, session.Season,
                session.Day, first.Time, originals.Min(photo => photo.CapturedAt), session.Collection,
                string.Join(":", session.PlayerIds), session.PlayerNames, "composite/" + session.Id, ownerId, session.Digest, session.Id, true, Hash(png));
            string image = Path.Combine(activeDirectory!, imageId + ".png"), index = Path.Combine(activeDirectory!, "index.json");
            File.WriteAllBytes(image + ".tmp", png); File.Move(image + ".tmp", image, true);
            var updated = photos.Where(photo => photo.Id != id).Append(composite).ToList();
            File.WriteAllText(index + ".tmp", JsonSerializer.Serialize(updated, Json)); File.Move(index + ".tmp", index, true); photos = updated; Version++;
            journal.Composite(session.Id, id); return composite;
        }
    }
    public byte[]? ReadImage(string imageId)
    {
        lock (gate)
        {
            if (!ValidId(imageId) || activeDirectory == null || !photos.Any(p => p.ImageId == imageId)) return null;
            string file = Path.Combine(activeDirectory, imageId + ".png");
            return File.Exists(file) ? File.ReadAllBytes(file) : null;
        }
    }
    private static bool ValidId(string value) => Regex.IsMatch(value, "^[a-f0-9]{32}$");
}
