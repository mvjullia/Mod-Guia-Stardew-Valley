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

var coopRules = JsonSerializer.Deserialize<AlbumCoopRules>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "album-rules.json")), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
var captions = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "album-moments.json")))!;
var alice = new AlbumActor("1", "Alice", "Beach", "Praia", "fishing", 1, "summer", 2, 1300, 10, 10, "", "", "2");
var bob = new AlbumActor("2", "Bob", "Mountain", "Montanha", "fishing", 1, "summer", 2, 1300, 10, 10, "", "", "1");
foreach (var activity in coopRules.Activities) {
    var director = new CoopAlbumDirector();
    var apart = director.Observe(alice with { Activity = activity.Id }, new[] { bob with { Activity = activity.Id } }, coopRules);
    Check(apart.Any(moment => moment.Kind == "coop-apart-" + activity.Id), "Faltou momento separado: " + activity.Id);
    var together = new CoopAlbumDirector().Observe(alice with { Activity = activity.Id }, new[] { bob with { Location = alice.Location, Activity = activity.Id } }, coopRules);
    Check(together.Any(moment => moment.Kind == "coop-together-" + activity.Id), "Faltou momento junto: " + activity.Id);
    Check(captions.ContainsKey("coop-apart-" + activity.Id) && captions.ContainsKey("coop-together-" + activity.Id), "Faltou legenda de atividade.");
}
var nights = new CoopAlbumDirector();
Check(nights.Observe(alice, Array.Empty<AlbumActor>(), coopRules).Count == 0, "Não se pode inventar um parceiro offline.");
Check(nights.Observe(alice, new[] { bob with { Day = 3 } }, coopRules).Count == 0, "Observações de outro dia não podem formar um momento.");
var night = nights.Observe(alice with { Time = 1900 }, new[] { bob with { Time = 1900 } }, coopRules);
Check(night.Count(moment => moment.Collection == "nights") == 1, "A noite da dupla precisa ser registrada.");
Check(nights.Observe(alice with { Time = 2200 }, new[] { bob with { Time = 2200 } }, coopRules).All(moment => moment.Collection != "nights"), "A mesma noite não pode duplicar.");
Check(nights.Observe(alice with { Time = 1900, Day = 3 }, new[] { bob with { Time = 1900, Day = 3 } }, coopRules).Any(moment => moment.Collection == "nights"), "A noite seguinte precisa de uma nova lembrança.");
var contest = new CoopAlbumDirector();
Check(contest.Result(alice, new AlbumScore(alice, "ice-fishing", 8, false, true), coopRules).Count == 0, "Placar provisório não pode virar vitória.");
contest.Result(alice, new AlbumScore(alice, "ice-fishing", 8, true, true), coopRules);
Check(contest.Result(alice, new AlbumScore(bob, "ice-fishing", 2, true, true), coopRules).Any(moment => moment.Kind == "competition-rout"), "Placar confirmado de lavada precisa ser reconhecido.");
var tied = new CoopAlbumDirector(); tied.Result(alice, new AlbumScore(alice, "egg-hunt", 8, true, true), coopRules);
Check(tied.Result(alice, new AlbumScore(bob, "egg-hunt", 8, true, true), coopRules).All(moment => moment.Kind == "competition-tie"), "Empate nunca pode ser tratado como lavada.");
Check(!AlbumCapturePolicy.AllowsReason(safe with { Moving = false, MenuOpen = true }, true, false, false, false), "Um motivo estacionário não libera menus arbitrários.");
Check(AlbumCapturePolicy.AllowsReason(safe with { Moving = false, MenuOpen = true, PlayerFree = false }, true, true, false, false), "Um motivo de menu explicitamente verificado pode registrar o próprio menu.");
Console.WriteLine("OK: 22 atividades juntas/separadas, noites por dupla, placares finais, empates e exceções explícitas de captura.");

var directory = Path.Combine(Path.GetTempPath(), "stardew-albums-test-" + Guid.NewGuid().ToString("N"));
byte[] png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDZ8AAAAASUVORK5CYII=");
byte[] Solid(byte red, byte green, byte blue) { var bytes = new byte[16 * 9 * 4]; for (int i=0;i<bytes.Length;i+=4) { bytes[i]=red;bytes[i+1]=green;bytes[i+2]=blue;bytes[i+3]=255; } return AlbumPng.Write(new AlbumPixels(16,9,bytes)); }
var redPng = Solid(220,20,20); var bluePng = Solid(20,20,220);
var decoded = AlbumPng.Read(redPng); Check(decoded.Width == 16 && decoded.Rgba[0] == 220, "Codec próprio precisa preservar pixels.");
var heart = AlbumHeartFrame.Compose(redPng,bluePng); var combined = AlbumPng.Read(heart);
if (args.Length == 1) File.WriteAllBytes(Path.GetFullPath(args[0]), heart);
Check(combined.Width==1600 && combined.Height==900, "Montagem precisa ser uma única imagem.");
Check(combined.Rgba[(400*1600+400)*4]>200 && combined.Rgba[(400*1600+1200)*4+2]>200, "As duas perspectivas precisam aparecer na montagem.");
bool badPng=false; var corrupt=redPng.ToArray();corrupt[corrupt.Length/2]^=1;try{AlbumPng.Read(corrupt);}catch(InvalidDataException){badPng=true;}Check(badPng,"CRC alterado precisa ser rejeitado.");
Console.WriteLine("OK: codec PNG próprio e montagem das duas perspectivas com moldura de coração.");
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
    var pairStore=new AlbumStore(directory);pairStore.Select("777","1");
    string sid=AlbumStore.StableId("teste-duas-visoes");var definition=new AlbumSession(sid,"shared-photo","coop","1",new[]{"1","2"},new[]{"Alice","Bob"},1,"summer",2,DateTimeOffset.UtcNow);
    Check(pairStore.Sessions!.Start(definition),"Sessão válida precisa persistir.");
    Check(!pairStore.Sessions.Start(definition with { Day=3 }),"Um índice antigo não pode trocar a data de uma sessão existente.");
    Check(!pairStore.Sessions.Start(definition with { InitiatorId="2" }),"O iniciador de uma sessão existente é imutável.");
    Check(!pairStore.Sessions.Confirm(sid,"1",new string('a',64)),"Não se confirma sessão sem originais.");
    var left=pairStore.Add(redPng,null,"shared-photo","Duas visões","Alice","Alice","Beach",1,"summer",2,1300,40,collection:"coop",ownerId:"1",sessionId:sid)!;
    Check(pairStore.SessionDigest(sid)==null,"Só uma foto não forma uma sessão completa.");
    var right=new AlbumPhoto(Guid.NewGuid().ToString("N"),Guid.NewGuid().ToString("N"),"shared-photo","Duas visões","Bob","Bob","Mountain",1,"summer",2,1300,DateTimeOffset.UtcNow,Collection:"coop",OwnerId:"2",SessionId:sid,ImageHash:AlbumStore.Hash(bluePng));
    Check(pairStore.Import(right,bluePng,"2"),"Segunda visão precisa ser importada após verificação.");
    string digest=pairStore.SessionDigest(sid)??throw new Exception("Resumo da sessão ausente");
    pairStore.Sessions.SetDigest(sid,digest);pairStore.Sessions.Confirm(sid,"1",digest);
    Check(pairStore.Sessions.Find(sid)!.Status!="synchronized","Ter duas fotos em um PC não confirma o outro PC.");
    Check(!pairStore.Sessions.Confirm(sid,"2",new string('b',64)),"Recibo com outro resumo não pode confirmar.");
    pairStore.Sessions.Confirm(sid,"2",digest);Check(pairStore.Sessions.Find(sid)!.Status=="synchronized","Os dois recibos válidos confirmam a sessão.");
    var otherComputer=new AlbumStore(directory);otherComputer.Select("777","2");otherComputer.Sessions!.Start(definition);
    Check(otherComputer.Import(left,redPng,"1")&&otherComputer.Import(right,bluePng,"2"),"O segundo computador precisa preservar as duas visões originais.");
    string otherDigest=otherComputer.SessionDigest(sid)??throw new Exception("Segundo computador não tem os originais");
    Check(otherDigest==digest,"Os dois computadores precisam concordar nos arquivos e metadados, não só nos nomes.");
    otherComputer.Sessions.SetDigest(sid,otherDigest);otherComputer.Sessions.Confirm(sid,"2",otherDigest);
    Check(otherComputer.Sessions.Find(sid)!.Status!="synchronized","Um recibo local sozinho nunca confirma o outro computador.");
    otherComputer.Sessions.Confirm(sid,"1",digest);Check(otherComputer.Sessions.Find(sid)!.Status=="synchronized","A confirmação bilateral precisa funcionar nos dois computadores.");
    var composite=pairStore.SaveComposite(pairStore.ActiveDirectory!,pairStore.Sessions.Find(sid)!,heart,"1");Check(composite?.IsComposite==true,"Foto composta precisa entrar no álbum.");
    var reopenedPair=new AlbumStore(directory);reopenedPair.Select("777","1");Check(reopenedPair.Sessions!.Find(sid)!.Status=="synchronized","Confirmações precisam sobreviver ao reinício.");
    string originalDirectory=pairStore.ActiveDirectory!;pairStore.Select("888","1");Check(pairStore.SaveComposite(originalDirectory,reopenedPair.Sessions.Find(sid)!,heart,"1")==null,"Montagem atrasada não pode cair em outro save.");
    var noise=new byte[128*96*4];new Random(42).NextBytes(noise);for(int i=3;i<noise.Length;i+=4)noise[i]=255;
    var large=AlbumPng.Write(new AlbumPixels(128,96,noise));var transferPhoto=right with {Id=Guid.NewGuid().ToString("N"),ImageId=Guid.NewGuid().ToString("N"),ImageHash=AlbumStore.Hash(large)};
    var inbox=new AlbumTransferInbox(pairStore.ActiveDirectory!);var offer=new AlbumTransferOffer(transferPhoto,AlbumStore.Hash(large),large.Length);inbox.Start("2",offer);
    var firstChunk=large.AsSpan(0,Math.Min(16384,large.Length)).ToArray();inbox.Put("2",transferPhoto.Id,0,firstChunk,AlbumStore.Hash(firstChunk));
    var resumed=new AlbumTransferInbox(pairStore.ActiveDirectory!);Check(!resumed.Missing("2",transferPhoto.Id).Contains(0),"Pedaço confirmado precisa sobreviver ao reinício.");
    foreach(int index in resumed.Missing("2",transferPhoto.Id)){var part=large.AsSpan(index*16384,Math.Min(16384,large.Length-index*16384)).ToArray();resumed.Put("2",transferPhoto.Id,index,part,AlbumStore.Hash(part));}
    Check(resumed.Assemble("2",transferPhoto.Id)!.SequenceEqual(large),"Retomada precisa produzir os mesmos bytes e hash.");
    resumed.Complete("2",transferPhoto.Id);
    Console.WriteLine("OK: sessão persistente, confirmação bilateral, transferência retomável e proteção ao trocar de save.");
    var badIndex = Path.Combine(directory, "123", "456", "index.json"); File.WriteAllText(badIndex, "índice inválido");
    bool rejected = false; try { reloaded.Select("123", "456"); } catch (JsonException) { rejected = true; }
    Check(rejected && File.ReadAllText(badIndex) == "índice inválido", "Índice corrompido não deve ser sobrescrito silenciosamente.");
    Console.WriteLine("OK: persistência, segurança de caminhos, isolamento, limite diário e preservação das fotos.");
} finally {
    var resolved = Path.GetFullPath(directory);
    Check(resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) && Path.GetFileName(resolved).StartsWith("stardew-albums-test-"), "Limpeza deve ficar restrita ao diretório temporário criado pelo teste.");
    if (Directory.Exists(resolved)) Directory.Delete(resolved, true);
}
