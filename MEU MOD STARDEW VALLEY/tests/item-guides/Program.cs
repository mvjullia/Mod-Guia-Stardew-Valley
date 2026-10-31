using System;
using System.Collections.Generic;
using System.Text.Json;
using StardewRealtimeTelemetry;
namespace StardewModdingAPI { public enum LogLevel { Warn } public interface IMonitor {void Log(string message,LogLevel level);} }
namespace StardewValley.GameData.Crops { public class CropData {public string HarvestItemId {get;set;}="";public List<string> Seasons {get;set;}=new();public List<int> DaysInPhase {get;set;}=new();public int RegrowDays {get;set;}=-1;} }
namespace StardewValley {
 public class MockContent { public T Load<T>(string name) { object value=name switch {"Data/Crops"=>new Dictionary<string,StardewValley.GameData.Crops.CropData>{{"472",new(){HarvestItemId="24",Seasons=new(){"Spring"},DaysInPhase=new(){1,1,1,1,99999}}}},"Data/CookingRecipes"=>new Dictionary<string,string>{{"receita objeto",""}},_=>new Dictionary<string,string>{{"maquina",""}}};return (T)value; } }
 public static class Game1 {public static MockContent content=new();}
 public class Item {public string QualifiedItemId {get;set;}="";}
 public class ItemData {public string DisplayName {get;set;}="Sementes";}
 public static class ItemRegistry {public static ItemData GetDataOrErrorItem(string id)=>new();}
 public class CraftingRecipe {private readonly bool cooking;public Dictionary<string,int> recipeList=new(){{"388",15}};public CraftingRecipe(string name,bool cooking){this.cooking=cooking;}public Item createItem()=>new(){QualifiedItemId=cooking?"(O)24":"(BC)24"};}
}
class Program {static void Main(){using var obj=JsonDocument.Parse(JsonSerializer.Serialize(ItemGuides.Get("(O)24")));using var machine=JsonDocument.Parse(JsonSerializer.Serialize(ItemGuides.Get("(BC)24")));var a=obj.RootElement.GetProperty("methods");var b=machine.RootElement.GetProperty("methods");if(a.GetArrayLength()!=2||a[0].GetProperty("type").GetString()!="cultivo"||a[1].GetProperty("type").GetString()!="culinaria"||b.GetArrayLength()!=1||b[0].GetProperty("type").GetString()!="fabricacao")throw new Exception("Colisão de IDs ou perda de métodos");Console.WriteLine("OK: IDs qualificados não colidem e múltiplos métodos são preservados.");} }
