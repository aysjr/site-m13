import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";

export const config = { path: "/api/chat" };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const sha = (s) => createHash("sha256").update(String(s)).digest();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  const store = getStore("chat");
  const msgs = (await store.get("messages", { type: "json" })) || [];

  if (req.method === "GET") return json(msgs);
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const body = await req.json().catch(() => null);
  const secret = Netlify.env.get("ADMIN_PASSWORD");
  if (!body) return json({ error: "Requête invalide" }, 400);
  if (!secret) return json({ error: "ADMIN_PASSWORD n’est pas défini sur Netlify" }, 500);

  if (!timingSafeEqual(sha(body.password ?? ""), sha(secret))) {
    await sleep(800);
    return json({ error: "Mot de passe incorrect" }, 401);
  }

  if (body.action === "login") return json({ ok: true });

  if (body.action === "post") {
    const name = String(body.name ?? "").trim().slice(0, 20);
    const text = String(body.text ?? "").trim().slice(0, 300);
    if (!name || !text) return json({ error: "Pseudo et message requis" }, 400);
    const next = [...msgs, { id: randomUUID(), name, text, ts: Date.now() }].slice(-100);
    await store.setJSON("messages", next);
    return json(next);
  }

  if (body.action === "delete") {
    const next = msgs.filter((m) => m.id !== body.id);
    await store.setJSON("messages", next);
    return json(next);
  }

  return json({ error: "Action inconnue" }, 400);
};
