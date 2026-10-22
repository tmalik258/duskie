// The Repos tab before the first answer.

// Placeholder rows shaped like the real ones, so the list does not jump
// when the repos arrive.
const SKELETON = [
  [46, 30, 2],
  [62, 22, 1],
  [38, 26, 0],
] as const;

export function ReposLoading() {
  return (
    <section className="ak-repos" aria-label="Repos" aria-busy="true">
      <div className="ak-rh">
        <span className="shimmer-text">Finding your repos and checking GitHub</span>
      </div>
      {SKELETON.map(([name, branch, tags], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
        <div key={i} className="ak-rrow ak-rskel" aria-hidden="true" style={{ animationDelay: `${i * 120}ms` }}>
          <i className="ak-rdot" />
          <span className="min-w-0">
            <i className="ak-rbar" style={{ width: `${name}%` }} />
            <i className="ak-rbar ak-rbar-s" style={{ width: `${branch}%` }} />
          </span>
          <span className="ak-rtags">
            {Array.from({ length: tags }, (_, t) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder tags
              <i key={t} className="ak-rbar ak-rbar-t" />
            ))}
          </span>
        </div>
      ))}
    </section>
  );
}
