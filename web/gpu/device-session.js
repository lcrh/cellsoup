// One owned GPU device. Retired devices cannot report failures into a new world.
export function createDeviceSession(gpu, onFailure) {
  let device = null;
  let failure = null;
  let generation = 0;
  let reconnecting = false;
  function dispose() {
    generation++;
    const previous = device;
    device = null;
    failure = null;
    previous?.destroy();
  }
  return {
    dispose,
    check() {
      if (failure) throw failure;
    },
    async connect() {
      if (device) {
        this.check();
        return device;
      }
      const ticket = generation;
      if (!gpu) throw Error("WebGPU is unavailable in this browser.");
      const adapter = await gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter)
        throw Error(
          reconnecting
            ? "The browser could not reconnect to the GPU. If restarting the soup still fails, restart the browser."
            : "No WebGPU adapter is available.",
        );
      // Large habitats reserve room for both living cells and edible remains.
      // Raising this limit grants capacity; it does not allocate GPU memory.
      const bindingLimit = adapter.limits?.maxStorageBufferBindingSize;
      const next = await adapter.requestDevice(
        bindingLimit
          ? {
              requiredLimits: {
                maxStorageBufferBindingSize: Math.min(
                  bindingLimit,
                  256 * 1024 * 1024,
                ),
              },
            }
          : {},
      );
      if (ticket !== generation) {
        next.destroy();
        throw Error("GPU startup was cancelled.");
      }
      device = next;
      reconnecting = true;
      const report = (error) => {
        if (device !== next || ticket !== generation) return;
        // Allocation failure can cause a cascade of secondary validation errors.
        // Preserve its cause; an actual device-loss report is more specific.
        if (failure && error.name !== "GPUDeviceLostError") return;
        failure = error;
        onFailure(error);
      };
      next.addEventListener("uncapturederror", (event) => report(event.error));
      next.lost.then((info) => {
        const error = new Error(
          `The GPU connection was lost (${info.reason || "unknown"})${info.message ? `: ${info.message}` : "."}`,
        );
        error.name = "GPUDeviceLostError";
        report(error);
      });
      return next;
    },
  };
}

export function describeGpuFailure(error, world) {
  const name = error?.name || error?.constructor?.name;
  const detail = error?.message || String(error);
  const location = world ? ` World ${world.seed}, tick ${world.tick}.` : "";
  if (name === "GPUDeviceLostError")
    return `${detail}${location} Restart soup to reconnect and begin again from this seed.`;
  if (name === "GPUOutOfMemoryError")
    return `The GPU ran out of memory. ${detail}${location} Try restarting with a lower entity capacity.`;
  if (name === "GPUValidationError")
    return `GPU validation failed: ${detail}${location} Restart soup to try again.`;
  return `${detail}${location} Restart soup to try again.`;
}
