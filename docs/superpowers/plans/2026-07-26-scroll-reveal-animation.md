# Scroll Reveal Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clearly visible but restrained entrance and scroll-reveal animations to the personal homepage, then publish and verify them on GitHub Pages.

**Architecture:** Keep the existing single-file static-page architecture. Extend the inline CSS with reusable reveal states and CSS custom properties, and replace the flat reveal setup with grouped `IntersectionObserver` logic that assigns staggered delays. Use dependency-free Node tests for the animation contract and Chrome browser checks for real rendering and scrolling behavior.

**Tech Stack:** HTML5, CSS custom properties and transitions, vanilla JavaScript, `IntersectionObserver`, Node.js built-in test runner, Chrome, Git, GitHub Pages.

## Global Constraints

- Do not add third-party JavaScript or CSS dependencies.
- Desktop section headings use approximately 40 pixels of vertical travel.
- The primary reveal duration is approximately 700 milliseconds.
- Adjacent grouped items use approximately 90 milliseconds of stagger.
- Hero animation plays once on first load; scroll animations play once when entering the viewport.
- Mobile uses shorter travel and duration.
- `prefers-reduced-motion: reduce` makes content immediately visible without translation, scaling, or stagger.
- Missing JavaScript or `IntersectionObserver` must never leave content permanently hidden.
- Preserve the existing semantic structure, focus order, responsive layout, navigation highlighting, personal copy, and portrait.

---

## File Structure

- Modify `index.html`: animation CSS, hero setup, grouped scroll targets, fallback behavior.
- Create `tests/scroll-animation.test.mjs`: dependency-free behavior and CSS contract tests.
- Preserve `黄广平.png`: deployed portrait asset; no binary change.
- Preserve `docs/superpowers/specs/2026-07-26-scroll-reveal-animation-design.md`: approved design source.

### Task 1: Add the failing animation behavior tests

**Files:**

- Create: `tests/scroll-animation.test.mjs`
- Read: `index.html`

**Interfaces:**

- Consumes: the final inline `<script>` from `index.html`.
- Produces: a reusable `runAnimationScript({ withObserver })` harness and assertions for hero sequencing, section staggering, observer behavior, fallback behavior, mobile tuning, and reduced-motion CSS.

- [ ] **Step 1: Create the dependency-free test harness**

Create `tests/scroll-animation.test.mjs` with the following behavior:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const animationScript = inlineScripts.at(-1)?.[1] ?? "";

function makeElement(attributes = {}) {
  const classes = new Set();
  const styleValues = new Map();
  const attributeValues = new Map(Object.entries(attributes));

  return {
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    style: {
      setProperty: (name, value) => styleValues.set(name, value),
      getPropertyValue: (name) => styleValues.get(name) ?? "",
    },
    getAttribute: (name) => attributeValues.get(name) ?? null,
    setAttribute: (name, value) => attributeValues.set(name, value),
    removeAttribute: (name) => attributeValues.delete(name),
    textContent: "",
  };
}

function makeSection(heading, items) {
  return {
    querySelector: (selector) =>
      selector === ":scope > .section-heading" ? heading : null,
    querySelectorAll: () => items,
  };
}

function runAnimationScript({ withObserver = true } = {}) {
  const root = makeElement();
  root.classList.add("no-js");

  const hero = Array.from({ length: 6 }, () => makeElement());
  const groupOne = [makeElement(), makeElement(), makeElement()];
  const groupTwo = [makeElement(), makeElement()];
  const contact = makeElement();
  const year = makeElement();
  const sections = [
    makeSection(groupOne[0], groupOne.slice(1)),
    makeSection(groupTwo[0], groupTwo.slice(1)),
  ];
  const observers = [];

  class FakeIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = [];
      this.unobserved = [];
      observers.push(this);
    }

    observe(element) {
      this.observed.push(element);
    }

    unobserve(element) {
      this.unobserved.push(element);
    }
  }

  const heroSelector =
    ".hero .eyebrow, #hero-title, .hero-lead, .hero-actions, .hero-stats, .hero-panel";
  const document = {
    documentElement: root,
    querySelectorAll: (selector) => {
      if (selector === heroSelector) return hero;
      if (selector === ".section") return sections;
      if (selector === ".nav-links a") return [];
      return [];
    },
    querySelector: (selector) =>
      selector === ".contact-section" ? contact : null,
    getElementById: (id) => (id === "current-year" ? year : null),
  };
  const window = withObserver
    ? { IntersectionObserver: FakeIntersectionObserver }
    : {};
  const context = {
    document,
    window,
    Date,
    requestAnimationFrame: (callback) => callback(),
  };
  if (withObserver) {
    context.IntersectionObserver = FakeIntersectionObserver;
  }

  vm.runInNewContext(animationScript, context);

  return {
    root,
    hero,
    groups: [groupOne, groupTwo, [contact]],
    observers,
  };
}

test("hero elements receive sequential delays and become visible", () => {
  const runtime = runAnimationScript();

  assert.equal(runtime.root.classList.contains("js"), true);
  assert.deepEqual(
    runtime.hero.map((element) =>
      element.style.getPropertyValue("--reveal-delay")
    ),
    ["120ms", "220ms", "320ms", "420ms", "520ms", "620ms"]
  );
  assert.equal(
    runtime.hero.every(
      (element) =>
        element.classList.contains("hero-reveal") &&
        element.classList.contains("is-visible")
    ),
    true
  );
});

test("section groups receive 90ms stagger and reveal once on intersection", () => {
  const runtime = runAnimationScript();
  const [firstGroup, secondGroup, contactGroup] = runtime.groups;
  const revealObserver = runtime.observers[0];

  assert.deepEqual(
    firstGroup.map((element) =>
      element.style.getPropertyValue("--reveal-delay")
    ),
    ["0ms", "90ms", "180ms"]
  );
  assert.deepEqual(
    secondGroup.map((element) =>
      element.style.getPropertyValue("--reveal-delay")
    ),
    ["0ms", "90ms"]
  );
  assert.equal(
    contactGroup[0].style.getPropertyValue("--reveal-delay"),
    "0ms"
  );
  assert.deepEqual(
    revealObserver.options,
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
  );

  revealObserver.callback(
    [{ isIntersecting: true, target: firstGroup[1] }],
    revealObserver
  );

  assert.equal(firstGroup[1].classList.contains("is-visible"), true);
  assert.deepEqual(revealObserver.unobserved, [firstGroup[1]]);
});

test("missing IntersectionObserver makes all scroll targets visible", () => {
  const runtime = runAnimationScript({ withObserver: false });
  const allTargets = runtime.groups.flat();

  assert.equal(
    allTargets.every((element) => element.classList.contains("is-visible")),
    true
  );
});

test("CSS defines restrained desktop, mobile, and reduced-motion behavior", () => {
  assert.match(html, /--reveal-distance:\s*40px/);
  assert.match(html, /--reveal-duration:\s*700ms/);
  assert.match(html, /scale\(var\(--reveal-scale,\s*0\.985\)\)/);
  assert.match(
    html,
    /@media \(max-width: 680px\)[\s\S]*--reveal-distance:\s*24px[\s\S]*--reveal-duration:\s*560ms/
  );
  assert.match(
    html,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.js \.hero-reveal[\s\S]*opacity:\s*1 !important[\s\S]*transition:\s*none !important/
  );
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```powershell
node --test tests/scroll-animation.test.mjs
```

Expected: FAIL because the current page does not add `hero-reveal`, does not assign `90ms` delays, still uses `22px / 600ms`, and has no explicit reduced-motion visibility override.

### Task 2: Implement the stronger native animation

**Files:**

- Modify: `index.html:32-35`
- Modify: `index.html:193-214`
- Preserve: `index.html:216-236`

**Interfaces:**

- Consumes: existing `.hero`, `.section`, `.section-heading`, card, timeline, skill, contact, and navigation selectors.
- Produces: `.hero-reveal`, `.reveal`, `.is-visible`, `--reveal-delay`, `--reveal-distance`, and `--reveal-duration` behavior used by the tests and browser QA.

- [ ] **Step 1: Replace the reveal CSS with reusable transition states**

Replace the existing two reveal rules with:

```css
.js .hero-reveal,
.js .reveal {
  --reveal-distance: 40px;
  --reveal-duration: 700ms;
  --reveal-scale: 0.985;
  opacity: 0;
  transform: translate3d(0, var(--reveal-distance), 0)
    scale(var(--reveal-scale, 0.985));
  transition:
    opacity var(--reveal-duration) cubic-bezier(0.22, 1, 0.36, 1)
      var(--reveal-delay, 0ms),
    transform var(--reveal-duration) cubic-bezier(0.22, 1, 0.36, 1)
      var(--reveal-delay, 0ms);
  will-change: opacity, transform;
}

.js .hero-reveal {
  --reveal-distance: 32px;
}

.js .hero-reveal.is-visible,
.js .reveal.is-visible {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}
```

- [ ] **Step 2: Add mobile and reduced-motion overrides**

Inside the existing `@media (max-width: 680px)` block, add:

```css
.js .hero-reveal,
.js .reveal {
  --reveal-distance: 24px;
  --reveal-duration: 560ms;
}
```

Inside the existing reduced-motion block, add:

```css
.js .hero-reveal,
.js .reveal {
  opacity: 1 !important;
  transform: none !important;
  transition: none !important;
}
```

Extend the print rule so both animation classes remain visible:

```css
.js .hero-reveal,
.js .reveal {
  opacity: 1;
  transform: none;
}
```

- [ ] **Step 3: Replace the flat reveal JavaScript with hero and grouped setup**

Replace `index.html:197-214` with:

```js
const heroTargets = [
  ...document.querySelectorAll(
    ".hero .eyebrow, #hero-title, .hero-lead, .hero-actions, .hero-stats, .hero-panel"
  ),
];

heroTargets.forEach((element, index) => {
  element.classList.add("hero-reveal");
  element.style.setProperty("--reveal-delay", `${120 + index * 100}ms`);
});

const showHeroTargets = () => {
  heroTargets.forEach((element) => element.classList.add("is-visible"));
};

if (typeof requestAnimationFrame === "function") {
  requestAnimationFrame(() => requestAnimationFrame(showHeroTargets));
} else {
  showHeroTargets();
}

const revealGroups = [...document.querySelectorAll(".section")].map(
  (section) =>
    [
      section.querySelector(":scope > .section-heading"),
      ...section.querySelectorAll(
        ".about-copy, .capability-card, .project-card, .timeline-item, .skill-groups article"
      ),
    ].filter(Boolean)
);

const contactSection = document.querySelector(".contact-section");
if (contactSection) revealGroups.push([contactSection]);

const revealTargets = revealGroups.flat();
revealGroups.forEach((group) => {
  group.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${index * 90}ms`);
  });
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
  );
  revealTargets.forEach((element) => revealObserver.observe(element));
} else {
  revealTargets.forEach((element) => element.classList.add("is-visible"));
}
```

Do not change the navigation observer or current-year code.

- [ ] **Step 4: Run the animation tests to verify GREEN**

Run:

```powershell
node --test tests/scroll-animation.test.mjs
```

Expected: 4 tests pass, 0 fail, with no warnings.

- [ ] **Step 5: Run structural regression checks**

Run:

```powershell
rg -n '黄广平.png|Java0120@163.com|id="about"|id="projects"|id="experience"|id="skills"|id="contact"' index.html
git diff --check
```

Expected: portrait path, email, and five navigation targets remain present; `git diff --check` exits 0.

- [ ] **Step 6: Commit the tested implementation**

```powershell
git add -- index.html tests/scroll-animation.test.mjs
git commit -m "Add staggered scroll animations"
```

### Task 3: Verify in Chrome and publish to GitHub Pages

**Files:**

- Verify: `index.html`
- Verify unchanged: `黄广平.png`
- Publish: Git branch `main`

**Interfaces:**

- Consumes: the committed animation implementation from Task 2.
- Produces: verified remote commit and public page at `https://lovesjava.github.io/resume-homepage/`.

- [ ] **Step 1: Open a fresh local copy in Chrome**

Navigate Chrome directly to:

```text
file:///E:/%E9%BB%84%E5%B9%BF%E5%B9%B3-%E6%96%87%E6%A1%A3/%E4%B8%AA%E4%BA%BA%E4%B8%BB%E9%A1%B5%E5%8F%91%E5%B8%83/index.html?animation-local=1#home
```

Expected: the local `index.html` loads without a server and displays the existing portrait from the same directory.

- [ ] **Step 2: Verify desktop behavior in Chrome**

At a desktop viewport:

- Load a fresh cache-busting URL at the top of the page.
- Confirm title `黄广平｜Java 后端开发工程师`.
- Confirm the portrait has `naturalWidth > 0`.
- Before scrolling, confirm an off-screen project card has `opacity: 0`.
- Scroll until the project section enters the viewport.
- Confirm the first three project cards have delays `90ms`, `180ms`, and `270ms`.
- Confirm each project card reaches `opacity: 1` and identity transform after its transition.
- Confirm the reveal observer removes targets after activation.
- Confirm the console has no JavaScript errors.

- [ ] **Step 3: Verify mobile behavior in Chrome**

At a 390 × 844 viewport:

- Confirm the document has no horizontal overflow.
- Confirm a reveal target computes `--reveal-distance: 24px`.
- Confirm a reveal target computes `--reveal-duration: 560ms`.
- Scroll through About, Projects, Experience, Skills, and Contact.
- Confirm content remains readable and every section becomes visible.
- Reset the temporary viewport override after testing.

- [ ] **Step 4: Re-run the complete local verification**

Run:

```powershell
node --test tests/scroll-animation.test.mjs
git diff --check
git status --short --branch
git log -1 --oneline
```

Expected: 4 tests pass, no whitespace errors, clean worktree, and `main` ahead of `origin/main` only by the approved design/plan and implementation commits.

- [ ] **Step 5: Push the tested commit**

Run:

```powershell
git push origin main
```

Expected: `main` updates successfully on `https://github.com/LovesJava/resume-homepage`.

- [ ] **Step 6: Verify the deployed page**

Check:

```text
https://lovesjava.github.io/resume-homepage/?animation-release=1#home
```

Required evidence:

- GitHub Pages returns HTTP 200.
- Remote `main` commit equals local `HEAD`.
- Deployed HTML contains the animation selectors and `90ms` stagger logic.
- Deployed portrait returns HTTP 200 with `image/png`.
- Chrome reproduces the hero and scroll animations from the public URL.
- The public page tab is left open as the deliverable.
