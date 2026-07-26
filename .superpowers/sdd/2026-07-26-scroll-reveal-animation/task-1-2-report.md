# Scroll Reveal Animation — Task 1 + 2 Report

## Scope completed

- Added the dependency-free Node test harness and four animation behavior tests.
- Replaced the flat scroll-reveal implementation with sequential hero reveals and section-group staggered reveals.
- Added mobile, reduced-motion, and print animation overrides.
- Preserved the portrait, resume copy, responsive rules, navigation observer, and current-year behavior.

## RED verification

Command run before production changes:

```powershell
node --test tests/scroll-animation.test.mjs
```

Relevant output:

```text
tests 4
pass 0
fail 4
```

The expected failures showed no hero delay values, no 90ms group delays, no no-observer visibility fallback, and no desktop reveal CSS variables.

## GREEN verification

Command run after the minimal implementation:

```powershell
node --test tests/scroll-animation.test.mjs
```

Relevant output:

```text
✔ hero elements receive sequential delays and become visible
✔ section groups receive 90ms stagger and reveal once on intersection
✔ missing IntersectionObserver makes all scroll targets visible
✔ CSS defines restrained desktop, mobile, and reduced-motion behavior
tests 4
pass 4
fail 0
```

## Test-harness compatibility adjustment

The mandated harness runs the site script in `vm.runInNewContext`. On this Node version, an options object constructed in that VM has a different prototype realm, so `assert.deepEqual` rejects it despite the same two fields. The fake observer now copies `threshold` and `rootMargin` into an outer-realm plain object. This is test-harness-only compatibility work; it does not change production behavior or the asserted observer contract.

## Structural regression checks

Command run:

```powershell
rg -n '黄广平.png|Java0120@163.com|id="about"|id="projects"|id="experience"|id="skills"|id="contact"' index.html
git diff --check
```

Relevant output confirmed the portrait and email:

```text
88:          <a class="button button-ghost" href="mailto:Java0120@163.com">邮件联系</a>
101:            src="黄广平.png"
207:      <a class="contact-link" href="mailto:Java0120@163.com"><span>Java0120@163.com</span><span aria-hidden="true">↗</span></a>
```

`git diff --check` exited 0. A separate `rg -n 'id=' index.html` self-review confirmed all five navigation targets remain: `about`, `projects`, `experience`, `skills`, and `contact`.

## Self-review

- Hero targets receive `120ms` through `620ms` delays and are revealed after two animation frames.
- Each section's heading and content reveal as a 90ms-staggered group; revealed targets are unobserved.
- Browsers without `IntersectionObserver` show all scroll targets.
- Reduced-motion and print rules force both reveal classes visible.
- The existing navigation observer and current-year assignment are unchanged.

## Final review fix wave

The final review identified a persistent `will-change: opacity, transform` declaration on every hero and section reveal target. Because these animations run once, retaining that compositor hint after transition completion can consume unnecessary resources, particularly on mobile. The smallest robust fix removes the permanent hint without adding transition lifecycle state or changing any motion values.

### RED

Added focused coverage asserting that the reveal CSS does not retain the compositor hint, then ran:

```powershell
node --test tests/scroll-animation.test.mjs
```

Relevant output:

```text
✖ reveal CSS does not retain a persistent compositor hint
tests 5
pass 4
fail 1
```

The failure matched `will-change: opacity, transform` in `index.html`, confirming the test caught the reported regression.

### GREEN

Removed only the permanent `will-change` declaration, then ran:

```powershell
node --test tests/scroll-animation.test.mjs
```

Relevant output:

```text
✔ hero elements receive sequential delays and become visible
✔ section groups receive 90ms stagger and reveal once on intersection
✔ missing IntersectionObserver makes all scroll targets visible
✔ CSS defines restrained desktop, mobile, and reduced-motion behavior
✔ reveal CSS does not retain a persistent compositor hint
tests 5
pass 5
fail 0
```

### Structural checks

Commands run:

```powershell
rg -n '黄广平.png|Java0120@163.com' index.html
rg -n 'id=.(about|projects|experience|skills|contact).' index.html
rg -n 'will-change' index.html
git diff --check
```

Relevant output:

```text
87:          <a class="button button-ghost" href="mailto:Java0120@163.com">邮件联系</a>
100:            src="黄广平.png"
206:      <a class="contact-link" href="mailto:Java0120@163.com"><span>Java0120@163.com</span><span aria-hidden="true">↗</span></a>
115:    <section class="section" id="about" aria-labelledby="about-title">
135:    <section class="section section-dark" id="projects" aria-labelledby="projects-title">
168:    <section class="section" id="experience" aria-labelledby="experience-title">
189:    <section class="section skills-section" id="skills" aria-labelledby="skills-title">
201:    <section class="contact-section" id="contact" aria-labelledby="contact-title">
```

The `will-change` search returned no production matches, and `git diff --check` exited 0. Git emitted only the repository's existing LF-to-CRLF working-copy warnings.

### Self-review

- The fix changes one CSS declaration and does not alter distances, duration, easing, delay, scale, observer behavior, or fallback behavior.
- No animation-completion listeners, timers, extra classes, or other lifecycle complexity were introduced.
- The focused test fails if any permanent `will-change` hint is reintroduced into the base reveal rule.
- Portrait, email, five navigation targets, navigation observer, responsive rules, and current-year behavior remain intact.
