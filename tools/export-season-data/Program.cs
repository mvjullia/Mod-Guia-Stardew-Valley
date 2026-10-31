using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using Microsoft.Xna.Framework.Content;

if (args.Length != 2) throw new ArgumentException("Uso: ExportSeasonData <pasta do jogo> <pasta de saída>");
string game = Path.GetFullPath(args[0]), output = Path.GetFullPath(args[1]);
AssemblyLoadContext.Default.Resolving += (_, name) => {
    string path = Path.Combine(game, name.Name + ".dll");
    return File.Exists(path) ? AssemblyLoadContext.Default.LoadFromAssemblyPath(path) : null;
};
Directory.CreateDirectory(output);
using var content = new ContentManager(new EmptyServices(), Path.Combine(game, "Content"));
var options = new JsonSerializerOptions { IncludeFields = true, WriteIndented = true };
var fish = content.Load<Dictionary<string, string>>("Data/Fish");
File.WriteAllText(Path.Combine(output, "fish.json"), JsonSerializer.Serialize(fish, options));
var models = Assembly.LoadFrom(Path.Combine(game, "StardewValley.GameData.dll"));
foreach (var entry in new[] { (Asset: "Locations", Model: "Locations.LocationData"), (Asset: "Shops", Model: "Shops.ShopData"), (Asset: "PassiveFestivals", Model: "PassiveFestivalData") }) {
    var type = typeof(Dictionary<,>).MakeGenericType(typeof(string), models.GetType("StardewValley.GameData." + entry.Model, true)!);
    object data = typeof(ContentManager).GetMethod("Load")!.MakeGenericMethod(type).Invoke(content, new object[] { "Data/" + entry.Asset })!;
    File.WriteAllText(Path.Combine(output, entry.Asset.ToLowerInvariant() + ".json"), JsonSerializer.Serialize(data, type, options));
}
Console.WriteLine("Dados originais exportados: Fish, Locations, Shops e PassiveFestivals.");
File.WriteAllText(Path.Combine(output, "source-info.json"), JsonSerializer.Serialize(new {
    gameVersion = AssemblyName.GetAssemblyName(Path.Combine(game, "Stardew Valley.dll")).Version?.ToString()
}, options));

class EmptyServices : IServiceProvider { public object? GetService(Type serviceType) => null; }
