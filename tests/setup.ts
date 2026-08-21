import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class ReactFlowResizeObserver {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.callback([{
        target,
        contentRect: target.getBoundingClientRect(),
      } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }, 0);
    this.timers.add(timer);
  }

  unobserve() {}
  disconnect() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}

class ReactFlowDOMMatrixReadOnly {
  readonly m22: number;

  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.]+)\)/)?.[1];
    this.m22 = scale === undefined ? 1 : Number(scale);
  }
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ReactFlowResizeObserver,
});
Object.defineProperty(globalThis, "DOMMatrixReadOnly", {
  configurable: true,
  value: ReactFlowDOMMatrixReadOnly,
});
Object.defineProperties(globalThis.HTMLElement.prototype, {
  offsetHeight: { configurable: true, get() { return Number.parseFloat(this.style.height) || 1; } },
  offsetWidth: { configurable: true, get() { return Number.parseFloat(this.style.width) || 1; } },
});
Object.defineProperty(globalThis.SVGElement.prototype, "getBBox", {
  configurable: true,
  value: () => ({ x: 0, y: 0, width: 1, height: 1 }),
});

afterEach(cleanup);
