using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StardewRealtimeTelemetry;

internal sealed record AlbumPhoto(string Id, string ImageId, string Kind, string Title, string Description,
    string PlayerName, string Location, int Year, string Season, int Day, int Time, DateTimeOffset CapturedAt);

/// <summary>Local, per-save/per-player album. Never deletes older photographs.</summary>
internal sealed class AlbumStore
{
    private readonly string root;
    private readonly object gate = new();
    private string? activeDirectory;
    private List<AlbumPhoto> photos = new();
    public long Version { get; private set; }
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };
    public AlbumStore(string root) { this.root = Path.GetFullPath(root); }
    public void Select(string saveId, string playerId)
    {
        if (!Regex.IsMatch(saveId, @"^\d+$") || !Regex.IsMatch(playerId, @"^-?\d+$")) throw new ArgumentException("Identidade de álbum inválida.");
        lock (gate)
        {
            activeDirectory = null; photos = new();
            string directory = Path.Combine(root, saveId, playerId), index = Path.Combine(directory, "index.json");
            var loaded = File.Exists(index) ? JsonSerializer.Deserialize<List<AlbumPhoto>>(File.ReadAllText(index), Json) ?? throw new InvalidDataException("Índice de álbum inválido.") : new();
            if (loaded.Any(photo => !ValidId(photo.Id) || !ValidId(photo.ImageId))) throw new InvalidDataException("Identificador de foto inválido.");
            Directory.CreateDirectory(directory); photos = loaded; activeDirectory = directory; Version++;
        }
    }
    public void Deactivate() { lock (gate) { activeDirectory = null; photos = new(); Version++; } }
    public object List()
    {
        lock (gate) return new { supported = true, active = activeDirectory != null, photos = photos.OrderByDescending(p => p.CapturedAt).ToArray() };
    }
    public AlbumPhoto? Add(byte[]? png, string? reuseImageId, string kind, string title, string description,
        string playerName, string location, int year, string season, int day, int time, int dailyLimit)
    {
        lock (gate)
        {
            if (activeDirectory == null || photos.Count(p => p.Year == year && p.Season == season && p.Day == day) >= dailyLimit) return null;
            if (photos.Any(p => p.Kind == kind && p.Year == year && p.Season == season && p.Day == day && p.Description == description)) return null;
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
            var photo = new AlbumPhoto(id, imageId, kind, title, description, playerName, location, year, season, day, time, DateTimeOffset.UtcNow);
            if (reuseImageId != null) {
                var original = photos.First(p => p.ImageId == reuseImageId);
                photo = photo with { Location = original.Location, Year = original.Year, Season = original.Season,
                    Day = original.Day, Time = original.Time, CapturedAt = original.CapturedAt };
            }
            var updated = new List<AlbumPhoto>(photos) { photo };
            string index = Path.Combine(activeDirectory, "index.json");
            File.WriteAllText(index + ".tmp", JsonSerializer.Serialize(updated, Json));
            File.Move(index + ".tmp", index, true); photos = updated; Version++;
            return photo;
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
