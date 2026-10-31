using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using HarmonyLib;
using StardewModdingAPI;
using StardewValley;
using StardewValley.Menus;
using StardewValley.Minigames;
using StardewValley.TerrainFeatures;

namespace StardewRealtimeTelemetry;

/// <summary>Postfix observers only: no game arguments, return values, scores or inventory are modified.</summary>
internal static class AlbumGameHooks
{
    private static readonly Dictionary<long, WeakReference<CoopAlbumRecorder>> recorders = new();
    private static readonly ConditionalWeakTable<object, object> completedGames = new();
    private static bool installed;
    private static IMonitor? monitor;
    internal static bool IsCompletedGame(object? game) => game != null && completedGames.TryGetValue(game, out _);
    public static void Register(CoopAlbumRecorder recorder) { if (Context.IsWorldReady) recorders[Game1.player.UniqueMultiplayerID] = new(recorder); }
    private static CoopAlbumRecorder? Local => Context.IsWorldReady && recorders.TryGetValue(Game1.player.UniqueMultiplayerID, out var reference) && reference.TryGetTarget(out var recorder) ? recorder : null;
    private static void Safe(Action<CoopAlbumRecorder> action) { try { if (Local is { } recorder) action(recorder); } catch (Exception error) { monitor?.Log("Álbum: observador ignorado: " + error.Message, LogLevel.Trace); } }
    public static void Install(string id, IMonitor log)
    {
        if (installed) return; installed = true; monitor = log; var harmony = new Harmony(id + ".Albums");
        void Patch(Type type, string name, string? before, string? after, Func<MethodInfo, bool>? filter = null) {
            var methods = AccessTools.GetDeclaredMethods(type).Where(method => method.Name == name && (filter == null || filter(method))).ToArray();
            if (!methods.Any()) log.Log("Álbum: evento não disponível nesta versão: " + type.Name + "." + name, LogLevel.Warn);
            foreach (var method in methods) try {
                harmony.Patch(method, before == null ? null : new HarmonyMethod(typeof(AlbumGameHooks), before), after == null ? null : new HarmonyMethod(typeof(AlbumGameHooks), after));
            } catch (Exception error) { log.Log("Álbum: integração indisponível para " + type.Name + "." + name + ": " + error.Message, LogLevel.Warn); }
        }
        Patch(typeof(Farmer), "doneEating", nameof(EatingBefore), nameof(EatingAfter));
        Patch(typeof(Farmer), "startToPassOut", nameof(PassOutBefore), null);
        Patch(typeof(Farmer), "performPassOut", nameof(PassOutBefore), null);
        Patch(typeof(Farmer), "performKissFarmer", null, nameof(KissAfter));
        Patch(typeof(StrengthGame), "afterSwingAnimation", null, nameof(StrengthAfter));
        Patch(typeof(FishingGame), "tick", null, nameof(GameTickAfter));
        Patch(typeof(TargetGame), "tick", null, nameof(GameTickAfter));
        Patch(typeof(Event), "eggHuntWinner", nameof(EggBefore), nameof(FestivalAfter));
        Patch(typeof(Event), "iceFishingWinner", nameof(IceBefore), nameof(FestivalAfter));
        Patch(typeof(ShopMenu), "tryToPurchaseItem", nameof(PurchaseBefore), nameof(PurchaseAfter));
        Patch(typeof(GameLocation), "performAction", null, nameof(ActionAfter), method => method.ReturnType == typeof(bool) && method.GetParameters().Any(p => p.ParameterType == typeof(Farmer)));
        Patch(typeof(HoeDirt), "plant", null, nameof(PlantAfter));
        Patch(typeof(Crop), "harvest", nameof(HarvestBefore), nameof(HarvestAfter));
        Patch(typeof(FarmAnimal), "pet", nameof(PetBefore), nameof(PetAfter));
        Patch(typeof(NPC), "receiveGift", null, nameof(GiftAfter));
        Patch(typeof(StardewValley.Object), "checkForAction", null, nameof(ObjectAfter));
        Patch(typeof(StardewValley.Objects.Furniture), "checkForAction", null, nameof(ObjectAfter));
    }
    private sealed record EatState(string Id, string Name, bool Consuming);
    private static void PassOutBefore(Farmer __instance) { if (Context.IsWorldReady && __instance.IsLocalPlayer) Safe(recorder => recorder.PassOut()); }
    private static void EatingBefore(Farmer __instance, out EatState? __state) {
        __state = Context.IsWorldReady && __instance.IsLocalPlayer && __instance.isEating && __instance.itemToEat != null && __instance.mostRecentlyGrabbedItem != null ?
            new EatState(__instance.itemToEat.QualifiedItemId, __instance.itemToEat.DisplayName, true) : null;
    }
    private static void EatingAfter(EatState? __state) { if (__state?.Consuming == true) Safe(recorder => { recorder.Pulse("eating"); if (recorder.IsJojaItem(__state.Id)) recorder.Record("joja-cola", "joja", "scene", __state.Name); }); }
    private static void KissAfter(Farmer __instance, long __0) { if (Context.IsWorldReady && (__instance.IsLocalPlayer || __0 == Game1.player.UniqueMultiplayerID)) Safe(recorder => recorder.Kiss(__instance, __0)); }
    private static void StrengthAfter(StrengthGame __instance) { Safe(recorder => recorder.Strength(Convert.ToSingle(AccessTools.Field(typeof(StrengthGame), "power").GetValue(__instance)), __instance)); }
    private static void GameTickAfter(object __instance) {
        Safe(recorder => {
            if (completedGames.TryGetValue(__instance, out _)) return;
            var type = __instance.GetType(); bool done = (bool)(AccessTools.Field(type, "gameDone")?.GetValue(__instance) ?? false);
            int results = (int)(AccessTools.Field(type, "showResultsTimer")?.GetValue(__instance) ?? int.MaxValue);
            if (!done || results < 0 || (__instance is FishingGame ? results > 5000 : results > 8000)) return;
            completedGames.Add(__instance, new object());
            recorder.Result(__instance is FishingGame ? "fair-fishing" : "fair-target", (int)(AccessTools.Field(type, "score")!.GetValue(__instance) ?? 0));
        });
    }
    private static List<AlbumScore>? ReadFestivalScores(string kind) { try { return Local?.FestivalScores(kind); } catch (Exception error) { monitor?.Log("Álbum: placar indisponível: " + error.Message, LogLevel.Trace); return null; } }
    private static void EggBefore(out List<AlbumScore>? __state) { __state = ReadFestivalScores("egg-hunt"); }
    private static void IceBefore(out List<AlbumScore>? __state) { __state = ReadFestivalScores("ice-fishing"); }
    private static void FestivalAfter(List<AlbumScore>? __state) { if (__state?.Count > 0) Safe(recorder => recorder.FestivalResults(__state[0].Competition, __state)); }
    private static void PurchaseBefore(out int __state) { __state = Context.IsWorldReady ? Game1.player.Money : 0; }
    private static void PurchaseAfter(ShopMenu __instance, object[] __args, int __state) {
        if (!Context.IsWorldReady || Game1.player.Money >= __state) return;
        Safe(recorder => { recorder.Pulse("shopping"); if (recorder.IsJojaShop(__instance.ShopId)) recorder.Record("joja-purchase", "joja", "joja", __args.OfType<Item>().FirstOrDefault()?.DisplayName ?? "um item", context: __instance); });
    }
    private static void ActionAfter(GameLocation __instance, object[] __args, bool __result) {
        if (!__result || !Context.IsWorldReady || !__args.OfType<Farmer>().Any(farmer => farmer.IsLocalPlayer)) return;
        Safe(recorder => { var action = __args.OfType<string>().FirstOrDefault(); if (action != null && recorder.IsJojaAction(action, __instance)) recorder.Record("joja-interaction", "joja", "joja", context: Game1.activeClickableMenu); });
    }
    private static void PlantAfter(object[] __args, bool __result) { if (__result && __args.OfType<Farmer>().Any(farmer => farmer.IsLocalPlayer)) Safe(recorder => recorder.Pulse("planting")); }
    private static void HarvestBefore(object[] __args, out int __state) { __state = Context.IsWorldReady && !__args.Any(arg => arg is StardewValley.Characters.JunimoHarvester) ? Game1.player.Items.Where(item => item != null).Sum(item => item.Stack) : -1; }
    private static void HarvestAfter(int __state) { if (__state >= 0 && Context.IsWorldReady && Game1.player.Items.Where(item => item != null).Sum(item => item.Stack) > __state) Safe(recorder => recorder.Pulse("harvesting")); }
    private static void PetBefore(FarmAnimal __instance, out bool __state) { __state = __instance.wasPet.Value; }
    private static void PetAfter(FarmAnimal __instance, object[] __args, bool __state) { if (!__state && __instance.wasPet.Value && __args.OfType<Farmer>().Any(farmer => farmer.IsLocalPlayer) && !__args.OfType<bool>().Any(value => value)) Safe(recorder => recorder.Pulse("petting")); }
    private static void GiftAfter(object[] __args) { if (!__args.OfType<Farmer>().Any(farmer => farmer.IsLocalPlayer)) return; Safe(recorder => { recorder.Pulse("gifting"); var gift = __args.OfType<Item>().FirstOrDefault(); if (gift != null && recorder.IsJojaItem(gift.QualifiedItemId)) recorder.Record("joja-gift", "joja", "scene", gift.DisplayName); }); }
    private static void ObjectAfter(StardewValley.Object __instance, object[] __args, bool __result) {
        if (!__result || __args.OfType<bool>().Any(value => value) || !__args.OfType<Farmer>().Any(farmer => farmer.IsLocalPlayer)) return;
        Safe(recorder => { if (recorder.IsJojaItem(__instance.QualifiedItemId)) recorder.Record("joja-object", "joja", "joja", __instance.DisplayName, context: Game1.activeClickableMenu); });
    }
}
