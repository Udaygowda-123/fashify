import { Skeleton } from "@/components/ui/Skeleton";

export default function ProductLoading() {
  return (
    <div
      role="status"
      aria-label="Loading this piece"
      className="mx-auto max-w-[1600px] md:pad-x"
    >
      <div className="pad-x pt-6 md:px-0 md:pt-10">
        <Skeleton className="h-3 w-20" />
      </div>

      <div className="mt-6 md:mt-10 md:grid md:grid-cols-12 md:gap-x-10 xl:gap-x-16">
        <div className="md:col-span-7">
          <Skeleton className="aspect-3/4 w-full" />
          <Skeleton className="mt-5 hidden aspect-3/4 w-full md:block" />
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <div className="pad-x pt-8 pb-16 md:px-0 md:pt-0">
            <Skeleton className="h-8 w-3/5 md:h-9" />
            <Skeleton className="mt-4 h-4 w-24" />
            <Skeleton className="mt-6 h-4 w-full max-w-[46ch]" />
            <Skeleton className="mt-2 h-4 w-4/5 max-w-[38ch]" />

            <Skeleton className="mt-9 h-3 w-24" />
            <div className="mt-3 flex gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-7 w-7" />
              ))}
            </div>

            <Skeleton className="mt-8 h-3 w-12" />
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-14" />
              ))}
            </div>

            <Skeleton className="mt-8 h-11 w-32" />
            <Skeleton className="mt-8 h-12 w-full" />

            <div className="mt-10 flex flex-col gap-px">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
