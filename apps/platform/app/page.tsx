import { Button } from "@futures-medialab/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-3xl rounded-3xl border border-border bg-card p-10 shadow-sm sm:p-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Futures Medialab
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
          Global creator campaigns, built to move.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          The platform workspace is ready for creator, agency, and brand
          experiences.
        </p>
        <div className="mt-8">
          <Button>Platform setup complete</Button>
        </div>
      </section>
    </main>
  );
}
