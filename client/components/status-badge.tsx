import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Video } from "@/types"

interface StatusBadgeProps {
  status: Video["status"]
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    uploaded: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    processing: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
  }

  const labels = {
    uploaded: "Uploaded",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
  }

  return (
    <Badge variant="outline" className={cn("capitalize", variants[status])}>
      {labels[status]}
    </Badge>
  )
}
