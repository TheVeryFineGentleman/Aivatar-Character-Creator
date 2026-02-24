import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, X, User, Plus, Trash2 } from "lucide-react";
import type { Character, CharacterRelationship } from "@/types/storyboard";

const ROLE_PRESETS = ["Protagonist", "Antagonist", "Nebenfigur", "Erzähler", "Mentor", "Sidekick"];
const COLOR_PRESETS = ["#8B5CF6", "#EC4899", "#F97316", "#10B981", "#3B82F6", "#EF4444", "#F59E0B", "#06B6D4"];

interface CharacterEditorProps {
  character: Character | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (character: Character) => void;
  allCharacters: Character[];
}

export const CharacterEditor: React.FC<CharacterEditorProps> = ({
  character,
  open,
  onOpenChange,
  onSave,
  allCharacters,
}) => {
  const [form, setForm] = useState<Character>(character || {
    id: '', name: '', role: '', referenceImages: [], visualDescription: '',
    voice: '', speakingStyle: '', emotionalBaseline: '', doRules: '', dontRules: '',
    relationships: [], color: '#8B5CF6',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync form when character changes
  React.useEffect(() => {
    if (character) setForm(character);
  }, [character]);

  const update = <K extends keyof Character>(key: K, value: Character[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages = [...form.referenceImages];
    for (const file of Array.from(files)) {
      if (newImages.length >= 3) break;
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push(dataUrl);
    }
    update('referenceImages', newImages);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    update('referenceImages', form.referenceImages.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(form);
    onOpenChange(false);
  };

  const otherCharacters = allCharacters.filter(c => c.id !== form.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg border-border/50 bg-card p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <SheetTitle className="text-foreground">
            {character ? 'Charakter bearbeiten' : 'Neuer Charakter'}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-5 pb-6">

            {/* Reference Images */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Referenzbilder (max. 3)
              </Label>
              <div className="flex gap-2">
                {form.referenceImages.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border/50 group">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
                {form.referenceImages.length < 3 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border border-dashed border-border/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-[10px]">Upload</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="char-name">Name</Label>
              <Input
                id="char-name"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="z.B. Lena"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="char-role">Rolle</Label>
              <Input
                id="char-role"
                value={form.role}
                onChange={e => update('role', e.target.value)}
                placeholder="z.B. Protagonistin"
              />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ROLE_PRESETS.map(r => (
                  <button
                    key={r}
                    onClick={() => update('role', r)}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                      form.role === r
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/50 text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label>Farbe</Label>
              <div className="flex gap-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => update('color', c)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-transform",
                      form.color === c ? "border-foreground scale-125" : "border-transparent hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Visual Description */}
            <div className="space-y-1.5">
              <Label htmlFor="char-visual">Visuelle Beschreibung</Label>
              <Textarea
                id="char-visual"
                value={form.visualDescription}
                onChange={e => update('visualDescription', e.target.value)}
                placeholder="Große Frau, dunkle Haare, Brille, rote Jacke..."
                className="min-h-[80px] resize-y"
              />
            </div>

            {/* Voice & Speaking Style */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="char-voice">Stimme</Label>
                <Input
                  id="char-voice"
                  value={form.voice}
                  onChange={e => update('voice', e.target.value)}
                  placeholder="warm, tief, ruhig"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="char-style">Sprechstil</Label>
                <Input
                  id="char-style"
                  value={form.speakingStyle}
                  onChange={e => update('speakingStyle', e.target.value)}
                  placeholder="poetisch, direkt"
                />
              </div>
            </div>

            {/* Emotional Baseline */}
            <div className="space-y-1.5">
              <Label htmlFor="char-emotion">Emotionale Grundhaltung</Label>
              <Input
                id="char-emotion"
                value={form.emotionalBaseline}
                onChange={e => update('emotionalBaseline', e.target.value)}
                placeholder="melancholisch aber hoffnungsvoll"
              />
            </div>

            {/* Do/Don't Rules */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="char-do" className="text-green-400">Do-Regeln</Label>
                <Textarea
                  id="char-do"
                  value={form.doRules}
                  onChange={e => update('doRules', e.target.value)}
                  placeholder="Trägt immer Brille&#10;Rote Jacke"
                  className="min-h-[60px] resize-y"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="char-dont" className="text-destructive">Don't-Regeln</Label>
                <Textarea
                  id="char-dont"
                  value={form.dontRules}
                  onChange={e => update('dontRules', e.target.value)}
                  placeholder="Nie lächeln&#10;Nie rennen"
                  className="min-h-[60px] resize-y"
                />
              </div>
            </div>

            {/* Relationships */}
            {otherCharacters.length > 0 && (
              <div className="space-y-2">
                <Label>Beziehungen</Label>
                {form.relationships.map((rel, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={rel.characterId}
                      onChange={e => {
                        const updated = [...form.relationships];
                        updated[i] = { ...updated[i], characterId: e.target.value };
                        update('relationships', updated);
                      }}
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">Charakter...</option>
                      {otherCharacters.map(c => (
                        <option key={c.id} value={c.id}>{c.name || c.id}</option>
                      ))}
                    </select>
                    <Input
                      value={rel.type}
                      onChange={e => {
                        const updated = [...form.relationships];
                        updated[i] = { ...updated[i], type: e.target.value };
                        update('relationships', updated);
                      }}
                      placeholder="Freund, Rivale..."
                      className="flex-1 h-8 text-xs"
                    />
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => update('relationships', form.relationships.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost" size="sm" className="text-xs gap-1"
                  onClick={() => update('relationships', [...form.relationships, { characterId: '', type: '' }])}
                >
                  <Plus className="w-3 h-3" /> Beziehung hinzufügen
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/30 flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!form.name.trim()}>
            Speichern
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
