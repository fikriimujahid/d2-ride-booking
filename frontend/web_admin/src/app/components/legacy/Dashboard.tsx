import { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  DollarSign, 
  BarChart3, 
  Shield, 
  FileText,
  Menu,
  X,
  Bell,
  Search,
  LogOut,
  Settings,
  ChevronDown
} from 'lucide-react';
import LiveOperations from './LiveOperations';
import PassengerManagement from './PassengerManagement';
import DriverManagement from './DriverManagement';
import RideMonitoring from './RideMonitoring';
import PricingManagement from './PricingManagement';
import Analytics from './Analytics';
import FraudDetection from './FraudDetection';
import AuditLogs from './AuditLogs';

type Page = 'operations' | 'passengers' | 'drivers' | 'rides' | 'pricing' | 'analytics' | 'fraud' | 'audit';

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState<Page>('operations');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'operations' as Page, label: 'Live Operations', icon: LayoutDashboard },
    { id: 'passengers' as Page, label: 'Passengers', icon: Users },
    { id: 'drivers' as Page, label: 'Drivers', icon: Car },
    { id: 'rides' as Page, label: 'Ride Monitoring', icon: FileText },
    { id: 'pricing' as Page, label: 'Pricing & Promos', icon: DollarSign },
    { id: 'analytics' as Page, label: 'Analytics', icon: BarChart3 },
    { id: 'fraud' as Page, label: 'Fraud Detection', icon: Shield },
    { id: 'audit' as Page, label: 'Audit Logs', icon: FileText },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'operations':
        return <LiveOperations />;
      case 'passengers':
        return <PassengerManagement />;
      case 'drivers':
        return <DriverManagement />;
      case 'rides':
        return <RideMonitoring />;
      case 'pricing':
        return <PricingManagement />;
      case 'analytics':
        return <Analytics />;
      case 'fraud':
        return <FraudDetection />;
      case 'audit':
        return <AuditLogs />;
      default:
        return <LiveOperations />;
    }
  };

  return (
    <div className="h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            {sidebarOpen && <span className="text-xl">RideBooking</span>}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-lg transition"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-left">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-3 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition">
            <Settings className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <h1>
                {menuItems.find(item => item.id === currentPage)?.label}
              </h1>
              <div className="ml-8 flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative p-2 hover:bg-slate-100 rounded-lg transition">
                <Bell className="w-5 h-5 text-slate-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white">A</span>
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm">Admin User</p>
                    <p className="text-xs text-slate-500">Super Admin</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              </div>
              
              <button className="p-2 hover:bg-slate-100 rounded-lg transition">
                <LogOut className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
