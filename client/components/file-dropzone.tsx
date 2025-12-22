"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  selectedFile?: File | null
  maxSize?: number // in MB
  accept?: string
  disabled?: boolean
}

export function FileDropzone({
  onFileSelect,
  selectedFile,
  maxSize = 500,
  accept = "video/mp4,video/webm,video/quicktime",
  disabled = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback(
    (file: File) => {
      setError(null)

      // Check file type
      const acceptedTypes = accept.split(",").map((t) => t.trim())
      const fileType = file.type
      const isValidType = acceptedTypes.some((type) => {
        if (type.endsWith("/*")) {
          return fileType.startsWith(type.replace("/*", ""))
        }
        return fileType === type
      })

      if (!isValidType) {
        setError("Invalid file type. Please upload a video file (MP4, WebM, or MOV)")
        return false
      }

      // Check file size
      const maxSizeBytes = maxSize * 1024 * 1024
      if (file.size > maxSizeBytes) {
        setError(`File size must be less than ${maxSize}MB`)
        return false
      }

      return true
    },
    [accept, maxSize],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0 && validateFile(files[0])) {
        onFileSelect(files[0])
      }
    },
    [disabled, onFileSelect, validateFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0 && validateFile(files[0])) {
        onFileSelect(files[0])
      }
    },
    [onFileSelect, validateFile],
  )

  const clearFile = useCallback(() => {
    setError(null)
    onFileSelect(null as any)
  }, [onFileSelect])

  return (
    <div className="w-full">
      {selectedFile ? (
        <div className="border-2 border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-3 rounded-lg">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              onClick={clearFile}
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
            isDragging ? "border-primary bg-primary/5" : "border-border",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-muted p-4 rounded-full">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">
                  <span className="text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="text-sm text-muted-foreground mt-1">MP4, WebM or MOV (max {maxSize}MB)</p>
              </div>
            </div>
            <input
              id="file-upload"
              type="file"
              accept={accept}
              onChange={handleFileInput}
              disabled={disabled}
              className="hidden"
            />
          </label>
        </div>
      )}
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  )
}
