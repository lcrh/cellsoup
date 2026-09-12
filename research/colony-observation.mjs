import {
  snapshot,
  largestBody,
  movingBody,
  bodyMotion,
} from "../web/gpu/observe.js";

// Whole connected bodies only: never truncate a graph and pretend it is intact.
export function observeColonies(buffer, world, maxCells = 1024) {
  const s = snapshot(buffer, world);
  const choices = [
    { selection: "largest", body: largestBody(s) },
    { selection: "largest-moving", body: movingBody(s) },
  ];
  const result = [],
    seen = new Set();
  for (const { selection, body } of choices) {
    if (!body.length) continue;
    const key = body.reduce((a, b) => Math.min(a, b), Infinity);
    if (seen.has(key)) continue;
    seen.add(key);
    const speed = bodyMotion(s, body);
    if (body.length > maxCells) {
      result.push({
        selection,
        size: body.length,
        speed,
        omitted: "Whole body exceeds observation limit",
      });
      continue;
    }
    const members = new Set(body);
    const cells = body.map((slot) => {
      const k = slot * 52;
      const linkSlots = [...s.u.slice(k + 32, k + 36)].map((handle) =>
        handle &&
        members.has(handle - 1) &&
        [...s.u.slice((handle - 1) * 52 + 32, (handle - 1) * 52 + 36)].includes(
          slot + 1,
        )
          ? handle - 1
          : null,
      );
      return {
        slot,
        incarnation: s.u[k + 24],
        genomeSlot: s.u[k + 25],
        x: s.f[k],
        y: s.f[k + 1],
        vx: s.f[k + 2],
        vy: s.f[k + 3],
        heading: s.f[k + 5],
        energy: s.f[k + 4] / 4096,
        storage: s.f[k + 38] / 4096,
        temperature: s.f[k + 39],
        hue: s.f[k + 48],
        ageTicks: s.u[k + 28],
        generation: s.u[k + 29],
        parent: s.u[k + 30],
        pc: s.u[k + 26],
        sleep: s.u[k + 27],
        registers: [...s.f.slice(k + 8, k + 16)],
        signal: [...s.f.slice(k + 16, k + 20)],
        mail: [...s.f.slice(k + 20, k + 24)],
        // Slot positions matter to (bond cN), including empty holes.
        linkSlots,
        links: linkSlots.filter((other) => other !== null),
        anchors: [...s.f.slice(k + 44, k + 48)],
        rest: s.f[k + 36],
      };
    });
    result.push({ selection, size: body.length, speed, cells });
  }
  return result;
}
