const VERSION = /^\d{4}\.\d{2}\.\d{2}\.\d{1,9}$/;
const parts = value => value.split(".").map(Number);
const compare = (a, b) => {
  const left = parts(a), right = parts(b);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
};

// Keep the service-worker release and monotonic cache generation in sync with
// the single edited version in app-release.js. Running twice is idempotent.
export function synchronizeRelease(worker, desired) {
  if (!VERSION.test(desired)) throw Error("Invalid app release version");
  const releases = [...worker.matchAll(/^const RELEASE = "([^"]+)";$/gm)];
  const generations = [...worker.matchAll(/^const VERSION = SHELL_PREFIX \+ "(\d{6})-v(\d+)";$/gm)];
  if (releases.length !== 1 || generations.length !== 1 || !VERSION.test(releases[0][1])) {
    throw Error("Unexpected service worker release format");
  }
  const previous = releases[0][1];
  if (desired === previous) return { worker, changed: false };
  if (compare(desired, previous) <= 0) throw Error("Release version must increase");
  const generation = Number(generations[0][2]) + 1;
  if (!Number.isSafeInteger(generation)) throw Error("Invalid cache generation");
  const [year, month, day] = desired.split(".");
  return { changed: true, worker: worker.replace(releases[0][0], 'const RELEASE = "' + desired + '";')
    .replace(generations[0][0], 'const VERSION = SHELL_PREFIX + "' + year.slice(2) + month + day + '-v' + generation + '";') };
}
