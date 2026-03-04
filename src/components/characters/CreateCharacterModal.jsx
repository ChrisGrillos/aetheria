/**
 * CreateCharacterModal — Asheron's Call-inspired flexible character creation.
 *
 * Flow:
 *   1. Name
 *   2. Race (shapes stat ranges + racial bonuses)
 *   3. Attributes — roll pool, then freely redistribute points within race ranges
 *   4. Skills — free skill point allocation (AC-style, not class-locked)
 *   5. Starting Focus — choose a broad archetype that gives a bonus but doesn't restrict
 *   6. Appearance
 */

import { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ChevronLeft, Plus, Minus, RefreshCw } from "lucide-react";
import { calculateDerivedStats } from "@/components/shared/charUtils";
import { getCharacterAbilities } from "@/components/shared/classDefinitions";
import { rollStatsForRace, getRace, RACE_LIST } from "@/components/shared/raceData";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MAX_REROLLS = 5;
const FREE_SKILL_POINTS = 30; // points to freely allocate across skills
const SKILL_MAX = 10;         // max starting skill level

const STAT_INFO = {
  strength:     { abbr: "STR", emoji: "💪", color: "text-red-400",    bg: "bg-red-900/20"    },
  dexterity:    { abbr: "DEX", emoji: "🏹", color: "text-green-400",  bg: "bg-green-900/20"  },
  intelligence: { abbr: "INT", emoji: "🧠", color: "text-blue-400",   bg: "bg-blue-900/20"   },
  wisdom:       { abbr: "WIS", emoji: "👁️", color: "text-purple-400", bg: "bg-purple-900/20" },
  constitution: { abbr: "CON", emoji: "🛡️", color: "text-orange-400", bg: "bg-orange-900/20" },
  charisma:     { abbr: "CHA", emoji: "✨", color: "text-pink-400",   bg: "bg-pink-900/20"   },
};
const STAT_ORDER = ["strength","dexterity","intelligence","wisdom","constitution","charisma"];

const SKILLS_DEF = [
  { id: "combat",              label: "Combat",              emoji: "⚔️",  primaryStat: "strength",     desc: "Melee & physical attacks" },
  { id: "diplomacy",           label: "Diplomacy",           emoji: "🤝",  primaryStat: "charisma",     desc: "Persuasion, trading favor" },
  { id: "resource_management", label: "Gathering",           emoji: "🌿",  primaryStat: "wisdom",       desc: "Harvesting & foraging" },
  { id: "research",            label: "Research",            emoji: "📚",  primaryStat: "intelligence", desc: "Lore & arcane knowledge" },
  { id: "healing",             label: "Healing",             emoji: "💚",  primaryStat: "wisdom",       desc: "Restore HP & cure ailments" },
  { id: "crafting",            label: "Crafting",            emoji: "🔨",  primaryStat: "dexterity",    desc: "Build & improve items" },
  { id: "trading",             label: "Trading",             emoji: "💰",  primaryStat: "charisma",     desc: "Buy low, sell high" },
  { id: "leadership",          label: "Leadership",          emoji: "👑",  primaryStat: "charisma",     desc: "Command allies & inspire" },
];

// Archetypes replace hard class-locking — they give a bonus package but don't restrict skills
const ARCHETYPES = [
  { id: "warrior",   emoji: "⚔️",  label: "Warrior",   desc: "Combat & Constitution focus. +5 combat, +3 CON", bonuses: { skills: { combat: 5 }, stats: { constitution: 3 } } },
  { id: "hunter",    emoji: "🏹",  label: "Hunter",    desc: "Swift & perceptive. +5 gathering, +3 DEX",       bonuses: { skills: { resource_management: 5 }, stats: { dexterity: 3 } } },
  { id: "wizard",    emoji: "🧙",  label: "Wizard",    desc: "Arcane scholar. +5 research, +3 INT",            bonuses: { skills: { research: 5 }, stats: { intelligence: 3 } } },
  { id: "healer",    emoji: "💚",  label: "Healer",    desc: "Compassionate doctor. +5 healing, +3 WIS",       bonuses: { skills: { healing: 5 }, stats: { wisdom: 3 } } },
  { id: "merchant",  emoji: "💰",  label: "Merchant",  desc: "Silver-tongued trader. +5 trading, +3 CHA",      bonuses: { skills: { trading: 5 }, stats: { charisma: 3 } } },
  { id: "craftsman", emoji: "🔨",  label: "Craftsman", desc: "Master builder. +5 crafting, +3 DEX",            bonuses: { skills: { crafting: 5 }, stats: { dexterity: 3 } } },
];

const AVATAR_COLORS = [
  "bg-red-900","bg-blue-900","bg-green-900",
  "bg-purple-900","bg-orange-900","bg-pink-900","bg-cyan-900","bg-gray-700",
];

const STEPS = [
  { id: "name",       label: "Name"       },
  { id: "race",       label: "Race"       },
  { id: "attributes", label: "Attributes" },
  { id: "skills",     label: "Skills"     },
  { id: "archetype",  label: "Archetype"  },
  { id: "appearance", label: "Appearance" },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function CreateCharacterModal({ user, onCreated, onClose }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [raceId, setRaceId] = useState(null);
  const [rolledStats, setRolledStats] = useState(null);
  const [rerollsLeft, setRerollsLeft] = useState(MAX_REROLLS);
  const [stats, setStats] = useState(null);           // user-adjusted stats
  const [statPool, setStatPool] = useState(0);        // unspent points from roll
  const [skills, setSkills] = useState({});           // user-allocated skills
  const [skillPointsLeft, setSkillPointsLeft] = useState(FREE_SKILL_POINTS);
  const [archetype, setArchetype] = useState(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [rolling, setRolling] = useState(false);

  const stepId = STEPS[step]?.id;
  const race = raceId ? getRace(raceId) : null;

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goNext = () => setStep(s => Math.min(STEPS.length - 1, s + 1));
  const goBack = () => setStep(s => Math.max(0, s - 1));

  // ── Race selection ──────────────────────────────────────────────────────────
  const handleSelectRace = (id) => {
    setRaceId(id);
    doRoll(id);
  };

  // ── Rolling ─────────────────────────────────────────────────────────────────
  const doRoll = (id = raceId) => {
    if (rolling) return;
    setRolling(true);
    let cycles = 0;
    const interval = setInterval(() => {
      setRolledStats(rollStatsForRace(id));
      cycles++;
      if (cycles >= 8) {
        clearInterval(interval);
        const final = rollStatsForRace(id);
        setRolledStats(final);
        setStats({ ...final });
        // pool = sum minus base 10*6 = bonus points available to redistribute
        const bonus = Object.values(final).reduce((s, v) => s + v, 0) - 60;
        setStatPool(Math.max(0, bonus));
        setRerollsLeft(r => Math.max(0, r - 1));
        setRolling(false);
      }
    }, 80);
  };

  // ── Stat tweaking ───────────────────────────────────────────────────────────
  const adjustStat = (stat, delta) => {
    if (!stats || !race) return;
    const { min, max } = race.statRanges[stat];
    const newVal = (stats[stat] || 10) + delta;
    if (newVal < min || newVal > max) return;
    if (delta > 0 && statPool <= 0) return;
    setStats(prev => ({ ...prev, [stat]: newVal }));
    setStatPool(p => p - delta);
  };

  // ── Skill allocation ────────────────────────────────────────────────────────
  const adjustSkill = (skillId, delta) => {
    const cur = skills[skillId] || 1;
    const newVal = cur + delta;
    if (newVal < 1 || newVal > SKILL_MAX) return;
    if (delta > 0 && skillPointsLeft <= 0) return;
    setSkills(prev => ({ ...prev, [skillId]: newVal }));
    setSkillPointsLeft(p => p - delta);
  };

  // ── Final create ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!name.trim() || !stats || !archetype) return;
    setSaving(true);

    const arch = ARCHETYPES.find(a => a.id === archetype);

    // Apply archetype stat bonuses on top of allocated stats
    const finalStats = { ...stats };
    if (arch?.bonuses?.stats) {
      for (const [s, v] of Object.entries(arch.bonuses.stats)) {
        finalStats[s] = (finalStats[s] || 10) + v;
      }
    }

    // Apply archetype skill bonuses
    const finalSkills = { ...SKILLS_DEF.reduce((o, s) => ({ ...o, [s.id]: skills[s.id] || 1 }), {}) };
    if (arch?.bonuses?.skills) {
      for (const [s, v] of Object.entries(arch.bonuses.skills)) {
        finalSkills[s] = Math.min(20, (finalSkills[s] || 1) + v);
      }
    }

    const maxHp = 100 + ((finalStats.constitution - 10) * 5);

    const charDraft = { stats: finalStats, level: 1, skills: finalSkills, active_effects: [], base_class: archetype };
    const derived = calculateDerivedStats(charDraft);
    const abilities = getCharacterAbilities(archetype, null, 1);

    await base44.entities.Character.create({
      name: name.trim(),
      type: "human",
      race: raceId || "human",
      class: archetype,
      base_class: archetype,
      avatar_color: avatarColor,
      avatar_emoji: race?.emoji || "🧑",
      x: Math.floor(Math.random() * 8) + 26,
      y: Math.floor(Math.random() * 6) + 20,
      level: 1, xp: 0, gold: 50,
      hp: maxHp, max_hp: maxHp,
      stats: finalStats,
      skills: finalSkills,
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

  const canNext = useMemo(() => {
    if (stepId === "name") return name.trim().length > 0;
    if (stepId === "race") return !!raceId;
    if (stepId === "attributes") return !!stats;
    if (stepId === "skills") return true;
    if (stepId === "archetype") return !!archetype;
    return true;
  }, [stepId, name, raceId, stats, archetype]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-3">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={goBack} className="text-gray-500 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-black text-amber-400">Create Your Character</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button>
        </div>

        {/* Progress bar */}
        <div className="flex px-5 pt-3 gap-1 shrink-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`flex-1 h-1 rounded-full transition-all ${
              i < step ? "bg-amber-500" : i === step ? "bg-amber-400" : "bg-gray-700"
            }`} />
          ))}
        </div>
        <div className="px-5 py-2 text-xs text-gray-500 shrink-0">
          {step + 1}/{STEPS.length} — <span className="text-amber-400">{STEPS[step].label}</span>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">

          {/* ── Name ── */}
          {stepId === "name" && (
            <div>
              <p className="text-sm text-gray-400 mb-3">What shall the world call you?</p>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter character name…"
                className="bg-gray-800 border-gray-600 text-white text-base py-3"
                onKeyDown={e => e.key === "Enter" && name.trim() && goNext()}
                autoFocus
              />
            </div>
          )}

          {/* ── Race ── */}
          {stepId === "race" && (
            <div className="grid grid-cols-2 gap-2.5">
              {RACE_LIST.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleSelectRace(r.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.01]
                    ${raceId === r.id ? `${r.borderClass} ${r.bgClass}` : "border-gray-700 bg-gray-800/50 hover:border-gray-600"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{r.emoji}</span>
                    <span className="font-bold text-white text-sm">{r.name}</span>
                    {raceId === r.id && <span className="ml-auto text-amber-400 text-xs">✓</span>}
                  </div>
                  <p className="text-xs text-gray-400 leading-snug mb-1.5 line-clamp-2">{r.description}</p>
                  <span className="text-xs text-gray-500">{r.traitEmoji} {r.racialTrait}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Attributes (free redistribution) ── */}
          {stepId === "attributes" && stats && race && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">Freely redistribute within your race's ranges. Unspent pool adds to total.</p>
                <button
                  onClick={() => doRoll()}
                  disabled={rerollsLeft <= 0 || rolling}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors
                    ${rerollsLeft > 0 ? "border-amber-700 text-amber-400 hover:bg-amber-900/30" : "border-gray-700 text-gray-600"}`}
                >
                  <RefreshCw className={`w-3 h-3 ${rolling ? "animate-spin" : ""}`} />
                  Reroll ({rerollsLeft})
                </button>
              </div>

              {/* Pool indicator */}
              <div className={`text-xs mb-3 px-3 py-1.5 rounded-lg text-center font-bold ${
                statPool > 0 ? "bg-amber-900/30 text-amber-400 border border-amber-800" : "bg-gray-800 text-gray-500"
              }`}>
                {statPool > 0 ? `${statPool} unspent points — redistribute freely` : "Pool spent — all points allocated"}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {STAT_ORDER.map(stat => {
                   const info = STAT_INFO[stat];
                   const val = stats[stat] || 10;
                   const { min, max } = race.statRanges[stat];
                  const pct = ((val - min) / Math.max(1, max - min)) * 100;
                  return (
                    <div key={stat} className={`${info.bg} rounded-xl p-3 border border-gray-700/40`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">{info.emoji} {info.abbr}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => adjustStat(stat, -1)}
                            className="w-5 h-5 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className={`text-lg font-black ${info.color} w-8 text-center ${rolling ? "animate-pulse" : ""}`}>{val}</span>
                          <button onClick={() => adjustStat(stat, 1)}
                            disabled={val >= max || statPool <= 0}
                            className="w-5 h-5 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-30">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${info.color.replace("text-","bg-")}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{min}–{max}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 text-center text-xs text-gray-600">
                Total: <span className="text-white font-bold">{Object.values(stats).reduce((s,v)=>s+v,0)}</span>
              </div>
            </div>
          )}

          {/* ── Skills (free allocation, AC-style) ── */}
          {stepId === "skills" && (
            <div>
              <div className={`text-xs px-3 py-1.5 rounded-lg text-center font-bold mb-3 ${
                skillPointsLeft > 0 ? "bg-blue-900/30 text-blue-400 border border-blue-800" : "bg-gray-800 text-gray-500"
              }`}>
                {skillPointsLeft > 0 ? `${skillPointsLeft} skill points remaining` : "All points allocated"}
              </div>
              <p className="text-xs text-gray-500 mb-3">Skills are not class-locked — invest in whatever suits your playstyle.</p>
              <div className="space-y-2">
                {SKILLS_DEF.map(sk => {
                  const val = skills[sk.id] || 1;
                  return (
                    <div key={sk.id} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2.5">
                      <span className="text-lg w-7 text-center">{sk.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">{sk.label}</span>
                          <span className="text-xs text-gray-500 capitalize">{sk.primaryStat.slice(0,3).toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{sk.desc}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => adjustSkill(sk.id, -1)} disabled={val <= 1}
                          className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 disabled:opacity-30 transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-bold text-amber-400 text-sm">{val}</span>
                        <button onClick={() => adjustSkill(sk.id, 1)} disabled={val >= SKILL_MAX || skillPointsLeft <= 0}
                          className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 disabled:opacity-30 transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Archetype (bonus package, not a lock) ── */}
          {stepId === "archetype" && (
            <div>
              <p className="text-xs text-gray-400 mb-3">
                Choose a starting archetype for a bonus package. This does <strong className="text-white">not</strong> lock your skills — any character can learn anything.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ARCHETYPES.map(a => (
                  <button key={a.id} onClick={() => setArchetype(a.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.01]
                      ${archetype === a.id ? "border-amber-500 bg-amber-900/25" : "border-gray-700 bg-gray-800/50 hover:border-gray-600"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{a.emoji}</span>
                      <span className="font-bold text-white text-sm">{a.label}</span>
                      {archetype === a.id && <span className="ml-auto text-amber-400 text-xs">✓</span>}
                    </div>
                    <p className="text-xs text-gray-400 leading-snug">{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Appearance ── */}
          {stepId === "appearance" && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="text-center py-4 bg-gray-800 rounded-xl">
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl mb-2 ${avatarColor}`}>
                  {race?.emoji || "🧑"}
                </div>
                <div className="font-bold text-white text-base">{name}</div>
                <div className="text-gray-400 text-xs mt-0.5">
                  {race?.name} · {ARCHETYPES.find(a => a.id === archetype)?.label || archetype}
                </div>
                <div className="text-gray-600 text-xs mt-0.5 italic">{race?.flavor}</div>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Avatar Color</label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} onClick={() => setAvatarColor(c)}
                      className={`w-8 h-8 rounded-full ${c} border-2 transition-all
                        ${avatarColor === c ? "border-amber-400 scale-125" : "border-transparent hover:scale-110"}`} />
                  ))}
                </div>
              </div>

              {/* Summary */}
              {stats && (
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-2">Final Attributes</div>
                  <div className="grid grid-cols-3 gap-1">
                    {STAT_ORDER.map(s => (
                      <div key={s} className="flex justify-between bg-gray-900 rounded px-2 py-1">
                        <span className="text-gray-500 text-xs">{STAT_INFO[s].abbr}</span>
                        <span className="text-amber-400 font-bold text-xs">{stats[s]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 shrink-0">
          {stepId !== "appearance" ? (
            <Button onClick={goNext} disabled={!canNext}
              className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold">
              Continue →
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={saving || !name.trim() || !stats || !archetype}
              className="w-full bg-green-700 hover:bg-green-600 text-white font-bold text-base py-3">
              {saving ? "Creating your character…" : "⚔️ Enter the World"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}