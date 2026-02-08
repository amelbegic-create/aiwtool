/**
 * Loading skeleton za Godišnji odmor – prikazuje se tijekom server roundtrip-a
 * (npr. pri promjeni godine) da korisnik odmah vidi feedback.
 */
export default function VacationsLoading() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground animate-pulse">
      <div className="max-w-6xl mx-auto space-y-8 md:max-w-[1600px]">
        {/* Header skeleton */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="h-9 w-64 bg-muted rounded-lg" />
            <div className="h-4 w-48 bg-muted/80 rounded" />
            <div className="flex gap-2 mt-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-9 w-14 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Stats cards row */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card p-6 rounded-2xl shadow-sm border border-border">
              <div className="h-3 w-20 bg-muted rounded mb-3" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-muted/50 border-b border-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 bg-muted rounded col-span-2" />
            ))}
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5, 6, 7].map((row) => (
              <div key={row} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                <div className="col-span-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted/80 rounded" />
                  </div>
                </div>
                <div className="col-span-3 flex gap-1">
                  <div className="h-5 w-16 bg-muted/80 rounded" />
                  <div className="h-5 w-14 bg-muted/80 rounded" />
                </div>
                <div className="col-span-4 grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((c) => (
                    <div key={c} className="h-5 bg-muted/80 rounded" />
                  ))}
                </div>
                <div className="col-span-2">
                  <div className="h-8 w-20 bg-muted/80 rounded ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
