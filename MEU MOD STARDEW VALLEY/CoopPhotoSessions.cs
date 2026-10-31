using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Xna.Framework;
using StardewModdingAPI;
using StardewValley;

namespace StardewRealtimeTelemetry;

internal sealed partial class CoopAlbumRecorder
{
    private sealed record ScheduledCapture(AlbumSession Session, AlbumMoment Moment, long Due, long Deadline, bool Queued = false);
    private readonly Dictionary<string, ScheduledCapture> captures = new();
    private sealed record CaptureRequest(long Target, SyncNote Note, long Until, long Next);
    private readonly Dictionary<string, CaptureRequest> requests = new();
    private void ClearCaptureSessions() { captures.Clear(); requests.Clear(); }
    private void ConfigureSharedControls()
    {
        helper.ConsoleCommands.Add("guia_foto_compartilhada", "Pede uma foto das duas visões. Opcional: ID do parceiro.", (_, args) => BeginManualPhoto(args.FirstOrDefault()));
        helper.ConsoleCommands.Add("guia_album", "Abre o álbum de fotos dentro do jogo.", (_, _) => OpenGameAlbum());
        helper.Events.Input.ButtonPressed += (_, e) => {
            if (!Ready || Game1.chatBox?.isActive() == true) return;
            if (e.Button == SButton.F9) { helper.Input.Suppress(e.Button); BeginManualPhoto(); }
            if (e.Button == SButton.F8) { helper.Input.Suppress(e.Button); OpenGameAlbum(); }
        };
        helper.Events.Display.RenderedHud += (_, e) => {
            if (!Ready) return;
            var next = captures.Values.Where(capture => Environment.TickCount64 < capture.Due).OrderBy(capture => capture.Due).FirstOrDefault();
            if (next == null) return;
            string text = "Foto compartilhada em " + Math.Max(1, (next.Due - Environment.TickCount64 + 999) / 1000) + "...";
            Utility.drawTextWithShadow(e.SpriteBatch, text, Game1.smallFont, new Vector2(24, 112), Color.Pink);
        };
    }
    private void Notice(string text) { if (Context.IsWorldReady) Game1.addHUDMessage(new HUDMessage(text, 3)); monitor.Log(text, LogLevel.Info); }
    private void OpenGameAlbum()
    {
        if (!Ready) return;
        if (Game1.activeClickableMenu is AlbumGameMenu) { Game1.exitActiveMenu(); return; }
        if (Game1.activeClickableMenu != null) { Notice("Feche o menu atual para abrir o álbum."); return; }
        Game1.activeClickableMenu = new AlbumGameMenu(store, id => BeginManualPhoto(id), () => { foreach (long id in CompatiblePeers) PlanCatalogue(id); Notice("Conferindo os índices e retomando o que falta..."); });
    }
    private void BeginManualPhoto(string? selectedId = null)
    {
        if (!Ready || !config().ShareAlbumPhotos) { Notice("Ative os álbuns e o compartilhamento para pedir uma foto."); return; }
        if (Game1.activeClickableMenu is AlbumGameMenu) Game1.exitActiveMenu();
        if (Game1.activeClickableMenu != null || Game1.currentMinigame != null) { Notice("Feche os menus ou termine o minijogo antes de pedir a foto."); return; }
        var candidates = peers.Where(pair => pair.Value.Sharing && pair.Value.Requests && Environment.TickCount64 - pair.Value.Received <= 5000).ToArray();
        var chosen = candidates.FirstOrDefault(pair => pair.Key.ToString(CultureInfo.InvariantCulture) == (selectedId ?? config().AlbumRomanticPartnerId));
        if (selectedId != null && chosen.Value == null) { Notice("Esse parceiro está offline, incompatível ou não permite pedidos de foto."); return; }
        if (chosen.Value == null) chosen = candidates.OrderBy(pair => pair.Key).FirstOrDefault();
        if (chosen.Value == null) { Notice("O outro jogador precisa estar conectado com a mesma versão compatível do mod e permitir pedidos de foto."); return; }
        var local = Actor(); var peer = chosen.Value.Actor;
        var values = PairValues(local, peer);
        var moment = new AlbumMoment("shared-photo", "", local.Location, CaptureMode: Game1.CurrentEvent?.isFestival == true ? "festival" : "scene",
            Collection: "coop", PairKey: CoopAlbumDirector.Pair(local, peer), Participants: new[] { local.Name, peer.Name }, Values: values, Priority: 100, FollowLocation: true);
        BeginSession(moment, local, chosen.Key, Guid.NewGuid().ToString("N"), false);
    }
    private static Dictionary<string, string> PairValues(AlbumActor local, AlbumActor peer) => new() {
        ["player"] = local.Name, ["partner"] = peer.Name, ["place"] = local.Place, ["partnerPlace"] = peer.Place,
        ["festival"] = local.FestivalName, ["year"] = local.Year.ToString(), ["season"] = SeasonLabel(local.Season), ["day"] = local.Day.ToString()
    };
    private bool TryAutomaticSession(AlbumMoment moment, AlbumActor local, string? peerId)
    {
        if (!config().ShareAlbumPhotos || peerId == null || !long.TryParse(peerId, out long id) || !peers.TryGetValue(id, out var peer) || !peer.Sharing || !peer.Requests || store.Sessions == null) return false;
        // One deterministic initiator avoids two requests for the same observed moment.
        if (string.CompareOrdinal(local.Id, peerId) > 0) return true;
        string key = moment.EpisodeKey ?? local.DateKey + "/" + moment.PairKey + "/" + moment.Kind;
        if (key.EndsWith("/" + local.Id, StringComparison.Ordinal)) key = key[..^(local.Id.Length + 1)];
        BeginSession(moment, local, id, AlbumStore.StableId("shared/" + key), true); return true;
    }
    private void BeginSession(AlbumMoment moment, AlbumActor local, long other, string id, bool automatic)
    {
        if (!peers.TryGetValue(other, out var peer)) return;
        var actors = new[] { local, peer.Actor }.OrderBy(actor => actor.Id, StringComparer.Ordinal).ToArray();
        var definition = new AlbumSession(id, moment.Kind, moment.Collection ?? "coop", local.Id, actors.Select(actor => actor.Id).ToArray(), actors.Select(actor => actor.Name).ToArray(),
            local.Year, local.Season, local.Day, DateTimeOffset.UtcNow, automatic);
        if (store.Sessions?.Start(definition) != true) return;
        if (store.Sessions.Find(id)?.Photos?.ContainsKey(local.Id) != true) ScheduleCapture(definition, moment, automatic ? 400 : 2000);
        var request = new SyncNote { Kind = "request", Session = definition, Values = moment.Values };
        Send(other, request); requests[id] = new CaptureRequest(other, request, Environment.TickCount64 + 10000, Environment.TickCount64 + 1000);
    }
    private void ScheduleCapture(AlbumSession definition, AlbumMoment moment, int delay)
    {
        if (captures.ContainsKey(definition.Id)) return;
        long now = Environment.TickCount64; var previousGuard = moment.Guard;
        bool Guard() => Ready && Actor().DateKey == definition.Year + "/" + definition.Season + "/" + definition.Day &&
            Environment.TickCount64 <= now + delay + 15000 && previousGuard?.Invoke() != false;
        var prepared = moment with { SessionId = definition.Id, EpisodeKey = "shared/" + definition.Id + "/" + Id(Game1.player), Guard = Guard };
        captures[definition.Id] = new ScheduledCapture(definition, prepared, now + delay, now + delay + 15000);
    }
    private void ReceiveCaptureRequest(long sender, SyncNote note)
    {
        var definition = note.Session;
        if (!AcceptSession(sender, definition)) return;
        if (!config().AllowSharedPhotoRequests) { Send(sender, new SyncNote { Kind = "failed", Id = definition!.Id, Reason = "Pedidos de fotos desativados neste jogador." }); return; }
        var local = Actor(); var peer = peers[sender].Actor;
        if (local.DateKey != definition!.Year + "/" + definition.Season + "/" + definition.Day || !AllowedSessionKind(definition.Kind)) return;
        Send(sender, new SyncNote { Kind = "accepted", Id = definition.Id });
        if (store.Sessions?.Find(definition.Id)?.Photos?.ContainsKey(local.Id) == true) { PlanCatalogue(sender); return; }
        var values = PairValues(local, peer);
        foreach (var pair in note.Values ?? new()) if (new[] { "winner", "loser", "winnerScore", "loserScore", "competition", "scoreBasis", "score" }.Contains(pair.Key) && pair.Value.Length < 400) values[pair.Key] = pair.Value;
        string mode = definition.Kind.StartsWith("coop-", StringComparison.Ordinal) || definition.Kind == "fishing-date" ? "activity" :
            definition.Kind.StartsWith("competition-", StringComparison.Ordinal) ? "competition" : Game1.CurrentEvent?.isFestival == true ? "festival" : "scene";
        string expectedActivity = definition.Kind.StartsWith("coop-apart-", StringComparison.Ordinal) ? definition.Kind[11..] : definition.Kind.StartsWith("coop-together-", StringComparison.Ordinal) ? definition.Kind[14..] : definition.Kind == "fishing-date" ? "fishing" : "";
        bool Guard() {
            if (!Ready || !peers.TryGetValue(sender, out var latest) || Environment.TickCount64 - latest.Received > 5000) return false;
            var now = Actor();
            if (mode == "activity") return Environment.TickCount64 - latest.Received <= latest.Actor.ActivityValidityMs &&
                now.Location == local.Location && latest.Actor.Location == peer.Location &&
                now.Activity == expectedActivity && latest.Actor.Activity == expectedActivity &&
                (definition.Kind.StartsWith("coop-apart-", StringComparison.Ordinal) ? now.Location != latest.Actor.Location : now.Location == latest.Actor.Location);
            if (definition.Collection == "nights") return now.Time >= 1800;
            return true;
        }
        var moment = new AlbumMoment(definition.Kind, "", local.Location, CaptureMode: mode, Collection: definition.Collection,
            PairKey: CoopAlbumDirector.Pair(local, peer), Participants: definition.PlayerNames, Values: values, Guard: Guard, Priority: 90,
            CaptureContext: Game1.activeClickableMenu ?? (object?)Game1.currentMinigame ?? Game1.CurrentEvent, FollowLocation: true);
        ScheduleCapture(definition, moment, definition.Automatic ? 400 : 2000);
    }
    private bool AllowedSessionKind(string kind) => kind == "shared-photo" || kind.StartsWith("coop-", StringComparison.Ordinal) && rules.Activities.Any(rule => kind.EndsWith("-" + rule.Id, StringComparison.Ordinal)) ||
        new[] { "night-together", "night-apart", "sunset-together", "night-sweethearts", "fishing-date", "festival-together", "player-kiss", "competition-rout", "competition-close", "competition-tie" }.Contains(kind);
    private void UpdateCaptureSessions()
    {
        foreach (var pair in requests.ToArray()) {
            if (Environment.TickCount64 > pair.Value.Until) { store.Sessions?.Failed(pair.Key, pair.Value.Target.ToString(CultureInfo.InvariantCulture), "O pedido não foi confirmado. Verifique a conexão e tente novamente."); requests.Remove(pair.Key); }
            else if (Environment.TickCount64 >= pair.Value.Next) { Send(pair.Value.Target, pair.Value.Note); requests[pair.Key] = pair.Value with { Next = Environment.TickCount64 + 1000 }; }
        }
        foreach (var pair in captures.ToArray()) {
            var capture = pair.Value;
            if (store.Sessions?.Find(pair.Key)?.Photos?.ContainsKey(Id(Game1.player)) == true) { captures.Remove(pair.Key); continue; }
            if (Environment.TickCount64 > capture.Deadline) {
                string reason = "Não houve um quadro válido: menu aberto, janela inativa ou momento encerrado. Tente novamente.";
                store.Sessions?.Failed(pair.Key, Id(Game1.player), reason);
                foreach (var other in capture.Session.PlayerIds.Where(id => id != Id(Game1.player))) if (long.TryParse(other, out long target)) Send(target, new SyncNote { Kind = "failed", Id = pair.Key, Reason = reason });
                captures.Remove(pair.Key); continue;
            }
            if (!capture.Queued && Environment.TickCount64 >= capture.Due) { captures[pair.Key] = capture with { Queued = true }; queue(capture.Moment); }
        }
    }
    private void CaptureSucceeded(string id) { captures.Remove(id); }
}
