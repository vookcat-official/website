import { NextRequest } from "next/server";
import {
  addReplay,
  addUser,
  clearedSessionCookie,
  deleteReplay,
  deleteUser,
  getEasyDonate,
  getHome,
  getPublicData,
  listUsers,
  login,
  readSession,
  registerUser,
  resetPassword,
  revokeSession,
  saveUserProfile,
  saveSettings,
  sessionCookie,
  updateUserRole,
} from "@/lib/app-data";

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers)) },
  });
}

async function sessionFromRequest(request: NextRequest) {
  return readSession(request.cookies.get("sid")?.value);
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์";
  if (message === "SESSION_EXPIRED") {
    return json({ error: "SESSION_EXPIRED", message: "หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่" }, 401);
  }
  if (message === "ต้องเป็นแอดมินเท่านั้น") {
    return json({ error: "FORBIDDEN", message }, 403);
  }
  console.error("API request failed:", error);
  const safeMessage = message.startsWith("Missing required environment variable:")
    ? "เซิร์ฟเวอร์ยังตั้งค่าระบบไม่ครบ กรุณาแจ้งผู้ดูแล"
    : "ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง";
  return json({ error: "SERVER_ERROR", message: safeMessage }, 500);
}

export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action");
    switch (action) {
      case "public":
        return json(await getPublicData());
      case "home":
        return json(await getHome(await sessionFromRequest(request)));
      case "donate":
        return json(await getEasyDonate());
      case "users":
        return json(await listUsers(await sessionFromRequest(request)));
      case "replays": {
        const home = await getHome(await sessionFromRequest(request));
        return json(home.replays);
      }
      default:
        return json({ error: "NOT_FOUND", message: "ไม่พบ API ที่เรียกใช้" }, 404);
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "login") {
      const result = await login(body.username, body.password);
      if (!result.ok) return json(result);
      return json(
        { ok: true },
        200,
        { "Set-Cookie": sessionCookie(result.token) },
      );
    }
    if (action === "register") {
      return json(await registerUser(body));
    }
    if (action === "logout") {
      try {
        await revokeSession(request.cookies.get("sid")?.value);
      } catch (error) {
        const response = errorResponse(error);
        response.headers.set("Set-Cookie", clearedSessionCookie());
        return response;
      }
      return json({ ok: true }, 200, { "Set-Cookie": clearedSessionCookie() });
    }

    const session = await sessionFromRequest(request);
    switch (action) {
      case "addUser":
        return json(await addUser(session, body));
      case "deleteUser":
        return json(await deleteUser(session, body.username));
      case "resetPassword":
        return json(await resetPassword(session, body));
      case "updateUserRole":
        return json(await updateUserRole(session, body.username, body.role));
      case "saveSettings":
        return json(await saveSettings(session, body.settings));
      case "saveProfile":
        return json(await saveUserProfile(session, body.profile));
      case "addReplay":
        return json(await addReplay(session, body));
      case "deleteReplay":
        return json(await deleteReplay(session, body.id));
      default:
        return json({ error: "NOT_FOUND", message: "ไม่พบ API ที่เรียกใช้" }, 404);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
