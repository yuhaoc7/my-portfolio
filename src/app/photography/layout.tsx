import DotGrid from "@/components/DotGrid";

export default function PhotographyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Full-screen DotGrid background, scoped to the photography page */}
      <div className="fixed inset-0 w-full h-full z-0">
        <DotGrid
          dotSize={8}
          gap={12}
          baseColor="var(--dot-grid-base)"
          activeColor="var(--color-2)"
          proximity={120}
          shockRadius={150}
          shockStrength={5}
          resistance={750}
          returnDuration={1.5}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </>
  );
}
