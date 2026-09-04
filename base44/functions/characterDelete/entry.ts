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

const DELETE_CODE_TTL_MS = 10 * 60 * 1000;

function isArchivedCharacter(character: any) {
  if (!character) return true;
  if (character.is_deleted === true) return true;
  return String(character.status || "").toLowerCase() === "archived";
}

function generateDeleteCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getOwnedCharacterOrThrow(base44: any, user: any, characterId: string) {
  const character = await base44.asServiceRole.entities.Character.get(characterId);
  if (!character) throw new Error("Character not found");
  if (character.created_by !== user.email) throw new Error("Character ownership mismatch");
  if (isArchivedCharacter(character)) throw new Error("Character already archived");
  return character;
}

async function findValidDeleteCodeLog(base44: any, user: any, characterId: string) {
  const rows = await base44.asServiceRole.entities.SecurityLog
    .filter(
      {
        action: "character_delete_code_issued",
        actor_user_id: user.id,
        target_id: characterId,
      },
      "-created_date",
      10
    )
    .catch(() => []);

  const now = Date.now();
  return rows.find((row: any) => {
    const expires = new Date(row.expires_at || 0).getTime();
    if (!Number.isFinite(expires) || expires < now) return false;
    return String(row.delete_code || "").trim().length > 0;
  }) || null;
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
    assertAllowedKeys(payload, ["action", "character_id", "code"]);

    const action = mustString(payload.action, "action");
    const characterId = mustString(payload.character_id, "character_id");

    if (!["request_delete_code", "confirm_delete"].includes(action)) {
      throw new Error("Invalid action");
    }

    const character = await getOwnedCharacterOrThrow(base44, user, characterId);

    if (action === "request_delete_code") {
      const code = generateDeleteCode();
      const expiresAt = new Date(Date.now() + DELETE_CODE_TTL_MS).toISOString();

      await createSecurityLog(base44, {
        action: "character_delete_code_issued",
        actor_user_id: user.id,
        actor_email: user.email,
        ip,
        target_id: characterId,
        delete_code: code,
        expires_at: expiresAt,
      });

      return json({
        ok: true,
        action,
        character_id: characterId,
        code,
        expires_at: expiresAt,
      });
    }

    const submittedCode = mustString(payload.code, "code");
    const pendingCodeLog = await findValidDeleteCodeLog(base44, user, characterId);
    if (!pendingCodeLog) throw new Error("Delete code missing or expired");
    if (String(pendingCodeLog.delete_code || "") !== submittedCode) {
      throw new Error("Invalid delete code");
    }

    await base44.asServiceRole.entities.Character.update(character.id, {
      status: "archived",
      is_online: false,
    });

    const ownedCharacters = await base44.asServiceRole.entities.Character
      .filter({ created_by: user.email, type: "human" }, "-updated_date", 20)
      .catch(() => []);

    const remainingPlayable = ownedCharacters
      .filter((row: any) => row.id !== characterId)
      .filter((row: any) => !isArchivedCharacter(row));

    const suggestedActiveCharacterId = remainingPlayable[0]?.id || null;

    await createSecurityLog(base44, {
      action: "character_delete_confirmed",
      actor_user_id: user.id,
      actor_email: user.email,
      ip,
      target_id: characterId,
      code_log_id: pendingCodeLog.id,
      suggested_active_character_id: suggestedActiveCharacterId || "",
    });

    return json({
      ok: true,
      action,
      character_id: characterId,
      archived: true,
      suggested_active_character_id: suggestedActiveCharacterId,
    });
  } catch (error) {
    await createSecurityLog(base44, {
      action: "character_delete_error",
      ip,
      reason: String((error as any)?.message || error),
    });
    return json({ ok: false, error: String((error as any)?.message || error) }, 400);
  }
});
