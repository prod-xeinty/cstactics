"use client";

import { useState, type FormEvent } from "react";
import { places, spawnZones } from "@/tactics/submission";
import styles from "./page.module.css";

type Role = { spawnZone: string; task: string; nades: string; fixed: boolean };
type Nade = { who: string; type: string; to: string; when: string; why: string };
const newRole = (): Role => ({ spawnZone: spawnZones[0], task: "", nades: "", fixed: false });
const newNade = (): Nade => ({ who: "", type: "smoke", to: places[0], when: "", why: "" });
const fileError = (file: File) => file.size > 10 * 1024 * 1024 ? "Видео больше 10 МБ. Сожми файл и попробуй снова." : !["video/mp4", "video/webm"].includes(file.type) ? "Нужно видео mp4 или webm." : null;

export function SubmitForm({ csrf }: { csrf: string }) {
  const [quick, setQuick] = useState(["", "", ""]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [nades, setNades] = useState<Nade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [video, setVideo] = useState<File | null>(null);
  const updateRole = (index: number, field: keyof Role, value: string | boolean) => setRoles((items) => items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const updateNade = (index: number, field: keyof Nade, value: string) => setNades((items) => items.map((item, i) => i === index ? { ...item, [field]: value } : item));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (video) { const problem = fileError(video); if (problem) { setError(problem); return; } }
    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? "").trim();
    const payload = {
      title: field("title"), side: field("side"), teamSize: Number(field("teamSize")), economy: field("economy"), difficulty: Number(field("difficulty")),
      gameVersion: field("gameVersion"), spawnDependent: form.has("spawnDependent"), call: field("call"),
      quick: quick.map((line) => line.trim()).filter(Boolean), roles: roles.map((role) => ({ ...role, task: role.task.trim(), nades: role.nades.trim() })),
      roleFallback: field("roleFallback"), nades: nades.map((nade) => ({ ...nade, who: nade.who.trim(), when: nade.when.trim(), why: nade.why.trim() })),
      flow: field("flow"), fallback: field("fallback"), postPlant: field("postPlant"), counters: field("counters"),
    };
    form.delete("video");
    form.set("payload", JSON.stringify(payload));
    if (video) form.set("video", video);
    setPending(true);
    try {
      const response = await fetch("/api/tactics", { method: "POST", headers: { "x-csrf-token": csrf }, body: form });
      const result: unknown = await response.json();
      if (!response.ok) { setError(result && typeof result === "object" && "error" in result ? String(result.error) : "Не вышло отправить. Попробуй ещё раз."); return; }
      setSent(true);
    } catch { setError("Связь пропала. Проверь интернет и попробуй ещё раз."); }
    finally { setPending(false); }
  }

  if (sent) return <div className={styles.success} role="status"><h2>Тактика ушла на проверку</h2><p>Прогоним раунд в игре. Если всё сходится, появится в каталоге с твоим ником.</p><a href="/tactics" className={styles.action}>Открыть каталог</a></div>;
  return <form className={styles.form} onSubmit={submit}>
    <section><h2>01 / Основное</h2><div className={styles.fields}>
      <label className={styles.wide}>Название*<input name="title" required maxLength={100} placeholder="Например: сплит A через лонг и кат" /></label>
      <label>Карта<select disabled defaultValue="dust2"><option value="dust2">Dust2</option></select></label>
      <label>Сторона<select name="side"><option value="T">T</option><option value="CT">CT</option></select></label>
      <label>Состав<select name="teamSize"><option value="2">Дуо</option><option value="3">Тройка</option><option value="4">Четверо</option><option value="5">Фулл стак</option></select></label>
      <label>Экономика<select name="economy"><option value="any">Любая</option><option value="eco">Эко</option><option value="force">Форс</option><option value="full">Фулл бай</option></select></label>
      <label>Сложность<select name="difficulty"><option value="1">1 / простая</option><option value="2">2 / средняя</option><option value="3">3 / сложная</option></select></label>
      <label>Версия игры*<input name="gameVersion" required maxLength={300} placeholder="Версия, на которой проверял" /></label>
      <label className={styles.check}><input type="checkbox" name="spawnDependent" /> Роли зависят от спавна</label>
      <label className={styles.wide}>Колл одной фразой*<input name="call" required maxLength={300} placeholder="Кто куда идёт и по какому сигналу выходим" /></label>
    </div></section>
    <section><h2>02 / Быстрая версия</h2><p>До четырёх строк. То, что реально успеешь сказать перед раундом.</p>{quick.map((line, i) => <label className={styles.line} key={i}>Строка {i + 1}<input value={line} maxLength={300} onChange={(event) => setQuick((items) => items.map((value, j) => j === i ? event.target.value : value))} /></label>)}{quick.length < 4 && <button type="button" className={styles.add} onClick={() => setQuick((items) => [...items, ""])}>+ Строка</button>}</section>
    <section><h2>03 / Роли по спавну</h2><p>Если роль требует конкретного человека, отметь её фиксированной.</p>{roles.map((role, i) => <div className={styles.row} key={i}><label>Зона<select value={role.spawnZone} onChange={(event) => updateRole(i, "spawnZone", event.target.value)}>{spawnZones.map((zone) => <option key={zone}>{zone}</option>)}</select></label><label>Задача<input value={role.task} maxLength={300} onChange={(event) => updateRole(i, "task", event.target.value)} /></label><label>Гранаты<input value={role.nades} maxLength={300} onChange={(event) => updateRole(i, "nades", event.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={role.fixed} onChange={(event) => updateRole(i, "fixed", event.target.checked)} /> Фиксированная</label><button type="button" className={styles.remove} onClick={() => setRoles((items) => items.filter((_, j) => j !== i))}>Убрать роль</button></div>)}{roles.length < 5 && <button type="button" className={styles.add} onClick={() => setRoles((items) => [...items, newRole()])}>+ Роль</button>}<label className={styles.line}>Если на нужном спавне никого<textarea name="roleFallback" maxLength={2000} rows={2} /></label></section>
    <section><h2>04 / Гранаты</h2><p>Что, куда, по какому триггеру и зачем. Без лайнапов.</p>{nades.map((nade, i) => <div className={styles.row} key={i}><label>Кто<input value={nade.who} maxLength={300} onChange={(event) => updateNade(i, "who", event.target.value)} /></label><label>Что<select value={nade.type} onChange={(event) => updateNade(i, "type", event.target.value)}><option value="smoke">Смок</option><option value="flash">Флешка</option><option value="molotov">Молик</option><option value="he">Хаешка</option><option value="decoy">Декой</option></select></label><label>Куда<select value={nade.to} onChange={(event) => updateNade(i, "to", event.target.value)}>{places.map((place) => <option key={place}>{place}</option>)}</select></label><label>Когда<input value={nade.when} maxLength={300} onChange={(event) => updateNade(i, "when", event.target.value)} /></label><label>Зачем<input value={nade.why} maxLength={300} onChange={(event) => updateNade(i, "why", event.target.value)} /></label><button type="button" className={styles.remove} onClick={() => setNades((items) => items.filter((_, j) => j !== i))}>Убрать гранату</button></div>)}{nades.length < 12 && <button type="button" className={styles.add} onClick={() => setNades((items) => [...items, newNade()])}>+ Граната</button>}</section>
    <section><h2>05 / Разбор</h2><div className={styles.fields}><label className={styles.wide}>Ход раунда<textarea name="flow" maxLength={2000} rows={3} /></label><label className={styles.wide}>Если пошло не так<textarea name="fallback" maxLength={2000} rows={3} /></label><label className={styles.wide}>Пост-плант<textarea name="postPlant" maxLength={2000} rows={3} /></label><label className={styles.wide}>Чем контрят<textarea name="counters" maxLength={2000} rows={3} /></label></div></section>
    <section><h2>06 / Видео</h2><p>Mp4 или webm до 10 МБ. Лучше 20–30 секунд в 720p — быстрее загрузится и проверится.</p><label>Видео<input type="file" name="video" accept="video/mp4,video/webm" onChange={(event) => { const file = event.target.files?.[0] ?? null; setVideo(file); setError(file ? fileError(file) : null); }} /></label></section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button type="submit" className={styles.submit} disabled={pending}>{pending ? "Отправляем…" : "Отправить на проверку"}</button>
  </form>;
}
