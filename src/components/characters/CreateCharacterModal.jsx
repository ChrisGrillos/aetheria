import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ChevronLeft } from "lucide-react";
import { calculateDerivedStats } from "@/components/shared/charUtils";
import { getCharacterAbilities, BASE_CLASSES } from "@/components/shared/classDefinitions";
import { rollStatsForRace, getRace } from "@/components/shared/raceData";
import RaceSelector from "./RaceSelector";
import StatRoller from "./StatRoller";
import ClassFitPicker from "./ClassFitPicker";

const MAX_REROLLS = 5;

const AVATAR_COLORS = [
  "bg-red-900", "bg-blue-900", "bg-green-900",
  "bg-purple-900", "bg-orange-900", "bg-pink-900", "bg-cyan-900", "bg-gray-700"
];

const STEPS = [
  { id: "name",       label: "Name"       },
  { id: "race",       label: "Race"       },
  { id: "stats",      label: "Attributes" },
  { id: "class",      label: "Class"      },
  { id: "appearance", label: "Appearance" },
];

export default function CreateCharacterModal({ user, onCreated, onClose }) {
  const [step, setStep] = useState(0);
  const [name, setName]               = useState("");
  const [race, setRace]               = useState(null);
  const [rolledStats, setRolledStats] = useState(null);
  const [rerollsLeft, setRerollsLeft] = useState(MAX_REROLLS);
  const [acceptedStats, setAcceptedStats] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [saving, setSaving]           = useState(false);

  const stepId = STEPS[step]?.id;

  // ── Step navigation ──────────────────────────────────────────────────────
  const goNext = () => setStep(s => Math.min(STEPS.length - 1, s + 1));
  const goBack = () => setStep(s => Math.max(0, s - 1));

  // ── Race selection → init dice ────────────────────────────────────────────
  const handleSelectRace = (raceId) => {
    setRace(raceId);
    const initialRoll = rollStatsForRace(raceId);
    setRolledStats(initialRoll);
    setRerollsLeft(MAX_REROLLS);
    setAcceptedStats(null);
  };

  // ── Stat roller ──────────────────────────────────────────────────────────
  const handleReroll = (newStats) => {
    setRolledStats(newStats);
    setRerollsLeft(r => Math.max(0, r - 1));
  };

  const handleAcceptStats = (stats) => {
    setAcceptedStats(stats);
    goNext();
  };

  // ── Final create ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!name.trim() || !selectedClass || !acceptedStats) return;
    setSaving(true);

    const baseClassDef = BASE_CLASSES[selectedClass];
    const stats = acceptedStats;
    const maxHp = 100 + ((stats.constitution - 10) * 5);
    const raceData = getRace(race || "human");

    const charDraft = {
      stats, level: 1,
      skills: baseClassDef?.startingSkills || {},
      active_effects: [],
      base_class: selectedClass,
    };
    const derived = calculateDerivedStats(charDraft);
    const abilities = getCharacterAbilities(selectedClass, null, 1);

    await base44.entities.Character.create({
      name: name.trim(),
      type: "human",          // preserves human vs ai_agent technical flag
      race: race || "human",  // new optional race field
      class: selectedClass,
      base_class: selectedClass,
      avatar_color: avatarColor,
      avatar_emoji: raceData.emoji,
      x: Math.floor(Math.random() * 8) + 26,
      y: Math.floor(Math.random() * 6) + 20,
      level: 1, xp: 0, gold: 50,
      hp: maxHp, max_hp: maxHp,
      stats,
      skills: baseClassDef?.startingSkills || {},
      derived_stats: derived,
      abilities,
      active_effects: [],
      stat_points: 0,
      is_online: true,
      status: "idle",
    });

    setSaving(false);
    onCreated();
  };

  const raceData = race ? getRace(race) : null;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button onClick={goBack} className="text-gray-500 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-black text-amber-400">Create Your Character</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        {/* Step tracker */}
        <div className="flex px-6 py-3 gap-1.5 shrink-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5 flex-1">
              <div className={`w-full h-1.5 rounded-full transition-all ${
                i < step ? "bg-amber-500" : i === step ? "bg-amber-400" : "bg-gray-700"
              }`} />
            </div>
          ))}
        </div>
        <div className="px-6 pb-2 text-xs text-gray-500 shrink-0">
          Step {step + 1} of {STEPS.length} — <span className="text-amber-400">{STEPS[step].label}</span>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-3">

          {/* ── Step 0: Name ── */}
          {stepId === "name" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">What is your character's name?</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter name..."
                  className="bg-gray-800 border-gray-600 text-white text-lg py-3"
                  onKeyDown={e => e.key === "Enter" && name.trim() && goNext()}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* ── Step 1: Race ── */}
          {stepId === "race" && (
            <RaceSelector selected={race} onSelect={handleSelectRace} />
          )}

          {/* ── Step 2: Stats ── */}
          {stepId === "stats" && rolledStats && (
            <StatRoller
              raceId={race}
              initialStats={rolledStats}
              rerollsLeft={rerollsLeft}
              onReroll={handleReroll}
              onAccept={handleAcceptStats}
            />
          )}

          {/* ── Step 3: Class ── */}
          {stepId === "class" && acceptedStats && (
            <ClassFitPicker
              rolledStats={acceptedStats}
              selected={selectedClass}
              onSelect={setSelectedClass}
            />
          )}

          {/* ── Step 4: Appearance ── */}
          {stepId === "appearance" && (
            <div className="space-y-5">
              {/* Character preview */}
              <div className="text-center py-4 bg-gray-800 rounded-xl">
                <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl mb-3 ${avatarColor}`}>
                  {raceData?.emoji || "🧑"}
                </div>
                <div className="text-white font-bold text-lg">{name}</div>
                <div className="text-gray-400 text-sm mt-1">
                  {raceData?.name} {selectedClass && `· ${selectedClass.charAt(0).toUpperCase() + selectedClass.slice(1)}`}
                </div>
                <div className="text-xs text-gray-600 mt-1 italic">{raceData?.flavor}</div>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Avatar Background</label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} onClick={() => setAvatarColor(c)}
                      className={`w-9 h-9 rounded-full ${c} border-2 transition-all
                        ${avatarColor === c ? "border-amber-400 scale-125 ring-2 ring-amber-400/40" : "border-transparent hover:scale-110"}`} />
                  ))}
                </div>
              </div>

              {/* Final stat summary */}
              {acceptedStats && (
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-2">Accepted Attributes</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {Object.entries(acceptedStats).map(([stat, val]) => (
                      <div key={stat} className="flex justify-between bg-gray-900 rounded px-2 py-1">
                        <span className="text-gray-500 text-xs capitalize">{stat.slice(0, 3).toUpperCase()}</span>
                        <span className="text-amber-400 font-bold text-xs">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-gray-800 shrink-0">
          {stepId === "name" && (
            <Button onClick={goNext} disabled={!name.trim()}
              className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold">
              Continue →
            </Button>
          )}
          {stepId === "race" && (
            <Button onClick={goNext} disabled={!race}
              className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold">
              {race ? `Choose ${getRace(race).name} →` : "Select a Race →"}
            </Button>
          )}
          {/* Stats step: accept/reroll buttons are inside StatRoller */}
          {stepId === "class" && (
            <Button onClick={goNext} disabled={!selectedClass}
              className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold">
              {selectedClass ? `Choose Appearance →` : "Select a Class →"}
            </Button>
          )}
          {stepId === "appearance" && (
            <Button onClick={handleCreate} disabled={saving || !name.trim() || !selectedClass || !acceptedStats}
              className="w-full bg-green-700 hover:bg-green-600 text-white font-bold text-base py-3">
              {saving ? "Creating your character..." : "⚔️ Enter the World"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}