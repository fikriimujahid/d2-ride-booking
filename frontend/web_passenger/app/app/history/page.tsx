import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Calendar, Star } from "lucide-react"
import { mockRides } from "@/lib/mock-data"

export default function HistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold">Ride History</h1>

        {mockRides.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No rides yet. Book your first ride to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {mockRides.map((ride) => (
              <Card key={ride.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      {/* Trip Route */}
                      <div className="mb-4 space-y-3">
                        <div className="flex gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                            <div className="h-2 w-2 rounded-full bg-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Pickup</p>
                            <p className="text-sm text-muted-foreground">{ride.pickup}</p>
                          </div>
                        </div>
                        <div className="ml-3 h-4 w-0.5 bg-border" />
                        <div className="flex gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent">
                            <MapPin className="h-3 w-3 text-accent-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Destination</p>
                            <p className="text-sm text-muted-foreground">{ride.destination}</p>
                          </div>
                        </div>
                      </div>

                      {/* Ride Info */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(ride.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <Badge variant="secondary">{ride.rideType}</Badge>
                        <Badge
                          variant={
                            ride.status === "completed"
                              ? "default"
                              : ride.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {ride.status}
                        </Badge>
                      </div>

                      {/* Driver Info */}
                      {ride.driverName && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Driver:</span>
                          <span className="font-medium">{ride.driverName}</span>
                          {ride.driverRating && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {ride.driverRating}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <div className="text-2xl font-bold">${ride.price.toFixed(2)}</div>
                      <p className="text-sm text-muted-foreground">Total fare</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="p-6">
            <h2 className="mb-4 font-semibold">Summary</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-2xl font-bold">{mockRides.length}</p>
                <p className="text-sm text-muted-foreground">Total rides</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{mockRides.filter((r) => r.status === "completed").length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${mockRides.reduce((sum, ride) => sum + (ride.status === "completed" ? ride.price : 0), 0).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Total spent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
