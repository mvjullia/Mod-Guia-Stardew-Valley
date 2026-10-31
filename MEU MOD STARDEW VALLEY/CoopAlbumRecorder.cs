using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using StardewModdingAPI;
using StardewModdingAPI.Events;
using StardewValley;
using StardewValley.Menus;
using StardewValley.Tools;

namespace StardewRealtimeTelemetry;

internal sealed partial class CoopAlbumRecorder
{
    private readonly IModHelper helper;
    private readonly IMonitor monitor;
    private readonly AlbumStore store;
    private readonly Func<ModConfig> config;
    private readonly Action<AlbumMoment> queue;
    private readonly string modId;
    private readonly AlbumCoopRules rules;
    private readonly CoopAlbumDirector director = new();
    private sealed record Peer(string Session, long Sequence, AlbumActor Actor, long Received, bool Sharing, bool Requests);
    private readonly Dictionary<long, Peer> peers = new();
    private readonly Dictionary<long, HashSet<string>> retired = new();
    private readonly Dictionary<string, ulong> counters = new();
    private readonly Dictionary<string, PropertyInfo> counterProperties = new();
    private HashSet<string> wearables = new();
    private string session = "", pulse = "";
    private long sequence, pulseUntil, eventSequence;
    private bool loaded;
    private sealed class Envelope
    {
        public Envelope() {} public string Save { get; set; } = ""; public string Session { get; set; } = "";
        public long Sequence { get; set; } public AlbumActor? Actor { get; set; } public int Protocol { get; set; }
        public bool Sharing { get; set; } public bool Requests { get; set; }
        public List<AlbumScore>? Scores { get; set; }
    }
    public CoopAlbumRecorder(IModHelper helper, IMonitor monitor, AlbumStore store, Func<ModConfig> config, Action<AlbumMoment> queue, string modId)
    {
        this.helper = helper; this.monitor = monitor; this.store = store; this.config = config; this.queue = queue; this.modId = modId;
        using var stream = typeof(CoopAlbumRecorder).Assembly.GetManifestResourceStream("Guide.album-rules.json") ?? throw new InvalidDataException("Regras cooperativas ausentes.");
        rules = JsonSerializer.Deserialize<AlbumCoopRules>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        foreach (var name in rules.Counters.Keys) { var property = typeof(Stats).GetProperty(name); if (property?.CanRead == true) counterProperties[name] = property; }
        AlbumGameHooks.Install(modId, monitor);
        helper.Events.GameLoop.SaveLoaded += (_, _) => { Reset(); loaded = true; session = Guid.NewGuid().ToString("N"); AlbumGameHooks.Register(this); ReadCounters(false); wearables = Equipped().Select(item => item.QualifiedItemId).ToHashSet(); Broadcast(); };
        helper.Events.GameLoop.ReturnedToTitle += (_, _) => Reset();
        helper.Events.Multiplayer.PeerDisconnected += (_, e) => { peers.Remove(e.Peer.PlayerID); retired.Remove(e.Peer.PlayerID); };
        helper.Events.Multiplayer.PeerConnected += (_, _) => { if (loaded) Broadcast(); };
        helper.Events.Multiplayer.ModMessageReceived += OnMessage;
        ConfigureSharedControls();
        helper.Events.GameLoop.UpdateTicked += Update;
        helper.Events.Player.Warped += (_, e) => { if (e.IsLocalPlayer && Ready && rules.JojaLocations.Contains(e.NewLocation.Name)) Record("joja-visit", "joja", "joja"); };
        helper.Events.Display.MenuChanged += (_, e) => { if (Ready && e.NewMenu is ShopMenu shop && rules.JojaShopIds.Contains(shop.ShopId)) Record("joja-shop", "joja", "joja", context: shop); };
    }
    private bool Ready => loaded && Context.IsWorldReady && config().EnableAlbums;
    private void Reset()
    {
        loaded = false; peers.Clear(); retired.Clear(); counters.Clear(); director.Reset(); session = ""; sequence = 0; eventSequence = 0; pulse = ""; pulseUntil = 0; ClearTransfers();
    }
    private static string SaveId => Game1.uniqueIDForThisGame.ToString(CultureInfo.InvariantCulture);
    private static string Id(Farmer farmer) => farmer.UniqueMultiplayerID.ToString(CultureInfo.InvariantCulture);
    private static IEnumerable<Item> Equipped() => new Item?[] { Game1.player.hat.Value, Game1.player.shirtItem.Value, Game1.player.pantsItem.Value, Game1.player.boots.Value }.Where(item => item != null).Cast<Item>();
    private string Activity()
    {
        var player = Game1.player;
        if (player.isEating) return "eating";
        if (player.UsingTool) return player.CurrentTool switch {
            FishingRod rod when rod.isFishing => "fishing", WateringCan => "watering", Hoe => "digging", Pickaxe => "mining",
            Axe => "chopping", MeleeWeapon weapon => weapon.isScythe() ? "cutting" : "fighting", Pan => "panning",
            MilkPail => "milking", Shears => "shearing", Slingshot => "fighting", _ => "idle"
        };
        if (Environment.TickCount64 <= pulseUntil) return pulse;
        if (player.isSitting.Value) return "sitting";
        return player.isMoving() ? "walking" : "idle";
    }
    private AlbumActor Actor(Farmer? farmer = null)
    {
        farmer ??= Game1.player; bool local = farmer.UniqueMultiplayerID == Game1.player.UniqueMultiplayerID;
        var location = farmer.currentLocation; var festival = location?.currentEvent;
        bool atFestival = festival?.isFestival == true;
        var passive = rules.PassiveFestivals.FirstOrDefault(rule => location != null && rule.Locations.Contains(location.Name) && Game1.timeOfDay >= rule.StartTime && Utility.GetDayOfPassiveFestival(rule.Id) > 0);
        string? partner = local && long.TryParse(config().AlbumRomanticPartnerId, out long selected) ? selected.ToString(CultureInfo.InvariantCulture) :
            farmer.team.GetSpouse(farmer.UniqueMultiplayerID)?.ToString(CultureInfo.InvariantCulture);
        string activity = local ? Activity() : "idle";
        int validity = local && !farmer.UsingTool && !farmer.isEating && activity == pulse ? (int)Math.Clamp(pulseUntil - Environment.TickCount64, 0, 3000) : 1000;
        return new AlbumActor(Id(farmer), farmer.Name, location?.NameOrUniqueName ?? "", location?.DisplayName ?? location?.Name ?? "o vale",
            activity, Game1.year, Game1.currentSeason, Game1.dayOfMonth, Game1.timeOfDay,
            farmer.Tile.X, farmer.Tile.Y, atFestival ? Game1.year + "/" + Game1.currentSeason + "/" + Game1.dayOfMonth : passive?.Id ?? "", atFestival ? festival!.FestivalName : passive?.Label ?? "", partner, validity);
    }
    private void ReadCounters(bool report)
    {
        foreach (var pair in counterProperties) {
            ulong value = Convert.ToUInt64(pair.Value.GetValue(Game1.stats), CultureInfo.InvariantCulture);
            if (report && counters.TryGetValue(pair.Key, out ulong before) && value > before) Pulse(rules.Counters[pair.Key]);
            counters[pair.Key] = value;
        }
    }
    private void Update(object? sender, UpdateTickedEventArgs e)
    {
        if (!Ready) return;
        try {
            if (e.IsMultipleOf(6)) SendPhotoChunks();
            if (!e.IsMultipleOf(30)) return;
            ReadCounters(true); Broadcast();
            var equipped = Equipped().ToArray();
            foreach (var item in equipped.Where(item => !wearables.Contains(item.QualifiedItemId) && IsJojaItem(item.QualifiedItemId)))
                Record("joja-outfit", "joja", "joja-outfit", item.DisplayName, context: Game1.activeClickableMenu);
            wearables = equipped.Select(item => item.QualifiedItemId).ToHashSet();
            if (!config().EnableCoopAlbums) return;
            var local = Actor();
            foreach (var moment in director.Observe(local, peers.Values.Where(peer => Environment.TickCount64 - peer.Received <= 5000)
                .Select(peer => Environment.TickCount64 - peer.Received > peer.Actor.ActivityValidityMs ? peer.Actor with { Activity = "idle" } : peer.Actor), rules)) QueueCoop(moment, local);
        } catch (Exception error) { monitor.Log("Álbum coop: observação ignorada: " + error.Message, LogLevel.Trace); }
    }
    private void Broadcast(List<AlbumScore>? scores = null)
    {
        if (!Ready || (!config().EnableCoopAlbums && !config().ShareAlbumPhotos) || !Context.IsMultiplayer) return;
        helper.Multiplayer.SendMessage(new Envelope { Save = SaveId, Session = session, Sequence = ++sequence, Actor = Actor(), Scores = scores,
                Protocol = 2, Sharing = config().ShareAlbumPhotos, Requests = config().AllowSharedPhotoRequests },
            "AlbumCoop.v1", modIDs: new[] { modId });
    }
    private void OnMessage(object? sender, ModMessageReceivedEventArgs e)
    {
        if (!Ready || e.FromModID != modId || e.FromPlayerID == Game1.player.UniqueMultiplayerID || !Game1.getOnlineFarmers().Any(farmer => farmer.UniqueMultiplayerID == e.FromPlayerID)) return;
        try {
            if (e.Type == "AlbumSync.v2") { ReceiveSync(e); return; }
            if (e.Type != "AlbumCoop.v1" || !config().EnableCoopAlbums) return;
            var message = e.ReadAs<Envelope>(); var actor = message.Actor; var local = Actor();
            if (message.Protocol != 2 || message.Save != SaveId || message.Session.Length != 32 || message.Sequence <= 0 || actor == null || actor.Id != e.FromPlayerID.ToString(CultureInfo.InvariantCulture) ||
                actor.DateKey != local.DateKey || actor.Name.Length > 200 || actor.Location.Length > 200 || actor.Place.Length > 300 || actor.ActivityValidityMs < 0 || actor.ActivityValidityMs > 3000 || !float.IsFinite(actor.X) || !float.IsFinite(actor.Y)) return;
            bool newConnection = !peers.TryGetValue(e.FromPlayerID, out var previous) || previous.Session != message.Session;
            if (previous != null) {
                if (previous.Session == message.Session && message.Sequence <= previous.Sequence) return;
                if (previous.Session != message.Session) {
                    if (!retired.TryGetValue(e.FromPlayerID, out var sessions)) retired[e.FromPlayerID] = sessions = new();
                    if (sessions.Contains(message.Session)) return; sessions.Add(previous.Session);
                }
            }
            actor = actor with { Name = Game1.getOnlineFarmers().First(farmer => farmer.UniqueMultiplayerID == e.FromPlayerID).Name };
            peers[e.FromPlayerID] = new Peer(message.Session, message.Sequence, actor, Environment.TickCount64, message.Sharing, message.Requests);
            if (newConnection && message.Sharing) PlanCatalogue(e.FromPlayerID);
            if (message.Scores is { Count: <= 16 }) foreach (var score in message.Scores) {
                if (score.Actor.Id != actor.Id && e.FromPlayerID != Game1.MasterPlayer.UniqueMultiplayerID) continue;
                foreach (var moment in director.Result(local, score, rules)) QueueCoop(moment, local);
            }
        } catch (Exception error) { monitor.Log("Álbum coop: mensagem descartada: " + error.Message, LogLevel.Trace); }
    }
    private void QueueCoop(AlbumMoment moment, AlbumActor original)
    {
        var peerId = moment.PairKey?.Split(':').FirstOrDefault(id => id != original.Id);
        bool Guard() {
            if (!Ready || Actor().DateKey != original.DateKey) return false;
            if (moment.CaptureMode == "competition") return true;
            if (peerId == null || !long.TryParse(peerId, out long id) || !peers.TryGetValue(id, out var peer) || Environment.TickCount64 - peer.Received > 5000) return false;
            var now = Actor();
            if (moment.Collection == "nights") return now.Time >= 1800;
            if (moment.CaptureMode == "activity" && (now.Activity != original.Activity || peer.Actor.Activity != original.Activity || Environment.TickCount64 - peer.Received > peer.Actor.ActivityValidityMs)) return false;
            return now.Location == original.Location && (moment.Kind.StartsWith("coop-apart-", StringComparison.Ordinal) ? now.Location != peer.Actor.Location : now.Location == peer.Actor.Location);
        }
        var values = new Dictionary<string, string>(moment.Values ?? new()) { ["year"] = Game1.year.ToString(), ["season"] = SeasonLabel(Game1.currentSeason), ["day"] = Game1.dayOfMonth.ToString() };
        var prepared = moment with { Guard = Guard, Values = values, CaptureContext = Game1.activeClickableMenu ?? (object?)Game1.currentMinigame ?? Game1.CurrentEvent };
        if (!TryAutomaticSession(prepared, original, peerId)) queue(prepared);
    }
    private static string SeasonLabel(string season) => season switch { "spring" => "primavera", "summer" => "verão", "fall" => "outono", "winter" => "inverno", _ => season };
    internal void Pulse(string activity) { if (!Ready) return; pulse = activity; pulseUntil = Environment.TickCount64 + 3000; Broadcast(); }
    internal void Record(string kind, string collection, string mode, string item = "", Dictionary<string, string>? values = null, object? context = null)
    {
        if (!Ready) return; var actor = Actor();
        var fields = new Dictionary<string, string>(values ?? new()) { ["player"] = actor.Name, ["place"] = actor.Place, ["item"] = item };
        queue(new AlbumMoment(kind, item, actor.Location, CaptureMode: mode, Collection: collection,
            EpisodeKey: actor.Id + "/" + session + "/" + ++eventSequence, Values: fields, Priority: 100,
            CaptureContext: context ?? Game1.activeClickableMenu ?? (object?)Game1.currentMinigame, FollowLocation: true));
    }
    internal bool IsJojaItem(string id) => rules.JojaItemIds.Contains(id);
    internal bool IsJojaShop(string id) => rules.JojaShopIds.Contains(id);
    internal bool IsJojaAction(string action, GameLocation location) => rules.JojaLocations.Contains(location.Name) || rules.JojaActionPrefixes.Any(prefix => action.StartsWith(prefix, StringComparison.Ordinal));
    internal void Strength(float power, object context) { if (Game1.CurrentEvent?.isFestival == true && power >= rules.StrengthTopTierMin) Record("strength-max", "festivals", "strength", values: new() { ["power"] = power.ToString("0.0", CultureInfo.InvariantCulture) }, context: context); }
    internal void Kiss(Farmer first, long secondId)
    {
        if (!Ready) return;
        var other = first.UniqueMultiplayerID == Game1.player.UniqueMultiplayerID ? Game1.GetPlayer(secondId) : first;
        if (other == null || other.UniqueMultiplayerID == Game1.player.UniqueMultiplayerID) return;
        var local = Actor(); var partner = Actor(other); string pair = CoopAlbumDirector.Pair(local, partner);
        queue(new AlbumMoment("player-kiss", "", local.Location, CaptureMode: "scene", Collection: "romance", PairKey: pair,
            Participants: new[] { local.Name, partner.Name }, EpisodeKey: local.DateKey + "/kiss/" + pair + "/" + local.Id,
            Values: new() { ["partner"] = partner.Name }, Priority: 90));
    }
    internal void Result(string competition, int score)
    {
        if (!Ready || !config().EnableCoopAlbums) return;
        var result = new AlbumScore(Actor(), competition, score, true, false); var local = Actor();
        foreach (var moment in director.Result(local, result, rules)) QueueCoop(moment, local);
        Broadcast(new() { result });
    }
    internal void FestivalResults(string competition, List<AlbumScore> results)
    {
        if (!Ready || !config().EnableCoopAlbums) return; var local = Actor();
        foreach (var result in results) foreach (var moment in director.Result(local, result, rules)) QueueCoop(moment, local);
        Broadcast(Context.IsMainPlayer ? results : results.Where(result => result.Actor.Id == local.Id).ToList());
    }
    internal List<AlbumScore> FestivalScores(string competition) => Game1.getOnlineFarmers()
        .Where(farmer => farmer.currentLocation?.NameOrUniqueName == Game1.currentLocation.NameOrUniqueName)
        .Select(farmer => new AlbumScore(Actor(farmer), competition, farmer.festivalScore, true, true)).ToList();
}
