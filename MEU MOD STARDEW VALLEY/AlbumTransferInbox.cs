using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StardewRealtimeTelemetry;

internal sealed record AlbumTransferOffer(AlbumPhoto Photo, string Hash, int Length, int ChunkSize = 16384, AlbumSession? Session = null);

/// <summary>Durable partial transfers. Every resumed piece and final image is checked before import.</summary>
internal sealed class AlbumTransferInbox
{
    private readonly string root;
    private readonly Dictionary<string, AlbumTransferOffer> offers = new();
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };
    public AlbumTransferInbox(string albumDirectory)
    {
        root = Path.GetFullPath(Path.Combine(albumDirectory, "_transfers"));
        if (!Directory.Exists(root)) return;
        foreach (string sender in Directory.EnumerateDirectories(root)) foreach (string photo in Directory.EnumerateDirectories(sender)) {
            try { string key = Key(Path.GetFileName(sender), Path.GetFileName(photo)); var offer = JsonSerializer.Deserialize<AlbumTransferOffer>(File.ReadAllText(Path.Combine(photo, "offer.json")), Json);
                if (offer != null && Valid(offer)) offers[key] = offer; } catch (Exception error) when (error is IOException or ArgumentException or JsonException) { /* Preserve invalid temporary files for diagnosis. */ }
        }
    }
    public static bool Valid(AlbumTransferOffer offer) => offer.Length is >= 24 and <= 4194304 && offer.ChunkSize == 16384 &&
        Regex.IsMatch(offer.Hash ?? "", "^[a-f0-9]{64}$") && Regex.IsMatch(offer.Photo.Id ?? "", "^[a-f0-9]{32}$") &&
        Regex.IsMatch(offer.Photo.ImageId ?? "", "^[a-f0-9]{32}$") && !offer.Photo.IsComposite && offer.Photo.ImageHash == offer.Hash;
    public void Start(string sender, AlbumTransferOffer offer)
    {
        if (!Valid(offer)) throw new InvalidDataException("Oferta inválida."); string key = Key(sender, offer.Photo.Id);
        if (offers.TryGetValue(key, out var previous) && (previous.Hash != offer.Hash || AlbumStore.MetadataHash(previous.Photo) != AlbumStore.MetadataHash(offer.Photo))) throw new InvalidDataException("Metadados imutáveis divergentes.");
        string folder = Folder(sender, offer.Photo.Id); Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, "offer.json.tmp"), JsonSerializer.Serialize(offer, Json)); File.Move(Path.Combine(folder, "offer.json.tmp"), Path.Combine(folder, "offer.json"), true); offers[key] = offer;
    }
    public AlbumTransferOffer? Find(string sender, string id) => offers.GetValueOrDefault(Key(sender, id));
    public IEnumerable<(string Sender, AlbumTransferOffer Offer)> Pending() => offers.Select(pair => (pair.Key.Split('/')[0], pair.Value)).ToArray();
    public int[] Missing(string sender, string id)
    {
        var offer = Find(sender, id) ?? throw new InvalidDataException("Transferência desconhecida.");
        return Enumerable.Range(0, Count(offer)).Where(index => !ValidChunk(sender, offer, index)).ToArray();
    }
    public void Put(string sender, string id, int index, byte[] data, string hash)
    {
        var offer = Find(sender, id) ?? throw new InvalidDataException("Transferência desconhecida.");
        if (index < 0 || index >= Count(offer) || data.Length != Math.Min(offer.ChunkSize, offer.Length - index * offer.ChunkSize) || AlbumStore.Hash(data) != hash) throw new InvalidDataException("Parte inválida.");
        string file = Path.Combine(Folder(sender, id), index + ".bin"); File.WriteAllBytes(file + ".tmp", data); File.Move(file + ".tmp", file, true); File.WriteAllText(file + ".sha", hash);
    }
    public byte[]? Assemble(string sender, string id)
    {
        var offer = Find(sender, id); if (offer == null || Missing(sender, id).Length > 0) return null;
        using var result = new MemoryStream(offer.Length);
        for (int index = 0; index < Count(offer); index++) result.Write(File.ReadAllBytes(Path.Combine(Folder(sender, id), index + ".bin")));
        byte[] png = result.ToArray(); return png.Length == offer.Length && AlbumStore.Hash(png) == offer.Hash ? png : null;
    }
    public void Complete(string sender, string id)
    {
        string folder = Folder(sender, id); offers.Remove(Key(sender, id));
        if (!folder.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Pasta temporária fora do álbum.");
        if (Directory.Exists(folder)) Directory.Delete(folder, true); // Only validated temporary chunk directories, never originals.
    }
    public void ResetParts(string sender, string id)
    {
        var offer = Find(sender, id) ?? throw new InvalidDataException("Transferência desconhecida.");
        for (int index = 0; index < Count(offer); index++) { string file = Path.Combine(Folder(sender, id), index + ".bin"); if (File.Exists(file)) File.Delete(file); if (File.Exists(file + ".sha")) File.Delete(file + ".sha"); }
    }
    private bool ValidChunk(string sender, AlbumTransferOffer offer, int index)
    {
        string file = Path.Combine(Folder(sender, offer.Photo.Id), index + ".bin");
        if (!File.Exists(file) || !File.Exists(file + ".sha") || new FileInfo(file).Length != Math.Min(offer.ChunkSize, offer.Length - index * offer.ChunkSize)) return false;
        return AlbumStore.Hash(File.ReadAllBytes(file)) == File.ReadAllText(file + ".sha");
    }
    private string Folder(string sender, string id) { Key(sender, id); return Path.Combine(root, sender, id); }
    private static string Key(string sender, string id) { if (!Regex.IsMatch(sender ?? "", @"^-?\d+$") || !Regex.IsMatch(id ?? "", "^[a-f0-9]{32}$")) throw new ArgumentException("Identificador inválido."); return sender + "/" + id; }
    private static int Count(AlbumTransferOffer offer) => (offer.Length + offer.ChunkSize - 1) / offer.ChunkSize;
}
