using StardewRealtimeTelemetry;
using System.Text.Json;

static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
var need = new AlbumRequirement("1:0", "(O)24", "Chirívia", 1, 0, "Pantry", false, false);
List<AlbumInventoryItem> Pack(int amount, int quality = 0) => new() { new("(O)24", "Chirívia", amount, quality) };
var safe = new AlbumFrameState(true, true, true, true, false, false, false, false);
Check(AlbumCapturePolicy.Allows(safe), "Frame do mundo em movimento deve permitir captura.");
foreach (var blocked in new[] { safe with { WorldReady = false }, safe with { ScreenActive = false }, safe with { PlayerFree = false },
    safe with { Moving = false }, safe with { MenuOpen = true }, safe with { EventActive = true }, safe with { MiniGameActive = true }, safe with { MapScreenshotActive = true } })
    Check(!AlbumCapturePolicy.Allows(blocked), "Menus, pausa, eventos ou jogador parado não podem produzir uma foto.");
Console.WriteLine("OK: política de captura bloqueia menus e frames sem movimento.");

var visit = new CommunityAlbumVisit();
Check(visit.Enter(new() { need }, Pack(1))?.Kind == "center-arrival", "Chegada com item precisa ser reconhecida.");
var donated = need with { Completed = true, BundleCompleted = true };
Check(visit.Observe(new() { need }, Pack(1)).Count == 0, "Um item segurado pelo cursor do menu ainda pertence ao jogador e não é uma entrega.");
Check(visit.Observe(new() { donated }, Pack(0)).Single().Kind == "center-complete", "Concluir um conjunto precisa gerar uma lembrança especial.");
Check(visit.Leave(new() { donated }, Pack(0), "Town") == null, "Entregar elimina a gag de esquecimento.");
visit.Enter(new() { need }, Pack(1));
Check(visit.Observe(new() { donated with { BundleCompleted = false } }, Pack(0)).Single().Kind == "center-delivery", "Entregas em conjuntos ainda abertos também precisam ser registradas.");
visit.Enter(new() { need }, Pack(1));
Check(visit.Observe(new() { donated }, Pack(1)).Count == 0, "Entrega de outro jogador não pode ser atribuída ao jogador local.");
visit.Enter(new() { need }, Pack(1));
Check(visit.Observe(new() { need }, Pack(0)).Count == 0, "Perder um item sem mudar o conjunto não é prova de entrega.");
Console.WriteLine("OK: entregas exigem mudança do conjunto e consumo do inventário local.");

visit.Enter(new() { need }, Pack(1)); visit.EntryImageId = new string('a', 32);
var forgotten = visit.Leave(new() { need }, Pack(1), "Town");
Check(forgotten?.Kind == "center-forgot" && forgotten.ItemName == "Chirívia" && forgotten.ReuseImageId == new string('a', 32), "Gag deve guardar o item e a foto válida da visita.");
Check(!visit.Active, "Visita precisa encerrar ao sair.");
visit.Enter(new() { need }, Pack(1));
Check(visit.Leave(new() { need with { BundleCompleted = true } }, Pack(1), "Town") == null, "Conjunto concluído por outra opção não é esquecimento.");
var gold = need with { Quantity = 5, Quality = 2 };
Check(visit.Enter(new() { gold }, Pack(5, 0)) == null, "Qualidade normal não atende um conjunto de ouro.");
Check(visit.Enter(new() { gold }, Pack(4, 2)) == null, "Quantidade insuficiente não é uma entrega disponível.");
Check(visit.Enter(new() { gold }, Pack(5, 2)) != null, "Quantidade e qualidade corretas devem ser elegíveis.");
visit.Reset(); Check(!visit.Active && visit.EntryImageId == null, "Trocar de save deve limpar a visita.");
Console.WriteLine("OK: gags respeitam quantidade, qualidade, pacotes de escolha e troca de save.");

var directory = Path.Combine(Path.GetTempPath(), "stardew-albums-test-" + Guid.NewGuid().ToString("N"));
byte[] png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDZ8AAAAASUVORK5CYII=");
try {
    var store = new AlbumStore(directory); store.Select("123", "456");
    var photo = store.Add(png, null, "center-arrival", "Trouxe o item", "Maria trouxe Chirívia", "Maria", "CommunityCenter", 1, "spring", 2, 900, 2) ?? throw new Exception("Foto não foi gravada.");
    Check(store.ReadImage(photo.ImageId)!.SequenceEqual(png), "Foto deve persistir sem alterar os bytes.");
    Check(store.ReadImage("../../secret") == null && store.ReadImage(new string('b', 32)) == null, "IDs não registrados devem ser recusados.");
    var gag = store.Add(null, photo.ImageId, "center-forgot", "Esqueci!", "Maria saiu sem entregar", "Maria", "CommunityCenter", 1, "spring", 2, 1000, 2);
    Check(gag != null && gag.ImageId == photo.ImageId && gag.Id != photo.Id, "A gag pode referenciar a foto verdadeira da chegada.");
    Check(gag!.Time == photo.Time && gag.CapturedAt == photo.CapturedAt, "Uma legenda posterior não pode falsificar o horário da foto original.");
    Check(store.Add(png, null, "late-home", "Tarde", "Tarde", "Maria", "FarmHouse", 1, "spring", 2, 2500, 2) == null, "Limite diário não pode ser ultrapassado.");
    Check(Directory.GetFiles(Path.Combine(directory, "123", "456"), "*.png").Length == 1, "Reutilizar a foto não deve duplicar arquivos.");
    var reloaded = new AlbumStore(directory); reloaded.Select("123", "456");
    Check(reloaded.ReadImage(photo.ImageId) != null, "Reabrir a fazenda deve preservar o álbum.");
    reloaded.Select("123", "789"); Check(reloaded.ReadImage(photo.ImageId) == null, "Álbuns de jogadores diferentes precisam ficar isolados.");
    reloaded.Select("999", "456"); Check(reloaded.ReadImage(photo.ImageId) == null, "Álbuns de fazendas diferentes precisam ficar isolados.");
    reloaded.Select("123", "456");
    Check(reloaded.Add(png, null, "late-home", "Outro dia", "Outra história", "Maria", "FarmHouse", 1, "spring", 3, 2500, 2) != null, "Outro dia deve permitir novas fotos.");
    Check(reloaded.ReadImage(photo.ImageId) != null, "Fotos antigas nunca devem ser apagadas para liberar espaço.");
    reloaded.Deactivate(); Check(reloaded.ReadImage(photo.ImageId) == null, "Ao sair da fazenda, o álbum precisa ficar inativo.");
    var badIndex = Path.Combine(directory, "123", "456", "index.json"); File.WriteAllText(badIndex, "índice inválido");
    bool rejected = false; try { reloaded.Select("123", "456"); } catch (JsonException) { rejected = true; }
    Check(rejected && File.ReadAllText(badIndex) == "índice inválido", "Índice corrompido não deve ser sobrescrito silenciosamente.");
    Console.WriteLine("OK: persistência, segurança de caminhos, isolamento, limite diário e preservação das fotos.");
} finally {
    var resolved = Path.GetFullPath(directory);
    Check(resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) && Path.GetFileName(resolved).StartsWith("stardew-albums-test-"), "Limpeza deve ficar restrita ao diretório temporário criado pelo teste.");
    if (Directory.Exists(resolved)) Directory.Delete(resolved, true);
}
