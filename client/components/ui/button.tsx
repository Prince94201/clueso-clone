import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-sm font-medium",
    "transition-[transform,box-shadow,background-color,color,border-color,opacity] duration-200",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "aria-invalid:ring-destructive/25 dark:aria-invalid:ring-destructive/35 aria-invalid:border-destructive",
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/92 hover:shadow-md hover:shadow-primary/25",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/92 hover:shadow-md hover:shadow-destructive/20 focus-visible:ring-destructive/30 dark:bg-destructive/70",
        outline:
          "border border-border/70 bg-background/60 backdrop-blur-sm shadow-sm hover:bg-accent/60 hover:text-accent-foreground hover:border-border",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/85 hover:shadow-md",
        ghost:
          "bg-transparent hover:bg-accent/60 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        gradient:
          "text-primary-foreground bg-gradient-to-r from-primary via-primary to-accent shadow-sm hover:shadow-md hover:shadow-primary/25",
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  )
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={props.disabled ?? loading}
      aria-busy={loading ? true : undefined}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="opacity-90" />
          <span className="sr-only">Loading</span>
        </>
      ) : null}
      {props.children}
    </Comp>
  )
}

export { Button, buttonVariants }
