using System;
using System.Buffers.Binary;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;

namespace StardewRealtimeTelemetry;

internal sealed record AlbumPixels(int Width, int Height, byte[] Rgba);

/// <summary>Small bounded PNG codec for our own screenshots. No screenshot/image libraries are used.</summary>
internal static class AlbumPng
{
    private static readonly byte[] Signature = { 137, 80, 78, 71, 13, 10, 26, 10 };
    public static AlbumPixels Read(byte[] png)
    {
        if (png.Length < 33 || !png.AsSpan(0, 8).SequenceEqual(Signature)) throw new InvalidDataException("PNG inválido.");
        int width = 0, height = 0, channels = 0, color = 0; using var compressed = new MemoryStream();
        for (int offset = 8; offset + 12 <= png.Length;) {
            int size = BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(offset));
            if (size < 0 || size > png.Length - offset - 12) throw new InvalidDataException("Bloco PNG truncado.");
            string type = Encoding.ASCII.GetString(png, offset + 4, 4); var bytes = png.AsSpan(offset + 8, size);
            uint expected = BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(offset + 8 + size));
            if (Crc(png.AsSpan(offset + 4, size + 4)) != expected) throw new InvalidDataException("Integridade PNG inválida.");
            if (type == "IHDR") {
                if (size != 13) throw new InvalidDataException("Cabeçalho PNG inválido.");
                width = BinaryPrimitives.ReadInt32BigEndian(bytes); height = BinaryPrimitives.ReadInt32BigEndian(bytes[4..]); color = bytes[9];
                channels = color switch { 0 => 1, 2 => 3, 4 => 2, 6 => 4, _ => 0 };
                if (width <= 0 || height <= 0 || width > 4096 || height > 4096 || bytes[8] != 8 || channels == 0 || bytes[12] != 0)
                    throw new InvalidDataException("Formato de screenshot PNG não suportado.");
            } else if (type == "IDAT") { compressed.Write(bytes); }
            offset += size + 12; if (type == "IEND") break;
        }
        if (channels == 0) throw new InvalidDataException("PNG sem cabeçalho.");
        compressed.Position = 0; using var zlib = new ZLibStream(compressed, CompressionMode.Decompress);
        int rowSize = checked(width * channels); var previous = new byte[rowSize]; var row = new byte[rowSize]; var rgba = new byte[checked(width * height * 4)];
        for (int y = 0; y < height; y++) {
            int filter = zlib.ReadByte(); if (filter < 0 || filter > 4) throw new InvalidDataException("Filtro PNG inválido.");
            int read = 0; while (read < rowSize) { int count = zlib.Read(row, read, rowSize - read); if (count == 0) throw new InvalidDataException("Imagem PNG incompleta."); read += count; }
            for (int x = 0; x < rowSize; x++) {
                int left = x >= channels ? row[x - channels] : 0, up = previous[x], diagonal = x >= channels ? previous[x - channels] : 0;
                int predictor = filter switch { 1 => left, 2 => up, 3 => (left + up) / 2, 4 => Paeth(left, up, diagonal), _ => 0 };
                row[x] = unchecked((byte)(row[x] + predictor));
            }
            for (int x = 0; x < width; x++) {
                int src = x * channels, dst = (y * width + x) * 4;
                rgba[dst] = row[src]; rgba[dst + 1] = color is 0 or 4 ? row[src] : row[src + 1]; rgba[dst + 2] = color is 0 or 4 ? row[src] : row[src + 2];
                rgba[dst + 3] = color == 6 ? row[src + 3] : color == 4 ? row[src + 1] : (byte)255;
            }
            (row, previous) = (previous, row);
        }
        if (zlib.ReadByte() != -1) throw new InvalidDataException("Dados PNG excedem o tamanho declarado.");
        return new AlbumPixels(width, height, rgba);
    }
    public static byte[] Write(AlbumPixels image)
    {
        if (image.Width <= 0 || image.Height <= 0 || image.Rgba.Length != checked(image.Width * image.Height * 4)) throw new InvalidDataException("Dimensões inválidas.");
        using var output = new MemoryStream(); output.Write(Signature);
        var header = new byte[13]; BinaryPrimitives.WriteInt32BigEndian(header, image.Width); BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4), image.Height); header[8] = 8; header[9] = 6;
        Chunk(output, "IHDR", header); using var compressed = new MemoryStream();
        using (var zlib = new ZLibStream(compressed, CompressionLevel.Optimal, true)) for (int y = 0; y < image.Height; y++) { zlib.WriteByte(0); zlib.Write(image.Rgba, y * image.Width * 4, image.Width * 4); }
        Chunk(output, "IDAT", compressed.ToArray()); Chunk(output, "IEND", Array.Empty<byte>()); return output.ToArray();
    }
    private static int Paeth(int a, int b, int c) { int p = a + b - c, pa = Math.Abs(p - a), pb = Math.Abs(p - b), pc = Math.Abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
    private static uint Crc(ReadOnlySpan<byte> data) { uint crc = 0xffffffff; foreach (byte b in data) { crc ^= b; for (int i = 0; i < 8; i++) crc = (crc >> 1) ^ ((crc & 1) != 0 ? 0xedb88320u : 0); } return crc ^ 0xffffffff; }
    private static void Chunk(Stream stream, string type, byte[] bytes) { var size = new byte[4]; BinaryPrimitives.WriteInt32BigEndian(size, bytes.Length); stream.Write(size); byte[] data = Encoding.ASCII.GetBytes(type).Concat(bytes).ToArray(); stream.Write(data); BinaryPrimitives.WriteUInt32BigEndian(size, Crc(data)); stream.Write(size); }
}

internal static class AlbumHeartFrame
{
    public static byte[] Compose(byte[] first, byte[] second)
    {
        var left = AlbumPng.Read(first); var right = AlbumPng.Read(second);
        const int width = 1600, height = 900; var pixels = new byte[width * height * 4]; var image = new AlbumPixels(width, height, pixels);
        void Rect(int x, int y, int w, int h, byte r, byte g, byte b) {
            for (int yy = Math.Max(0, y); yy < Math.Min(height, y + h); yy++) for (int xx = Math.Max(0, x); xx < Math.Min(width, x + w); xx++) {
                int i = (yy * width + xx) * 4; pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
            }
        }
        void Heart(int x, int y, int scale) {
            string[] pattern = { "01100110", "11111111", "11111111", "01111110", "00111100", "00011000" };
            for (int row = 0; row < pattern.Length; row++) for (int col = 0; col < 8; col++) if (pattern[row][col] == '1') { Rect(x + col * scale + 3, y + row * scale + 3, scale, scale, 116, 54, 55); Rect(x + col * scale, y + row * scale, scale, scale, 206, 96, 111); }
        }
        Rect(0, 0, width, height, 112, 67, 37); Rect(12, 12, width - 24, height - 24, 179, 116, 65);
        Rect(27, 27, width - 54, height - 54, 255, 226, 179); Rect(43, 43, width - 86, height - 86, 255, 246, 222);
        for (int x = 70; x < width - 80; x += 108) { Heart(x, 58, 4); Heart(x, height - 85, 4); }
        Heart(750, 103, 12);
        void Photo(AlbumPixels source, int x) {
            Rect(x - 15, 221, 732, 444, 116, 74, 49); Rect(x - 9, 227, 720, 432, 225, 154, 133); Rect(x, 236, 702, 414, 248, 229, 196);
            int w = 690, h = Math.Max(1, source.Height * w / source.Width); if (h > 402) { h = 402; w = Math.Max(1, source.Width * h / source.Height); }
            int ox = x + (702 - w) / 2, oy = 236 + (414 - h) / 2;
            for (int y = 0; y < h; y++) for (int xx = 0; xx < w; xx++) {
                int src = ((y * source.Height / h) * source.Width + xx * source.Width / w) * 4, dst = ((oy + y) * width + ox + xx) * 4;
                pixels[dst] = source.Rgba[src]; pixels[dst + 1] = source.Rgba[src + 1]; pixels[dst + 2] = source.Rgba[src + 2]; pixels[dst + 3] = 255;
            }
            Heart(x - 23, 215, 6); Heart(x + 670, 215, 6); Heart(x - 23, 636, 6); Heart(x + 670, 636, 6);
        }
        Photo(left, 76); Photo(right, 822); Heart(752, 698, 12);
        return AlbumPng.Write(image);
    }
}
