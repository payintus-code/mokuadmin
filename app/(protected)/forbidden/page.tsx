export default function ForbiddenPage() {
  return (
    <main className="stack">
      <section className="card frontdesk-hero">
        <div className="frontdesk-hero-copy">
          <div className="section-kicker">Access Denied</div>
          <h1 className="frontdesk-hero-title">You do not have permission to access this area</h1>
          <p className="frontdesk-hero-subtitle">Ask an administrator to grant your account access in `app_users`.</p>
        </div>
      </section>
    </main>
  );
}
