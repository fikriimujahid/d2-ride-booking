import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { LiveDashboard } from "../modules/dashboard/LiveDashboard";
import { PassengersModule } from "../modules/passengers/PassengersModule";
import { DriversModule } from "../modules/drivers/DriversModule";
import { DisputesModule } from "../modules/disputes/DisputesModule";
import { PricingModule } from "../modules/pricing/PricingModule";
import { AnalyticsModule } from "../modules/analytics/AnalyticsModule";
import { FraudModule } from "../modules/fraud/FraudModule";
import { SettingsModule } from "../modules/settings/SettingsModule";
import { AdminsModule } from "../modules/AdminsModule";

/**
 * AdminShell extraction
 *
 * This exists to keep App.tsx focused on routing/auth flow.
 * The actual admin layout (Sidebar + Header + active module) stays the same.
 */

const moduleConfig = {
  dashboard: {
    title: "Live Operations",
    subtitle: "Real-time ride monitoring and system overview",
    component: LiveDashboard,
  },
  passengers: {
    title: "Passenger Management",
    subtitle: "Manage and monitor all registered passengers",
    component: PassengersModule,
  },
  drivers: {
    title: "Driver Management",
    subtitle: "Manage and monitor all registered drivers",
    component: DriversModule,
  },
  disputes: {
    title: "Dispute Resolution",
    subtitle: "Handle and resolve ride disputes",
    component: DisputesModule,
  },
  pricing: {
    title: "Pricing & Promotions",
    subtitle: "Configure pricing rules and promotional campaigns",
    component: PricingModule,
  },
  analytics: {
    title: "Analytics & Reports",
    subtitle: "Performance metrics and business intelligence",
    component: AnalyticsModule,
  },
  fraud: {
    title: "Fraud Detection & Audit",
    subtitle: "Security monitoring and administrative logs",
    component: FraudModule,
  },
  admins: {
    title: "Admin Management",
    subtitle: "Manage administrators, roles, and permissions",
    component: AdminsModule,
  },
  settings: {
    title: "System Settings",
    subtitle: "Configure platform settings and permissions",
    component: SettingsModule,
  },
};

/**
 * Authenticated Admin Shell
 *
 * This renders the existing dashboard layout (Sidebar + Header + active module).
 * It is only reachable when:
 * - user is authenticated as ADMIN
 * - MFA is satisfied (guarded by Router)
 */
export function AdminShell(props: {
  module: string;
  onModuleChange: (module: string) => void;
  onLogout: () => void;
}) {
  const activeModule = (props.module || "dashboard") as keyof typeof moduleConfig;
  const currentModule = moduleConfig[activeModule] ?? moduleConfig.dashboard;
  const ModuleComponent = currentModule.component;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={props.onModuleChange}
        onLogout={props.onLogout}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={currentModule.title} subtitle={currentModule.subtitle} />

        <main className="flex-1 overflow-y-auto p-8">
          <ModuleComponent />
        </main>
      </div>
    </div>
  );
}
