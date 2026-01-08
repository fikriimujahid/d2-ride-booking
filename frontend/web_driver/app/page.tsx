import { Header } from "@/components/header"
import Link from "next/link"
import { CheckCircle, Zap, BarChart3, Shield } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background">
      <Header />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance">
            Earn More with Every Ride
          </h1>
          <p className="text-xl text-secondary mb-8 max-w-2xl mx-auto text-balance">
            Join RideHub today and start earning flexible income on your own schedule. Set your own hours, work when you
            want, and keep more of what you earn.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-primary text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary-dark transition-colors inline-block"
            >
              Become a Driver
            </Link>
            <Link
              href="/login"
              className="border border-border text-foreground px-8 py-4 rounded-lg font-semibold hover:bg-border transition-colors inline-block"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-card border-t border-b border-border py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-foreground mb-16 text-center">Why Join RideHub?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-start">
              <Zap className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Flexible Schedule</h3>
              <p className="text-secondary">Work whenever you want. Be your own boss and control your hours.</p>
            </div>
            <div className="flex flex-col items-start">
              <BarChart3 className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Earn More</h3>
              <p className="text-secondary">Get competitive rates and bonuses. Maximize your earnings potential.</p>
            </div>
            <div className="flex flex-col items-start">
              <Shield className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Safe & Secure</h3>
              <p className="text-secondary">Top-tier safety features and support. We protect our drivers.</p>
            </div>
            <div className="flex flex-col items-start">
              <CheckCircle className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Easy to Use</h3>
              <p className="text-secondary">Intuitive app and dashboard. Get started in just a few minutes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-4xl font-bold text-primary mb-2">50K+</p>
            <p className="text-secondary">Active Drivers</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary mb-2">2M+</p>
            <p className="text-secondary">Rides Completed</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary mb-2">$500M+</p>
            <p className="text-secondary">Earned by Drivers</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary mb-2">4.8★</p>
            <p className="text-secondary">Average Rating</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-secondary text-sm">
          <p>&copy; 2026 RideHub. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
