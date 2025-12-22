import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Play, Zap, Share2, FileText } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <Play className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">VideoAI</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance">
            Transform your videos with AI-powered tools
          </h1>
          <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
            Upload, transcribe, enhance, and share your video content with cutting-edge AI technology. Build better
            narratives faster.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/register">
              <Button size="lg" className="text-base">
                Start building
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-base bg-transparent">
                View demos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 border-t border-border">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="bg-primary/10 text-primary p-3 rounded-lg w-fit">
              <Play className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold">Smart Upload</h3>
            <p className="text-muted-foreground leading-relaxed">
              Upload and process videos with automatic metadata extraction and thumbnail generation.
            </p>
          </div>
          <div className="space-y-3">
            <div className="bg-primary/10 text-primary p-3 rounded-lg w-fit">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold">AI Processing</h3>
            <p className="text-muted-foreground leading-relaxed">
              Transcribe audio, improve scripts, generate professional voiceovers, and auto-generate docs with AI.
            </p>
          </div>
          <div className="space-y-3">
            <div className="bg-primary/10 text-primary p-3 rounded-lg w-fit">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold">Documentation</h3>
            <p className="text-muted-foreground leading-relaxed">
              Automatically generate comprehensive documentation from your video content.
            </p>
          </div>
          <div className="space-y-3">
            <div className="bg-primary/10 text-primary p-3 rounded-lg w-fit">
              <Share2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold">Easy Sharing</h3>
            <p className="text-muted-foreground leading-relaxed">
              Share your processed videos with secure tokens and public viewer links.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
