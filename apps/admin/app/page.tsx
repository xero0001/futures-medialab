import { Button } from "@futures-medialab/ui/button";

export default function AdminHomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6 py-16 text-foreground">
      <section className="w-full max-w-2xl rounded-3xl border border-border bg-card p-10 shadow-sm sm:p-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Internal console
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          Futures Medialab Admin
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">
          Operations, campaign review, and finance modules will live here.
        </p>
        <div className="mt-8">
          <Button variant="outline">Admin setup complete</Button>
        </div>
      </section>
    </main>
  );
}
