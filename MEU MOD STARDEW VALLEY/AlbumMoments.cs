using System;
using System.Collections.Generic;
using System.Linq;

namespace StardewRealtimeTelemetry;

internal sealed record AlbumInventoryItem(string GameId, string Name, int Quantity, int Quality);
internal sealed record AlbumRequirement(string Key, string GameId, string Name, int Quantity, int Quality,
    string Room, bool Completed, bool BundleCompleted);
internal sealed record AlbumMoment(string Kind, string ItemName, string Location, string? ReuseImageId = null, string? Room = null,
    string CaptureMode = "walking", string? Collection = null, string? PairKey = null, string[]? Participants = null,
    string? EpisodeKey = null, Dictionary<string, string>? Values = null, Func<bool>? Guard = null,
    int Priority = 0, object? CaptureContext = null, bool FollowLocation = false, string? SessionId = null);
internal sealed record AlbumFrameState(bool WorldReady, bool ScreenActive, bool PlayerFree, bool Moving,
    bool MenuOpen, bool EventActive, bool MiniGameActive, bool MapScreenshotActive);
internal static class AlbumCapturePolicy
{
    public static bool Allows(AlbumFrameState frame) => frame.WorldReady && frame.ScreenActive && frame.PlayerFree && frame.Moving &&
        !frame.MenuOpen && !frame.EventActive && !frame.MiniGameActive && !frame.MapScreenshotActive;
    public static bool AllowsReason(AlbumFrameState frame, bool stationary, bool menu, bool festival, bool minigame) =>
        frame.WorldReady && frame.ScreenActive && (stationary || (frame.PlayerFree && frame.Moving)) &&
        (!frame.MenuOpen || menu) && (!frame.EventActive || festival) && (!frame.MiniGameActive || minigame) && !frame.MapScreenshotActive;
}

/// <summary>Pure decision logic: an item disappearing is never proof of a bundle donation.</summary>
internal sealed class CommunityAlbumVisit
{
    private List<AlbumRequirement> enteredWith = new();
    private List<AlbumRequirement> previous = new();
    private List<AlbumInventoryItem> inventory = new();
    public string? EntryImageId { get; set; }
    public bool Active { get; private set; }
    public static int Held(AlbumRequirement need, IEnumerable<AlbumInventoryItem> items) => items
        .Where(item => item.GameId == need.GameId && item.Quality >= need.Quality).Sum(item => item.Quantity);
    public static bool Eligible(AlbumRequirement need, IEnumerable<AlbumInventoryItem> items) =>
        !need.Completed && !need.BundleCompleted && Held(need, items) >= need.Quantity;
    public AlbumMoment? Enter(List<AlbumRequirement> needs, List<AlbumInventoryItem> items)
    {
        Reset(); Active = true; previous = needs; inventory = items;
        enteredWith = needs.Where(need => Eligible(need, items)).ToList();
        return enteredWith.Count > 0 ? new AlbumMoment("center-arrival", enteredWith[0].Name, "CommunityCenter") : null;
    }
    public List<AlbumMoment> Observe(List<AlbumRequirement> needs, List<AlbumInventoryItem> items)
    {
        var result = new List<AlbumMoment>();
        if (!Active) return result;
        foreach (var need in previous.Where(need => !need.Completed && !need.BundleCompleted))
        {
            var now = needs.Find(current => current.Key == need.Key);
            if (now?.Completed == true && Held(need, inventory) - Held(need, items) >= need.Quantity)
                result.Add(new AlbumMoment(now.BundleCompleted ? "center-complete" : "center-delivery", need.Name, "CommunityCenter"));
        }
        previous = needs; inventory = items;
        return result;
    }
    public AlbumMoment? Leave(List<AlbumRequirement> needs, List<AlbumInventoryItem> items, string location)
    {
        var forgotten = enteredWith.Find(need => needs.Any(current => current.Key == need.Key && Eligible(current, items)));
        var moment = forgotten == null ? null : new AlbumMoment("center-forgot", forgotten.Name,
            EntryImageId != null ? "CommunityCenter" : location, EntryImageId);
        Reset(); return moment;
    }
    public void Reset() { Active = false; EntryImageId = null; enteredWith = new(); previous = new(); inventory = new(); }
}
