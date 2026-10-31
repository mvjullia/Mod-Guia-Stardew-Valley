using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

// Reads the installed game's resources. No game files are modified.
if (args.Length != 2) throw new ArgumentException("Uso: ExportGameUi <pasta do jogo> <pasta de saída>");
string game = Path.GetFullPath(args[0]), output = Path.GetFullPath(args[1]);
Directory.CreateDirectory(output);
string texturePath = Path.Combine(game, "Content/LooseSprites/Cursors.xnb");
byte[] xnb = File.ReadAllBytes(texturePath);
if (Encoding.ASCII.GetString(xnb, 0, 3) != "XNB" || (xnb[5] & 0x80) == 0) throw new InvalidDataException("Esperada textura XNB com compressão LZX.");
var framework = Assembly.LoadFrom(Path.Combine(game, "MonoGame.Framework.dll"));
var decoderType = framework.GetType("Microsoft.Xna.Framework.Content.LzxDecoder", true)!;
object decoder = Activator.CreateInstance(decoderType, new object[] { 16 })!;
var decompress = decoderType.GetMethod("Decompress")!;
using var source = new MemoryStream(xnb);
using var decoded = new MemoryStream();
source.Position = 14;
while (source.Position < source.Length && decoded.Length < BitConverter.ToInt32(xnb, 10))
{
    int high = source.ReadByte(), low = source.ReadByte(), frameSize = 0x8000;
    int blockSize = (high << 8) | low;
    if (high == 0xff)
    {
        frameSize = (low << 8) | source.ReadByte();
        blockSize = (source.ReadByte() << 8) | source.ReadByte();
    }
    if (blockSize <= 0 || frameSize <= 0) break;
    long next = source.Position + blockSize;
    if (next > source.Length) throw new InvalidDataException("Bloco LZX truncado.");
    int result = (int)decompress.Invoke(decoder, new object[] { source, blockSize, decoded, frameSize })!;
    if (result != 0) throw new InvalidDataException("Falha ao decodificar LZX.");
    source.Position = next;
}
decoded.Position = 0;
using var reader = new BinaryReader(decoded);
int readers = reader.Read7BitEncodedInt();
for (int i = 0; i < readers; i++) { reader.ReadString(); reader.ReadInt32(); }
if (reader.Read7BitEncodedInt() != 0 || reader.Read7BitEncodedInt() != 1 || reader.ReadInt32() != 0)
    throw new InvalidDataException("Esperada textura RGBA sem recursos compartilhados.");
int width = reader.ReadInt32(), height = reader.ReadInt32();
reader.ReadInt32(); // mip count
int size = reader.ReadInt32();
byte[] pixels = reader.ReadBytes(size);
if (size != width * height * 4 || pixels.Length != size) throw new InvalidDataException("Textura truncada.");
// The first 16x16 tile in LooseSprites/Cursors is the game's default arrow.
WritePng(Path.Combine(output, "game-cursor.png"), 32, 32, (x, y) => pixels.AsSpan(((y / 2) * width + x / 2) * 4, 4).ToArray());
// Retain a preview in obj for visual verification, outside the shipped assets.
string preview = Path.Combine(AppContext.BaseDirectory, "cursors-preview.png");
WritePng(preview, Math.Min(width, 256), 64, (x, y) => pixels.AsSpan((y * width + x) * 4, 4).ToArray());

string bankPath = Path.Combine(game, "Content/XACT/Wave Bank.xwb");
using var bank = new BinaryReader(File.OpenRead(bankPath));
if (bank.ReadUInt32() != 0x444e4257) throw new InvalidDataException("Assinatura XWB inválida.");
bank.ReadUInt32();
if (bank.ReadUInt32() != 44) throw new InvalidDataException("Versão XWB não suportada.");
var segments = Enumerable.Range(0, 5).Select(_ => (Offset: bank.ReadUInt32(), Length: bank.ReadUInt32())).ToArray();
bank.BaseStream.Position = segments[0].Offset;
uint flags = bank.ReadUInt32(), count = bank.ReadUInt32();
if ((flags & 0x20000) != 0) throw new InvalidDataException("Banco compacto não suportado.");
bank.BaseStream.Position = segments[0].Offset + 72;
uint entrySize = bank.ReadUInt32();
var cues = new[] { (Name: "smallSelect", Index: 20, File: "menu-hover.wav"), (Name: "select", Index: 148, File: "menu-select.wav"),
    (Name: "bigSelect", Index: 3, File: "menu-open.wav"), (Name: "bigDeSelect", Index: 2, File: "menu-close.wav") };
foreach (var cue in cues)
{
    if (cue.Index >= count || entrySize != 24) throw new InvalidDataException("Metadados XWB não suportados.");
    bank.BaseStream.Position = segments[1].Offset + cue.Index * entrySize;
    uint sampleCount = bank.ReadUInt32() >> 4, format = bank.ReadUInt32();
    uint offset = bank.ReadUInt32(), length = bank.ReadUInt32();
    int channels = (int)((format >> 2) & 7), rate = (int)((format >> 5) & 0x3ffff);
    int blockAlign = ((int)((format >> 23) & 0xff) + 22) * channels;
    if ((format & 3) != 2 || channels is < 1 or > 2) throw new InvalidDataException("Esperado áudio MS ADPCM mono/estéreo.");
    bank.BaseStream.Position = segments[4].Offset + offset;
    byte[] audio = bank.ReadBytes((int)length);
    byte[] pcm = DecodeAdpcm(audio, channels, blockAlign, sampleCount);
    using var wav = new BinaryWriter(File.Create(Path.Combine(output, cue.File)));
    wav.Write(Encoding.ASCII.GetBytes("RIFF")); wav.Write(36 + pcm.Length); wav.Write(Encoding.ASCII.GetBytes("WAVEfmt "));
    wav.Write(16); wav.Write((short)1); wav.Write((short)channels); wav.Write(rate);
    wav.Write(rate * channels * 2); wav.Write((short)(channels * 2)); wav.Write((short)16);
    wav.Write(Encoding.ASCII.GetBytes("data")); wav.Write(pcm.Length); wav.Write(pcm);
    Console.WriteLine($"{cue.File}: {cue.Name}, {rate} Hz, {sampleCount / (double)rate:F3} s");
}
var provenance = new {
    owner = "ConcernedApe — Stardew Valley", gameVersion = File.Exists(Path.Combine(game, "Stardew Valley.dll")) ? AssemblyName.GetAssemblyName(Path.Combine(game, "Stardew Valley.dll")).Version?.ToString() : null,
    cursor = new { source = "Content/LooseSprites/Cursors.xnb", tile = new[] { 0, 0, 16, 16 }, scale = 2, sha256 = Hash(texturePath) },
    audio = new { source = "Content/XACT/Wave Bank.xwb", sha256 = Hash(bankPath), cues = cues.Select(c => new { cue = c.Name, waveIndex = c.Index, file = c.File }) }
};
File.WriteAllText(Path.Combine(output, "game-ui-sources.json"), JsonSerializer.Serialize(provenance, new JsonSerializerOptions { WriteIndented = true }) + "\n");
Console.WriteLine("Prévia do atlas: " + preview);

static string Hash(string path) { using var file = File.OpenRead(path); return Convert.ToHexString(SHA256.HashData(file)).ToLowerInvariant(); }

static byte[] DecodeAdpcm(byte[] data, int channels, int blockAlign, uint frames)
{
    int[] adaptation = { 230, 230, 230, 230, 307, 409, 512, 614, 768, 614, 512, 409, 307, 230, 230, 230 };
    int[] coef1 = { 256, 512, 0, 192, 240, 460, 392 }, coef2 = { 0, -256, 0, 64, 0, -208, -232 };
    using var pcm = new MemoryStream();
    using var writer = new BinaryWriter(pcm);
    for (int start = 0; start < data.Length; start += blockAlign)
    {
        int end = Math.Min(start + blockAlign, data.Length), position = start;
        if (end - start < 7 * channels) throw new InvalidDataException("Bloco ADPCM truncado.");
        int[] predictor = new int[channels], delta = new int[channels], sample1 = new int[channels], sample2 = new int[channels];
        for (int c = 0; c < channels; c++) { predictor[c] = data[position++]; if (predictor[c] >= 7) throw new InvalidDataException("Preditor ADPCM inválido."); }
        foreach (var values in new[] { delta, sample1, sample2 })
            for (int c = 0; c < channels; c++) { values[c] = BitConverter.ToInt16(data, position); position += 2; }
        foreach (var values in new[] { sample2, sample1 }) for (int c = 0; c < channels; c++) writer.Write((short)values[c]);
        int channel = 0;
        while (position < end)
        {
            byte packed = data[position++];
            foreach (int nibble in new[] { packed >> 4, packed & 15 })
            {
                int p = predictor[channel];
                int sample = (sample1[channel] * coef1[p] + sample2[channel] * coef2[p]) / 256 + (nibble >= 8 ? nibble - 16 : nibble) * delta[channel];
                sample = Math.Clamp(sample, short.MinValue, short.MaxValue);
                sample2[channel] = sample1[channel]; sample1[channel] = sample;
                delta[channel] = Math.Max(16, adaptation[nibble] * delta[channel] / 256);
                writer.Write((short)sample); channel = (channel + 1) % channels;
            }
        }
    }
    int required = checked((int)frames * channels * 2);
    if (pcm.Length < required) throw new InvalidDataException("Amostras ADPCM insuficientes.");
    return pcm.ToArray().AsSpan(0, required).ToArray();
}

static void WritePng(string path, int width, int height, Func<int, int, byte[]> pixel)
{
    using var file = File.Create(path);
    file.Write(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
    byte[] header = new byte[13];
    System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(header, width);
    System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4), height);
    header[8] = 8; header[9] = 6;
    Chunk("IHDR", header);
    using var packed = new MemoryStream();
    using (var zlib = new ZLibStream(packed, CompressionLevel.Optimal, true))
        for (int y = 0; y < height; y++) { zlib.WriteByte(0); for (int x = 0; x < width; x++) zlib.Write(pixel(x, y)); }
    Chunk("IDAT", packed.ToArray()); Chunk("IEND", Array.Empty<byte>());
    void Chunk(string name, byte[] bytes)
    {
        byte[] length = new byte[4]; System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(length, bytes.Length); file.Write(length);
        byte[] type = Encoding.ASCII.GetBytes(name); file.Write(type); file.Write(bytes);
        uint crc = 0xffffffff;
        foreach (byte b in type.Concat(bytes)) { crc ^= b; for (int i = 0; i < 8; i++) crc = (crc >> 1) ^ ((crc & 1) == 1 ? 0xedb88320u : 0); }
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(length, crc ^ 0xffffffff); file.Write(length);
    }
}
