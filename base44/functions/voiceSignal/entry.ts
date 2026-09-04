import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";
import {
  assertAllowedKeys,
  createSecurityLog,
  getClientIp,
  json,
  mustString,
  readJson,
  requireAuth,
} from "./_common.ts";

const TTL_MS = 45 * 1000;

function uniqueStrings(values: unknown[]) {
  return [...new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

async function requireOwnedCharacter(base44: any, user: any, characterId: string, partyId?: string) {
  const character = await base44.asServiceRole.entities.Character.get(characterId);
  if (!character) throw new Error("Character not found");
  if (character.created_by !== user.email) throw new Error("Character ownership mismatch");
  if (partyId && String(character.party_id || "") !== partyId) {
    throw new Error("Character is not in requested party");
  }
  return character;
}

async function getOrCreateRoom(base44: any, roomId: string, partyId: string) {
  const existing = await base44.asServiceRole.entities.VoiceRoomState.filter({ room_id: roomId }, "-updated_date", 1).catch(() => []);
  if (existing?.[0]) return existing[0];
  return base44.asServiceRole.entities.VoiceRoomState.create({
    room_id: roomId,
    party_id: partyId,
    members: [],
    region: "us-east",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

async function cleanupSignals(base44: any, roomId: string) {
  const now = Date.now();
  const rows = await base44.asServiceRole.entities.VoiceSignal.filter({ room_id: roomId }, "-created_date", 300).catch(() => []);
  for (const row of rows) {
    const expires = new Date(row.expires_at || 0).getTime();
    if (!Number.isFinite(expires) || expires < now) {
      await base44.asServiceRole.entities.VoiceSignal.delete(row.id).catch(() => {});
    }
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const ip = getClientIp(req);

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const user = await requireAuth(base44);
    const payload = await readJson(req) as Record<string, unknown>;
    assertAllowedKeys(payload, [
      "action_type",
      "party_id",
      "room_id",
      "character_id",
      "from_character_id",
      "to_character_id",
      "signal_type",
      "payload",
      "members",
      "region",
    ]);

    const actionType = mustString(payload.action_type, "action_type");
    const partyId = String(payload.party_id || "");
    const roomId = String(payload.room_id || (partyId ? `party:${partyId}` : ""));
    const characterId = String(payload.character_id || payload.from_character_id || "");

    if (!["join_room", "leave_room", "send_signal", "poll_signals"].includes(actionType)) {
      throw new Error("Invalid action_type");
    }

    if (!partyId) throw new Error("Invalid party_id");
    if (!characterId) throw new Error("Invalid character_id");

    await requireOwnedCharacter(base44, user, characterId, partyId);
    const room = await getOrCreateRoom(base44, roomId, partyId);
    await cleanupSignals(base44, roomId);

    if (actionType === "join_room") {
      const members = uniqueStrings([
        ...(Array.isArray(room.members) ? room.members : []),
        ...(Array.isArray(payload.members) ? payload.members : []),
        characterId,
      ]).slice(0, 6);

      const updated = await base44.asServiceRole.entities.VoiceRoomState.update(room.id, {
        members,
        region: String(payload.region || room.region || "us-east"),
        updated_at: new Date().toISOString(),
      });

      await createSecurityLog(base44, {
        action: "voice_join",
        actor_user_id: user.id,
        actor_email: user.email,
        ip,
        target_id: roomId,
      });

      return json({
        ok: true,
        room_id: roomId,
        room_state: updated,
        members,
      });
    }

    if (actionType === "leave_room") {
      const members = uniqueStrings((room.members || []).filter((m: string) => String(m) !== characterId));
      const updated = await base44.asServiceRole.entities.VoiceRoomState.update(room.id, {
        members,
        updated_at: new Date().toISOString(),
      });
      return json({ ok: true, room_id: roomId, room_state: updated, members });
    }

    if (actionType === "send_signal") {
      const toCharacterId = mustString(payload.to_character_id, "to_character_id");
      const signalType = mustString(payload.signal_type, "signal_type");
      if (!["offer", "answer", "ice", "sync"].includes(signalType)) throw new Error("Invalid signal_type");
      if (!room.members?.includes(toCharacterId)) throw new Error("Target is not in room");

      const signal = await base44.asServiceRole.entities.VoiceSignal.create({
        room_id: roomId,
        party_id: partyId,
        from_character_id: characterId,
        to_character_id: toCharacterId,
        signal_type: signalType,
        payload: String(payload.payload || ""),
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + TTL_MS).toISOString(),
      });
      return json({ ok: true, signal_id: signal.id });
    }

    if (actionType === "poll_signals") {
      const allSignals = await base44.asServiceRole.entities.VoiceSignal.filter({ room_id: roomId }, "-created_date", 120).catch(() => []);
      const now = Date.now();
      const signals = allSignals
        .filter((row: any) => {
          const expires = new Date(row.expires_at || 0).getTime();
          if (!Number.isFinite(expires) || expires < now) return false;
          return String(row.to_character_id || "") === characterId;
        })
        .slice(0, 40);

      return json({
        ok: true,
        room_id: roomId,
        members: room.members || [],
        signals,
      });
    }

    throw new Error("Unhandled action");
  } catch (error) {
    await createSecurityLog(base44, {
      action: "voice_signal_error",
      ip,
      reason: String((error as any)?.message || error),
    });
    return json({ ok: false, error: String((error as any)?.message || error) }, 400);
  }
});
