// Preserve publication, links and instruction timing while replacing only the
// new linked-signal reading. A self-history control distinguishes communication
// from a cell merely using its own persistent output as memory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const marker = "c.r[d]=sum/f32(max(1u,count));";
export function interveneLinkedSignal(
  source,
  { mode = "zero", genomeSlots = null, value = 0 } = {},
) {
  assert.ok(["zero", "self", "constant"].includes(mode));
  assert.equal(
    source.split(marker).length,
    2,
    "Requires exactly one linked-signal implementation",
  );
  assert.ok(Number.isFinite(value) && Math.abs(value) <= 100);
  if (genomeSlots !== null) {
    assert.ok(Array.isArray(genomeSlots) && genomeSlots.length);
    assert.equal(new Set(genomeSlots).size, genomeSlots.length);
    assert.ok(
      genomeSlots.every((s) => Number.isInteger(s) && s >= 0 && s < 65536),
    );
  }
  const literal = String(Math.fround(value));
  const scalar = /[.e]/i.test(literal) ? literal : literal + ".0";
  const alternative =
    mode === "self"
      ? "old[i].signal[u32(clamp(b,0.0,3.0))]"
      : mode === "zero"
        ? "0.0"
        : scalar;
  const expression =
    genomeSlots === null
      ? alternative
      : `select(sum/f32(max(1u,count)),${alternative},${genomeSlots.map((s) => `c.machine.y==${s}u`).join("||")})`;
  return source.replace(marker, `c.r[d]=${expression};`);
}
export function linkedSignalDevice(device, options) {
  let actualSha256,
    changedModules = 0;
  const proxy = new Proxy(device, {
    get(obj, name) {
      if (name === "createShaderModule")
        return (descriptor) => {
          const code = interveneLinkedSignal(descriptor.code, options);
          changedModules++;
          actualSha256 = createHash("sha256").update(code).digest("hex");
          return obj.createShaderModule({ ...descriptor, code });
        };
      const value = Reflect.get(obj, name, obj);
      return typeof value === "function" ? value.bind(obj) : value;
    },
  });
  return {
    device: proxy,
    get actualSha256() {
      assert.equal(changedModules, 1);
      return actualSha256;
    },
  };
}
