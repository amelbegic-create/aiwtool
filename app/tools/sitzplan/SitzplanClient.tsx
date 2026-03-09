"use client";

import { Map } from "lucide-react";

interface SitzplanClientProps {
  sitzplanPdfUrl: string | null;
  restaurantName: string;
}

/** PDF koristi cijeli prostor ispod top navigacije (samo top nav vidljiv). Layout već ima pt-16. */
export default function SitzplanClient({ sitzplanPdfUrl, restaurantName }: SitzplanClientProps) {
  return (
    <div className="w-full h-[calc(100vh-4rem)] min-h-[calc(100vh-4rem)] bg-muted/30 -mt-14 md:-mt-16">
      {sitzplanPdfUrl ? (
        <iframe
          src={sitzplanPdfUrl}
          className="w-full h-full border-0 block"
          title={`Sitzplan – ${restaurantName}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-center px-4 h-full">
          <Map size={48} className="text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground font-medium">
            Für dieses Restaurant wurde noch kein Sitzplan hinterlegt.
          </p>
          <p className="text-sm text-muted-foreground/80 mt-2">
            Bitte wenden Sie sich an Ihren Administrator.
          </p>
        </div>
      )}
    </div>
  );
}
