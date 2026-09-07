import { shortestDelta } from "./camera.js";
import { assemble, disassemble, OPS } from "./language.js";
import { PRESETS } from "./presets.js";
import { Renderer } from "./renderer.js";
const $ = (id) => document.getElementById(id);
let renderer,
  worker,
  ready = false,
  paused = false,
  tool = "inspect",
  frame,
  lastTick = -1,
  history = [],
  currentGenome = "",
  noticeTimer,
  selectedId = 0,
  following = false,
  focusPending = false;
function notice(text, error = false) {
  $("notice").textContent = text;
  $("notice").style.background = error ? "#612e27" : "#25483a";
  $("notice").hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(
    () => ($("notice").hidden = true),
    error ? 12000 : 3500,
  );
}
function send(data) {
  if (ready) worker.postMessage(data);
}
function setFollowing(value) {
  following = value;
  $("follow-body").setAttribute("aria-pressed", String(value));
  $("follow-body").classList.toggle("active", value);
  $("follow-body").textContent = value ? "Stop following" : "Follow organism";
  $("tracking").hidden = !value;
}
$("focus-body").onclick = () => {
  if (!frame?.detail) return;
  renderer.focusBody(frame.detail);
  setFollowing(true);
  renderer.draw(frame);
  $("world").scrollIntoView({ behavior: "smooth", block: "center" });
};
$("follow-body").onclick = () => {
  if (!frame?.detail) return;
  setFollowing(!following);
  if (following) renderer.trackBody(frame.detail);
  renderer.draw(frame);
};
function validate() {
  try {
    const p = assemble($("source").value);
    $("compile-status").textContent = `${p.length} instructions · valid genome`;
    $("compile-status").className = "";
    return true;
  } catch (e) {
    $("compile-status").textContent = e.message;
    $("compile-status").className = "error";
    return false;
  }
}
for (const [key, p] of Object.entries(PRESETS)) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = p.name;
  $("preset").append(option);
}
function preset() {
  const p = PRESETS[$("preset").value];
  $("source").value = p.source;
  $("preset-description").textContent = p.description;
  validate();
}
$("preset").onchange = preset;
preset();
$("source").addEventListener("input", validate);
$("source").onkeydown = (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const s = e.target.selectionStart,
      t = e.target.selectionEnd;
    e.target.setRangeText("  ", s, t, "end");
    validate();
  }
};
for (const [name, args, help] of OPS) {
  const div = document.createElement("div");
  div.className = "instruction";
  const code = document.createElement("code");
  code.textContent = `${name} ${args}`;
  const p = document.createElement("p");
  p.textContent = help;
  div.append(code, p);
  $("instructions").append(div);
}
function panel(name) {
  for (const b of document.querySelectorAll("[data-panel]")) {
    const active = b.dataset.panel === name;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
    b.tabIndex = active ? 0 : -1;
    $(`panel-${b.dataset.panel}`).hidden = !active;
  }
}
for (const b of document.querySelectorAll("[data-panel]")) {
  b.onclick = () => panel(b.dataset.panel);
  b.onkeydown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const tabs = [...document.querySelectorAll("[data-panel]")],
        i = tabs.indexOf(b),
        next =
          tabs[
            (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length
          ];
      panel(next.dataset.panel);
      next.focus();
    }
  };
}
function togglePause() {
  if (!ready) return;
  paused = !paused;
  send({ type: "pause", value: paused });
  $("pause").textContent = paused ? "Resume" : "Pause";
  $("run-state").textContent = paused ? "Paused" : "Living";
  $("live-dot").style.background = paused ? "#8b9d9c" : "#a5f2c8";
  $("step").disabled = !paused;
}
$("pause").onclick = togglePause;
$("step").onclick = () => send({ type: "step" });
$("speed").onchange = () =>
  send({ type: "speed", value: Number($("speed").value) });
$("reset").onclick = () => {
  if ($("scenario").value === "editor" && !validate()) return;
  history = [];
  lastTick = -1;
  selectedId = 0;
  renderer.selected = 0;
  setFollowing(false);
  focusPending = false;
  send({
    type: "reset",
    source: $("source").value,
    seed: Number($("random-seed").value) || 42,
    ecosystem: $("scenario").value === "ecosystem",
  });
  notice("Dish reset.");
};
$("seed").onclick = () => {
  if (validate())
    send({ type: "seed", source: $("source").value, x: 800, y: 500, n: 32 });
};
function settings() {
  send({
    type: "config",
    settings: {
      steps: Number($("budget").value),
      cap: Number($("cap").value),
      mutation: Number($("mutation").value) / 100,
      food: Number($("rain").value),
    },
  });
  $("budget-value").textContent = $("budget").value;
  $("rain-value").textContent = `${$("rain").value}×`;
  $("mutation-value").textContent = `${$("mutation").value}%`;
}
for (const id of ["budget", "cap", "mutation", "rain"])
  $(id).oninput = settings;
$("color-mode").onchange = () => {
  renderer.mode = Number($("color-mode").value);
  if (frame) renderer.draw(frame);
};
for (const [id, prop] of [
  ["show-food", "showFood"],
  ["show-bonds", "showBonds"],
])
  $(id).onchange = () => {
    renderer[prop] = $(id).checked;
    if (frame) renderer.draw(frame);
  };
$("fit").onclick = () => {
  setFollowing(false);
  renderer.center = [800, 500];
  renderer.zoom = 1;
  renderer.resize();
  if (frame) renderer.draw(frame);
};
for (const b of document.querySelectorAll("[data-tool]"))
  b.onclick = () => {
    tool = b.dataset.tool;
    for (const el of document.querySelectorAll("[data-tool]")) {
      el.classList.toggle("active", el === b);
      el.setAttribute("aria-pressed", String(el === b));
    }
    $("canvas-hint").textContent = {
      inspect: "Click a cell to inspect · scroll to zoom · drag to pan",
      food: "Click or drag to add nutrient blobs",
      seed: "Click to seed 32 cells from the editor",
      pan: "Drag to pan · scroll to zoom",
    }[tool];
  };
$("download").onclick = () => {
  if (!validate()) return;
  const url = URL.createObjectURL(
    new Blob([$("source").value], { type: "text/plain" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "genome.cell";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("import").onclick = () => $("file").click();
$("file").onchange = async () => {
  const file = $("file").files[0];
  if (!file) return;
  if (file.size > 100000) {
    notice("Genome file is too large (100 KB maximum).", true);
    return;
  }
  $("source").value = await file.text();
  $("preset-description").textContent = `Imported ${file.name}`;
  validate();
  $("file").value = "";
};
$("copy-genome").onclick = () => {
  if (!currentGenome) return;
  $("source").value = currentGenome;
  $("preset-description").textContent =
    "Loaded from the selected cell, including its inherited mutations.";
  validate();
  panel("genome");
};
document.addEventListener("keydown", (e) => {
  if (["TEXTAREA", "INPUT", "SELECT", "BUTTON"].includes(e.target.tagName))
    return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePause();
  }
});
function inspect(detail, genome) {
  if (!detail) {
    if (following) setFollowing(false);
    $("cell-detail").hidden = true;
    $("cell-title").textContent = selectedId
      ? "Cell no longer alive"
      : "Select a cell";
    $("inspect-hint").hidden = false;
    $("inspect-hint").textContent = selectedId
      ? "This cell died. Choose another cell to follow its program."
      : "Click a cell in the dish to see its energy, registers, ancestry, and executing instruction.";
    return;
  }
  $("cell-detail").hidden = false;
  $("inspect-hint").hidden = true;
  $("cell-title").textContent = `Cell ${detail[0]}`;
  $("organism-summary").textContent =
    `Connected body: ${detail[24]} ${detail[24] === 1 ? "cell" : "cells"} · ${detail[25].toFixed(1)} total energy`;
  $("tracking").textContent =
    `Following #${detail[0]} · ${detail[24]} connected ${detail[24] === 1 ? "cell" : "cells"}`;
  const entries = [
    ["Energy", detail[1].toFixed(2)],
    ["Age", `${detail[3].toFixed(1)} s`],
    ["Generation", detail[4]],
    ["Bonds", detail[5]],
    ["Public tag", detail[6]],
    ["Shield", `${Math.round(detail[7] * 100)}%`],
    ["Parent", detail[9] || "seed"],
    ["Variant", `#${detail[18]}`],
    ["Parent variant", detail[19] ? `#${detail[19]}` : "founder"],
    ["Founder", `#${detail[20]}`],
    ["Mutation depth", detail[21]],
    ["Variant births", detail[23]],
  ];
  $("cell-stats").replaceChildren();
  for (const [k, v] of entries) {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    $("cell-stats").append(dt, dd);
  }
  $("registers").replaceChildren();
  for (let k = 0; k < 8; k++) {
    const div = document.createElement("div"),
      label = document.createElement("span");
    label.textContent = `r${k}`;
    div.append(
      label,
      document.createTextNode(Number(detail[10 + k].toFixed(3))),
    );
    $("registers").append(div);
  }
  currentGenome = disassemble(genome);
  $("cell-code").replaceChildren();
  currentGenome.split("\n").forEach((line, i) => {
    const row = document.createElement("div");
    row.textContent = line;
    if (i === detail[2]) row.className = "current";
    $("cell-code").append(row);
  });
}
let lastLineageUpdate = 0;
const lineageRows = new Map();
function evolution(m) {
  $("evo-variants").textContent = m.stats[7];
  $("evo-mutations").textContent = m.stats[8].toLocaleString();
  $("evo-generation").textContent = m.stats[9];
  $("evo-depth").textContent = m.stats[10];
  $("evo-mode").textContent =
    Number($("mutation").value) > 0 ? "Mutation on" : "Mutation off";
  $("mutation-mix").textContent =
    `${m.stats[12]} operand · ${m.stats[13]} replaced · ${m.stats[14]} inserted · ${m.stats[15]} deleted`;
  if (!paused && performance.now() - lastLineageUpdate < 700) return;
  lastLineageUpdate = performance.now();
  const present = new Set();
  for (let k = 0; k < m.lineages.length; k += 12) {
    const row = m.lineages.slice(k, k + 12),
      button = lineageRows.get(row[0]) ?? document.createElement("button");
    present.add(row[0]);
    lineageRows.set(row[0], button);
    button.replaceChildren();
    button.className = "lineage-row";
    const title = document.createElement("div");
    title.className = "lineage-title";
    const dot = document.createElement("i");
    dot.style.background = `hsl(${row[11] * 360} 60% 65%)`;
    const name = document.createElement("strong");
    name.textContent = `Variant #${row[0]}`;
    const count = document.createElement("span");
    count.textContent = `${row[3]} cells`;
    title.append(dot, name, count);
    const meta = document.createElement("div");
    meta.className = "small";
    meta.textContent = `${row[4]} births · ${row[7]} instructions · ${row[6]} mutations deep`;
    const track = document.createElement("div");
    track.className = "lineage-track";
    const bar = document.createElement("i");
    bar.style.width = `${(row[3] / Math.max(1, m.stats[0])) * 100}%`;
    bar.style.background = dot.style.background;
    track.append(bar);
    button.append(title, meta, track);
    button.onclick = () => {
      selectedId = row[9];
      renderer.selected = row[9];
      focusPending = true;
      setFollowing(true);
      send({ type: "inspect", id: row[9] });
      panel("inspector");
    };
    $("lineages").append(button);
  }
  for (const [id, button] of lineageRows)
    if (!present.has(id)) {
      button.remove();
      lineageRows.delete(id);
    }
}
function graph() {
  const c = $("history"),
    r = c.getBoundingClientRect(),
    d = devicePixelRatio || 1;
  if (
    c.width !== Math.round(r.width * d) ||
    c.height !== Math.round(r.height * d)
  ) {
    c.width = Math.round(r.width * d);
    c.height = Math.round(r.height * d);
  }
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  if (history.length < 2) return;
  const max = Math.max(100, ...history.map((p) => p[1])) * 1.15;
  const start = history[0][0],
    end = history.at(-1)[0];
  ctx.beginPath();
  history.forEach(([t, n], i) => {
    const x = ((t - start) / Math.max(1, end - start)) * c.width,
      y = c.height - 6 * d - (n / max) * (c.height - 10 * d);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = "#79c7a6";
  ctx.lineWidth = 1.5 * d;
  ctx.stroke();
  ctx.lineTo(c.width, c.height);
  ctx.lineTo(0, c.height);
  ctx.closePath();
  ctx.fillStyle = "#76cba511";
  ctx.fill();
}
try {
  renderer = new Renderer($("world"));
  worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  worker.onerror = (e) => {
    notice(e.message || "Simulation worker failed.", true);
    $("run-state").textContent = "Engine error";
  };
  worker.onmessage = ({ data: m }) => {
    if (m.type === "ready") {
      ready = true;
      $("pause").disabled = false;
      $("reset").disabled = false;
      $("seed").disabled = false;
      $("run-state").textContent = "Living";
      settings();
      return;
    }
    if (m.type === "notice" || m.type === "error") {
      notice(m.text, m.type === "error");
      if (!ready) $("run-state").textContent = "Unable to start";
      return;
    }
    if (m.type === "frame") {
      frame = m;
      if (m.detail?.[0] === selectedId) {
        if (focusPending) {
          renderer.focusBody(m.detail);
          focusPending = false;
        } else if (following) renderer.trackBody(m.detail);
      }
      renderer.draw(m);
      $("population").textContent = m.stats[0].toLocaleString();
      $("bonds").textContent = m.stats[4].toLocaleString();
      $("energy").textContent = m.stats[5].toFixed(1);
      $("time").textContent = `${(m.stats[1] / 60).toFixed(paused ? 2 : 1)}s`;
      $("events").textContent =
        `${m.stats[2].toLocaleString()} births · ${m.stats[3].toLocaleString()} deaths`;
      $("performance").textContent =
        `${m.ms.toFixed(2)} ms / tick · ${m.stats[7]} genomes · WASM`;
      $("empty").hidden = m.stats[0] > 0;
      if (m.selection === selectedId) inspect(m.detail, m.genome);
      evolution(m);
      if (m.stats[1] - lastTick >= 30 || lastTick < 0) {
        history.push([m.stats[1], m.stats[0]]);
        if (history.length > 300) history.shift();
        lastTick = m.stats[1];
        graph();
      }
      worker.postMessage({ type: "ack" });
    }
  };
  const canvas = $("world");
  let pointer = null,
    lastFood = 0;
  canvas.addEventListener("pointerdown", (e) => {
    if (!ready) return;
    const r = canvas.getBoundingClientRect();
    pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    canvas.setPointerCapture(e.pointerId);
    if (tool === "food") {
      const [x, y] = renderer.world(e.clientX - r.left, e.clientY - r.top);
      send({ type: "food", x, y });
      lastFood = performance.now();
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x,
      dy = e.clientY - pointer.y;
    pointer.moved ||=
      Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 4;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (tool === "pan" || (tool === "inspect" && pointer.moved)) {
      setFollowing(false);
      renderer.center[0] -= dx / renderer.scale;
      renderer.center[1] -= dy / renderer.scale;
      if (frame) renderer.draw(frame);
    }
    if (tool === "food" && performance.now() - lastFood > 90) {
      const r = canvas.getBoundingClientRect(),
        [x, y] = renderer.world(e.clientX - r.left, e.clientY - r.top);
      send({ type: "food", x, y });
      lastFood = performance.now();
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const r = canvas.getBoundingClientRect(),
      [x, y] = renderer.world(e.clientX - r.left, e.clientY - r.top);
    if (!pointer.moved) {
      if (tool === "seed" && validate())
        send({ type: "seed", x, y, source: $("source").value, n: 32 });
      if (tool === "inspect" && frame) {
        let best = Math.max(10, 12 / renderer.scale) ** 2,
          id = 0;
        for (let k = 0; k < frame.cells.length; k += 8) {
          const d =
            shortestDelta(frame.cells[k] - x, 1600) ** 2 +
            shortestDelta(frame.cells[k + 1] - y, 1000) ** 2;
          if (d < best) {
            best = d;
            id = frame.cells[k + 4];
          }
        }
        selectedId = id;
        renderer.selected = id;
        send({ type: "inspect", id });
        if (id) panel("inspector");
      }
    }
    pointer = null;
  });
  canvas.addEventListener("pointercancel", () => (pointer = null));
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      renderer.zoomAt(
        e.clientX - r.left,
        e.clientY - r.top,
        Math.exp(-e.deltaY * 0.001),
      );
    },
    { passive: false },
  );
} catch (e) {
  notice(e.message, true);
  $("run-state").textContent = "Unable to start";
}
