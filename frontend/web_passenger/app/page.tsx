import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Clock, Shield, DollarSign } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">Get there with RideGo</h1>
          <p className="mt-6 text-pretty text-lg text-muted-foreground md:text-xl">
            Request a ride, hop in, and go. Choose from a range of ride options to suit your needs, all at the tap of a
            button.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/app/book">
              <Button size="lg" className="w-full sm:w-auto">
                Book a Ride
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-t bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-balance text-center text-3xl font-bold md:text-4xl">How it works</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Enter your destination</h3>
                <p className="text-muted-foreground">
                  Open the app and enter your pickup location and where you want to go.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Choose your ride</h3>
                <p className="text-muted-foreground">
                  Select from Economy, Premium, or XL options based on your needs and budget.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">Enjoy your ride</h3>
                <p className="text-muted-foreground">
                  Track your driver in real-time and enjoy a safe, comfortable ride to your destination.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-balance text-center text-3xl font-bold md:text-4xl">Why choose RideGo</h2>
          <div className="mt-12 grid gap-12 md:grid-cols-2">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold">Affordable pricing</h3>
                <p className="text-muted-foreground">
                  Transparent pricing with no hidden fees. See the cost before you book and pay securely through the
                  app.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold">Safe and reliable</h3>
                <p className="text-muted-foreground">
                  All drivers are background-checked and highly rated. Track your ride in real-time and share your ETA.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold">Always available</h3>
                <p className="text-muted-foreground">
                  Request a ride anytime, anywhere. Drivers are available 24/7 to get you where you need to go.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold">Easy to use</h3>
                <p className="text-muted-foreground">
                  Simple interface that makes booking a ride quick and effortless. Get from A to B with just a few taps.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-accent py-20 text-accent-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-balance text-3xl font-bold md:text-4xl">Ready to ride?</h2>
          <p className="mt-4 text-pretty text-lg opacity-90">
            Join thousands of riders who trust RideGo for their daily commute.
          </p>
          <Link href="/app/book">
            <Button size="lg" variant="secondary" className="mt-8">
              Book Your First Ride
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h4 className="mb-4 font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>About Us</li>
                <li>Careers</li>
                <li>Press</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Products</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Ride</li>
                <li>Drive</li>
                <li>Business</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Help Center</li>
                <li>Safety</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Terms of Service</li>
                <li>Privacy Policy</li>
                <li>Accessibility</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            © 2026 RideGo. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
