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
