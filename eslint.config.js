import js from "@eslint/js";

const browserGlobals = Object.fromEntries(
  [
    "window", "document", "navigator", "localStorage", "sessionStorage", "location", "history",
    "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask",
    "requestAnimationFrame", "cancelAnimationFrame", "fetch", "URL", "URLSearchParams", "Blob",
    "File", "FileReader", "FileList", "FormData", "Image", "Canvas", "HTMLCanvasElement",
    "DOMParser", "XMLSerializer", "MutationObserver", "ResizeObserver", "IntersectionObserver",
    "AbortController", "TextEncoder", "TextDecoder", "Uint8Array", "Uint32Array", "Uint16Array",
    "Int8Array", "DataView", "ArrayBuffer", "Map", "Set", "WeakMap", "Promise", "Symbol",
    "JSON", "Math", "Date", "RegExp", "Intl", "structuredClone", "crypto", "indexedDB",
    "IDBKeyRange", "matchMedia", "getComputedStyle", "alert", "confirm", "prompt", "atob",
    "btoa", "HTMLElement", "Node", "Element", "Event", "CustomEvent", "KeyboardEvent",
    "MouseEvent", "DragEvent", "ClipboardEvent", "DataTransfer", "Range", "NodeFilter",
    "Worker", "performance", "__APP_VERSION__", "HTMLAnchorElement", "HTMLInputElement",
    "HTMLTextAreaElement", "HTMLDivElement", "BlobPart", "globalThis",
  ].map((k) => [k, "readonly"]),
);

export default [
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "test/**/*.js", "*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...browserGlobals, process: "readonly" },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-prototype-builtins": "off",
      eqeqeq: ["warn", "smart"],
      "no-var": "warn",
      "prefer-const": "warn",
    },
  },
];
