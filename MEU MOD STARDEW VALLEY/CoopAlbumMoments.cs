using System;
using System.Collections.Generic;
using System.Linq;

namespace StardewRealtimeTelemetry;

internal sealed record AlbumActor(string Id, string Name, string Location, string Place, string Activity,
    int Year, string Season, int Day, int Time, float X, float Y, string Festival, string FestivalName, string? PartnerId = null, int ActivityValidityMs = 1000)
{
    public string DateKey => Year + "/" + Season + "/" + Day;
}
internal sealed class AlbumActivityRule { public string Id { get; set; } = ""; public string Label { get; set; } = ""; }
internal sealed class AlbumCompetitionRule { public string Label { get; set; } = ""; public int MinLead { get; set; } = 2; public double Ratio { get; set; } = 1.5; }
internal sealed class AlbumPassiveFestivalRule { public string Id { get; set; } = ""; public string Label { get; set; } = ""; public string[] Locations { get; set; } = Array.Empty<string>(); public int StartTime { get; set; } }
internal sealed class AlbumCoopRules
{
    public List<AlbumActivityRule> Activities { get; set; } = new();
    public Dictionary<string, string> Counters { get; set; } = new();
    public Dictionary<string, AlbumCompetitionRule> Competitions { get; set; } = new();
    public string[] JojaLocations { get; set; } = Array.Empty<string>();
    public string[] JojaShopIds { get; set; } = Array.Empty<string>();
    public string[] JojaItemIds { get; set; } = Array.Empty<string>();
    public string[] JojaActionPrefixes { get; set; } = Array.Empty<string>();
    public float StrengthTopTierMin { get; set; } = 99;
    public List<AlbumPassiveFestivalRule> PassiveFestivals { get; set; } = new();
}
internal sealed record AlbumScore(AlbumActor Actor, string Competition, int Score, bool Final, bool Official);

/// <summary>Consumes verified observations only. It never guesses activity from possession of a tool.</summary>
internal sealed class CoopAlbumDirector
{
    private readonly HashSet<string> emitted = new();
    private readonly Dictionary<string, AlbumScore> scores = new();
    public static string Pair(AlbumActor a, AlbumActor b) => string.Join(":", new[] { a.Id, b.Id }.OrderBy(id => id, StringComparer.Ordinal));
    public void Reset() { emitted.Clear(); scores.Clear(); }
    private AlbumMoment? Once(AlbumActor local, AlbumActor peer, string kind, string collection, string mode, Dictionary<string, string>? extra = null, string? episode = null)
    {
        string key = episode ?? local.DateKey + "/" + Pair(local, peer) + "/" + kind + "/" + local.Id;
        if (!emitted.Add(key)) return null;
        var values = new Dictionary<string, string> { ["player"] = local.Name, ["partner"] = peer.Name, ["place"] = local.Place,
            ["partnerPlace"] = peer.Place, ["festival"] = local.FestivalName };
        if (extra != null) foreach (var pair in extra) values[pair.Key] = pair.Value;
        string[] people = new[] { local, peer }.OrderBy(actor => actor.Id, StringComparer.Ordinal).Select(actor => actor.Name).ToArray();
        return new AlbumMoment(kind, "", local.Location, CaptureMode: mode, Collection: collection, PairKey: Pair(local, peer),
            Participants: people, EpisodeKey: key, Values: values, Priority: collection == "nights" ? 75 : 65, FollowLocation: collection == "nights");
    }
    public List<AlbumMoment> Observe(AlbumActor local, IEnumerable<AlbumActor> peers, AlbumCoopRules rules)
    {
        var result = new List<AlbumMoment>();
        void Add(AlbumMoment? moment) { if (moment != null) result.Add(moment); }
        foreach (var peer in peers.Where(peer => peer.Id != local.Id && peer.DateKey == local.DateKey))
        {
            bool sameMap = peer.Location == local.Location;
            float distance = (peer.X - local.X) * (peer.X - local.X) + (peer.Y - local.Y) * (peer.Y - local.Y);
            bool near = sameMap && distance <= 64;
            if (local.Activity == peer.Activity && rules.Activities.Any(rule => rule.Id == local.Activity) && (!sameMap || near))
                Add(Once(local, peer, "coop-" + (sameMap ? "together-" : "apart-") + local.Activity, "coop", "activity"));
            if (!string.IsNullOrEmpty(local.Festival) && local.Festival == peer.Festival && sameMap)
                Add(Once(local, peer, "festival-together", "festivals", "festival"));
            if (local.Time >= 1800 && peer.Time >= 1800)
            {
                Add(Once(local, peer, sameMap ? "night-together" : "night-apart", "nights", string.IsNullOrEmpty(local.Festival) ? "scene" : "festival",
                    episode: local.DateKey + "/" + Pair(local, peer) + "/night/" + local.Id));
                if (near && local.Time <= 2000 && string.IsNullOrEmpty(local.Festival))
                    Add(Once(local, peer, "sunset-together", "romance", "scene"));
                if (near && local.PartnerId == peer.Id && local.Time >= 2100 && string.IsNullOrEmpty(local.Festival))
                    Add(Once(local, peer, "night-sweethearts", "romance", "scene"));
            }
            if (near && local.PartnerId == peer.Id && local.Activity == "fishing" && peer.Activity == "fishing")
                Add(Once(local, peer, "fishing-date", "romance", "activity"));
        }
        return result;
    }
    public List<AlbumMoment> Result(AlbumActor local, AlbumScore score, AlbumCoopRules rules)
    {
        var result = new List<AlbumMoment>();
        if (!score.Final || score.Score < 0 || score.Actor.DateKey != local.DateKey || !rules.Competitions.TryGetValue(score.Competition, out var rule)) return result;
        string prefix = score.Actor.DateKey + "/" + score.Competition + "/";
        string key = prefix + score.Actor.Id;
        if (!scores.TryGetValue(key, out var previous) || score.Score > previous.Score) scores[key] = score;
        if (!scores.TryGetValue(prefix + local.Id, out var own)) return result;
        foreach (var other in scores.Where(pair => pair.Key.StartsWith(prefix, StringComparison.Ordinal) && pair.Value.Actor.Id != local.Id).Select(pair => pair.Value))
        {
            if (own.Score == other.Score) {
                var tie = Once(local, other.Actor, "competition-tie", "festivals", "competition", new() { ["competition"] = rule.Label, ["score"] = own.Score.ToString() },
                    prefix + Pair(local, other.Actor) + "/tie/" + own.Score + "/" + local.Id);
                if (tie != null) result.Add(tie); continue;
            }
            var winner = own.Score > other.Score ? own : other; var loser = ReferenceEquals(winner, own) ? other : own;
            bool rout = winner.Score - loser.Score >= rule.MinLead && winner.Score >= Math.Max(1, loser.Score) * rule.Ratio;
            var values = new Dictionary<string, string> { ["winner"] = winner.Actor.Name, ["loser"] = loser.Actor.Name,
                ["winnerScore"] = winner.Score.ToString(), ["loserScore"] = loser.Score.ToString(), ["competition"] = rule.Label,
                ["scoreBasis"] = score.Official ? "placar final entre os jogadores" : "melhor marca concluída de cada jogador neste dia" };
            var moment = Once(local, other.Actor, rout ? "competition-rout" : "competition-close", "festivals", "competition", values,
                prefix + Pair(local, other.Actor) + "/" + winner.Actor.Id + "/" + winner.Score + "/" + loser.Score + "/" + local.Id);
            if (moment != null) result.Add(moment with { FollowLocation = true, Priority = 90 });
        }
        return result;
    }
}
