"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileDropzone } from "@/components/file-dropzone"
import { useToast } from "@/hooks/use-toast"
import apiClient from "@/lib/axios"
import { ArrowLeft, CircleDot } from "lucide-react"
import Link from "next/link"
import { RecordDialog } from "@/components/record-dialog"

export default function UploadVideoPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [recordOpen, setRecordOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast({
        title: "Error",
        description: "Please select a video file",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append("video", file)
      formData.append("title", title)
      formData.append("description", description)

      const { data } = await apiClient.post("/api/videos", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(progress)
          }
        },
      })

      toast({
        title: "Success",
        description: "Video uploaded successfully",
      })

      router.push(`/videos/${data.id}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to upload video",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/videos">
          <Button variant="ghost" className="gap-2 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Library
          </Button>
        </Link>
        <PageHeader title="Upload Video" description="Upload a new video to your library" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Video Details</CardTitle>
          <CardDescription>Provide information about your video</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="file">Video File</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => setRecordOpen(true)}
                  disabled={isUploading}
                >
                  <CircleDot className="h-4 w-4" />
                  Record instead
                </Button>
              </div>

              <FileDropzone onFileSelect={setFile} selectedFile={file} disabled={isUploading} />
              <p className="text-xs text-muted-foreground">
                You can <span className="font-medium">Click to upload</span> / drag & drop, or <span className="font-medium">Record</span> a new video.
              </p>
            </div>

            <RecordDialog
              open={recordOpen}
              onOpenChange={setRecordOpen}
              onUploaded={(id) => router.push(`/videos/${id}`)}
            />

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter video title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter video description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                disabled={isUploading}
              />
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploading...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={!file || isUploading} className="flex-1">
                {isUploading ? "Uploading..." : "Upload Video"}
              </Button>
              <Link href="/videos" className="flex-1">
                <Button type="button" variant="outline" className="w-full bg-transparent" disabled={isUploading}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
