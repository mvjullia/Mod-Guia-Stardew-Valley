using System;
using System.Collections.Generic;
using System.Linq;
using StardewValley;
using StardewValley.GameData.Crops;
namespace StardewRealtimeTelemetry;
internal static class ItemGuides
{
    private static Dictionary<string,List<object>>? guides;
    public static StardewModdingAPI.IMonitor? Monitor { get; set; }
    public static object? Get(string qualifiedId)
    {
        if(guides==null)Build();
        return guides!.TryGetValue(qualifiedId,out var methods)?new {methods}:null;
    }
    private static void Add(string id, object method)
    {
        if(!guides!.TryGetValue(id,out var methods))guides[id]=methods=new List<object>();
        methods.Add(method);
    }
    private static string QualifiedObject(string id)=>id.StartsWith("(",StringComparison.Ordinal)?id:"(O)"+id;
    private static void Build()
    {
        guides=new();
        var seasons=new Dictionary<string,string>{{"Spring","Primavera"},{"Summer","Verão"},{"Fall","Outono"},{"Winter","Inverno"}};
        foreach(var pair in Game1.content.Load<Dictionary<string,CropData>>("Data/Crops")) {
            var crop=pair.Value;if(string.IsNullOrWhiteSpace(crop.HarvestItemId))continue;
            string seed=ItemRegistry.GetDataOrErrorItem(pair.Key).DisplayName;
            string season=string.Join(", ",crop.Seasons.Select(s=>seasons.TryGetValue(s.ToString(),out var translated)?translated:s.ToString()));
            Add(QualifiedObject(crop.HarvestItemId),new {type="cultivo",method="Cultive "+seed+" em solo arado e regue diariamente.",season,growthDays=crop.DaysInPhase.Where(n=>n<99999).Sum(),regrowDays=crop.RegrowDays,source="Dados de cultivo da versão instalada do jogo. Tempo base sem bônus."});
        }
        foreach(bool cooking in new[]{true,false}) foreach(var name in Game1.content.Load<Dictionary<string,string>>(cooking?"Data/CookingRecipes":"Data/CraftingRecipes").Keys) {
            try {
                var recipe=new CraftingRecipe(name,cooking);var result=recipe.createItem();
                string ingredients=string.Join(", ",recipe.recipeList.Select(e=>e.Value+" × "+(e.Key.StartsWith("-")?"categoria de ingrediente "+e.Key:ItemRegistry.GetDataOrErrorItem(e.Key).DisplayName)));
                Add(result.QualifiedItemId,new {type=cooking?"culinaria":"fabricacao",method=(cooking?"Prepare em uma cozinha ou kit de cozinha, com a receita desbloqueada. Ingredientes: ":"Fabrique com a receita desbloqueada. Ingredientes: ")+ingredients,source="Receitas da versão instalada do jogo."});
            } catch(Exception error) { Monitor?.Log("Guia: receita ignorada: "+name+" ("+error.GetType().Name+")",StardewModdingAPI.LogLevel.Warn); }
        }
    }
}
