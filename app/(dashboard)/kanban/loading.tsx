import { Skeleton } from "@/components/ui/skeleton";

export default function KanbanLoading() {
  return (
    <>
      <div className="px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      <div className="flex gap-4 overflow-hidden px-4 pb-4 lg:px-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-muted/40 flex h-[400px] w-80 shrink-0 flex-col rounded-lg border"
          >
            <div className="flex items-center justify-between border-b p-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-8 rounded-full" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
