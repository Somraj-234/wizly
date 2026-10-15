import * as Dialog from "@radix-ui/react-dialog"
import * as Label from "@radix-ui/react-label"
import * as Slider from "@radix-ui/react-slider"
import * as Switch from "@radix-ui/react-switch"
import * as Tabs from "@radix-ui/react-tabs"
import * as Tooltip from "@radix-ui/react-tooltip"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react"
import { cn } from "../lib/utils"

const buttonStyles = cva(
  "pressable inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-card",
        ghost: "bg-transparent",
        destructive: "bg-destructive text-white",
      },
      size: {
        default: "h-9",
        sm: "h-8 px-2.5 text-xs",
        icon: "size-9 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonStyles({ variant, size }), className)} {...props} />
}

export function Card({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return <section className={cn("rounded-lg border border-border bg-card text-card-foreground", className)} style={style}>{children}</section>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <Label.Root className="text-muted-foreground">{label}</Label.Root>
      {children}
    </div>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 rounded-md border border-input bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-ring focus:ring-2 focus:ring-ring/30",
        props.className,
      )}
    />
  )
}

export function Range({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  label,
}: {
  value: number
  min: number
  max: number
  step?: number
  onValueChange: (value: number) => void
  label: string
}) {
  return (
    <div className="grid gap-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <Slider.Root
        className="relative flex h-5 touch-none items-center"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onValueChange(next[0] ?? min)}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-secondary">
          <Slider.Range className="absolute h-full rounded-full bg-primary" />
        </Slider.Track>
        <Slider.Thumb className="block size-4 rounded-full border border-border bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </Slider.Root>
    </div>
  )
}

export function Toggle({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (value: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-10 rounded-full bg-secondary transition-colors duration-150 data-[state=checked]:bg-primary"
      >
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-card transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>
    </div>
  )
}

export function PanelTabs({
  value,
  onValueChange,
  tabs,
}: {
  value: string
  onValueChange: (value: string) => void
  tabs: { id: string; label: string; body: ReactNode }[]
}) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <Tabs.List className="mb-4 flex gap-1 rounded-lg bg-secondary p-1">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.id}
            value={tab.id}
            className="flex-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content key={tab.id} value={tab.id} className="outline-none">
          {tab.body}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}

export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(420px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-lg outline-none">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="origin-[var(--radix-tooltip-content-transform-origin)] rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delayDuration={400}>{children}</Tooltip.Provider>
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground", className)}>{children}</span>
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>
}
