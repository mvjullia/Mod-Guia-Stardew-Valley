using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewModdingAPI;
using StardewModdingAPI.Events;
using StardewValley;
using StardewValley.Locations;
using StardewValley.Tools;
using StardewValley.Menus;

namespace StardewRealtimeTelemetry;

/// <summary>Schedules moments on game events; screenshots are taken only on moving, menu-free frames.</summary>
internal sealed class AlbumRecorder
{
    private readonly AlbumStore store;
    private readonly IMonitor monitor;
    private readonly Func<ModConfig> config;
    private readonly CommunityAlbumVisit visit = new();
    private readonly List<(AlbumMoment Moment, DateTimeOffset Expires)> pending = new();
    private readonly Dictionary<string, Template> templates;
    private readonly List<(Vector2 Tile, string Room)> notes = new();
    private readonly HashSet<string> visitedRooms = new();
    private Vector2 lastPosition;
    private DateTimeOffset nextPhoto;
    private AlbumMoment? ready;
    private bool enabled;
    private string? rainyWateringDay;
    private sealed class Template { public Template() {} public string Title { get; set; } = ""; public string Description { get; set; } = ""; }
    public AlbumRecorder(IModHelper helper, IMonitor monitor, AlbumStore store, Func<ModConfig> config)
    {
        this.monitor = monitor; this.store = store; this.config = config;
        using var stream = typeof(AlbumRecorder).Assembly.GetManifestResourceStream("Guide.album-moments.json") ?? throw new InvalidDataException("Legendas dos álbuns ausentes.");
        templates = JsonSerializer.Deserialize<Dictionary<string, Template>>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        helper.Events.GameLoop.SaveLoaded += (_, _) => Load();
        helper.Events.GameLoop.ReturnedToTitle += (_, _) => Reset();
        helper.Events.Player.Warped += OnWarped;
        helper.Events.GameLoop.UpdateTicked += OnUpdate;
        helper.Events.Display.Rendered += OnRendered;
    }
    private void Load()
    {
        Reset();
        try {
            store.Select(Game1.uniqueIDForThisGame.ToString(System.Globalization.CultureInfo.InvariantCulture),
                Game1.player.UniqueMultiplayerID.ToString(System.Globalization.CultureInfo.InvariantCulture));
            enabled = config().EnableAlbums; lastPosition = Game1.player.Position;
            if (enabled && Game1.currentLocation is CommunityCenter) EnterCenter();
        } catch (Exception error) { monitor.Log("Álbuns indisponíveis; arquivos existentes preservados: " + error.Message, LogLevel.Warn); }
    }
    private void Reset()
    {
        enabled = false; pending.Clear(); ready = null; visit.Reset(); visitedRooms.Clear(); notes.Clear();
        nextPhoto = DateTimeOffset.MinValue; rainyWateringDay = null; store.Deactivate();
    }
    internal static List<AlbumInventoryItem> Inventory() => Game1.player.Items.Where(item => item != null).Select(item =>
        new AlbumInventoryItem(item.QualifiedItemId, item.DisplayName, item.Stack, item is StardewValley.Object obj ? obj.Quality : 0)).ToList();
    private static List<AlbumInventoryItem> DonationInventory()
    {
        var items = Inventory();
        // Picking an item up with the mouse is not a donation. It is still owned until the bundle accepts it.
        if (Game1.activeClickableMenu is JunimoNoteMenu menu && menu.heldItem is Item held && !Game1.player.Items.Any(item => ReferenceEquals(item, held)))
            items.Add(new AlbumInventoryItem(held.QualifiedItemId, held.DisplayName, held.Stack, held is StardewValley.Object obj ? obj.Quality : 0));
        return items;
    }
    internal static List<AlbumRequirement> Requirements()
    {
        var result = new List<AlbumRequirement>();
        foreach (var entry in Game1.netWorldState.Value.BundleData)
        {
            var fields = entry.Value.Split('/'); if (fields.Length < 3) continue;
            if (!int.TryParse(entry.Key.Split('/')[1], out int bundleId) || !Game1.netWorldState.Value.Bundles.TryGetValue(bundleId, out var completed)) continue;
            var parts = fields[2].Split(' ', StringSplitOptions.RemoveEmptyEntries);
            int required = fields.Length > 4 && int.TryParse(fields[4], out int count) && count > 0 ? count : parts.Length / 3;
            bool bundleComplete = completed.Count(value => value) >= required;
            for (int i = 0; i + 2 < parts.Length; i += 3)
            {
                if (parts[i] == "-1") continue;
                string id = parts[i].StartsWith("(") ? parts[i] : "(O)" + parts[i];
                if (!int.TryParse(parts[i + 1], out int quantity) || !int.TryParse(parts[i + 2], out int quality)) continue;
                result.Add(new AlbumRequirement(bundleId + ":" + i / 3, id, ItemRegistry.GetDataOrErrorItem(id).DisplayName,
                    quantity, quality, entry.Key.Split('/')[0], i / 3 < completed.Length && completed[i / 3], bundleComplete));
            }
        }
        return result;
    }
    private void Queue(AlbumMoment? moment)
    {
        if (moment == null || !templates.ContainsKey(moment.Kind)) return;
        if (moment.ReuseImageId != null) { Save(moment, null); return; }
        if (!pending.Any(item => item.Moment.Kind == moment.Kind && item.Moment.ItemName == moment.ItemName))
            pending.Add((moment, DateTimeOffset.UtcNow.AddSeconds(moment.Kind is "center-delivery" or "center-complete" ? 120 : 45)));
    }
    private void EnterCenter()
    {
        visitedRooms.Clear(); notes.Clear();
        Queue(visit.Enter(Requirements(), Inventory()));
        // Read note positions from the current map, including replacements; no room coordinates are hardcoded.
        var location = Game1.currentLocation; var layer = location.Map.GetLayer("Buildings");
        if (layer == null) return;
        for (int x = 0; x < layer.LayerWidth; x++) for (int y = 0; y < layer.LayerHeight; y++)
        {
            string? action = location.doesTileHaveProperty(x, y, "Action", "Buildings");
            var parts = action?.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts?.Length >= 2 && parts[0] == "JunimoNote" && int.TryParse(parts[1], out int area))
                notes.Add((new Vector2(x, y), CommunityCenter.getAreaNameFromNumber(area)));
        }
    }
    private void OnWarped(object? sender, WarpedEventArgs e)
    {
        if (!enabled || !e.IsLocalPlayer) return;
        try {
            lastPosition = Game1.player.Position; ready = null;
            if (e.OldLocation is CommunityCenter && visit.Active)
            {
                foreach (var delivery in visit.Observe(Requirements(), DonationInventory())) Queue(delivery);
                Queue(visit.Leave(Requirements(), Inventory(), e.NewLocation.NameOrUniqueName));
                pending.RemoveAll(item => item.Moment.Location == "CommunityCenter");
            }
            if (e.NewLocation is CommunityCenter) EnterCenter();
            if (e.NewLocation is FarmHouse && Game1.timeOfDay >= 2400) Queue(new AlbumMoment("late-home", "", e.NewLocation.NameOrUniqueName));
        } catch (Exception error) { monitor.Log("Álbum: não foi possível avaliar a visita: " + error.Message, LogLevel.Trace); }
    }
    private void OnUpdate(object? sender, UpdateTickedEventArgs e)
    {
        if (!enabled || !config().EnableAlbums || !Context.IsWorldReady || !Game1.game1.IsActive || !e.IsMultipleOf(15)) return;
        try {
            var position = Game1.player.Position; bool moving = Vector2.DistanceSquared(position, lastPosition) > 1; lastPosition = position;
            pending.RemoveAll(item => item.Expires < DateTimeOffset.UtcNow || item.Moment.Location != Game1.currentLocation.NameOrUniqueName ||
                (item.Moment.Room != null && !notes.Any(note => note.Room == item.Moment.Room && Vector2.DistanceSquared(Game1.player.Tile, note.Tile) <= 25)));
            if (visit.Active && Game1.currentLocation is CommunityCenter)
            {
                var needs = Requirements(); var inventory = DonationInventory();
                foreach (var moment in visit.Observe(needs, inventory)) Queue(moment);
                if (moving) foreach (var note in notes)
                {
                    if (Vector2.DistanceSquared(Game1.player.Tile, note.Tile) > 25 || visitedRooms.Contains(note.Room)) continue;
                    var eligible = needs.Find(need => need.Room == note.Room && CommunityAlbumVisit.Eligible(need, inventory));
                    if (eligible != null) { visitedRooms.Add(note.Room); Queue(new AlbumMoment("center-room", eligible.Name, "CommunityCenter", Room: note.Room)); }
                }
            }
            string day = Game1.year + ":" + Game1.currentSeason + ":" + Game1.dayOfMonth;
            if (Game1.isRaining && Game1.currentLocation.IsOutdoors && Game1.player.CurrentTool is WateringCan && Game1.player.UsingTool && rainyWateringDay != day)
            { rainyWateringDay = day; Queue(new AlbumMoment("rain-watering", "", Game1.currentLocation.NameOrUniqueName)); }
            if (moving && CanCapture() && DateTimeOffset.UtcNow >= nextPhoto && pending.Count > 0)
            {
                var chosen = pending.OrderBy(item => item.Moment.Kind == "center-complete" ? 0 : item.Moment.Kind == "center-delivery" ? 1 : item.Moment.Kind == "center-arrival" ? 2 : 3).First();
                ready = chosen.Moment; pending.Remove(chosen);
            }
        } catch (Exception error) { monitor.Log("Álbum: evento ignorado com segurança: " + error.Message, LogLevel.Trace); }
    }
    private static bool CanCapture() => AlbumCapturePolicy.Allows(new AlbumFrameState(Context.IsWorldReady, Game1.game1.IsActive,
        Context.IsPlayerFree, Context.IsWorldReady && Game1.player.isMoving(), Game1.activeClickableMenu != null,
        Game1.eventUp, Game1.currentMinigame != null, Game1.game1.takingMapScreenshot));
    private void OnRendered(object? sender, RenderedEventArgs e)
    {
        var moment = ready; ready = null;
        if (moment == null || !CanCapture() || Game1.currentLocation.NameOrUniqueName != moment.Location) return;
        if (moment.Room != null && !notes.Any(note => note.Room == moment.Room && Vector2.DistanceSquared(Game1.player.Tile, note.Tile) <= 25)) return;
        try {
            var graphics = Game1.graphics.GraphicsDevice;
            int width = graphics.PresentationParameters.BackBufferWidth, height = graphics.PresentationParameters.BackBufferHeight;
            var pixels = new Color[width * height]; graphics.GetBackBufferData(pixels);
            // Avoid saving fade/blank frames if a graphics backend cannot expose a valid world frame.
            if (pixels.Where((_, index) => index % 997 == 0).Select(color => color.PackedValue).Distinct().Take(3).Count() < 3) return;
            int photoWidth = Math.Min(1280, width), photoHeight = Math.Max(1, height * photoWidth / width);
            var scaled = new Color[photoWidth * photoHeight];
            for (int y = 0; y < photoHeight; y++) for (int x = 0; x < photoWidth; x++) {
                var pixel = pixels[(y * height / photoHeight) * width + x * width / photoWidth];
                scaled[y * photoWidth + x] = new Color(pixel.R, pixel.G, pixel.B, (byte)255);
            }
            using var image = new Texture2D(graphics, photoWidth, photoHeight); image.SetData(scaled);
            using var stream = new MemoryStream(); image.SaveAsPng(stream, photoWidth, photoHeight); Save(moment, stream.ToArray());
            nextPhoto = DateTimeOffset.UtcNow.AddSeconds(Math.Max(3, config().AlbumMinSecondsBetweenPhotos));
        } catch (Exception error) { monitor.Log("Álbum: captura indisponível neste frame: " + error.Message, LogLevel.Trace); }
    }
    private void Save(AlbumMoment moment, byte[]? png)
    {
        var template = templates[moment.Kind];
        string Fill(string text) => text.Replace("{player}", Game1.player.Name).Replace("{item}", moment.ItemName).Replace("{room}", moment.Room ?? "");
        var photo = store.Add(png, moment.ReuseImageId, moment.Kind, Fill(template.Title), Fill(template.Description), Game1.player.Name,
            moment.Location, Game1.year, Game1.currentSeason, Game1.dayOfMonth, Game1.timeOfDay, Math.Clamp(config().AlbumDailyLimit, 1, 100));
        if (photo != null) {
            if (moment.Kind == "center-arrival" && visit.Active) visit.EntryImageId = photo.ImageId;
            monitor.Log("Memória guardada no álbum: " + photo.Title, LogLevel.Trace);
        }
    }
}
