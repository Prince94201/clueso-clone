"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useVideo } from "@/hooks/use-video"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { StatusBadge } from "@/components/status-badge"
import { ActionButtons } from "@/components/action-buttons"
import { useToast } from "@/hooks/use-toast"
import apiClient from "@/lib/axios"
import { ArrowLeft, Share2, Trash2, Copy, ExternalLink, FileText, ScrollText, Mic, Video as VideoIcon } from "lucide-react"

export default function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { video, isLoading, mutate } = useVideo(id)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this video?")) return
    setIsDeleting(true)
    try {
      await apiClient.delete(`/api/videos/${id}`)
      toast({ title: "Success", description: "Video deleted successfully" })
      router.push("/videos")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete video",
        variant: "destructive",
      })
      setIsDeleting(false)
    }
  }

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const { data } = await apiClient.post(`/api/videos/${id}/share`)
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/share/${data.token}`
      setShareUrl(url)
      toast({ title: "Success", description: "Share link generated" })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to generate share link",
        variant: "destructive",
      })
    } finally {
      setIsSharing(false)
    }
  }

  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      toast({ title: "Copied", description: "Share URL copied to clipboard" })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!video) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Video not found</h2>
        <Link href="/videos"><Button>Back to Library</Button></Link>
      </div>
    )
  }

  const videoUrl = `${process.env.NEXT_PUBLIC_API_URL}${video.filepath}`

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col gap-4 w-full p-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between shrink-0 bg-card p-3 rounded-lg border shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/videos">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold truncate max-w-[300px]">{video.title}</h1>
            <StatusBadge status={video.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {shareUrl ? (
            <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md mr-2">
              <span className="text-xs font-mono truncate max-w-[150px]">{shareUrl}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyShareUrl}><Copy className="h-3 w-3" /></Button>
            </div>
          ) : null}
          <Button onClick={handleShare} disabled={isSharing} variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button onClick={handleDelete} disabled={isDeleting} variant="destructive" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border shadow-sm overflow-hidden bg-background">

        {/* LEFT: Video Player & Voiceover */}
        <ResizablePanel defaultSize={70} minSize={50}>
          <div className="h-full flex flex-col bg-black/95 relative group">
            <div className="flex-1 overflow-hidden bg-black">
              <video src={videoUrl} controls className="w-full h-full" poster={video.thumbnail ? `${process.env.NEXT_PUBLIC_API_URL}${video.thumbnail}` : undefined}>
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="bg-card border-t p-4 shrink-0 space-y-4">
              <div className="flex flex-col items-center gap-4">
                {/* Centralized Action Buttons */}
                <ActionButtons videoId={video.id} hasTranscript={!!video.transcript?.original_transcript} onSuccess={mutate} />

                {/* Voiceover Player (Below Video) */}
                {video.voiceover?.filepath && (
                  <div className="w-full max-w-2xl bg-muted/30 rounded-lg p-3 border flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Mic className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">AI Voiceover</p>
                        <span className="text-xs text-muted-foreground capitalize">{video.voiceover.voice_type}</span>
                      </div>
                      <audio src={`${process.env.NEXT_PUBLIC_API_URL}${video.voiceover.filepath}`} controls className="w-full h-8" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* RIGHT: AI Content (Summary/Script) */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50} className="bg-muted/10">
          <Tabs defaultValue="transcript" className="h-full flex flex-col">
            <div className="border-b bg-card">
              <TabsList className="w-full justify-start rounded-none bg-transparent p-0 h-10">
                <TabsTrigger value="transcript" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-muted/20">
                  <FileText className="h-4 w-4 mr-2" /> AI Summary
                </TabsTrigger>
                <TabsTrigger value="script" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-muted/20">
                  <ScrollText className="h-4 w-4 mr-2" /> AI Script
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Summary Tab */}
            <TabsContent value="transcript" className="flex-1 overflow-y-auto p-4 m-0 data-[state=inactive]:hidden">
              {video.transcript?.original_transcript ? (
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                  <p className="whitespace-pre-wrap">{video.transcript.original_transcript}</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                  <FileText className="h-12 w-12 mb-2 opacity-20" />
                  <p className="text-sm">No summary generated.</p>
                  <p className="text-xs opacity-70 mt-1">Click "Transcribe & Summarize"</p>
                </div>
              )}
            </TabsContent>

            {/* Script Tab */}
            <TabsContent value="script" className="flex-1 overflow-y-auto p-4 m-0 data-[state=inactive]:hidden">
              {video.transcript?.improved_script ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground bg-blue-500/10 text-blue-500 px-2 py-1 rounded w-fit">Voiceover Script</p>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                    {video.transcript.improved_script}
                  </pre>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                  <ScrollText className="h-12 w-12 mb-2 opacity-20" />
                  <p className="text-sm">No script available.</p>
                  <p className="text-xs opacity-70 mt-1">Generate AI Script to see it here.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  )
}
