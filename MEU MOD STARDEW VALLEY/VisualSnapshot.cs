using System;
using System.Linq;
using System.Collections.Generic;
using System.IO;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using StardewValley;

namespace StardewRealtimeTelemetry;
internal static class VisualSnapshot
{
    private static readonly Dictionary<string,string> images = new();
    private static string Png(Texture2D texture, Rectangle rect, string? key)
    {
        if(key!=null && images.TryGetValue(key,out var cached))return cached;
        var pixels=new Color[rect.Width*rect.Height];texture.GetData(0,rect,pixels,0,pixels.Length);
        using var copy=new Texture2D(Game1.graphics.GraphicsDevice,rect.Width,rect.Height);copy.SetData(pixels);
        using var stream=new MemoryStream();copy.SaveAsPng(stream,rect.Width,rect.Height);
        string result="data:image/png;base64,"+Convert.ToBase64String(stream.ToArray());
        if(key!=null)images[key]=result;
        return result;
    }
    private static object Item(string id, bool personal = false)
    {
        var data=ItemRegistry.GetDataOrErrorItem(id);
        var item=ItemRegistry.Create(id);
        return new {id,personal,quality=0,qualifiedId=item.QualifiedItemId,obtaining=ItemGuides.Get(item.QualifiedItemId),name=data.DisplayName,wikiName=data.InternalName,description=item.getDescription(),category=item.getCategoryName(),price=item is StardewValley.Object obj ? obj.salePrice() : 0,icon=Png(data.GetTexture(),data.GetSourceRect(),id)};
    }
    public static object Capture()
    {
        var bundles=new List<object>();
        foreach(var entry in Game1.netWorldState.Value.BundleData) {
            var fields=entry.Value.Split('/');if(fields.Length<3)continue;
            var parts=fields[2].Split(' ',StringSplitOptions.RemoveEmptyEntries);
            int bundleId=int.Parse(entry.Key.Split('/')[1]);
            var delivered=Game1.netWorldState.Value.Bundles[bundleId];
            var items=new List<object>();
            for(int i=0;i+2<parts.Length;i+=3) {
                bool isMoney=parts[i]=="-1" && entry.Key.StartsWith("Vault/",StringComparison.OrdinalIgnoreCase);
                object item=isMoney ? new {id="-1",name="Ouro",icon=""} : Item(parts[i]);
                items.Add(new {item,quantity=int.Parse(parts[i+1]),quality=isMoney?0:int.Parse(parts[i+2]),completed=i/3<delivered.Length && delivered[i/3],isMoney});
            }
            int requiredCount = fields.Length > 4 && int.TryParse(fields[4], out int required) && required > 0 ? required : items.Count;
            bundles.Add(new {id=bundleId,room=entry.Key.Split('/')[0],internalName=fields[0],name=fields.Length>6?fields[6]:fields[0],items,requiredCount,completed=delivered.Count(value=>value)>=requiredCount});
        }
        var tastes=Game1.content.Load<Dictionary<string,string>>("Data/NPCGiftTastes");
        var npcs=new List<object>();
        foreach(var entry in tastes) {
            if(entry.Key.StartsWith("Universal_"))continue;
            var npc=Game1.getCharacterFromName(entry.Key);if(npc==null)continue;
            var fields=entry.Value.Split('/');if(fields.Length<2)continue;
            string universal=tastes.TryGetValue("Universal_Love",out var universalLove)?universalLove:"";
            var loves=(fields[1]+" "+universal).Split(' ',StringSplitOptions.RemoveEmptyEntries).Where(id=>!id.StartsWith("-")).Distinct().Where(id=>npc.getGiftTasteForThisItem(ItemRegistry.Create(id))==0).Select(id=>Item(id,fields[1].Split(' ').Contains(id))).ToArray();
            npcs.Add(new {id=entry.Key,hearts=Game1.player.getFriendshipHeartLevelForNPC(npc.Name),maxHearts=Game1.player.spouse==npc.Name?14:10,name=npc.displayName,movesToFarm=npc.isMarried() || npc.isRoommate(),portrait=Png(npc.Portrait,new Rectangle(0,0,64,64),"npc:"+entry.Key),gifts=loves});
        }
        var pets = new List<StardewValley.Characters.Pet>();
        Utility.ForEachCharacter(character => { if (character is StardewValley.Characters.Pet pet && !pets.Contains(pet)) pets.Add(pet); return true; }, false);
        var petInfo = pets.Select(pet => new {name=pet.Name,icon=Png(pet.Sprite.Texture,pet.Sprite.SourceRect,"pet:"+pet.petId.Value+":"+pet.Sprite.CurrentFrame)}).ToArray();
        return new {bundles,npcs,pets=petInfo,pet=petInfo.FirstOrDefault(),ui=new {silver=Png(Game1.mouseCursors,new Rectangle(338,400,8,8),"silver"),gold=Png(Game1.mouseCursors,new Rectangle(346,400,8,8),"gold"),iridium=Png(Game1.mouseCursors,new Rectangle(346,392,8,8),"iridium"),heart=Png(Game1.mouseCursors,new Rectangle(211,428,7,6),"heart")},icons=new Dictionary<string,object>{{"home",Item("24")},{"center",Item("22")},{"gifts",Item("72")},{"fishing",Item("145")},{"foraging",Item("16")},{"farming",Item("24")},{"mining",Item("378")},{"combat",Item("768")},{"wiki",Item("102")}}};
    }
    private static string CapturePlayer(bool headOnly)
    {
        var graphics=Game1.graphics.GraphicsDevice;
        var previous=graphics.GetRenderTargets();
        using var target=new RenderTarget2D(graphics,96,160);using var batch=new SpriteBatch(graphics);
        try {graphics.SetRenderTarget(target);graphics.Clear(Color.Transparent);
            batch.Begin(samplerState:SamplerState.PointClamp);
            if(headOnly) Game1.player.FarmerRenderer.drawMiniPortrat(batch,new Vector2(16,24),0.5f,4f,2,Game1.player);
            else Game1.player.FarmerRenderer.draw(batch,Game1.player.FarmerSprite,Game1.player.FarmerSprite.SourceRect,new Vector2(16,24),Vector2.Zero,0.5f,Color.White,0f,Game1.player);
            batch.End();graphics.SetRenderTargets(previous);
            var pixels=new Color[96*160];target.GetData(pixels);int left=96,top=160,right=-1,bottom=-1;for(int y=0;y<160;y++)for(int x=0;x<96;x++)if(pixels[y*96+x].A>0){left=Math.Min(left,x);right=Math.Max(right,x);top=Math.Min(top,y);bottom=Math.Max(bottom,y);}if(right<left)throw new InvalidOperationException("Sprite do jogador vazio");
            return Png(target,new Rectangle(left,top,right-left+1,bottom-top+1),null);
        } finally {graphics.SetRenderTargets(previous);}
    }
    public static string Portrait() => CapturePlayer(false);
    public static string HeadPortrait() => CapturePlayer(true);
}
