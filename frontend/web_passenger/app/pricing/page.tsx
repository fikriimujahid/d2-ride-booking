import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import { rideOptions } from "@/lib/mock-data"

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">Simple, transparent pricing</h1>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Choose the ride option that best fits your needs. All prices include taxes and fees.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {rideOptions.map((option) => (
            <Card key={option.id} className={option.id === "economy" ? "border-accent" : ""}>
              <CardHeader>
                <div className="mb-2 text-4xl">{option.icon}</div>
                <CardTitle>{option.name}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${(5 * option.priceMultiplier).toFixed(2)}</span>
                    <span className="text-muted-foreground">base fare</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    + ${(2.5 * option.priceMultiplier).toFixed(2)}/mile
                  </div>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <span className="text-sm">Up to {option.capacity} passengers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <span className="text-sm">Estimated arrival: {option.estimatedTime}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <span className="text-sm">Real-time tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <span className="text-sm">24/7 support</span>
                  </li>
                </ul>
                <Link href="/app/book" className="mt-6 block">
                  <Button className="w-full" variant={option.id === "economy" ? "default" : "outline"}>
                    Book {option.name}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-12 bg-muted/50">
          <CardHeader>
            <CardTitle>How pricing works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Base fare:</strong> The initial cost when you enter the vehicle.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Per mile:</strong> Cost for each mile traveled during your trip.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Upfront pricing:</strong> You&apos;ll see the total estimated cost before
              you book. The final price may vary slightly based on the actual route taken.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">No hidden fees:</strong> What you see is what you pay. All taxes and
              service fees are included in the displayed price.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
