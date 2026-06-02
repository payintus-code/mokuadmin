export default function Loading() {
  return (
    <main className="stack page-loading" aria-busy="true" aria-label="Loading page">
      <section className="page-header loading-panel">
        <div className="loading-line loading-line-kicker" />
        <div className="loading-line loading-line-title" />
        <div className="loading-line loading-line-copy" />
      </section>

      <section className="grid-3 loading-grid">
        <div className="metric-card loading-card" />
        <div className="metric-card loading-card" />
        <div className="metric-card loading-card" />
      </section>

      <section className="panel stack">
        <div className="loading-line loading-line-title" />
        <div className="loading-row" />
        <div className="loading-row" />
        <div className="loading-row" />
      </section>
    </main>
  );
}
