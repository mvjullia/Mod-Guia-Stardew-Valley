using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using StardewModdingAPI;
using StardewModdingAPI.Events;

namespace StardewRealtimeTelemetry;

internal sealed partial class CoopAlbumRecorder
{
    private sealed class SyncNote
    {
        public SyncNote() {} public int Protocol { get; set; } = 2; public string Save { get; set; } = ""; public string Kind { get; set; } = "";
        public string Id { get; set; } = ""; public string Hash { get; set; } = ""; public int Index { get; set; } public int[]? Indices { get; set; }
        public string Data { get; set; } = ""; public string Reason { get; set; } = ""; public AlbumTransferOffer? Offer { get; set; }
        public AlbumSession? Session { get; set; } public Dictionary<string, string>? Values { get; set; }
    }
    private readonly Queue<(long Target, SyncNote Note)> controls = new();
    private readonly Queue<(long Target, string Photo, int Index)> chunks = new();
    private readonly HashSet<string> queuedChunks = new();
    private readonly Dictionary<long, Queue<string>> catalogues = new();
    private readonly Dictionary<string, byte[]> sendImages = new();
    private AlbumTransferInbox? inbox;
    private long lastSync;
    private sealed record ComposeResult(string Directory, AlbumSession Session, byte[] Png);
    private Task<ComposeResult>? composing;
    private readonly HashSet<string> badCompositions = new();
    private void ClearTransfers()
    {
        controls.Clear(); chunks.Clear(); queuedChunks.Clear(); catalogues.Clear(); sendImages.Clear(); badCompositions.Clear(); composing = null;
        inbox = store.ActiveDirectory is { } directory ? new AlbumTransferInbox(directory) : null; lastSync = 0; ClearCaptureSessions();
    }
    private IEnumerable<long> CompatiblePeers => peers.Where(pair => pair.Value.Sharing).Select(pair => pair.Key);
    private void Send(long target, SyncNote note)
    {
        if (!Ready || !config().ShareAlbumPhotos || controls.Count > 4096) return;
        note.Save = SaveId; controls.Enqueue((target, note));
    }
    private bool MaySend(AlbumPhoto photo, long target) => !photo.IsComposite &&
        (photo.SessionId == null || store.Sessions?.Find(photo.SessionId)?.PlayerIds.Contains(target.ToString(System.Globalization.CultureInfo.InvariantCulture)) == true);
    private AlbumTransferOffer? Offer(string id)
    {
        var photo = store.FindPhoto(id); if (photo == null || photo.IsComposite) return null;
        var png = store.ReadImage(photo.ImageId); if (png == null || png.Length > 4194304 || photo.ImageHash != null && photo.ImageHash != AlbumStore.Hash(png)) return null;
        photo = photo with { OwnerId = photo.OwnerId ?? Id(StardewValley.Game1.player), ImageHash = AlbumStore.Hash(png) };
        return new AlbumTransferOffer(photo, photo.ImageHash, png.Length, Session: photo.SessionId == null ? null : store.Sessions?.Find(photo.SessionId));
    }
    private void PlanCatalogue(long peer)
    {
        if (!Ready || !config().ShareAlbumPhotos) return;
        foreach (var session in store.Sessions?.Snapshot() ?? Array.Empty<AlbumSession>())
            if (session.PlayerIds.Contains(peer.ToString(System.Globalization.CultureInfo.InvariantCulture))) Send(peer, new SyncNote { Kind = "session", Session = session });
        catalogues[peer] = new Queue<string>(store.Snapshot().Where(photo => MaySend(photo, peer)).Select(photo => photo.Id));
    }
    internal void PhotoSaved(AlbumPhoto photo, byte[] png)
    {
        if (!Ready) return;
        if (photo.SessionId != null) { store.Sessions?.PhotoArrived(photo); CaptureSucceeded(photo.SessionId); }
        if (!config().ShareAlbumPhotos || !Context.IsMultiplayer || photo.IsComposite) return;
        var offer = new AlbumTransferOffer(photo, AlbumStore.Hash(png), png.Length, Session: photo.SessionId == null ? null : store.Sessions?.Find(photo.SessionId));
        foreach (long peer in CompatiblePeers) if (MaySend(photo, peer)) Send(peer, new SyncNote { Kind = "offer", Offer = offer });
    }
    private void SendPhotoChunks()
    {
        UpdateCaptureSessions();
        if (composing?.IsCompleted == true) {
            try { var result = composing.GetAwaiter().GetResult(); store.SaveComposite(result.Directory, result.Session, result.Png, Id(StardewValley.Game1.player)); }
            catch (Exception error) { monitor.Log("Álbum: montagem não concluída: " + error.Message, LogLevel.Warn); }
            composing = null;
        }
        if (Environment.TickCount64 - lastSync > 3000) {
            lastSync = Environment.TickCount64;
            foreach (var pending in inbox?.Pending() ?? Array.Empty<(string Sender, AlbumTransferOffer Offer)>())
                if (long.TryParse(pending.Sender, out long peer) && peers.ContainsKey(peer)) Need(peer, pending.Offer.Photo.Id);
            ConfirmSessions();
        }
        if (!config().ShareAlbumPhotos || !Context.IsMultiplayer) return;
        foreach (var pair in catalogues.ToArray()) {
            if (!peers.ContainsKey(pair.Key)) { catalogues.Remove(pair.Key); continue; }
            if (pair.Value.Count > 0 && controls.Count < 32) { var offer = Offer(pair.Value.Dequeue()); if (offer != null) Send(pair.Key, new SyncNote { Kind = "offer", Offer = offer }); }
            if (pair.Value.Count == 0) catalogues.Remove(pair.Key);
        }
        for (int i = 0; i < 4 && controls.Count > 0; i++) {
            var item = controls.Dequeue(); if (peers.ContainsKey(item.Target)) helper.Multiplayer.SendMessage(item.Note, "AlbumSync.v2", modIDs: new[] { modId }, playerIDs: new[] { item.Target });
        }
        for (int i = 0; i < 2 && chunks.Count > 0; i++) {
            var item = chunks.Dequeue(); queuedChunks.Remove(item.Target + "/" + item.Photo + "/" + item.Index);
            if (!peers.ContainsKey(item.Target)) continue; var offer = Offer(item.Photo); if (offer == null || !MaySend(offer.Photo, item.Target)) continue;
            if (!sendImages.TryGetValue(offer.Photo.ImageId, out var png)) { if (sendImages.Count >= 4) sendImages.Clear(); png = store.ReadImage(offer.Photo.ImageId); if (png == null) continue; sendImages[offer.Photo.ImageId] = png; }
            int offset = item.Index * 16384; if (offset < 0 || offset >= png.Length) continue;
            byte[] part = png.AsSpan(offset, Math.Min(16384, png.Length - offset)).ToArray();
            helper.Multiplayer.SendMessage(new SyncNote { Save = SaveId, Kind = "chunk", Id = item.Photo, Index = item.Index, Hash = AlbumStore.Hash(part), Data = Convert.ToBase64String(part) },
                "AlbumSync.v2", modIDs: new[] { modId }, playerIDs: new[] { item.Target });
        }
    }
    private void Need(long sender, string id)
    {
        if (inbox?.Find(sender.ToString(System.Globalization.CultureInfo.InvariantCulture), id) == null) return;
        var missing = inbox.Missing(sender.ToString(System.Globalization.CultureInfo.InvariantCulture), id);
        if (missing.Length > 0) Send(sender, new SyncNote { Kind = "need", Id = id, Indices = missing }); else Finish(sender, id);
    }
    private void Finish(long sender, string id)
    {
        string owner = sender.ToString(System.Globalization.CultureInfo.InvariantCulture); var offer = inbox?.Find(owner, id); var png = inbox?.Assemble(owner, id);
        if (offer == null) return;
        if (png == null) { if (inbox!.Missing(owner, id).Length == 0) { inbox.ResetParts(owner, id); Need(sender, id); } return; }
        var pixels = AlbumPng.Read(png); // Validate dimensions, CRCs, filters and bounded decompression before accepting the file.
        if (store.Import(offer.Photo, png, offer.Photo.OwnerId!)) { inbox!.Complete(owner, id); Send(sender, new SyncNote { Kind = "ack", Id = id, Hash = offer.Hash }); ConfirmSessions(); }
    }
    private bool AcceptSession(long sender, AlbumSession? session)
    {
        string player = sender.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (session == null || !AlbumSessions.Valid(session) || !session.PlayerIds.Contains(Id(StardewValley.Game1.player)) || !session.PlayerIds.Contains(player) || store.Sessions?.Start(session) != true) return false;
        if (session.Failures?.TryGetValue(player, out string? reason) == true) store.Sessions.Failed(session.Id, player, reason);
        return true;
    }
    private void ReceiveSync(ModMessageReceivedEventArgs e)
    {
        if (!config().ShareAlbumPhotos || !peers.TryGetValue(e.FromPlayerID, out var peer) || !peer.Sharing) return;
        var note = e.ReadAs<SyncNote>(); if (note.Protocol != 2 || note.Save != SaveId) return;
        string sender = e.FromPlayerID.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (note.Kind == "session") { AcceptSession(e.FromPlayerID, note.Session); return; }
        if (note.Kind == "request") { ReceiveCaptureRequest(e.FromPlayerID, note); return; }
        if (note.Kind == "accepted") { if (requests.TryGetValue(note.Id, out var requested) && requested.Target == e.FromPlayerID) requests.Remove(note.Id); return; }
        if (note.Kind == "failed") { if (requests.TryGetValue(note.Id, out var request) && request.Target == e.FromPlayerID) requests.Remove(note.Id); if (store.Sessions?.Find(note.Id)?.PlayerIds.Contains(sender) == true) store.Sessions.Failed(note.Id, sender, note.Reason ?? "Captura não concluída"); return; }
        if (note.Kind == "receipt") {
            string? digest = store.SessionDigest(note.Id); if (digest == null || digest != note.Hash) return;
            store.Sessions?.SetDigest(note.Id, digest); store.Sessions?.Confirm(note.Id, sender, digest); return;
        }
        if (note.Kind == "offer" && note.Offer is { } offer) {
            if (!AlbumTransferInbox.Valid(offer) || offer.Photo.Title.Length > 500 || offer.Photo.Description.Length > 4000 || offer.Photo.Participants?.Length > 16) return;
            if (offer.Photo.SessionId != null && (!AcceptSession(e.FromPlayerID, offer.Session) || offer.Session?.Id != offer.Photo.SessionId)) return;
            if (offer.Photo.SessionId != null) requests.Remove(offer.Photo.SessionId);
            var known = store.FindPhoto(offer.Photo.Id);
            var normalized = known == null ? null : known with { OwnerId = known.OwnerId ?? Id(StardewValley.Game1.player), ImageHash = known.ImageHash ?? offer.Hash };
            if (offer.Photo.OwnerId != sender && (normalized == null || AlbumStore.MetadataHash(normalized) != AlbumStore.MetadataHash(offer.Photo))) return;
            if (known != null && store.ValidImage(known) && AlbumStore.MetadataHash(normalized!) == AlbumStore.MetadataHash(offer.Photo)) {
                store.Sessions?.PhotoArrived(known); Send(e.FromPlayerID, new SyncNote { Kind = "ack", Id = known.Id, Hash = offer.Hash }); ConfirmSessions(); return;
            }
            inbox?.Start(sender, offer); Need(e.FromPlayerID, offer.Photo.Id); return;
        }
        if (note.Kind == "need" && note.Indices is { Length: <= 256 }) {
            var requestedOffer = Offer(note.Id); if (requestedOffer == null || !MaySend(requestedOffer.Photo, e.FromPlayerID)) return;
            foreach (int index in note.Indices.Distinct()) if (index >= 0 && index < (requestedOffer.Length + 16383) / 16384 && queuedChunks.Add(sender + "/" + note.Id + "/" + index)) chunks.Enqueue((e.FromPlayerID, note.Id, index)); return;
        }
        if (note.Kind == "chunk" && note.Data?.Length <= 22000 && inbox?.Find(sender, note.Id) != null) {
            inbox.Put(sender, note.Id, note.Index, Convert.FromBase64String(note.Data), note.Hash); if (inbox.Missing(sender, note.Id).Length == 0) Finish(e.FromPlayerID, note.Id); return;
        }
        if (note.Kind == "ack") { var photo = store.FindPhoto(note.Id); if (photo != null && photo.ImageHash == note.Hash) ConfirmSessions(); }
    }
    private void ConfirmSessions()
    {
        foreach (var session in store.Sessions?.Snapshot() ?? Array.Empty<AlbumSession>()) {
            string? digest = store.SessionDigest(session.Id); if (digest == null) continue;
            store.Sessions!.SetDigest(session.Id, digest); store.Sessions.Confirm(session.Id, Id(StardewValley.Game1.player), digest);
            foreach (var peer in session.PlayerIds.Where(id => id != Id(StardewValley.Game1.player))) if (long.TryParse(peer, out long target) && peers.ContainsKey(target)) Send(target, new SyncNote { Kind = "receipt", Id = session.Id, Hash = digest });
            var current = store.Sessions.Find(session.Id)!;
            if (composing == null && current.CompositePhotoId == null && !badCompositions.Contains(session.Id)) {
                var originals = current.PlayerIds.Select(owner => store.FindPhoto(current.Photos![owner])!).ToArray();
                byte[] a = store.ReadImage(originals[0].ImageId)!, b = store.ReadImage(originals[1].ImageId)!; string directory = store.ActiveDirectory!;
                badCompositions.Add(session.Id); composing = Task.Run(() => new ComposeResult(directory, current, AlbumHeartFrame.Compose(a, b)));
            }
        }
    }
}
