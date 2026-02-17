export default function RulesLoading() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground pb-24">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 w-40 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
                </div>
              </div>
              <div className="h-11 w-full sm:w-64 rounded-xl bg-muted animate-pulse" />
            </div>
            <div className="flex gap-2 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 w-20 rounded-full bg-muted animate-pulse shrink-0" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              <div className="h-36 bg-muted animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                <div className="h-5 w-full rounded bg-muted animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-muted/80 animate-pulse" />
                <div className="flex justify-between pt-2">
                  <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-muted/70 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
