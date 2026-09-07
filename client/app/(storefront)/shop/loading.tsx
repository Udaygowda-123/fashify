import { ProductGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-[1600px] pad-x pb-section">
      <header className="pt-8 md:pt-14">
        <Skeleton className="h-10 w-56 md:h-14 md:w-72" />
        <Skeleton className="mt-5 h-4 w-full max-w-[52ch]" />
        <Skeleton className="mt-2 h-4 w-2/3 max-w-[38ch]" />
      </header>

      <div className="mt-8 md:mt-14 md:grid md:grid-cols-12 md:gap-x-10 xl:gap-x-16">
        <div className="hidden md:col-span-3 md:block">
          <Skeleton className="h-3 w-20" />
          <div className="mt-6 flex flex-col gap-6">
            {Array.from({ length: 4 }).map((_, group) => (
              <div key={group} className="border-t border-rule pt-5">
                <Skeleton className="h-3 w-16" />
                <div className="mt-4 flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, row) => (
                    <Skeleton key={row} className="h-3.5 w-3/4" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-9">
          <ProductGridSkeleton />
        </div>
      </div>
    </div>
  );
}
