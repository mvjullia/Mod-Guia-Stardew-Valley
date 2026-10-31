using System;
using System.Globalization;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using StardewModdingAPI;
using StardewValley;

namespace StardewRealtimeTelemetry
{
    public sealed class ModConfig
    {
        // Somente exportação local até existir uma API autenticada no site.
        public bool EnableHttpUpload { get; set; } = false;
        public string ApiUrl { get; set; } = "http://127.0.0.1:8787/api/snapshots";
        public string ApiToken { get; set; } = "";
        public int UploadIntervalSeconds { get; set; } = 2;
    }

    public class ModEntry : Mod
    {
        private ModConfig Config = new();
        private EmbeddedGuide? guide;
        private bool openedGuide;
        private void OpenGuide() { if (this.guide == null) { this.Monitor.Log("Guia indisponível; verifique o erro de inicialização.", LogLevel.Warn); return; } try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(this.guide.StartUrl) { UseShellExecute = true }); this.Monitor.Log("Abrindo guia com conexão automática no navegador padrão.", LogLevel.Info); } catch (Exception ex) { this.Monitor.Log("Não foi possível abrir o navegador: " + ex.Message, LogLevel.Warn); } }
        private int elapsedSeconds;
        private string? portrait;
        private int uploadInProgress;
        private static readonly HttpClient Client = new() { Timeout = TimeSpan.FromSeconds(10) };

        public override void Entry(IModHelper helper)
        {
            this.Config = helper.ReadConfig<ModConfig>();
            ItemGuides.Monitor = this.Monitor;
            try { this.guide = new EmbeddedGuide(this.Monitor); this.guide.Start(); AppDomain.CurrentDomain.ProcessExit += (_, _) => this.guide.Dispose(); this.Monitor.Log("Link do guia local: " + this.guide.Origin + "/", LogLevel.Info); }
            catch (Exception ex) { this.Monitor.Log("Não foi possível iniciar o guia local: " + ex.Message, LogLevel.Warn); this.guide = null; }
            helper.ConsoleCommands.Add("guia_abrir", "Abre o guia conectado no navegador padrão.", (_, _) => this.OpenGuide());
            helper.Events.GameLoop.GameLaunched += (_, _) => { if (!this.openedGuide) { this.OpenGuide(); this.openedGuide = true; } };
            this.Monitor.Log($"Guia integrado: {(this.guide != null ? "ativo" : "indisponível")}; intervalo: {Math.Clamp(this.Config.UploadIntervalSeconds, 1, 60)}s.", LogLevel.Info);
            helper.Events.GameLoop.SaveLoaded += (_, _) => { this.portrait=null; this.Monitor.Log("Jogador entrou na fazenda; iniciando atualizações do guia.", LogLevel.Info); this.ExportSnapshot(); };
            helper.Events.GameLoop.ReturnedToTitle += (_, _) => this.Monitor.Log("Jogador saiu da fazenda; atualizações pausadas.", LogLevel.Info);
            helper.Events.GameLoop.Saved += (_, _) => this.ExportSnapshot();
            helper.Events.GameLoop.OneSecondUpdateTicked += (_, e) => {
                if (this.guide != null && ++this.elapsedSeconds >= Math.Clamp(this.Config.UploadIntervalSeconds, 1, 60)) { this.elapsedSeconds = 0; this.ExportSnapshot(false); }
            };
        }

        private void ExportSnapshot(bool writeFile = true)
        {
            if (!Context.IsWorldReady || Game1.player == null)
                return;

            // Todas as leituras de Game1 acontecem na thread principal.
            var player = Game1.player;
            object? visuals=null;
            try { visuals=VisualSnapshot.Capture(); this.portrait ??=VisualSnapshot.Portrait(); } catch(Exception ex) { this.Monitor.Log("Falha ao coletar imagens/progresso: "+ex.Message, LogLevel.Warn); }
            var payload = new
            {
                schemaVersion = 1,
                visuals,
                portrait = this.portrait,
                exportedAt = DateTimeOffset.UtcNow.ToString("O"),
                modVersion = this.ModManifest.Version.ToString(),
                farm = new
                {
                    saveId = Game1.uniqueIDForThisGame.ToString(CultureInfo.InvariantCulture),
                    name = player.farmName.Value ?? "",
                    year = Game1.year,
                    season = Game1.currentSeason,
                    day = Game1.dayOfMonth,
                    time = Game1.timeOfDay,
                    isNight = Game1.isDarkOut(Game1.currentLocation)
                },
                player = new
                {
                    multiplayerId = player.UniqueMultiplayerID.ToString(CultureInfo.InvariantCulture),
                    steamId = this.GetSteamId(),
                    name = player.Name ?? "",
                    isMale = player.IsMale,
                    skills = new
                    {
                        farming = player.FarmingLevel,
                        fishing = player.FishingLevel,
                        foraging = player.ForagingLevel,
                        mining = player.MiningLevel,
                        combat = player.CombatLevel
                    }
                },
                // null significa ainda não coletado; nunca significa progresso zero.
                mastery = (object?)null,
                communityCenter = (object?)null
            };

            try
            {
                if (writeFile) this.Helper.Data.WriteJsonFile($"exports/{Game1.uniqueIDForThisGame}-{player.UniqueMultiplayerID}.json", payload);
                if (writeFile) this.Monitor.Log("Snapshot exportado na pasta exports do mod.", LogLevel.Info);
            }
            catch (Exception ex)
            {
                this.Monitor.Log($"Falha ao exportar snapshot: {ex.Message}", LogLevel.Warn);
            }

            try { this.guide?.Publish(JsonSerializer.Serialize(payload)); } catch (Exception ex) { this.Monitor.Log("Erro ao atualizar guia: " + ex.Message, LogLevel.Warn); }

        }

        private string? GetSteamId()
        {
            try
            {
                foreach (Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
                {
                    Type? type = assembly.GetType("Steamworks.SteamUser");
                    object? id = type?.GetMethod("GetSteamID", BindingFlags.Public | BindingFlags.Static)?.Invoke(null, null);
                    string? value = id?.ToString();
                    if (ulong.TryParse(value, out ulong number) && number > 0)
                        return value;
                }
            }
            catch (Exception ex)
            {
                this.Monitor.Log($"SteamID indisponível: {ex.GetType().Name}", LogLevel.Trace);
            }
            // UniqueMultiplayerID não é um SteamID.
            return null;
        }

        private async Task UploadAsync(string json)
        {
            if (!Uri.TryCreate(this.Config.ApiUrl, UriKind.Absolute, out Uri? uri) || (uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && (uri.Host == "127.0.0.1" || uri.Host == "localhost" || uri.Host == "[::1]"))))
            {
                this.Monitor.Log("Configure ApiUrl com HTTPS ou HTTP de loopback para habilitar o envio.", LogLevel.Warn);
                return;
            }
            if (Interlocked.Exchange(ref this.uploadInProgress, 1) == 1)
                return;
            try
            {
                using var content = new StringContent(json, Encoding.UTF8, "application/json");
                using var request = new HttpRequestMessage(HttpMethod.Post, uri) { Content = content };
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", this.Config.ApiToken);
                using HttpResponseMessage response = await Client.SendAsync(request).ConfigureAwait(false);
                this.Monitor.Log($"Envio de snapshot: API respondeu {(int)response.StatusCode}.", response.IsSuccessStatusCode ? LogLevel.Info : LogLevel.Warn);
            }
            catch (Exception ex)
            {
                this.Monitor.Log($"Envio indisponível ({ex.GetType().Name}); exportação local preservada.", LogLevel.Warn);
            }
            finally { Interlocked.Exchange(ref this.uploadInProgress, 0); }
        }
    }
}
