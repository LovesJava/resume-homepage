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
      this.options = {
        threshold: options.threshold,
        rootMargin: options.rootMargin,
      };
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
