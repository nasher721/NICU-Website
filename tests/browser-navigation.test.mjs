import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

async function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Continue through configured and platform-standard candidates.
    }
  }
  throw new Error(`No Chrome executable found. Set CHROME_BIN. Checked: ${candidates.join(", ")}`);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

async function waitForHttp(url, process, output, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (process.exitCode != null) {
      throw new Error(`Process exited before ${url} was ready.\n${output.join("")}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // The listener is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}.\n${output.join("")}`);
}

async function stopProcess(child) {
  if (child.exitCode != null) return;
  try {
    if (child.pid) process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
  await Promise.race([once(child, "exit"), delay(1_000)]);
}

class DevToolsSession {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => this.handleMessage(JSON.parse(event.data)));
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new DevToolsSession(socket);
  }

  handleMessage(message) {
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
    return () => listeners.delete(listener);
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function waitForValue(session, expression, predicate, label, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await session.evaluate(expression);
    if (predicate(value)) return value;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}; last value: ${JSON.stringify(value)}`);
}

async function waitForSearchHydration(session) {
  await waitForValue(
    session,
    "document.querySelector('.search-combobox')?.dataset.searchHydrated",
    (value) => value === "true",
    "search box hydration",
  );
}

async function navigate(session, url, expectedPathname) {
  await session.send("Page.navigate", { url });
  await waitForValue(
    session,
    "({ pathname: location.pathname, ready: document.readyState })",
    (value) => value.pathname === expectedPathname && value.ready === "complete",
    expectedPathname,
  );
  await delay(250);
}

async function pressKey(session, key, code = key) {
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", key, code });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
}

async function captureEvidence(session, path) {
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path, Buffer.from(data, "base64"));
}

test("production browser preserves URL state, history, hash authority, and clean hydration", {
  timeout: 120_000,
}, async (t) => {
  const chromePath = await resolveChromeExecutable();
  const appPort = await availablePort();
  const debugPort = await availablePort();
  const profile = await mkdtemp(join(tmpdir(), "faculty-wiki-chrome-"));
  const evidenceDir = join(projectRoot, ".tmp", "release-evidence");
  await mkdir(evidenceDir, { recursive: true });
  const serverOutput = [];

  const app = spawn(process.execPath, [
    "node_modules/vinext/dist/cli.js",
    "start",
    "--port",
    String(appPort),
    "--hostname",
    "127.0.0.1",
  ], {
    cwd: projectRoot,
    env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  app.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
  app.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));

  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-features=Translate",
    "--no-default-browser-check",
    "--no-first-run",
    "about:blank",
  ], { stdio: "ignore" });

  // eslint-disable-next-line prefer-const
  let session;
  t.after(async () => {
    session?.close();
    await stopProcess(chrome);
    await stopProcess(app);
    await rm(profile, { recursive: true, force: true });
  });

  await waitForHttp(`http://127.0.0.1:${appPort}/main-campus`, app, serverOutput);
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, chrome, []);
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const page = pages.find((target) => target.type === "page" && target.url === "about:blank")
    ?? pages.find((target) => target.type === "page");
  assert.ok(page, "Chrome must expose a page target");
  session = await DevToolsSession.connect(page.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Network.enable");

  const browserProblems = [];
  session.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    browserProblems.push(`exception: ${exceptionDetails.text}`);
  });
  session.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type !== "error") return;
    browserProblems.push(`console.error: ${args.map((arg) => arg.value ?? arg.description).join(" ")}`);
  });

  const origin = `http://127.0.0.1:${appPort}`;
  const initialRouteRequests = [];
  const stopInitialRequestCapture = session.on("Network.requestWillBeSent", ({ request }) => {
    initialRouteRequests.push(request.url);
  });
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await navigate(session, `${origin}/`, "/");
  assert.equal(await waitForValue(
    session,
    "document.querySelector('.eye-field')?.dataset.motion",
    (value) => value === "reduced",
    "deterministic reduced-motion EyeField",
  ), "reduced");
  assert.ok(initialRouteRequests.every((url) => !url.includes("/search-index/")));

  initialRouteRequests.length = 0;
  await navigate(session, `${origin}/main-campus`, "/main-campus");
  assert.ok(initialRouteRequests.every((url) => !url.includes("/search-index/")));
  await waitForSearchHydration(session);
  await session.evaluate("document.querySelector('[role=\"combobox\"]').focus()");
  await session.send("Input.insertText", { text: "ICH" });
  await waitForValue(
    session,
    "document.querySelectorAll('[role=\"listbox\"] [role=\"option\"]').length",
    (value) => value > 0,
    "single-campus suggestions",
  );
  assert.ok(initialRouteRequests.some((url) => url.endsWith("/search-index/main-campus.json")));
  assert.ok(initialRouteRequests.every((url) => !url.endsWith("/search-index/akron.json")));
  await session.evaluate(`(() => {
    const input = document.querySelector('[role="combobox"]');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await session.evaluate("localStorage.removeItem('faculty-wiki-campus')");
  stopInitialRequestCapture();
  await session.send("Emulation.setEmulatedMedia", { features: [] });

  for (const [campus, expectedRecords] of [["main-campus", 83], ["akron", 86]]) {
    const response = await fetch(`${origin}/search-index/${campus}.json`);
    assert.equal(response.status, 200);
    const index = await response.json();
    assert.equal(index.campus, campus);
    assert.equal(index.records.length, expectedRecords);
  }

  for (const [campus, label] of [["main-campus", "Main Campus"], ["akron", "Akron General"]]) {
    await navigate(session, `${origin}/${campus}`, `/${campus}`);
    assert.deepEqual(await session.evaluate(`(() => {
      const current = [...document.querySelectorAll('.wiki-sidebar a[aria-current="page"]')]
        .map((link) => link.textContent.trim());
      return {
        main: document.querySelectorAll('main').length,
        h1: document.querySelectorAll('h1').length,
        currentOverview: current.filter((text) => text.includes('Campus overview')).length,
        sourceNote: Boolean(document.querySelector('.source-status, .integrity-banner')),
        title: document.title,
      };
    })()`), {
      main: 1,
      h1: 1,
      currentOverview: 2,
      sourceNote: true,
      title: `${label} Faculty Wiki | Neurocritical Care`,
    });
  }
  await session.evaluate("localStorage.removeItem('faculty-wiki-campus')");

  await navigate(session, `${origin}/search?q=ICH&scope=both`, "/search");
  const fullResultCount = await waitForValue(
    session,
    "document.querySelectorAll('.full-search-results > li').length",
    (value) => value > 0,
    "populated Both-campus full results",
  );
  assert.ok(fullResultCount >= 6);
  assert.deepEqual(await session.evaluate(`({
    mainCampus: Boolean(document.querySelector('.full-search-results .campus-main-campus')),
    akron: Boolean(document.querySelector('.full-search-results .campus-akron')),
    savedCampus: localStorage.getItem('faculty-wiki-campus'),
  })`), {
    mainCampus: true,
    akron: true,
    savedCampus: null,
  });

  await navigate(session, `${origin}/main-campus`, "/main-campus");
  await waitForSearchHydration(session);
  await session.evaluate(`(() => {
    localStorage.setItem('faculty-wiki-campus', 'akron');
    const scope = document.querySelector('.search-scope-control select');
    scope.value = 'both';
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[role="combobox"]').focus();
  })()`);
  await session.send("Input.insertText", { text: "ICH" });
  await waitForValue(
    session,
    "document.querySelectorAll('[role=\"listbox\"] [role=\"option\"]').length",
    (value) => value === 6,
    "six live ICH suggestions",
  );
  const suggestionContract = await session.evaluate(`(() => {
    const input = document.querySelector('[role="combobox"]');
    const controlled = document.getElementById(input.getAttribute('aria-controls'));
    return {
      expanded: input.getAttribute('aria-expanded'),
      controlsRole: controlled?.getAttribute('role'),
      optionIds: [...controlled.querySelectorAll('[role="option"]')].map((option) => option.id),
      savedCampus: localStorage.getItem('faculty-wiki-campus'),
    };
  })()`);
  assert.equal(suggestionContract.expanded, "true");
  assert.equal(suggestionContract.controlsRole, "listbox");
  assert.equal(suggestionContract.optionIds.length, 6);
  assert.ok(suggestionContract.optionIds.every(Boolean));
  assert.equal(suggestionContract.savedCampus, "akron");

  await pressKey(session, "ArrowUp", "ArrowUp");
  assert.equal(
    await session.evaluate("document.querySelector('[role=\"combobox\"]').getAttribute('aria-activedescendant')"),
    suggestionContract.optionIds.at(-1),
  );
  await pressKey(session, "ArrowDown", "ArrowDown");
  assert.equal(
    await session.evaluate("document.querySelector('[role=\"combobox\"]').getAttribute('aria-activedescendant')"),
    suggestionContract.optionIds[0],
  );
  await pressKey(session, "Escape", "Escape");
  assert.deepEqual(await session.evaluate(`(() => {
    const input = document.querySelector('[role="combobox"]');
    return {
      expanded: input.getAttribute('aria-expanded'),
      controls: input.getAttribute('aria-controls'),
      focused: document.activeElement === input,
      value: input.value,
    };
  })()`), { expanded: "false", controls: null, focused: true, value: "ICH" });

  await pressKey(session, "ArrowDown", "ArrowDown");
  await session.evaluate("document.querySelector('h1').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))");
  await waitForValue(
    session,
    "document.querySelector('[role=\"combobox\"]').getAttribute('aria-expanded')",
    (value) => value === "false",
    "outside pointer dismissal",
  );

  await session.evaluate("document.querySelector('[role=\"combobox\"]').focus()");
  await pressKey(session, "ArrowDown", "ArrowDown");
  const keyboardSelectionPath = await session.evaluate(`(() => {
    const input = document.querySelector('[role="combobox"]');
    return new URL(document.getElementById(input.getAttribute('aria-activedescendant')).href).pathname;
  })()`);
  await pressKey(session, "Enter", "Enter");
  await waitForValue(
    session,
    "location.pathname",
    (value) => value === keyboardSelectionPath,
    "keyboard suggestion selection",
  );

  await navigate(session, `${origin}/main-campus`, "/main-campus");
  await waitForSearchHydration(session);
  await session.evaluate(`(() => {
    const scope = document.querySelector('.search-scope-control select');
    scope.value = 'both';
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[role="combobox"]').focus();
  })()`);
  await session.send("Input.insertText", { text: "ICH" });
  await waitForValue(
    session,
    "document.querySelectorAll('[role=\"listbox\"] [role=\"option\"]').length",
    (value) => value === 6,
    "touch-selectable suggestions",
  );
  const touchTarget = await session.evaluate(`(() => {
    const option = document.querySelector('[role="option"]');
    const bounds = option.getBoundingClientRect();
    return {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
      path: new URL(option.href).pathname,
    };
  })()`);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchTarget.x, y: touchTarget.y }],
  });
  assert.equal(
    await session.evaluate("document.activeElement === document.querySelector('[role=\"combobox\"]')"),
    true,
  );
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await waitForValue(session, "location.pathname", (value) => value === touchTarget.path, "touch suggestion selection");
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: false });

  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  const searchIndexRequests = [];
  session.on("Network.requestWillBeSent", ({ request }) => {
    if (request.url.includes("/search-index/")) searchIndexRequests.push(request.url);
  });
  await session.send("Network.setBlockedURLs", { urls: ["*search-index/akron.json"] });
  await navigate(session, `${origin}/main-campus`, "/main-campus");
  await waitForSearchHydration(session);
  await session.evaluate(`(() => {
    localStorage.setItem('faculty-wiki-campus', 'akron');
    const scope = document.querySelector('.search-scope-control select');
    scope.value = 'both';
    scope.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[role="combobox"]').focus();
  })()`);
  await session.send("Input.insertText", { text: "ICH" });
  await waitForValue(
    session,
    "Boolean(document.querySelector('.search-panel-warning button'))",
    Boolean,
    "partial search retry",
  );
  assert.deepEqual(await session.evaluate(`(() => {
    const input = document.querySelector('[role="combobox"]');
    return {
      expanded: input.getAttribute('aria-expanded'),
      controlsExists: Boolean(document.getElementById(input.getAttribute('aria-controls'))),
      savedCampus: localStorage.getItem('faculty-wiki-campus'),
    };
  })()`), {
    expanded: "true",
    controlsExists: true,
    savedCampus: "akron",
  });
  await session.send("Network.setBlockedURLs", { urls: [] });
  const requestsBeforeRetry = searchIndexRequests.length;
  await session.evaluate("document.querySelector('.search-panel-warning button').click()");
  await waitForValue(
    session,
    "document.querySelectorAll('[role=\"listbox\"] [role=\"option\"]').length",
    (value) => value === 6,
    "successful search retry",
  );
  assert.deepEqual(searchIndexRequests.slice(requestsBeforeRetry), [`${origin}/search-index/akron.json`]);
  const requestCountAfterRetry = searchIndexRequests.length;
  await session.evaluate(`(() => {
    const input = document.querySelector('[role="combobox"]');
    input.focus();
    input.setSelectionRange(0, input.value.length);
  })()`);
  await session.send("Input.insertText", { text: "stroke" });
  await waitForValue(
    session,
    "document.querySelector('[role=\"combobox\"]').value",
    (value) => value === "stroke",
    "post-retry query change",
  );
  await delay(500);
  assert.equal(searchIndexRequests.length, requestCountAfterRetry);
  await session.send("Network.setCacheDisabled", { cacheDisabled: false });

  const filteredPath = "/search?q=ICH&scope=akron&chapter=stroke-alerts&type=reference-table";
  await navigate(session, `${origin}${filteredPath}`, "/search");
  await waitForValue(
    session,
    "document.querySelector('[role=\"status\"]')?.textContent",
    (value) => value === "Faculty wiki search loaded",
    "search route announcement",
  );
  assert.deepEqual(await session.evaluate(`({
    href: location.pathname + location.search,
    q: document.querySelector('[name="q"]').value,
    scope: document.querySelector('[name="scope"]').value,
    chapter: document.querySelector('[name="chapter"]').value,
    type: document.querySelector('[name="type"]').value,
    announcement: document.querySelector('[role="status"]').textContent,
  })`), {
    href: filteredPath,
    q: "ICH",
    scope: "akron",
    chapter: "stroke-alerts",
    type: "reference-table",
    announcement: "Faculty wiki search loaded",
  });
  assert.deepEqual(await session.evaluate(`(() => {
    const formControls = [...document.querySelectorAll('input, select')];
    return {
      main: document.querySelectorAll('main').length,
      h1: document.querySelectorAll('h1').length,
      unlabeledControls: formControls.filter((control) => {
        const explicit = control.id && document.querySelector(\`label[for="\${control.id}"]\`);
        return !explicit && !control.closest('label') && !control.getAttribute('aria-label');
      }).length,
      resultsRegion: Boolean(document.querySelector('.search-page [role="status"]')),
    };
  })()`), { main: 1, h1: 1, unlabeledControls: 0, resultsRegion: true });

  await navigate(session, `${origin}/main-campus`, "/main-campus");
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.deepEqual(await session.evaluate(`(() => {
    const trigger = document.querySelector('.sidebar-toggle');
    const desktop = document.querySelector('.wiki-contents-desktop');
    return {
      triggerDisplay: getComputedStyle(trigger).display,
      desktopDisplay: getComputedStyle(desktop).display,
      controls: trigger.getAttribute('aria-controls'),
      expanded: trigger.getAttribute('aria-expanded'),
      noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
    };
  })()`), {
    triggerDisplay: "flex",
    desktopDisplay: "none",
    controls: "mobile-wiki-contents-main-campus",
    expanded: "false",
    noPageOverflow: true,
  });
  await captureEvidence(session, join(evidenceDir, "main-campus-390.png"));
  await session.evaluate("document.querySelector('.sidebar-toggle').click()");
  await waitForValue(session, "document.querySelector('.sidebar-toggle').getAttribute('aria-expanded')", (value) => value === "true", "drawer open");
  assert.equal(await session.evaluate("document.activeElement.classList.contains('drawer-close')"), true);
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
  await waitForValue(session, "document.querySelector('.sidebar-toggle').getAttribute('aria-expanded')", (value) => value === "false", "drawer close");
  await waitForValue(session, "document.activeElement.classList.contains('sidebar-toggle')", Boolean, "drawer focus restoration");

  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 768,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.equal(await session.evaluate("getComputedStyle(document.querySelector('.sidebar-toggle')).display"), "flex");
  await captureEvidence(session, join(evidenceDir, "main-campus-768.png"));
  await session.evaluate("document.querySelector('.sidebar-toggle').click()");
  await waitForValue(session, "document.body.style.overflow", (value) => value === "hidden", "drawer scroll lock");
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await waitForValue(
    session,
    "document.querySelector('.sidebar-toggle').getAttribute('aria-expanded')",
    (value) => value === "false",
    "drawer closure across desktop breakpoint",
  );
  assert.deepEqual(await session.evaluate(`({
    trigger: getComputedStyle(document.querySelector('.sidebar-toggle')).display,
    desktop: getComputedStyle(document.querySelector('.wiki-contents-desktop')).display,
    bodyOverflow: document.body.style.overflow,
  })`), { trigger: "none", desktop: "block", bodyOverflow: "" });
  await captureEvidence(session, join(evidenceDir, "main-campus-desktop.png"));

  await session.evaluate(`(() => {
    const campusPicker = document.querySelector('.campus-picker select');
    campusPicker.value = 'akron';
    campusPicker.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitForValue(session, "location.pathname", (value) => value === "/akron", "campus picker navigation");
  await session.evaluate("history.back()");
  await waitForValue(session, "location.pathname", (value) => value === "/main-campus", "Back navigation");
  await session.evaluate("history.forward()");
  await waitForValue(session, "location.pathname", (value) => value === "/akron", "Forward navigation");

  const explicitHash = "#/wiki/main-campus/critical-contacts";
  await navigate(session, `${origin}/akron${explicitHash}`, "/akron");
  assert.deepEqual(await session.evaluate("({ pathname: location.pathname, hash: location.hash, heading: document.querySelector('h1').textContent })"), {
    pathname: "/akron",
    hash: explicitHash,
    heading: "Akron General faculty wiki",
  });

  const malformedHash = "#/wiki/%E0%A4%A";
  await navigate(session, `${origin}/${malformedHash}`, "/");
  assert.deepEqual(await session.evaluate("({ pathname: location.pathname, hash: location.hash })"), {
    pathname: "/",
    hash: malformedHash,
  });

  await navigate(
    session,
    `${origin}/?q=ICH&scope=both#/wiki/akron/transitions-of-care`,
    "/akron/part-7-transitions-of-care",
  );
  assert.deepEqual(await session.evaluate("({ pathname: location.pathname, search: location.search, announcement: document.querySelector('[role=\"status\"]').textContent })"), {
    pathname: "/akron/part-7-transitions-of-care",
    search: "?q=ICH&scope=both",
    announcement: "Transitions of Care loaded for Akron General",
  });

  await navigate(session, `${origin}/main-campus/part-6-documentation-and-quality`, "/main-campus/part-6-documentation-and-quality");
  assert.deepEqual(await session.evaluate(`(() => ({
    main: document.querySelectorAll('main').length,
    h1: document.querySelectorAll('h1').length,
    scrollableTables: [...document.querySelectorAll('.table-wrap')].every((table) =>
      table.getAttribute('role') === 'region' && table.tabIndex === 0 && Boolean(table.getAttribute('aria-label'))),
    scopedHeaders: [...document.querySelectorAll('th')].every((header) => header.scope === 'col'),
    explanatorySmartPhraseProse: [...document.querySelectorAll('.article-content p')]
      .some((paragraph) => /SmartPhrase|dot phrase/i.test(paragraph.textContent)),
  }))()`), {
    main: 1,
    h1: 1,
    scrollableTables: true,
    scopedHeaders: true,
    explanatorySmartPhraseProse: true,
  });

  await navigate(session, `${origin}/main-campus/appendix-a-smartphrase-library`, "/main-campus/appendix-a-smartphrase-library");
  assert.deepEqual(await session.evaluate(`({
    explanatoryProse: [...document.querySelectorAll('.article-content p')].some((node) => /copy\\/reference library|dot phrases/i.test(node.textContent)),
    templateCode: document.querySelectorAll('.article-content pre.smartphrase-block code').length > 0,
  })`), { explanatoryProse: true, templateCode: true });

  await navigate(session, `${origin}/main-campus/stroke-care-pathway-in-epic`, "/main-campus/stroke-care-pathway-in-epic");
  await waitForValue(session, "Boolean(document.querySelector('.source-figure img'))", Boolean, "source figure");
  await session.evaluate("document.querySelector('.source-figure img').dispatchEvent(new Event('error'))");
  assert.deepEqual(await session.evaluate(`({
    fallback: Boolean(document.querySelector('.source-figure .missing-figure-placeholder')),
    caption: document.querySelector('.source-figure figcaption')?.textContent ?? '',
  })`), {
    fallback: true,
    caption: "Main Campus: Stroke Care Pathway in Epic · Figure from the source handbook · MC NICU Faculty Orientation Document (2026) · part-6-documentation-and-quality/stroke-care-pathway-in-epic",
  });

  await navigate(session, `${origin}/main-campus/documentation-and-quality`, "/main-campus/part-6-documentation-and-quality");
  await navigate(session, `${origin}/akron/not-a-current-article`, "/akron/not-a-current-article");
  assert.equal(await session.evaluate(
    "document.querySelector('h1')?.textContent === 'This article path is not in the current handbook.'"
      + " && document.querySelector('[name=\"scope\"]')?.value === 'akron'",
  ), true);

  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "Object.defineProperty(globalThis, 'ResizeObserver', { value: undefined, configurable: true });",
  });
  await navigate(session, `${origin}/`, "/");
  assert.equal(await waitForValue(
    session,
    "document.querySelector('.eye-field')?.dataset.motion",
    (value) => value === "full",
    "EyeField resize fallback",
  ), "full");
  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "HTMLCanvasElement.prototype.getContext = () => null;",
  });
  await navigate(session, `${origin}/?canvas=fallback`, "/");
  assert.equal(await session.evaluate("document.querySelectorAll('.hospital-card').length"), 2);

  assert.deepEqual(browserProblems, []);
});
