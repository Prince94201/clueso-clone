"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Loader2, FileText, Wand2, Mic, FileCode } from "lucide-react"
import apiClient from "@/lib/axios"
import { useToast } from "@/hooks/use-toast"

interface ActionButtonsProps {
  videoId: string
  hasTranscript?: boolean
  onSuccess?: () => void
}

export function ActionButtons({ videoId, hasTranscript, onSuccess }: ActionButtonsProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState("alloy")

  const ensureTranscript = async (opts?: { silent?: boolean }) => {
    if (hasTranscript) return true
    try {
      const { data } = await apiClient.post(`/api/ai/videos/${videoId}/transcribe`)
      if (!opts?.silent && data?.mode === "visual") {
        toast({
          title: "No audio detected",
          description: "This is a non-voice video. We generated a visual summary to use as the transcript.",
        })
      }
      onSuccess?.()
      return true
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || error.response?.data?.error || "Failed to generate transcript",
        variant: "destructive",
      })
      return false
    }
  }

  const handleAction = async (action: string, endpoint: string, body?: any) => {
    setIsLoading(action)
    try {
      const { data } = await apiClient.post(endpoint, body)

      if (action === "Transcribe" && data?.mode === "visual") {
        toast({
          title: "No audio detected",
          description: "This is a non-voice video. No audio transcription is available for it.",
        })
      }
      toast({
        title: "Success",
        description: `${action} completed successfully`,
      })
      onSuccess?.()
    } catch (error: any) {
      const status = error.response?.status
      if (status === 429) {
        toast({
          title: "AI quota exceeded",
          description: "Your OpenAI credits/quota are exhausted. Add credits or switch providers.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: error.response?.data?.message || error.response?.data?.error || `Failed to ${action.toLowerCase()}`,
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(null)
    }
  }

  const handleVoiceoverSubmit = () => {
    ; (async () => {
      const ok = await ensureTranscript({ silent: true })
      if (!ok) return
      await handleAction("Generate Voiceover", `/api/ai/videos/${videoId}/generate-voice`, {
        voice: selectedVoice,
        source: 'transcript',
      })
    })()
    setVoiceDialogOpen(false)
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => handleAction("Transcribe", `/api/ai/videos/${videoId}/transcribe`)}
          disabled={!!isLoading}
          className="gap-2"
        >
          {isLoading === "Transcribe" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Transcribe & Summarize
        </Button>

        <Button
          onClick={() => {
            ; (async () => {
              const ok = await ensureTranscript({ silent: true })
              if (!ok) return
              await handleAction("Generate AI Script", `/api/ai/videos/${videoId}/improve-script`)
            })()
          }}
          disabled={!!isLoading}
          variant="outline"
          className="gap-2"
        >
          {isLoading === "Generate AI Script" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Generate AI Script
        </Button>

        <Button
          onClick={() => {
            ; (async () => {
              const ok = await ensureTranscript({ silent: true })
              if (!ok) return
              setVoiceDialogOpen(true)
            })()
          }}
          disabled={!!isLoading}
          variant="outline"
          className="gap-2"
        >
          {isLoading === "Generate Voiceover" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          Generate Voiceover
        </Button>

        {/* Removed Generate Docs/Summary button as Transcribe does it now */}
      </div>

      {/* Voice Selection Dialog */}
      <Dialog open={voiceDialogOpen} onOpenChange={setVoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Voiceover</DialogTitle>
            <DialogDescription>Choose a source text and voice model.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="voice">Voice Type</Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger id="voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="fable">Fable</SelectItem>
                  <SelectItem value="onyx">Onyx</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="shimmer">Shimmer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleVoiceoverSubmit} className="flex-1">
              Generate
            </Button>
            <Button variant="outline" onClick={() => setVoiceDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
